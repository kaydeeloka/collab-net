// ============================================================
//  Google Form -> confirmed_influencers importer
//
//  Give it a Google Sheet link (the Form's response sheet) and it
//  reads named columns, matches each row to an existing
//  influencers/confirmed_influencers record by handle (falls back
//  to Full Name), and writes phone / repost / address / notes
//  directly into Supabase.
//
//  Address parsing is best-effort (US addresses are written too
//  inconsistently for a reliable regex) — always check the
//  `results[].parsedAddress` / `lowConfidence` flags in the response.
// ============================================================

var US_STATE_NAME_TO_ABBR = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
};

function _findHeaderIndex(headers, needle) {
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].toLowerCase().indexOf(needle) >= 0) return i;
  }
  return -1;
}

function _formatUsPhone(raw) {
  var digits = (raw || '').toString().replace(/\D/g, '');
  if (digits.length === 10) return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  if (digits.length === 11 && digits.charAt(0) === '1') return digits.slice(1, 4) + '-' + digits.slice(4, 7) + '-' + digits.slice(7);
  return (raw || '').toString().trim();
}

function _mapRepostAnswer(raw) {
  var s = (raw || '').toString().toLowerCase().trim();
  if (!s) return { value: '', lowConfidence: true };
  if (s.indexOf('ask me first') >= 0 || s.indexOf('ask first') >= 0 || s.indexOf('discuss this separately') >= 0 || s.indexOf('discuss separately') >= 0) {
    return { value: '▲', lowConfidence: false };
  }
  if (s.indexOf('not comfortable') >= 0 || s.indexOf('rather not') >= 0 || s.indexOf('no') === 0) {
    return { value: 'X', lowConfidence: false };
  }
  if (s.indexOf('yes') === 0 || s.indexOf('absolutely') >= 0) {
    return { value: 'O', lowConfidence: false };
  }
  return { value: '', lowConfidence: true };
}

function _normalizeNote(raw) {
  var s = (raw || '').toString().trim();
  if (!s) return '';
  var blanks = ['n/a', 'na', 'none', 'none!', 'no', 'nope', '-', 'nothing'];
  if (blanks.indexOf(s.toLowerCase().replace(/[.!]+$/, '')) >= 0) return '';
  return s;
}

