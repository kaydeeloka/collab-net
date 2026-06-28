// ============================================================
//  Google Sheets sync — Influencer DB & Brand DB
//  First click creates the spreadsheet and saves its ID.
//  Every subsequent click updates the same sheet with latest data.
//
//  Script Properties:
//    INFLUENCER_SPREADSHEET_ID
//    BRAND_SPREADSHEET_ID
// ============================================================

function _getOrCreateSpreadsheet(propKey, name) {
  var id = PropertiesService.getScriptProperties().getProperty(propKey);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* sheet deleted — recreate */ }
  }
  var ss = SpreadsheetApp.create(name);
  PropertiesService.getScriptProperties().setProperty(propKey, ss.getId());
  return ss;
}

function _writeSheet(ss, sheetName, headers, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clearContents();
  var data = [headers].concat(rows.length ? rows : [headers.map(function() { return ''; })]);
  sheet.getRange(1, 1, data.length, headers.length).setValues(data);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  return sheet;
}

// ── Influencer DB ─────────────────────────────────────────────

function updateInfluencerSheet(body) {
  var phaseId = (body.phaseId || '').toString().trim();
  if (!phaseId) return { error: 'phaseId가 필요합니다.' };

  try {
    var rows = supabaseGet(
      '/rest/v1/influencers?select=handle,display_name,email,followers,following,following_ratio,total_likes,video_count,engagement_rate,tiers(rank,label,category)' +
      '&phase_id=eq.' + phaseId + '&order=created_at.asc'
    );
    if (!Array.isArray(rows)) return { error: 'Supabase 오류: ' + JSON.stringify(rows) };

    var ss = _getOrCreateSpreadsheet('INFLUENCER_SPREADSHEET_ID', 'MiMuse 인플루언서 DB');

    var headers = ['No.', '이름', '핸들', '이메일', '티어', '카테고리', '팔로워', '팔로잉', '팔로잉 비율', '좋아요', '영상 수', '참여율(%)'];
    var sheetRows = rows.map(function(r, i) {
      var tier = r.tiers || {};
      return [
        i + 1,
        r.display_name || '',
        r.handle || '',
        r.email || '',
        tier.rank || '',
        tier.label || '',
        r.followers || 0,
        r.following || 0,
        r.following_ratio || '',
        r.total_likes || 0,
        r.video_count || 0,
        r.engagement_rate || 0,
      ];
    });

    _writeSheet(ss, '인플루언서 DB', headers, sheetRows);

    var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('시트1');
    if (defaultSheet && ss.getSheets().length > 1) {
      try { ss.deleteSheet(defaultSheet); } catch (e) {}
    }

    return { ok: true, url: ss.getUrl(), count: rows.length, message: rows.length + '명 시트 업데이트 완료' };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ── Brand DB ──────────────────────────────────────────────────

function updateBrandSheet(body) {
  var phaseId = (body.phaseId || '').toString().trim();
  if (!phaseId) return { error: 'phaseId가 필요합니다.' };

  try {
    var generalRows = supabaseGet(
      '/rest/v1/brand_general?select=brand_name,company,contact_name,department,position,email,telephone,personal_email,personal_phone,rep_email,website,product_category,overseas,contacted,status,notes' +
      '&phase_id=eq.' + phaseId + '&order=brand_name.asc'
    );
    var personalRows = supabaseGet(
      '/rest/v1/brand_personal?select=brand_name,company,contact_name,department,position,personal_email,personal_phone,rep_email,website,product_category,overseas,contacted,status,notes' +
      '&phase_id=eq.' + phaseId + '&order=brand_name.asc'
    );
    if (!Array.isArray(generalRows))  return { error: '일반 DB 조회 오류: ' + JSON.stringify(generalRows) };
    if (!Array.isArray(personalRows)) return { error: '퍼스널 DB 조회 오류: ' + JSON.stringify(personalRows) };

    var ss = _getOrCreateSpreadsheet('BRAND_SPREADSHEET_ID', 'MiMuse 브랜드 DB');

    _writeSheet(ss, '일반', ['No.', '브랜드명', '회사명', '담당자명', '부서', '직책', '이메일', '전화번호', '개인 이메일', '개인 전화번호', '대표 이메일', '웹사이트', '상품 카테고리', '해외', '비고'],
      generalRows.map(function(r, i) {
        return [
          i + 1,
          r.brand_name || '', r.company || '', r.contact_name || '',
          r.department || '', r.position || '',
          Array.isArray(r.email) ? r.email.join(', ') : (r.email || ''),
          r.telephone || '',
          Array.isArray(r.personal_email) ? r.personal_email.join(', ') : (r.personal_email || ''),
          r.personal_phone || '', r.rep_email || '', r.website || '', r.product_category || '',
          r.overseas ? 'Y' : '', r.notes || '',
        ];
      })
    );

    _writeSheet(ss, '퍼스널', ['No.', '브랜드명', '회사명', '담당자명', '부서', '직책', '이메일', '전화번호', '대표 이메일', '웹사이트', '상품 카테고리', '해외', '비고'],
      personalRows.map(function(r, i) {
        return [
          i + 1,
          r.brand_name || '', r.company || '', r.contact_name || '',
          r.department || '', r.position || '',
          Array.isArray(r.personal_email) ? r.personal_email.join(', ') : (r.personal_email || ''),
          r.personal_phone || '', r.rep_email || '', r.website || '', r.product_category || '',
          r.overseas ? 'Y' : '', r.notes || '',
        ];
      })
    );

    var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('시트1');
    if (defaultSheet && ss.getSheets().length > 1) {
      try { ss.deleteSheet(defaultSheet); } catch (e) {}
    }

    return {
      ok: true, url: ss.getUrl(),
      generalCount: generalRows.length, personalCount: personalRows.length,
      message: '일반 ' + generalRows.length + '개 / 퍼스널 ' + personalRows.length + '개 시트 업데이트 완료',
    };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ── Router ────────────────────────────────────────────────────

function routeSheets(action, p, body) {
  switch (action) {
    case 'updateInfluencerSheet': return updateInfluencerSheet(body || {});
    case 'updateBrandSheet':      return updateBrandSheet(body || {});
    default:                      return null;
  }
}
