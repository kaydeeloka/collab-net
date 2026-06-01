// ============================================================
//  Beauty News — Groq AI Analysis (Dual-Model)
//  Model 1: qwen/qwen3-32b               — 기사 선택
//  Model 2: meta-llama/llama-4-scout     — 요약 + 트렌드 분석
//
//  Script Properties required:
//    GROQ_API_KEY  — Groq API key
//
//  Source strategy: direct RSS from beauty publications & trade press.
//  No Google News RSS — feeds come straight from the magazines/sites.
//
//  Date window (strict — enforced at fetch AND in Groq prompt):
//    windowEnd   = yesterday at 23:59 (last complete day)
//    windowStart = 7 days before windowEnd at 00:00 (7-day total window)
// ============================================================

const GROQ_MODEL_SCRAPER = 'qwen/qwen3-32b';
const GROQ_MODEL_ANALYST = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_ENDPOINT      = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_PER_SOURCE     = 12; // articles to read per publication feed

// ── Publication RSS feeds ─────────────────────────────────────
const SOURCES = [
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

// Category definitions (used for _selectTop + _summarize prompts)
const NEWS_CATEGORIES = [
  { name: '스킨케어', emoji: '🧴' },
  { name: '메이크업', emoji: '💋' },
  { name: '퍼스널케어', emoji: '🚿' },
  { name: 'K-뷰티',  emoji: '🇰🇷' },
  { name: '기타',    emoji: '✨' },
];

// Keywords for code-level categorisation (checked before Groq selection)
// K-뷰티 is checked first and is exclusive — no duplicates into other categories.
// 퍼스널케어 is checked before 메이크업 to avoid figurative words ("foundation for growth")
// pulling business/brand articles into the wrong bucket.
const CATEGORY_KEYWORDS = {
  'K-뷰티':   ['k-beauty', 'korean beauty', 'korean skincare', 'korean makeup',
               'laneige', 'cosrx', 'anua', 'medicube', 'beauty of joseon',
               'innisfree', 'sulwhasoo', 'amorepacific', 'tonymoly', 'klairs',
               'missha', 'etude', 'some by mi', 'torriden', 'isntree'],
  '스킨케어': ['skincare', 'skin care', 'serum', 'moisturizer', 'moisturiser',
               'sunscreen', 'spf', 'cleanser', 'face wash', 'toner', 'retinol',
               'niacinamide', 'vitamin c', 'hyaluronic', 'face mask', 'exfoliant',
               'aha', 'bha', 'skin barrier', 'peptide'],
  '퍼스널케어': [
    // Brand names — matched before generic keywords to prevent mis-routing
    'bath & body works', 'bath and body works', 'native deodorant', 'old spice',
    'dove ', 'dove beauty', 'olaplex', 'pantene', 'head & shoulders', 'head and shoulders',
    'herbal essences', 'tresemmé', 'tresemme', 'garnier fructis', 'paul mitchell',
    'moroccanoil', 'kerastase', 'kérastase', 'bumble and bumble', 'briogeo',
    'act + acre', 'amika', 'not your mother', 'camille rose',
    // Product types
    'haircare', 'hair care', 'shampoo', 'conditioner', 'dry shampoo', 'hair mask',
    'hair oil', 'hair serum', 'heat protectant', 'scalp care', 'scalp treatment',
    'bodycare', 'body care', 'body wash', 'body lotion', 'body butter', 'body oil',
    'body scrub', 'body cream', 'hand cream', 'hand lotion', 'hand soap', 'lotion',
    'shower gel', 'bath oil', 'bath soak', 'soap bar',
    'fragrance', 'perfume', 'eau de parfum', 'eau de toilette', 'cologne', 'scent',
    'deodorant', 'antiperspirant',
    'oral care', 'toothpaste', 'mouthwash', 'teeth whitening', 'whitening strips',
  ],
  '메이크업': ['makeup', 'make-up', 'cosmetics line', 'lipstick', 'lip gloss', 'lip liner',
               'mascara', 'eyeshadow', 'eye shadow', 'blush palette', 'rouge',
               'concealer', 'contour', 'bronzer', 'highlighter', 'eyeliner',
               'nail polish', 'nail art', 'nail lacquer', 'setting spray', 'bb cream',
               'cc cream', 'tinted moisturizer', 'color corrector'],
  '기타':     [], // catch-all — articles not matched above
};

// ── System prompts ────────────────────────────────────────────
const SYSTEM_SCRAPER =
  'You are a North American beauty industry researcher. ' +
  'Output in English only. Use only real brands, products, and publications that actually exist.';

const SYSTEM_ANALYST =
  '너는 북미 뷰티 트렌드 분석 전문가다. ' +
  '출력은 반드시 순수한 한국어만 사용하라. ' +
  '한자(예: 介绍·美容·製品·紹介)와 일본어 가타카나·히라가나(예: リップ·スキン·ケア·スティック)는 절대 사용하지 마라. ' +
  '영어 외래어는 한글 음역(립스틱, 스킨케어, 세럼, 틴트 등)으로 표기하라. ' +
  '브랜드명·제품명·매체명은 원문 영어 그대로 유지하라. ' +
  '모든 문장은 ~이다, ~한다, ~됐다, ~보인다 평서체로 끝낼 것. ~입니다, ~합니다 경어체 금지.';

// ── Script Properties ─────────────────────────────────────────
function _prop(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// ── Date window ───────────────────────────────────────────────
// windowEnd   = yesterday at 23:59:59 (last complete day, never today)
// windowStart = 7 days before windowEnd at 00:00:00
function _getDateWindow() {
  const MS_DAY = 24 * 60 * 60 * 1000;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const windowEnd   = new Date(todayMidnight.getTime() - 1);           // yesterday 23:59:59.999
  const windowStart = new Date(todayMidnight.getTime() - 8 * MS_DAY);  // 8 days ago midnight
  windowStart.setHours(0, 0, 0, 0);
  return { windowStart, windowEnd };
}

// ── Fetch a single publication RSS feed ───────────────────────
// Handles RSS 2.0 and basic Atom. Returns only articles within window.
function _fetchSource(source, windowStart, windowEnd) {
  try {
    const res = UrlFetchApp.fetch(source.url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MiMuseBot/1.0)' },
    });
    if (res.getResponseCode() !== 200) return [];

    const doc  = XmlService.parse(res.getContentText());
    const root = doc.getRootElement();
    const ns   = root.getNamespace();

    let items = [];
    const channel = root.getChild('channel');
    if (channel) {
      items = channel.getChildren('item');         // RSS 2.0
    } else {
      items = root.getChildren('entry', ns);       // Atom
    }

    const out = [];
    for (const item of items.slice(0, MAX_PER_SOURCE)) {
      const pubStr = item.getChildText('pubDate')
        || item.getChildText('published')
        || item.getChildText('updated') || '';
      if (!pubStr) continue;

      const pubDate = new Date(pubStr);
      if (isNaN(pubDate.getTime())) continue;
      if (pubDate < windowStart || pubDate > windowEnd) continue; // strict window

      const titleEl = item.getChild('title');
      const title   = (titleEl ? titleEl.getValue() : '').replace(/<[^>]+>/g, '').trim();
      if (!title) continue;

      let link = item.getChildText('link') || '';
      if (!link) {
        const linkEl = item.getChild('link', ns);
        if (linkEl && linkEl.getAttribute('href')) link = linkEl.getAttribute('href').getValue();
      }

      const desc = (item.getChildText('description') || item.getChildText('summary') || '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

      out.push({
        title,
        source: source.name,
        link,
        pubDate: Utilities.formatDate(pubDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        desc,
      });
    }
    return out;
  } catch(e) {
    Logger.log('Feed error [' + source.name + ']: ' + e.message);
    return [];
  }
}

// ── Deduplicate by title ──────────────────────────────────────
function _dedupe(articles) {
  const seen = [];
  return articles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (seen.includes(key)) return false;
    seen.push(key);
    return true;
  });
}