/** Best-effort US address splitter. Returns line1/line2/city/state/zip + a lowConfidence flag. */
function _parseUsAddress(raw) {
  var lowConfidence = false;
  var text = (raw || '').toString().replace(/[\r\n]+/g, ', ').replace(/\s+/g, ' ').trim();
  text = text.replace(/,?\s*(united states( of america)?|u\.s\.a\.?|usa|u\.s\.?)\s*\.?\s*$/i, '').trim();

  var zip = '';
  var zipMatch = text.match(/(\d{5})(-\d{4})?\s*$/);
  if (zipMatch) {
    zip = zipMatch[1];
    text = text.slice(0, zipMatch.index).trim().replace(/,\s*$/, '');
  } else {
    lowConfidence = true;
  }

  var state = '';
  var tokens = text.split(/[\s,]+/).filter(Boolean);
  if (tokens.length) {
    var last = tokens[tokens.length - 1];
    if (/^[A-Za-z]{2}$/.test(last)) {
      state = last.toUpperCase();
      tokens.pop();
      text = tokens.join(' ');
    } else {
      var lowerText = text.toLowerCase();
      var bestName = '';
      for (var name in US_STATE_NAME_TO_ABBR) {
        var idx = lowerText.lastIndexOf(name);
        if (idx >= 0 && idx + name.length >= lowerText.length - 2 && name.length > bestName.length) {
          bestName = name;
        }
      }
      if (bestName) {
        state = US_STATE_NAME_TO_ABBR[bestName];
        var cutIdx = lowerText.lastIndexOf(bestName);
        text = text.slice(0, cutIdx).trim().replace(/,\s*$/, '');
      } else {
        lowConfidence = true;
      }
    }
  }

  var city = '';
  var addrPart = text;
  var commaIdx = text.lastIndexOf(',');
  if (commaIdx >= 0) {
    city = text.slice(commaIdx + 1).trim();
    addrPart = text.slice(0, commaIdx).trim();
  } else {
    var parts = text.split(' ');
    city = parts.pop() || '';
    addrPart = parts.join(' ');
    lowConfidence = true;
  }

  var line1 = addrPart, line2 = '';
  var aptMatch = addrPart.match(/(.*?)[,]?\s*((?:apt|apartment|unit|suite|ste|#)\.?\s*\S+)\s*$/i);
  if (aptMatch) {
    line1 = aptMatch[1].trim();
    line2 = aptMatch[2].trim();
  }

  if (!line1 || !city || !state || !zip) lowConfidence = true;

  return {
    address_line_1: line1,
    address_line_2: line2,
    city: city,
    state: state,
    zip: zip,
    lowConfidence: lowConfidence,
  };
}

function _openFormSheet(sheetUrl, sheetName) {
  var ss = SpreadsheetApp.openByUrl(sheetUrl);
  if (sheetName) {
    var named = ss.getSheetByName(sheetName);
    if (named) return named;
  }
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase().indexOf('respon') >= 0) return sheets[i];
  }
  return sheets[0];
}

function importConfirmedInfluencerForm(body) {
  var sheetUrl = (body.sheetUrl || '').toString().trim();
  if (!sheetUrl) return { error: 'sheetUrl이 필요합니다.' };
  var phaseId = (body.phaseId || '').toString().trim();

  try {
    var sheet = _openFormSheet(sheetUrl, body.sheetName);
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return { error: '시트에 데이터가 없습니다.' };

    var headers = data[0].map(function(h) { return (h || '').toString(); });
    var idx = {
      fullName:    _findHeaderIndex(headers, 'full name'),
      accountName: _findHeaderIndex(headers, 'account name'),
      address:     _findHeaderIndex(headers, 'shipping address'),
      phone:       _findHeaderIndex(headers, 'phone number'),
      resharing:   _findHeaderIndex(headers, 'resharing') >= 0 ? _findHeaderIndex(headers, 'resharing') : _findHeaderIndex(headers, 'reshare'),
      notes:       _findHeaderIndex(headers, 'special requests') >= 0 ? _findHeaderIndex(headers, 'special requests') : _findHeaderIndex(headers, 'concerns'),
    };
    var missing = [];
    if (idx.fullName < 0)    missing.push('Full Name');
    if (idx.address < 0)     missing.push('Complete Shipping Address');
    if (idx.phone < 0)       missing.push('Phone Number');
    if (idx.resharing < 0)   missing.push('resharing question');
    if (idx.notes < 0)       missing.push('special requests question');
    if (missing.length) return { error: '시트에서 컬럼을 찾을 수 없습니다: ' + missing.join(', ') };

    var results = [];
    var unmatched = [];
    var matchedCount = 0;

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var fullName    = (row[idx.fullName] || '').toString().trim();
      var accountName = idx.accountName >= 0 ? (row[idx.accountName] || '').toString().trim() : '';
      var addressRaw  = (row[idx.address] || '').toString();
      var phoneRaw     = (row[idx.phone] || '').toString();
      var resharingRaw = (row[idx.resharing] || '').toString();
      var notesRaw      = (row[idx.notes] || '').toString();

      if (!fullName && !accountName) continue;

      var handle = accountName.replace(/^@/, '').trim();

      var influencer = null;
      if (handle) {
        var byHandle = supabaseGet('/rest/v1/influencers?select=id,handle,display_name&handle=ilike.' + encodeURIComponent(handle) +
          (phaseId ? '&phase_id=eq.' + phaseId : ''));
        if (Array.isArray(byHandle) && byHandle.length) influencer = byHandle[0];
      }
      if (!influencer) {
        unmatched.push({ fullName: fullName, accountName: accountName });
        continue;
      }

      var confirmedRows = supabaseGet('/rest/v1/confirmed_influencers?select=id&influencer_id=eq.' + influencer.id);
      if (!Array.isArray(confirmedRows) || !confirmedRows.length) {
        unmatched.push({ fullName: fullName, accountName: accountName, reason: 'influencer found but not confirmed' });
        continue;
      }
      var confirmedId = confirmedRows[0].id;

      var addr = _parseUsAddress(addressRaw);
      var repostResult = _mapRepostAnswer(resharingRaw);
      var phone = _formatUsPhone(phoneRaw);
      var note = _normalizeNote(notesRaw);

      var payload = {
        phone:          phone || null,
        repost:         repostResult.value || null,
        address_line_1: addr.address_line_1 || null,
        address_line_2: addr.address_line_2 || null,
        city:           addr.city || null,
        state:          addr.state || null,
        zip:            addr.zip || null,
        country:        'US',
        notes:          note || null,
      };

      var patchResult = supabasePatch('confirmed_influencers', 'id=eq.' + confirmedId, payload);
      if (!patchResult.ok) {
        unmatched.push({ fullName: fullName, accountName: accountName, reason: 'write failed: ' + patchResult.status });
        continue;
      }

      if (fullName && fullName !== influencer.display_name) {
        supabasePatch('influencers', 'id=eq.' + influencer.id, { display_name: fullName });
      }

      matchedCount++;
      results.push({
        handle: influencer.handle,
        displayName: fullName || influencer.display_name,
        parsedAddress: addr,
        repost: repostResult.value,
        notes: note,
        lowConfidence: addr.lowConfidence || repostResult.lowConfidence,
      });
    }

    return {
      ok: true,
      total: data.length - 1,
      matchedCount: matchedCount,
      unmatchedCount: unmatched.length,
      unmatched: unmatched,
      results: results,
      message: matchedCount + '명 업데이트 완료' + (unmatched.length ? ', ' + unmatched.length + '명 매칭 실패' : ''),
    };
  } catch (e) {
    return { error: e.toString() };
  }
}

function getFormSheetRowCount(body) {
  var b = body || {};
  var sheetUrl = (b.sheetUrl || '').toString().trim();
  if (!sheetUrl) return { error: 'sheetUrl이 필요합니다.' };
  try {
    var sheet = _openFormSheet(sheetUrl, b.sheetName);
    return { ok: true, rowCount: Math.max(0, sheet.getLastRow() - 1) };
  } catch (e) {
    return { error: e.toString() };
  }
}

function routeConfirmedImport(action, p, body) {
  switch (action) {
    case 'importConfirmedInfluencerForm': return importConfirmedInfluencerForm(body || {});
    case 'getFormSheetRowCount':          return getFormSheetRowCount(body || {});
    default: return null;
  }
}
