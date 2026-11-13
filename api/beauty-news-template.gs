// ============================================================
//  Beauty News — HTML Email Builder (GAS)
//  Style mirrors buildEmailHtml() in src/pages/trend/beauty-news/index.tsx
//
//  buildBriefingHtml(data) → HTML string
//
//  data shape:
//    windowsStart  — "YYYY-MM-DD"
//    windowsEnd    — "YYYY-MM-DD"
//    reportTitle   — string
//    categories    — [{ emoji, name, count, items/articles/stories: [{ title, link/url, source, pubDate/date, summary }] }]
//    keywords      — [{ tag, explanation }]
// ============================================================

function buildBriefingHtml(data) {
  var ws    = _formatKrDate(data.windowsStart || '');
  var we    = _formatKrDate(data.windowsEnd   || '');
  var range = ws + (we ? ' – ' + we : '');
  var title = data.reportTitle || ('이번 주 뷰티 브리핑 — ' + range);
  var cats  = data.categories  || [];
  var kws   = data.keywords    || [];

  var h = '<html><body style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222">';

  h += '<h1 style="font-size:20px;border-bottom:2px solid #f5c518;padding-bottom:8px">'
     + '🌟 CollabNet [NEW-TEMPLATE] ' + _esc(title) + '</h1>';

  if (range) {
    h += '<p style="font-size:12px;color:#888;margin-top:4px">📅 ' + range + '</p>';
  }

  // ── Categories ───────────────────────────────────────────────
  for (var c = 0; c < cats.length; c++) {
    var cat      = cats[c];
    var articles = _getCatArticles(cat);
    if (articles.length === 0) continue;

    var count = (cat.count != null) ? cat.count : articles.length;

    h += '<h2 style="font-size:16px;margin-top:28px">'
       + _esc(cat.emoji || '') + ' ' + _esc(cat.name || '') + '</h2>';
    h += '<p style="font-size:12px;color:#888;margin:4px 0 10px">'
       + '이번 주 트렌드 시그널이 감지된 뉴스는 총 '
       + '<strong style="color:#1a73e8">' + count + '</strong>건입니다.</p>';

    for (var a = 0; a < articles.length; a++) {
      var art      = articles[a];
      var artTitle = art.title   || art.headline || '';
      var artUrl   = art.url     || art.link     || '';
      var artDate  = art.pubDate || art.date      || '';

      h += '<div style="background:#f9f9f9;border-left:3px solid #f5c518;padding:12px;margin-bottom:12px;border-radius:4px">';
      h += '<div style="font-weight:600;font-size:14px">';
      if (artUrl) {
        h += '<a href="' + _esc(artUrl) + '" style="color:#222;text-decoration:none">' + _esc(artTitle) + '</a>';
      } else {
        h += _esc(artTitle);
      }
      h += '</div>';

      if (art.source) {
        h += '<div style="font-size:11px;color:#888;margin-bottom:6px">'
           + _esc(art.source) + (artDate ? ' · ' + _esc(artDate) : '')
           + '</div>';
      }

      h += '<div style="font-size:13px;line-height:1.6">' + _esc(art.summary || '') + '</div>';

      if (artUrl) {
        h += '<a href="' + _esc(artUrl) + '" style="font-size:11px;color:#1a73e8" target="_blank">'
           + '원문 보기</a>';
      }

      h += '</div>';
    }
  }

  // ── Keywords ─────────────────────────────────────────────────
  if (kws.length > 0) {
    h += '<div style="background:#fff3cd;border-radius:6px;padding:16px;margin-top:24px">';
    h += '<h3 style="margin-top:0;font-size:15px">✨ 이번 주 트렌드 키워드</h3>';
    for (var k = 0; k < kws.length; k++) {
      var kw = kws[k];
      h += '<div style="margin-bottom:12px">'
         + '<strong style="font-size:13px">' + _esc(kw.tag || '') + '</strong><br>'
         + '<span style="font-size:13px;line-height:1.6">' + _esc(kw.explanation || '') + '</span>'
         + '</div>';
    }
    h += '</div>';
  }

  // ── Footer button ─────────────────────────────────────────────
  var dashUrl = 'https://collabnet-dashboard.vercel.app/trend/beauty-news';
  h += '<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e0e0e0;text-align:center">';
  h += '<a href="' + dashUrl + '" target="_blank"'
     + ' style="display:inline-block;background:#f5c518;color:#1a1a1a;font-weight:700;'
     + 'font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none">'
     + '📊 대시보드 뷰티뉴스 바로가기</a>';
  h += '</div>';

  h += '</body></html>';
  return h;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Find the articles array inside a category object.
 * Tries named keys first, then falls back to scanning all properties
 * for the first non-empty array — handles any key Claude might use.
 */
function _getCatArticles(cat) {
  if (!cat || typeof cat !== 'object') return [];
  var KEYS = ['articles', 'items', 'stories', 'news', 'content', 'data', 'list'];
  for (var k = 0; k < KEYS.length; k++) {
    if (Array.isArray(cat[KEYS[k]]) && cat[KEYS[k]].length > 0) return cat[KEYS[k]];
  }
  var props = Object.keys(cat);
  for (var i = 0; i < props.length; i++) {
    if (Array.isArray(cat[props[i]]) && cat[props[i]].length > 0) return cat[props[i]];
  }
  return [];
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _formatKrDate(iso) {
  if (!iso || iso.length < 10) return iso;
  var parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  return parts[0] + '년 ' + parseInt(parts[1]) + '월 ' + parseInt(parts[2]) + '일';
}
