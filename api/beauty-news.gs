// ============================================================
//  Beauty News — Claude AI Analysis
//  Model: claude-sonnet-4-6  (change BN_CLAUDE_MODEL to swap)
//
//  Script Properties required:
//    ANTHROPIC_API_KEY  — Anthropic API key
//    RECIPIENT_EMAILS   — comma-separated addresses (optional)
//    SENDER_EMAIL       — Outlook from address (optional)
//
//  Source strategy: direct RSS from beauty publications & trade press.
//  No Google News RSS — feeds come straight from the magazines/sites
//  so articles include editorial content, not just news wire pickups.
//
//  Date window (strict — enforced at fetch AND in Claude prompt):
//    windowEnd   = yesterday at 23:59 (last complete day)
//    windowStart = yesterday minus 6 days at 00:00 (7-day total window)
// ============================================================

const BN_CLAUDE_MODEL    = 'claude-sonnet-4-6';
const BN_CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const BN_CLAUDE_VERSION  = '2023-06-01';
const BN_MAX_TOKENS      = 6000;
const BN_MAX_PER_SOURCE  = 12; // articles to read per publication feed

// ── Publication RSS feeds ─────────────────────────────────────
// Mix of trade press + consumer magazines for broad coverage.
// If a feed URL changes or blocks GAS, the source is skipped gracefully.
const BN_SOURCES = [
  // Trade / industry
  { name: 'WWD',                url: 'https://wwd.com/beauty-industry-news/feed/' },
  { name: 'Beauty Independent', url: 'https://www.beautyindependent.com/feed/' },
  { name: 'BeautyMatter',       url: 'https://beautymatter.com/feed/' },
  { name: 'Glossy',             url: 'https://www.glossy.co/beauty/feed/' },
  // Beauty-focused magazines
  { name: 'Allure',             url: 'https://www.allure.com/feed/rss' },
  { name: 'Byrdie',             url: 'https://www.byrdie.com/rss' },
  // Fashion / lifestyle with strong beauty sections
  { name: 'Vogue',              url: 'https://www.vogue.com/feed/rss' },
  { name: "Harper's Bazaar",    url: 'https://www.harpersbazaar.com/rss/all.xml/' },
  { name: 'Elle',               url: 'https://www.elle.com/rss/beauty.xml/' },
  { name: 'Cosmopolitan',       url: 'https://www.cosmopolitan.com/rss/beauty.xml/' },
  { name: 'Refinery29',         url: 'https://www.refinery29.com/en-us/beauty.rss' },
  { name: 'Who What Wear',      url: 'https://www.whowhatwear.com/rss' },
  { name: 'The Zoe Report',     url: 'https://www.thezoereport.com/rss' },
  { name: 'InStyle',            url: 'https://www.instyle.com/rss' },
];

// Claude still organises output into these 5 fixed categories
const BN_CATEGORY_NAMES = ['스킨케어', '메이크업', '퍼스널케어', 'K-뷰티', '기타'];
const BN_CATEGORY_META  = {
  '스킨케어':  { emoji: '🧴' },
  '메이크업':  { emoji: '💋' },
  '퍼스널케어': { emoji: '🚿' },
  'K-뷰티':   { emoji: '🇰🇷' },
  '기타':     { emoji: '✨' },
};

// ── Script Properties ─────────────────────────────────────────
function _prop(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// ── Date utilities ────────────────────────────────────────────
function _bnFmt(d, fmt) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), fmt);
}
function _bnFmtKorean(d) { return _bnFmt(d, 'yyyy년 MM월 dd일'); }
function _bnFmtShort(d)  { return _bnFmt(d, 'MM월 dd일'); }
function _bnFmtIso(d)    { return _bnFmt(d, 'yyyy-MM-dd'); }

// ── Date window ───────────────────────────────────────────────
function _bnGetDateWindow() {
  const MS_DAY = 24 * 60 * 60 * 1000;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const windowEnd   = new Date(todayMidnight.getTime() - 1);           // yesterday 23:59:59.999
  const windowStart = new Date(todayMidnight.getTime() - 8 * MS_DAY);  // 8 days ago midnight
  windowStart.setHours(0, 0, 0, 0);
  return { windowStart, windowEnd };
}

