// ============================================================
//  Beauty News — HTML Email Builder
//
//  buildBriefingHtml(data) → HTML string
//
//  data shape:
//    windowsStart  — "YYYY-MM-DD"
//    windowsEnd    — "YYYY-MM-DD"
//    reportTitle   — string
//    categories    — [{ name, articles: [{ title, source, date, summary, url }] }]
//    keywords      — [{ tag, explanation }]
// ============================================================

function buildBriefingHtml(data) {
  var start  = _formatKrDate(data.windowsStart || '');
  var end    = _formatKrDate(data.windowsEnd   || '');
  var title  = data.reportTitle || '주간 뷰티 브리핑';
  var cats   = data.categories  || [];
  var kws    = data.keywords    || [];

  var html = '';

  // ── Wrapper ──────────────────────────────────────────────────
  html += '<!DOCTYPE html><html><head><meta charset="UTF-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">'
        + '</head><body style="margin:0;padding:0;background:#f4f6f8;font-family:\'Apple SD Gothic Neo\',\'Malgun Gothic\',Arial,sans-serif;">';

  html += '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f8;padding:32px 16px;">'
        + '<tr><td align="center">'
        + '<table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;">';

  // ── Header ───────────────────────────────────────────────────
  html += '<tr><td style="background:#0f766e;border-radius:12px 12px 0 0;padding:32px 36px;">'
        + '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        + '<td><div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#99f6e4;text-transform:uppercase;margin-bottom:6px;">MiMuse Beauty Intelligence</div>'
        + '<div style="font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">' + _esc(title) + '</div>'
        + '<div style="font-size:13px;color:#ccfbf1;margin-top:8px;">' + start + ' – ' + end + '</div>'
        + '</td></tr></table></td></tr>';

  // ── Body card ────────────────────────────────────────────────
  html += '<tr><td style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px 36px;">';

  // ── Categories ───────────────────────────────────────────────
  if (cats.length > 0) {
    for (var c = 0; c < cats.length; c++) {
      var cat      = cats[c];
      // support: articles (template shape), items (old webhook), stories (new webhook)
      var articles = cat.articles || cat.stories || cat.items || [];
      if (articles.length === 0) continue;

      // Category header
      html += '<div style="margin-bottom:20px;">'
            + '<div style="display:inline-block;background:#f0fdfa;color:#0f766e;font-size:11px;font-weight:700;'
            + 'letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:20px;margin-bottom:14px;">'
            + _esc(cat.name || '') + '</div>';

      for (var a = 0; a < articles.length; a++) {
        var art        = articles[a];
        var artTitle   = art.title    || art.headline || '';
        var articleUrl = art.url      || art.link     || '';
        var artDate    = art.pubDate  || art.date     || '';
        var titleHtml  = articleUrl
          ? '<a href="' + _esc(articleUrl) + '" style="color:#0f766e;text-decoration:none;font-size:14px;font-weight:700;line-height:1.4;">' + _esc(artTitle) + '</a>'
          : '<span style="color:#111827;font-size:14px;font-weight:700;line-height:1.4;">' + _esc(artTitle) + '</span>';

        html += '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">'
              + '<tr><td style="padding:14px 16px;background:#f9fafb;border-radius:8px;border-left:3px solid #0f766e;">'
              + '<div style="margin-bottom:6px;">' + titleHtml + '</div>'
              + '<div style="font-size:11px;color:#6b7280;margin-bottom:8px;">'
              + _esc(art.source || '') + (artDate ? ' · ' + _esc(artDate) : '')
              + '</div>'
              + '<div style="font-size:13px;color:#374151;line-height:1.7;">' + _esc(art.summary || '') + '</div>'
              + '</td></tr></table>';
      }

      html += '</div>';

      // Divider between categories
      if (c < cats.length - 1) {
        html += '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />';
      }
    }
  }

  // ── Keywords ─────────────────────────────────────────────────
  if (kws.length > 0) {
    html += '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />';
    html += '<div style="margin-bottom:8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">이번 주 키워드</div>';
    html += '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>';

    for (var k = 0; k < kws.length; k++) {
      var kw = kws[k];
      html += '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">'
            + '<tr><td style="padding:10px 14px;background:#f0fdfa;border-radius:8px;">'
            + '<span style="font-size:13px;font-weight:700;color:#0f766e;">' + _esc(kw.tag || '') + '</span>'
            + '<span style="font-size:12px;color:#374151;margin-left:10px;">' + _esc(kw.explanation || '') + '</span>'
            + '</td></tr></table>';
    }

    html += '</td></tr></table>';
  }

  // ── Footer ───────────────────────────────────────────────────
  html += '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />';
  html += '<div style="text-align:center;font-size:11px;color:#9ca3af;line-height:1.8;">'
        + 'MiMuse Beauty Intelligence · 본 메일은 발송 전용입니다<br>'
        + '수신을 원하지 않으시면 담당자에게 문의해 주세요.'
        + '</div>';

  // Close body card
  html += '</td></tr>';

  // Close wrapper tables
  html += '</table></td></tr></table></body></html>';

  return html;
}

// ── Helpers ───────────────────────────────────────────────────

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
