// ============================================================
//  차수 관리 (Phase Management)
//  Active spreadsheet ID is stored in Script Properties:
//    ACTIVE_PHASE        — e.g. "1차"
//    ACTIVE_OUTREACH_ID  — Google Spreadsheet ID for active phase
//    PHASES              — JSON array of all phase records
// ============================================================

function getPhaseInfo() {
  const props            = PropertiesService.getScriptProperties();
  const activePhase      = props.getProperty('ACTIVE_PHASE') || '1차';
  const phases           = JSON.parse(props.getProperty('PHASES') || '[]');
  const activeOutreachId = getActiveOutreachId();
  return {
    ok: true,
    activePhase,
    activeOutreachId,
    phase1SheetId: PHASE1_SHEET_ID,
    phases,
  };
}

/** Tab order for every new phase spreadsheet (must match Code.gs constants). */
function _expectedPhaseTabNames() {
  return [
    SHEET_K_BEAUTY,
    SHEET_GENERAL_BEAUTY,
    SHEET_INFLUENCERS,
    SHEET_DELIVERY_LIST,
    SHEET_DELIVERY_TRACK,
    SHEET_MONITORING,
  ];
}

function createNewPhase(phaseName) {
  if (!phaseName) return { error: '차수 이름을 입력하세요.' };
  try {
    /** K-뷰티 / 일반뷰티 공통 1행 헤더 — LISTUP_HEADERS (tcm-listup.gs) */
    const LIST_HEADERS = LISTUP_HEADERS;

    /** 배송리스트 — 수령·주소 정보 */
    const DELIVERY_HEADERS = [
      '플랫폼', '계정', '팔로워', 'NAME', '리뷰 업로드', 'repost',
      'PHONE', 'E-mail', 'Address Line 1', 'Address Line 2', 'City', 'State', 'Zip', 'Country',
    ];

    // Create new spreadsheet in Drive → exactly 6 tabs (see _expectedPhaseTabNames).
    const ss   = SpreadsheetApp.create('[MiMuse] ' + phaseName + ' 데이터베이스');
    const ssId = ss.getId();

    // 1) K-뷰티 — rename the default first sheet
    const kbSheet = ss.getSheets()[0];
    kbSheet.setName(SHEET_K_BEAUTY);
    kbSheet.getRange(1, 1, 1, LIST_HEADERS.length).setValues([LIST_HEADERS]);
    kbSheet.setFrozenRows(1);

    // 2)–6) Append in order (insertSheet(name) adds at the end — avoids index bugs)
    const beSheet = ss.insertSheet(SHEET_GENERAL_BEAUTY);
    beSheet.getRange(1, 1, 1, LIST_HEADERS.length).setValues([LIST_HEADERS]);
    beSheet.setFrozenRows(1);

    const confirmedSheet = ss.insertSheet(SHEET_INFLUENCERS);
    confirmedSheet.getRange(1, 1, 1, CONFIRMED_HEADERS.length).setValues([CONFIRMED_HEADERS]);
    confirmedSheet.setFrozenRows(1);

    const DELIVERY_LIST_HEADERS = [
      'No', 'Platform', 'Handle', 'Followers', 'Name', 'Phone', 'Email',
      'Address Line 1', 'Address Line 2', 'City', 'State', 'ZIP', 'Country', 'Product',
    ];
    const deliverySheet = ss.insertSheet(SHEET_DELIVERY_LIST);
    deliverySheet.getRange(1, 1, 1, DELIVERY_LIST_HEADERS.length).setValues([DELIVERY_LIST_HEADERS]);
    deliverySheet.setFrozenRows(1);

    const EMS_HEADERS = [
      'No', 'Name', 'EMS Number', 'US Arrival', 'Registered?',
      'Status', 'Last Update (17track)', 'Email Sent?', 'Email Address',
    ];
    const emsSheet = ss.insertSheet(SHEET_DELIVERY_TRACK);
    emsSheet.getRange(1, 1, 1, EMS_HEADERS.length).setValues([EMS_HEADERS]);
    emsSheet.setFrozenRows(1);

    const MON_HEADERS = ['플랫폼', '계정', '핸들', '영상일', '링크', '조회수', '좋아요', '댓글', '최종업데이트'];
    const monSheet = ss.insertSheet(SHEET_MONITORING);
    monSheet.getRange(1, 1, 1, MON_HEADERS.length).setValues([MON_HEADERS]);
    monSheet.setFrozenRows(1);

    const expected = _expectedPhaseTabNames();
    const actual   = ss.getSheets().map(function (sh) { return sh.getName(); });
    if (actual.length !== expected.length) {
      return {
        error:
          '탭 개수 불일치: 예상 ' +
          expected.length +
          '개, 실제 ' +
          actual.length +
          '개 — ' +
          actual.join(', '),
      };
    }
    for (var i = 0; i < expected.length; i++) {
      if (actual.indexOf(expected[i]) === -1) {
        return {
          error:
            '탭 생성 불완전: "' +
            expected[i] +
            '" 없음. 현재 탭: ' +
            actual.join(', '),
        };
      }
    }

    // Archive current phase, then activate new one
    const props        = PropertiesService.getScriptProperties();
    const phases       = JSON.parse(props.getProperty('PHASES') || '[]');
    const currentPhase = props.getProperty('ACTIVE_PHASE') || '1차';
    const currentId    = getActiveOutreachId();

    if (!phases.find(function(p) { return p.name === currentPhase; })) {
      phases.push({ name: currentPhase, outreachId: currentId, archivedAt: new Date().toISOString() });
    }
    phases.push({ name: phaseName, outreachId: ssId, createdAt: new Date().toISOString() });

    props.setProperty('PHASES',              JSON.stringify(phases));
    props.setProperty('ACTIVE_PHASE',        phaseName);
    props.setProperty('ACTIVE_OUTREACH_ID',  ssId);

    return { ok: true, phaseName: phaseName, outreachId: ssId };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * Allowed spreadsheet IDs for the dashboard: legacy 1·1차, every ID in PHASES, and the current active ID.
 */
function _collectAllowedOutreachIds(props, phases) {
  const allowed = {};
  allowed[PHASE1_SHEET_ID] = true;
  allowed[PHASE1_SHEET_ID] = true;
  var cur = (props.getProperty('ACTIVE_OUTREACH_ID') || '').toString().trim();
  if (cur) allowed[cur] = true;
  for (var i = 0; i < phases.length; i++) {
    var pid = (phases[i].outreachId || '').toString().trim();
    if (pid) allowed[pid] = true;
  }
  return allowed;
}

function _resolvePhaseLabelForOutreachId(id, props, phases) {
  if (id === PHASE1_SHEET_ID) return '1차';
  for (var i = phases.length - 1; i >= 0; i--) {
    if ((phases[i].outreachId || '').toString().trim() === id) {
      return phases[i].name || '차수';
    }
  }
  return props.getProperty('ACTIVE_PHASE') || '1차';
}

/** Switch which spreadsheet all GAS readers use (Script Property ACTIVE_OUTREACH_ID). */
function setActiveDatabase(outreachId) {
  var id = (outreachId || '').toString().trim();
  if (!id) return { error: 'outreachId가 필요합니다.' };

  var props  = PropertiesService.getScriptProperties();
  var phases = JSON.parse(props.getProperty('PHASES') || '[]');
  var allowed = _collectAllowedOutreachIds(props, phases);

  if (!allowed[id]) {
    return { error: '허용되지 않은 스프레드시트 ID입니다. 대시보드에 등록된 DB만 선택할 수 있습니다.' };
  }

  var phaseLabel = _resolvePhaseLabelForOutreachId(id, props, phases);
  props.setProperty('ACTIVE_OUTREACH_ID', id);
  props.setProperty('ACTIVE_PHASE', phaseLabel);

  return { ok: true, activePhase: phaseLabel, activeOutreachId: id };
}

/**
 * Remove one phase record from PHASES (차수 기록). Does not delete the Google Sheet unless trashSheet is true.
 * 1차 고정 DB는 PHASES에 없으므로 이 함수로 삭제할 수 없습니다.
 */
function deletePhase(phaseName, trashSheet) {
  var name = (phaseName || '').toString().trim();
  if (!name) return { error: '차수 이름이 필요합니다.' };

  var props  = PropertiesService.getScriptProperties();
  var phases = JSON.parse(props.getProperty('PHASES') || '[]');

  // 1차 is a hardcoded legacy DB — not stored in PHASES array, handle specially
  if (name === '1차') {
    if (trashSheet && PHASE1_SHEET_ID) {
      try {
        DriveApp.getFileById(PHASE1_SHEET_ID).setTrashed(true);
      } catch (e) {
        return { error: 'Google 시트를 휴지통으로 보내지 못했습니다: ' + e.toString() };
      }
    }
    var activeId = (props.getProperty('ACTIVE_OUTREACH_ID') || '').toString().trim();
    if (activeId === PHASE1_SHEET_ID) {
      var fallback = phases.length > 0 ? phases[phases.length - 1] : null;
      var fid = fallback && (fallback.outreachId || '').toString().trim();
      props.setProperty('ACTIVE_OUTREACH_ID', fid || PHASE1_SHEET_ID);
      props.setProperty('ACTIVE_PHASE', fallback ? (fallback.name || '1차') : '1차');
    }
    return { ok: true, removed: '1차', activePhase: props.getProperty('ACTIVE_PHASE'), activeOutreachId: props.getProperty('ACTIVE_OUTREACH_ID') };
  }

  var idx = -1;
  for (var i = 0; i < phases.length; i++) {
    if (phases[i].name === name) {
      idx = i;
      break;
    }
  }
  if (idx < 0) {
    return { error: '「' + name + '」을(를) 차수 기록에서 찾을 수 없습니다.' };
  }

  var removed = phases[idx];
  var rid     = (removed.outreachId || '').toString().trim();

  if (trashSheet && rid) {
    try {
      DriveApp.getFileById(rid).setTrashed(true);
    } catch (e) {
      return {
        error:
          'Google 시트를 휴지통으로 보내지 못했습니다: ' +
          e.toString() +
          ' — 차수만 제거하려면 휴지통 옵션 없이 다시 시도하세요.',
      };
    }
  }

  phases.splice(idx, 1);
  props.setProperty('PHASES', JSON.stringify(phases));

  var activeId = (props.getProperty('ACTIVE_OUTREACH_ID') || '').toString().trim();
  if (activeId === rid) {
    var fallback = phases.length > 0 ? phases[phases.length - 1] : null;
    var fid      = fallback && (fallback.outreachId || '').toString().trim();
    if (fid) {
      props.setProperty('ACTIVE_OUTREACH_ID', fid);
      props.setProperty('ACTIVE_PHASE', fallback.name || '1차');
    } else {
      props.setProperty('ACTIVE_OUTREACH_ID', PHASE1_SHEET_ID);
      props.setProperty('ACTIVE_PHASE', '1차');
    }
  }

  return {
    ok: true,
    removed: name,
    activePhase: props.getProperty('ACTIVE_PHASE'),
    activeOutreachId: props.getProperty('ACTIVE_OUTREACH_ID'),
  };
}

/**
 * Link an existing spreadsheet to a phase name (no new sheet created).
 * If outreachId is omitted, uses PHASE1_SHEET_ID (1차 데이터베이스).
 */
function linkPhase(phaseName, outreachId) {
  var name = (phaseName || '').toString().trim();
  if (!name) return { error: '차수 이름이 필요합니다.' };

  var id = (outreachId || '').toString().trim() || PHASE1_SHEET_ID;

  var props  = PropertiesService.getScriptProperties();
  var phases = JSON.parse(props.getProperty('PHASES') || '[]');

  if (phases.find(function(p) { return p.name === name; })) {
    return { error: '「' + name + '」은(는) 이미 등록된 차수 이름입니다.' };
  }

  phases.push({ name: name, outreachId: id, linkedAt: new Date().toISOString() });
  props.setProperty('PHASES', JSON.stringify(phases));

  return { ok: true, phaseName: name, outreachId: id };
}

/** Wipe all stored phase records and reset active DB to 1차. */
function clearPhases() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('PHASES', '[]');
  props.setProperty('ACTIVE_PHASE', '1차');
  props.setProperty('ACTIVE_OUTREACH_ID', PHASE1_SHEET_ID);
  return { ok: true, activePhase: '1차', activeOutreachId: PHASE1_SHEET_ID };
}

function routePhase(action, p, body) {
  const b = body || {};
  switch (action) {
    case 'getPhaseInfo':      return getPhaseInfo();
    case 'createNewPhase':    return createNewPhase(b.phaseName);
    case 'setActiveDatabase': return setActiveDatabase(b.outreachId);
    case 'deletePhase':       return deletePhase(b.phaseName, !!b.trashSheet);
    case 'linkPhase':         return linkPhase(b.phaseName, b.outreachId);
    case 'clearPhases':       return clearPhases();
    default: return null;
  }
}