// ── Fetch a single publication RSS feed ───────────────────────
// Handles both RSS 2.0 and basic Atom. Returns articles within window.
function _bnFetchSource(source, windowStart, windowEnd) {
  try {
    const res = UrlFetchApp.fetch(source.url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MiMuseBot/1.0)' },
    });
    if (res.getResponseCode() !== 200) return [];

    const xml  = res.getContentText();
    const doc  = XmlService.parse(xml);
    const root = doc.getRootElement();
    const ns   = root.getNamespace();

    // Determine feed type: RSS (<channel><item>) vs Atom (<feed><entry>)
    let items = [];
    try {
      const channel = root.getChild('channel');
      if (channel) {
        items = channel.getChildren('item');
      } else {
        // Atom
        items = root.getChildren('entry', ns);
      }
    } catch(e) { return []; }

    const out = [];
    for (const item of items.slice(0, BN_MAX_PER_SOURCE)) {
      // Date: RSS uses <pubDate>, Atom uses <published> or <updated>
      const pubStr = item.getChildText('pubDate')
        || item.getChildText('published')
        || item.getChildText('updated')
        || '';
      if (!pubStr) continue;
      const pubDate = new Date(pubStr);
      if (isNaN(pubDate.getTime())) continue;
      if (pubDate < windowStart || pubDate > windowEnd) continue; // strict window

      // Title
      const titleEl = item.getChild('title');
      const title   = (titleEl ? titleEl.getValue() : '').replace(/<[^>]+>/g, '').trim();
      if (!title) continue;

      // Link: RSS <link> text, Atom <link href="..."/>
      let link = item.getChildText('link') || '';
      if (!link) {
        const linkEl = item.getChild('link', ns);
        if (linkEl) link = linkEl.getAttribute('href') ? linkEl.getAttribute('href').getValue() : '';
      }

      // Description / summary
      const desc = (item.getChildText('description') || item.getChildText('summary') || '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

      out.push({ title, source: source.name, link, pubDate: _bnFmtIso(pubDate), desc });
    }
    return out;
  } catch(e) {
    Logger.log('Feed error [' + source.name + ']: ' + e.message);
    return [];
  }
}

// ── Deduplicate by title similarity ──────────────────────────
function _bnDedupe(articles) {
  const seen = [];
  return articles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (seen.includes(key)) return false;
    seen.push(key);
    return true;
  });
}