// ── Keyword-based categorisation ──────────────────────────────
// K-뷰티 is checked first and is exclusive (no duplicates to other cats).
// Unmatched articles go to 기타.
function _categorize(articles) {
  const buckets = {};
  NEWS_CATEGORIES.forEach(c => { buckets[c.name] = []; });

  for (const a of articles) {
    const text = (a.title + ' ' + a.desc).toLowerCase();
    let assigned = false;

    // K-뷰티 first — exclusive
    if (CATEGORY_KEYWORDS['K-뷰티'].some(kw => text.includes(kw))) {
      buckets['K-뷰티'].push(a);
      continue;
    }
    for (const cat of ['스킨케어', '퍼스널케어', '메이크업']) {
      if (CATEGORY_KEYWORDS[cat].some(kw => text.includes(kw))) {
        buckets[cat].push(a);
        assigned = true;
        break;
      }
    }
    if (!assigned) buckets['기타'].push(a);
  }
  return buckets;
}

// ── Groq call ─────────────────────────────────────────────────
function _groq(userPrompt, maxTokens, model, systemPrompt) {
  const key = _prop('GROQ_API_KEY');
  if (!key) return '(GROQ_API_KEY missing in Script Properties)';
  const payload = {
    model: model || GROQ_MODEL_ANALYST,
    messages: [
      { role: 'system', content: systemPrompt || SYSTEM_ANALYST },
      { role: 'user',   content: userPrompt },
    ],
    max_tokens:  maxTokens || 512,
    temperature: 0.3,
  };
  try {
    const res  = UrlFetchApp.fetch(GROQ_ENDPOINT, {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const body = JSON.parse(res.getContentText());
    return (body.choices && body.choices[0].message.content || '').trim();
  } catch(e) {
    return '(Groq 오류: ' + e.message + ')';
  }
}

// ── Select top 5 articles via Groq (qwen) — Trend-First Filter ─
function _selectTop(articles, catName) {
  if (articles.length <= 5) return articles;
  const numbered = articles.map((a, i) =>
    (i + 1) + '. [' + a.source + ' · ' + (a.pubDate || '?') + '] ' + a.title
  ).join('\n');
  const prompt =
    'Category: ' + catName + '\n' +
    'A Korean beauty brand is researching the North American market.\n' +
    'Select the 5 articles that best reveal what is SHIFTING — not just what happened.\n' +
    'Ask yourself: "Does this signal a change in direction?"\n\n' +
    'PRIORITIZE (in order):\n' +
    '1. Brand strategic pivot — repositioning, new channel, new market entry\n' +
    '2. Consumer behavior shift — ingredients, values, price sensitivity, platform migration\n' +
    '3. Retail / distribution change — new partnerships, DTC vs wholesale, shelf resets\n' +
    '4. Marketing / campaign trend — influencer strategy, TikTok formats, collabs\n' +
    '5. Product category rising or falling — new format breakout, ingredient falling out of favor\n\n' +
    'DEPRIORITIZE:\n' +
    '- One-off product launches with no broader trend signal\n' +
    '- Routine earnings reports with no strategic implication\n' +
    '- Celebrity brand news with no market trend relevance\n' +
    '- Generic listicles, "best of" roundups, gift guides\n\n' +
    numbered +
    '\n\nReply ONLY with 5 numbers separated by commas. Example: 2,5,9,11,14';
  const result = _groq(prompt, 40, GROQ_MODEL_SCRAPER, SYSTEM_SCRAPER);
  try {
    const indices = result.split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < articles.length);
    if (indices.length >= 5) return indices.slice(0, 5).map(i => articles[i]);
  } catch(e) {}
  return articles.slice(0, 5);
}

// ── Summarize one article in Korean (llama-4-scout) ───────────
function _summarize(article, catName) {
  const prompt =
    '카테고리: ' + catName + '\n' +
    '제목: ' + article.title + '\n' +
    '매체: ' + article.source + '\n' +
    (article.pubDate ? '날짜: ' + article.pubDate + '\n' : '') +
    '내용: ' + (article.desc || '(본문 없음 — 제목만으로 요약)') + '\n\n' +
    '아래 3가지 기준으로 2–4문장 요약하라:\n' +
    '① 어떤 브랜드·제품·카테고리가 전략적 전환·바이럴·판매 증가를 기록했는지 구체적으로 언급\n' +
    '② 이 변화를 이끄는 소비자 행동·성분·유통 채널·마케팅 방식이 무엇인지\n' +
    '③ 이것이 북미 뷰티 시장에서 어떤 방향 전환을 의미하는지 — 마지막 문장은 반드시 "방향 신호"로 끝낼 것\n\n' +
    '규칙: 한자·일본어 절대 금지. 순수 한국어만. 브랜드명·제품명·매체명은 영어 그대로. ' +
    '~이다/~한다/~됐다/~보인다 평서체만. 요약 텍스트만 출력, 번호·불릿 없이.';
  return _groq(prompt, 380, GROQ_MODEL_ANALYST, SYSTEM_ANALYST);
}

// ── Trend keywords (llama-4-scout) ────────────────────────────
function _trendKeywords(allSummaries) {
  const prompt =
    '이번 주 북미 뷰티 뉴스 요약 ' + allSummaries.length + '건 (전 카테고리 통합):\n' +
    allSummaries.join('\n') + '\n\n' +
    '위 전체 내용을 분석해 3–5개의 트렌드 키워드를 추출하라.\n' +
    '키워드는 특정 카테고리에 국한되지 않고 여러 카테고리를 관통하는 신호를 포착해야 한다.\n\n' +
    '선정 기준:\n' +
    '- 주류 미디어가 아직 "트렌드"로 명명하지 않은 초기 시장 신호\n' +
    '- 소비자 행동·유통·마케팅에서 포착되는 구체적인 방향 전환\n' +
    '- 여러 카테고리에서 동시에 나타나는 공통 패턴\n' +
    '- 새로운 성분 조합, 포맷, 채널, 가격 전략의 부상\n\n' +
    '절대 금지 (이미 알려진 일반 트렌드): Glass Skin, K-Beauty 글로벌화, Clean Beauty, ' +
    'Glow, 미니멀리즘, 자연주의, 비건 뷰티, 지속가능성\n\n' +
    '목표 수준 예시: #DupeEconomy #BarrierSkincare #K-BeautyMainstream #InfluencerFatigue #ScentIdentity\n' +
    '— 이처럼 영어 해시태그 형식으로, 구체적이고 인사이트 있는 신조어 수준\n\n' +
    '각 키워드 출력 형식 (마크다운·볼드·불릿 없이):\n' +
    '#KeywordHere\n' +
    '이 트렌드가 무엇인지, 왜 지금 뜨는지 (1문장). 어떤 카테고리·기사가 이 신호를 뒷받침하는지 (1문장).';
  return _groq(prompt, 1200, GROQ_MODEL_ANALYST, SYSTEM_ANALYST);
}

// ── Main analysis function ─────────────────────────────────────
function runAnalysis() {
  try {
    const { windowStart, windowEnd } = _getDateWindow();
    const tz = Session.getScriptTimeZone();
    const wsStr = Utilities.formatDate(windowStart, tz, 'yyyy년 MM월 dd일');
    const weStr = Utilities.formatDate(windowEnd,   tz, 'yyyy년 MM월 dd일');
    const reportTitle = '이번 주 뷰티 브리핑 — '
      + Utilities.formatDate(windowStart, tz, 'MM월 dd일')
      + ' – '
      + Utilities.formatDate(windowEnd,   tz, 'MM월 dd일');

    // 1. Fetch all publication feeds within the strict date window
    let allArticles = [];
    for (const source of SOURCES) {
      const arts = _fetchSource(source, windowStart, windowEnd);
      allArticles = allArticles.concat(arts);
      Logger.log('[' + source.name + '] ' + arts.length + ' articles in window');
    }
    allArticles = _dedupe(allArticles);
    allArticles.sort((a, b) => b.pubDate.localeCompare(a.pubDate));
    Logger.log('Total after dedupe: ' + allArticles.length);

    if (!allArticles.length) {
      return { ok: false, error: wsStr + ' ~ ' + weStr + ' 기간의 기사를 찾지 못했습니다.' };
    }

    // 2. Categorise by keyword, then select top 5 + summarise per category
    const buckets    = _categorize(allArticles);
    const categories = [];
    const allSummaries = [];

    for (const cat of NEWS_CATEGORIES) {
      const articles = buckets[cat.name] || [];
      const top5     = _selectTop(articles, cat.emoji + ' ' + cat.name);
      const items    = [];

      for (const a of top5) {
        const summary = _summarize(a, cat.emoji + ' ' + cat.name);
        if (!summary) continue;
        items.push({ title: a.title, source: a.source, link: a.link, pubDate: a.pubDate, summary });
        allSummaries.push('[' + cat.name + '] ' + a.title + ': ' + summary);
        Utilities.sleep(800);
      }
      categories.push({ name: cat.name, emoji: cat.emoji, items, count: items.length });
    }

    const keywords = allSummaries.length ? _trendKeywords(allSummaries) : '';
    const result   = {
      ok: true,
      date: weStr,
      dateRange: wsStr + ' – ' + weStr,
      reportTitle,
      categories,
      keywords,
    };

    _saveArchive(result);
    return result;
  } catch(e) {
    Logger.log('runAnalysis error: ' + e.toString());
    return { ok: false, error: e.toString() };
  }
}

// ── Archive helpers ───────────────────────────────────────────
const ARCH_INDEX_KEY = 'BN_ARCH_INDEX';
const ARCH_MAX       = 12;
const ARCH_CHUNK     = 7500;

function _archDateKey(dateStr) {
  return String(dateStr).replace(/[^0-9]/g, '');
}

function _saveArchive(data) {
  try {
    const props   = PropertiesService.getScriptProperties();
    const dateKey = _archDateKey(data.date);
    const json    = JSON.stringify(data);
    const chunks  = Math.ceil(json.length / ARCH_CHUNK);
    for (var i = 0; i < chunks; i++) {
      props.setProperty('BN_ARCH_' + dateKey + '_' + i, json.substring(i * ARCH_CHUNK, (i + 1) * ARCH_CHUNK));
    }
    props.setProperty('BN_ARCH_' + dateKey + '_META', JSON.stringify({
      chunks, date: data.date, reportTitle: data.reportTitle, savedAt: new Date().toISOString(),
    }));
    var index = [];
    try { index = JSON.parse(props.getProperty(ARCH_INDEX_KEY) || '[]'); } catch(e) {}
    index = index.filter(k => k !== dateKey);
    index.unshift(dateKey);
    if (index.length > ARCH_MAX) {
      index.splice(ARCH_MAX).forEach(k => _deleteArchiveEntry(props, k));
    }
    props.setProperty(ARCH_INDEX_KEY, JSON.stringify(index));
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
    try { index = JSON.parse(props.getProperty(ARCH_INDEX_KEY) || '[]'); } catch(e) {}
    const list = index.map(dateKey => {
      try {
        var meta = JSON.parse(props.getProperty('BN_ARCH_' + dateKey + '_META') || '{}');
        return { dateKey, date: meta.date || dateKey, reportTitle: meta.reportTitle || '', savedAt: meta.savedAt || '' };
      } catch(e) { return { dateKey, date: dateKey, reportTitle: '', savedAt: '' }; }
    });
    return { ok: true, archives: list };
  } catch(e) { return { ok: false, error: e.toString() }; }
}

function getArchive(dateKey) {
  try {
    const props   = PropertiesService.getScriptProperties();
    var meta = JSON.parse(props.getProperty('BN_ARCH_' + dateKey + '_META') || 'null');
    if (!meta) return { ok: false, error: '해당 아카이브를 찾을 수 없습니다.' };
    var json = '';
    for (var i = 0; i < meta.chunks; i++) {
      const chunk = props.getProperty('BN_ARCH_' + dateKey + '_' + i);
      if (!chunk) return { ok: false, error: '아카이브 데이터가 손상됐습니다.' };
      json += chunk;
    }
    const data = JSON.parse(json);
    data.fromArchive = true;
    return data;
  } catch(e) { return { ok: false, error: e.toString() }; }
}

function deleteArchive(dateKey) {
  try {
    const props = PropertiesService.getScriptProperties();
    _deleteArchiveEntry(props, dateKey);
    var index = [];
    try { index = JSON.parse(props.getProperty(ARCH_INDEX_KEY) || '[]'); } catch(e) {}
    props.setProperty(ARCH_INDEX_KEY, JSON.stringify(index.filter(k => k !== dateKey)));
    return { ok: true };
  } catch(e) { return { ok: false, error: e.toString() }; }
}

// ── Email via Outlook Graph API ───────────────────────────────
function sendBeautyNewsEmail(recipients, htmlBody, subject) {
  try {
    const token       = getOutlookAccessToken();
    const senderEmail = _prop('SENDER_EMAIL') || '';
    let sent = 0;
    const errors = [];

    for (const email of recipients) {
      const addr = email.trim();
      if (!addr) continue;
      const payload = {
        message: {
          subject: subject || '뷰티 뉴스 브리핑',
          body: { contentType: 'HTML', content: htmlBody || '' },
          toRecipients: [{ emailAddress: { address: addr } }],
        },
        saveToSentItems: true,
      };
      if (senderEmail) payload.message.from = { emailAddress: { address: senderEmail } };
      const res  = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'post', contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      const code = res.getResponseCode();
      if (code === 202 || code === 200) {
        sent++;
      } else {
        const err = JSON.parse(res.getContentText() || '{}');
        errors.push(addr + ': ' + ((err.error && err.error.message) || 'HTTP ' + code));
      }
    }

    if (errors.length) return { ok: false, error: errors.join('; '), sent };
    return { ok: true, sent };
  } catch(e) { return { ok: false, error: e.toString() }; }
}

// ── Recipient list ────────────────────────────────────────────
function getRecipients() {
  const raw = _prop('RECIPIENT_EMAILS') || 'kaydee@cranecomm.com,nexanetraventures@gmail.com';
  return raw.split(',').map(e => e.trim()).filter(Boolean);
}

// ── Webhook receiver — called by Claude routine via HTTP POST ──
// Body shape:
//   { action: 'receiveWebhook', secret: '...', autoEmail: true/false,
//     date, dateRange, reportTitle, categories, keywords }
function receiveWebhookBriefing(body) {
  // Optional secret check — set WEBHOOK_SECRET in Script Properties to enable
  const secret = _prop('WEBHOOK_SECRET');
  if (secret && (body || {}).secret !== secret) {
    return { ok: false, error: 'Unauthorized' };
  }

  const data = body || {};
  if (!data.date || !Array.isArray(data.categories)) {
    return { ok: false, error: 'Invalid payload: date and categories are required' };
  }

  const briefing = {
    ok:          true,
    date:        data.date,
    dateRange:   data.dateRange   || data.date,
    reportTitle: data.reportTitle || ('이번 주 뷰티 브리핑 — ' + data.date),
    categories:  data.categories,
    keywords:    data.keywords    || '',
  };

  _saveArchive(briefing);
  Logger.log('Webhook: saved briefing for ' + briefing.date);

  // Auto-send email if caller requests it
  if (data.autoEmail) {
    const recipients = data.recipients && data.recipients.length
      ? data.recipients
      : getRecipients();
    const subject  = data.subject || ('[MiMuse] 주간 뷰티 브리핑 · ' + briefing.date);
    const htmlBody = data.htmlBody || _buildWebhookEmailHtml(briefing);
    const sent     = sendBeautyNewsEmail(recipients, htmlBody, subject);
    Logger.log('Webhook auto-email: ' + JSON.stringify(sent));
    return { ok: true, saved: true, email: sent };
  }

  return { ok: true, saved: true };
}

// Simple email builder used when autoEmail:true but no htmlBody provided
function _buildWebhookEmailHtml(data) {
  var esc = function(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  };
  var h = '<html><body style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222">';
  h += '<h1 style="font-size:20px;border-bottom:2px solid #f5c518;padding-bottom:8px">🌟 MiMuse ' + esc(data.reportTitle) + '</h1>';
  if (data.dateRange) h += '<p style="font-size:12px;color:#888;margin-top:4px">📅 ' + esc(data.dateRange) + '</p>';

  (data.categories || []).forEach(function(cat) {
    var count = cat.count != null ? cat.count : (cat.items || []).length;
    h += '<h2 style="font-size:16px;margin-top:24px">' + esc(cat.emoji + ' ' + cat.name) + '</h2>';
    h += '<p style="font-size:12px;color:#888;margin:4px 0 10px">트렌드 시그널 <strong style="color:#1a73e8">' + count + '</strong>건</p>';
    (cat.items || []).forEach(function(item) {
      h += '<div style="background:#f9f9f9;border-left:3px solid #f5c518;padding:12px;margin-bottom:10px;border-radius:4px">';
      if (item.link) {
        h += '<div style="font-weight:600;font-size:14px"><a href="' + esc(item.link) + '" style="color:#222;text-decoration:none">' + esc(item.title) + '</a></div>';
      } else {
        h += '<div style="font-weight:600;font-size:14px">' + esc(item.title) + '</div>';
      }
      if (item.source) h += '<div style="font-size:11px;color:#888;margin-bottom:5px">' + esc(item.source) + (item.pubDate ? ' · ' + item.pubDate : '') + '</div>';
      h += '<div style="font-size:13px;line-height:1.6">' + esc(item.summary) + '</div>';
      if (item.link) h += '<br><a href="' + esc(item.link) + '" style="font-size:11px;color:#1a73e8">원문 보기</a>';
      h += '</div>';
    });
  });

  if (data.keywords) {
    h += '<div style="background:#fff3cd;border-radius:6px;padding:14px;margin-top:20px">';
    h += '<h3 style="margin-top:0;font-size:14px">✨ 트렌드 키워드</h3>';
    h += '<div style="font-size:13px;line-height:1.8">' + esc(data.keywords).replace(/\n/g, '<br>') + '</div>';
    h += '</div>';
  }

  var dashUrl = 'https://mimuse-automation-dashboard.vercel.app/tab-trends.html#briefing';
  h += '<div style="margin-top:36px;padding-top:18px;border-top:1px solid #e0e0e0;text-align:center">';
  h += '<a href="' + dashUrl + '" target="_blank" style="display:inline-block;background:#f5c518;color:#1a1a1a;font-weight:700;font-size:13px;padding:11px 26px;border-radius:8px;text-decoration:none">📊 대시보드에서 전체 보기</a>';
  h += '<p style="font-size:11px;color:#aaa;margin-top:14px">MiMuse 자동화 대시보드 · 주간 뷰티 브리핑</p>';
  h += '</div></body></html>';
  return h;
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
    case 'receiveWebhook':      return receiveWebhookBriefing(body);
    default:                    return null;
  }
}