// ── Claude API call ───────────────────────────────────────────
function _bnClaude(system, user, maxTokens) {
  const key = _prop('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY missing in Script Properties');
  const res = UrlFetchApp.fetch(BN_CLAUDE_ENDPOINT, {
    method:      'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': BN_CLAUDE_VERSION },
    payload: JSON.stringify({
      model:      BN_CLAUDE_MODEL,
      max_tokens: maxTokens || BN_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error('Claude HTTP ' + code + ': ' + res.getContentText().slice(0, 300));
  return ((JSON.parse(res.getContentText()).content || [])[0] || {}).text || '';
}

// ── System prompt ─────────────────────────────────────────────
function _bnSystemPrompt() {
  return [
    'You are a beauty industry analyst producing a weekly beauty news briefing for a Korean beauty brand monitoring the North American market.',
    '',
    'Language rules (STRICT):',
    '  - All summaries and keyword explanations: Korean only (한국어)',
    '  - NO Chinese characters (漢字), NO Japanese kana',
    '  - English loanwords → Korean transliteration: 립스틱, 스킨케어, 세럼, 파운데이션, 틴트',
    '  - Brand / product / publication names: keep original English spelling',
    '  - Sentence endings: ~이다 / ~한다 / ~됐다 / ~보인다 — NEVER ~입니다 / ~합니다',
    '',
    'Output: respond with ONLY a valid JSON object. No prose, no markdown outside the JSON block.',
  ].join('\n');
}

// ── User prompt ───────────────────────────────────────────────
function _bnUserPrompt(articleBlocks, articleCount, ws, we) {
  return [
    '## Date window: ' + ws + ' ~ ' + we,
    'HARD CUTOFF — only articles with pubDate inside [' + ws + ', ' + we + '] are valid.',
    'Discard any article outside this range, no exceptions.',
    '',
    '## Articles (' + articleCount + ' total, already pre-filtered to within the date window)',
    articleBlocks,
    '',
    '## Instructions',
    '',
    '### 1 — Beauty relevance filter',
    'This feed includes content from general fashion/lifestyle magazines.',
    'First, discard any article that is NOT primarily about beauty (skincare, makeup, haircare,',
    'fragrance, bodycare, K-beauty, or beauty industry business/retail).',
    '',
    '### 2 — Trend-First Story Filter',
    'From the remaining beauty articles, select the 5 most trend-significant per category. Prioritize:',
    '  - Brand strategic pivot or major direction change',
    '  - Consumer behavior shift (what people are buying/avoiding/talking about)',
    '  - Retail or distribution channel change',
    '  - Marketing or campaign trend gaining traction',
    '  - Product category or ingredient rising or falling',
    '  Deprioritize: one-off launches with no broader signal, generic listicles, "best of" roundups.',
    '',
    '### 3 — Category assignment (NO duplicates across categories)',
    '  🧴 스킨케어  — NA brands: serums, moisturizers, sunscreen, cleansers, masks, ingredient trends',
    '  💋 메이크업  — NA brands: foundation, lipstick, mascara, eyeshadow, blush, nail, tools',
    '  🚿 퍼스널케어 — NA brands: haircare, bodycare, fragrance, oral care, deodorant',
    '  🇰🇷 K-뷰티   — ALL Korean brands (any product type) + K-beauty market / TikTok / retail phenomena',
    '    ⚠ ABSOLUTE RULE: Korean brand or K-beauty story → K-뷰티 ONLY. Never duplicate.',
    '  ✨ 기타     — wellness, ingestible beauty, devices, men\'s beauty, industry data & reports',
    '',
    '### 4 — Korean summary per article (2–4 sentences)',
    '  ① Which specific brand/product is shifting, going viral, or seeing major retail movement',
    '  ② Which consumer behavior, ingredient, or format is driving this',
    '  ③ Why this matters as a trend signal for the North American market',
    '',
    '### 5 — Trend keywords (3–5 hashtags)',
    '  BANNED (already mainstream): #GlassSkin #CleanBeauty #KBeauty #Minimalism #Glow',
    '  Target: concrete micro-trends like #SkinFlooding #BarrierFirstLayering #SlugSkin',
    '  Each keyword: 1–2 Korean sentences explaining the signal.',
    '',
    '### Output — return ONLY this JSON (all 5 categories required)',
    '```json',
    '{',
    '  "categories": [',
    '    {',
    '      "name": "스킨케어",',
    '      "emoji": "🧴",',
    '      "items": [',
    '        {',
    '          "articleId": 1,',
    '          "title": "Original English headline",',
    '          "source": "Publisher name",',
    '          "pubDate": "yyyy-MM-dd",',
    '          "summary": "Korean 2–4 sentence summary"',
    '        }',
    '      ]',
    '    }',
    '  ],',
    '  "keywords": "#Keyword1\\n한국어 설명 1–2문장\\n\\n#Keyword2\\n한국어 설명"',
    '}',
    '```',
    'Categories in order: 스킨케어, 메이크업, 퍼스널케어, K-뷰티, 기타.',
    'If a category has fewer than 5 qualifying articles, include however many there are (can be 0).',
    'articleId values must match the [N] numbers in the articles list above.',
  ].join('\n');
}

// ── Main analysis ─────────────────────────────────────────────
function runAnalysis() {
  try {
    const { windowStart, windowEnd } = _bnGetDateWindow();
    const ws = _bnFmtKorean(windowStart);
    const we = _bnFmtKorean(windowEnd);
    const reportTitle = '이번 주 뷰티 브리핑 — ' + _bnFmtShort(windowStart) + ' – ' + _bnFmtShort(windowEnd);

    // 1. Fetch all publication feeds and aggregate within the date window
    let rawArticles = [];
    for (const source of BN_SOURCES) {
      const arts = _bnFetchSource(source, windowStart, windowEnd);
      rawArticles = rawArticles.concat(arts);
      Logger.log('[' + source.name + '] ' + arts.length + ' articles in window');
    }

    // Deduplicate, sort newest-first
    rawArticles = _bnDedupe(rawArticles);
    rawArticles.sort(function(a, b) { return b.pubDate.localeCompare(a.pubDate); });

    if (!rawArticles.length) {
      return { ok: false, error: ws + ' ~ ' + we + ' 기간에 해당하는 기사를 찾지 못했습니다. 피드 URL 또는 날짜 범위를 확인하세요.' };
    }

    // 2. Build numbered article block for Claude
    const articleMap = {};
    let blocks = '';
    rawArticles.forEach(function(a, i) {
      const id = i + 1;
      articleMap[id] = a;
      blocks += '[' + id + '] ' + a.pubDate + ' | ' + a.source + '\n';
      blocks += 'Title: ' + a.title + '\n';
      if (a.desc) blocks += 'Desc: ' + a.desc + '\n';
      blocks += '\n';
    });

    Logger.log('Total articles for Claude: ' + rawArticles.length);

    // 3. Claude analysis (one call — categorises + summarises everything)
    const raw = _bnClaude(_bnSystemPrompt(), _bnUserPrompt(blocks, rawArticles.length, ws, we), BN_MAX_TOKENS);

    // 4. Parse JSON from response
    const m = raw.match(/```json\s*([\s\S]+?)\s*```/) ||
              raw.match(/```\s*([\s\S]+?)\s*```/)     ||
              raw.match(/(\{[\s\S]+\})/);
    if (!m) {
      Logger.log('No JSON in Claude response:\n' + raw);
      throw new Error('Claude 응답에서 JSON을 찾을 수 없습니다.');
    }
    const parsed = JSON.parse(m[1]);

    // 5. Merge real article links from articleMap
    const categories = BN_CATEGORY_NAMES.map(function(name) {
      const meta = BN_CATEGORY_META[name];
      const pc   = (parsed.categories || []).find(function(c) { return c.name === name; }) || {};
      const items = (pc.items || []).map(function(item) {
        const orig = articleMap[item.articleId] || {};
        return {
          title:   item.title   || orig.title  || '',
          source:  item.source  || orig.source || '',
          link:    orig.link    || '',
          pubDate: item.pubDate || orig.pubDate || '',
          summary: item.summary || '',
        };
      });
      return { name: name, emoji: meta.emoji, items: items, count: items.length };
    });

    const result = {
      ok: true,
      date: we,
      dateRange: ws + ' – ' + we,
      reportTitle: reportTitle,
      categories: categories,
      keywords: parsed.keywords || '',
    };

    _saveArchive(result);
    return result;

  } catch(e) {
    Logger.log('runAnalysis error: ' + e.toString());
    return { ok: false, error: e.toString() };
  }
}

// ── Scheduled trigger: run + auto-email ───────────────────────
// Point a weekly GAS time-based trigger at this function.
function scheduledRunAndEmail() {
  const result = runAnalysis();
  if (!result.ok) { Logger.log('scheduled: analysis failed — ' + result.error); return; }
  const recipients = getRecipients();
  if (!recipients.length) return;
  const subject  = '[MiMuse] 주간 뷰티 브리핑 · ' + result.date;
  const htmlBody = _bnBuildEmailHtml(result);
  const sent     = sendBeautyNewsEmail(recipients, htmlBody, subject);
  Logger.log('scheduled: sent to ' + sent.sent + ' recipient(s)');
}

// ── Email HTML builder ────────────────────────────────────────
function _bnBuildEmailHtml(data) {
  const title = data.reportTitle || ('이번 주 뷰티 브리핑 — ' + data.date);
  var esc = function(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  };
  var h = '<html><body style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222">';
  h += '<h1 style="font-size:20px;border-bottom:2px solid #f5c518;padding-bottom:8px">🌟 MiMuse ' + esc(title) + '</h1>';
  if (data.dateRange) h += '<p style="font-size:12px;color:#888;margin-top:4px">📅 ' + esc(data.dateRange) + '</p>';

  (data.categories || []).forEach(function(cat) {
    var count = cat.count != null ? cat.count : (cat.items || []).length;
    h += '<h2 style="font-size:16px;margin-top:28px">' + esc(cat.emoji + ' ' + cat.name) + '</h2>';
    h += '<p style="font-size:12px;color:#888;margin:4px 0 10px">이번 주 트렌드 시그널이 감지된 뉴스는 총 <strong style="color:#1a73e8">' + count + '</strong>건입니다.</p>';
    (cat.items || []).forEach(function(item) {
      h += '<div style="background:#f9f9f9;border-left:3px solid #f5c518;padding:12px;margin-bottom:12px;border-radius:4px">';
      if (item.link) {
        h += '<div style="font-weight:600;font-size:14px"><a href="' + esc(item.link) + '" style="color:#222;text-decoration:none">' + esc(item.title) + '</a></div>';
      } else {
        h += '<div style="font-weight:600;font-size:14px">' + esc(item.title) + '</div>';
      }
      if (item.source) h += '<div style="font-size:11px;color:#888;margin-bottom:6px">' + esc(item.source) + (item.pubDate ? ' · ' + item.pubDate : '') + '</div>';
      h += '<div style="font-size:13px;line-height:1.6">' + esc(item.summary) + '</div>';
      if (item.link) h += '<a href="' + esc(item.link) + '" style="font-size:11px;color:#1a73e8" target="_blank">원문 보기</a>';
      h += '</div>';
    });
  });

  if (data.keywords) {
    h += '<div style="background:#fff3cd;border-radius:6px;padding:16px;margin-top:24px">';
    h += '<h3 style="margin-top:0;font-size:15px">✨ 이번 주 트렌드 키워드</h3>';
    h += '<div style="font-size:13px;line-height:1.8">' + esc(data.keywords).replace(/\n/g, '<br>') + '</div>';
    h += '</div>';
  }

  var dashUrl = 'https://mimuse-automation-dashboard.vercel.app/tab-trends.html#briefing';
  h += '<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e0e0e0;text-align:center">';
  h += '<p style="font-size:13px;color:#555;margin-bottom:14px">전체 리포트 및 지난 주차 아카이브는 MiMuse 대시보드에서 확인하세요.</p>';
  h += '<a href="' + dashUrl + '" target="_blank" style="display:inline-block;background:#f5c518;color:#1a1a1a;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none">📊 대시보드 뷰티뉴스 섹션 바로가기</a>';
  h += '<p style="font-size:11px;color:#aaa;margin-top:16px">MiMuse 자동화 대시보드 · 주간 뷰티 브리핑</p>';
  h += '</div></body></html>';
  return h;
}

// ── Archive ───────────────────────────────────────────────────
const BN_ARCH_INDEX_KEY = 'BN_ARCH_INDEX';
const BN_ARCH_MAX       = 12;
const BN_ARCH_CHUNK     = 7500;

function _archDateKey(dateStr) {
  return String(dateStr).replace(/[^0-9]/g, '');
}

function _saveArchive(data) {
  try {
    const props   = PropertiesService.getScriptProperties();
    const dateKey = _archDateKey(data.date);
    const json    = JSON.stringify(data);
    const chunks  = Math.ceil(json.length / BN_ARCH_CHUNK);
    for (var i = 0; i < chunks; i++) {
      props.setProperty('BN_ARCH_' + dateKey + '_' + i, json.substring(i * BN_ARCH_CHUNK, (i + 1) * BN_ARCH_CHUNK));
    }
    props.setProperty('BN_ARCH_' + dateKey + '_META', JSON.stringify({
      chunks: chunks, date: data.date, reportTitle: data.reportTitle, savedAt: new Date().toISOString(),
    }));
    var index = [];
    try { index = JSON.parse(props.getProperty(BN_ARCH_INDEX_KEY) || '[]'); } catch(e) {}
    index = index.filter(function(k) { return k !== dateKey; });
    index.unshift(dateKey);
    if (index.length > BN_ARCH_MAX) {
      index.splice(BN_ARCH_MAX).forEach(function(k) { _deleteArchiveEntry(props, k); });
    }
    props.setProperty(BN_ARCH_INDEX_KEY, JSON.stringify(index));
  } catch(e) { Logger.log('_saveArchive: ' + e.message); }
}

function _deleteArchiveEntry(props, dateKey) {
  try {
    var meta = JSON.parse(props.getProperty('BN_ARCH_' + dateKey + '_META') || 'null');
    if (!meta) return;
    for (var i = 0; i < meta.chunks; i++) props.deleteProperty('BN_ARCH_' + dateKey + '_' + i);
    props.deleteProperty('BN_ARCH_' + dateKey + '_META');
  } catch(e) {}
}

function getArchiveList() {
  try {
    const props = PropertiesService.getScriptProperties();
    var index = [];
    try { index = JSON.parse(props.getProperty(BN_ARCH_INDEX_KEY) || '[]'); } catch(e) {}
    return { ok: true, archives: index.map(function(dateKey) {
      try {
        var meta = JSON.parse(props.getProperty('BN_ARCH_' + dateKey + '_META') || '{}');
        return { dateKey: dateKey, date: meta.date || dateKey, reportTitle: meta.reportTitle || '', savedAt: meta.savedAt || '' };
      } catch(e) { return { dateKey: dateKey, date: dateKey, reportTitle: '', savedAt: '' }; }
    })};
  } catch(e) { return { ok: false, error: e.toString() }; }
}

function getArchive(dateKey) {
  try {
    const props = PropertiesService.getScriptProperties();
    var meta = JSON.parse(props.getProperty('BN_ARCH_' + dateKey + '_META') || 'null');
    if (!meta) return { ok: false, error: '해당 아카이브를 찾을 수 없습니다.' };
    var json = '';
    for (var i = 0; i < meta.chunks; i++) {
      var chunk = props.getProperty('BN_ARCH_' + dateKey + '_' + i);
      if (!chunk) return { ok: false, error: '아카이브 데이터가 손상됐습니다.' };
      json += chunk;
    }
    var data = JSON.parse(json);
    data.fromArchive = true;
    return data;
  } catch(e) { return { ok: false, error: e.toString() }; }
}

function deleteArchive(dateKey) {
  try {
    const props = PropertiesService.getScriptProperties();
    _deleteArchiveEntry(props, dateKey);
    var index = [];
    try { index = JSON.parse(props.getProperty(BN_ARCH_INDEX_KEY) || '[]'); } catch(e) {}
    props.setProperty(BN_ARCH_INDEX_KEY, JSON.stringify(index.filter(function(k) { return k !== dateKey; })));
    return { ok: true };
  } catch(e) { return { ok: false, error: e.toString() }; }
}

// ── Email via Outlook Graph API ───────────────────────────────
function sendBeautyNewsEmail(recipients, htmlBody, subject) {
  try {
    const token       = getOutlookAccessToken();
    const senderEmail = _prop('SENDER_EMAIL') || '';
    var sent = 0, errors = [];
    for (var i = 0; i < recipients.length; i++) {
      var addr = recipients[i].trim();
      if (!addr) continue;
      var payload = {
        message: {
          subject: subject || '주간 뷰티 브리핑',
          body: { contentType: 'HTML', content: htmlBody || '' },
          toRecipients: [{ emailAddress: { address: addr } }],
        },
        saveToSentItems: true,
      };
      if (senderEmail) payload.message.from = { emailAddress: { address: senderEmail } };
      var res  = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'post', contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify(payload), muteHttpExceptions: true,
      });
      var code = res.getResponseCode();
      if (code === 202 || code === 200) {
        sent++;
      } else {
        var err = JSON.parse(res.getContentText() || '{}');
        errors.push(addr + ': ' + ((err.error && err.error.message) || 'HTTP ' + code));
      }
    }
    if (errors.length) return { ok: false, error: errors.join('; '), sent: sent };
    return { ok: true, sent: sent };
  } catch(e) { return { ok: false, error: e.toString() }; }
}

// ── Recipient list ────────────────────────────────────────────
function getRecipients() {
  var raw = _prop('RECIPIENT_EMAILS') || 'kaydee@cranecomm.com,nexanetraventures@gmail.com';
  return raw.split(',').map(function(e) { return e.trim(); }).filter(Boolean);
}

// ── Route handler — called by Code.gs dispatcher ──────────────
function routeBeautyNews(action, p, body) {
  switch (action) {
    case 'runAnalysis':         return runAnalysis();
    case 'getArchiveList':      return getArchiveList();
    case 'getArchive':          return getArchive((p || {}).dateKey);
    case 'deleteArchive':       return deleteArchive((body || {}).dateKey);
    case 'getRecipients':       return getRecipients();
    case 'sendBeautyNewsEmail': return sendBeautyNewsEmail((body || {}).recipients, (body || {}).htmlBody, (body || {}).subject);
    default:                    return null;
  }
}
