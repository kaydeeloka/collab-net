// ============================================================
//  Tab: 인플루언서 리스트업 + 크리에이터 탐색 (Apify)
//  Requires Script Property: APIFY_TOKEN
// ============================================================

// 16 columns — must match the K-뷰티 / 일반뷰티 sheet headers exactly
const LISTUP_HEADERS = [
  'Timestamp', '순위', 'Handle', 'Display Name', 'Email',
  'Followers', 'Following', 'Following Ratio (%)',
  'Total Likes', 'Video Count',
  'Engagement Rate (%)', 'Bio', 'Profile URL',
  'Outreach', 'Reply Body', 'Reply Date',
];

function getInfluencerList() {
  try {
    const ss = SpreadsheetApp.openById(getActiveOutreachId());

    const kb = _readInfluencerTab(ss, SHEET_K_BEAUTY);
    const be = _readInfluencerTab(ss, SHEET_GENERAL_BEAUTY);

    // All sheets use the standard 16-column header — colIdx is fixed
    const colIdx = kb.colIdx;

    const combined = [
      ...(kb.rows || []).map((r, i) => ({ row: r, sheetRow: (kb.rowNums || [])[i], sheetName: kb.sheetTabName })),
      ...(be.rows || []).map((r, i) => ({ row: r, sheetRow: (be.rowNums || [])[i], sheetName: be.sheetTabName })),
    ];

    const TIERS  = ['1순위', '2순위', '3순위', '4순위', '5순위'];
    const result = {};
    TIERS.forEach(tier => {
      const tierNum = tier.replace('순위', '');
      const items = combined.filter(x => {
        const val = (x.row[COL_RANK] || '').toString().trim();
        return val === tier || val === tierNum;
      });
      const totalFollowers = items.reduce((s, x) => s + (parseInt(x.row[COL_FOLLOWERS]) || 0), 0);
      result[tier] = {
        headers  : LISTUP_HEADERS.slice(),
        rows     : items.map(x => x.row),
        rowNums  : items.map(x => x.sheetRow),
        sheetNames: items.map(x => x.sheetName),
        colIdx,
        stats    : { total: items.length, totalFollowers },
      };
    });
    return result;
  } catch (e) {
    return { error: e.toString() };
  }
}

function _readInfluencerTab(ss, tabName) {
  var ws = ss.getSheetByName(tabName);
  var sheetTabName = ws ? ws.getName() : tabName;
  if (!ws) return { headers: [], rows: [], rowNums: [], colIdx: {}, stats: { total: 0, totalFollowers: 0 }, error: tabName + ' 탭을 찾을 수 없습니다.', sheetTabName: sheetTabName };
  const all = ws.getDataRange().getValues();
  if (all.length < 2) return { headers: all.length ? all[0].map(h => h.toString()) : [], rows: [], rowNums: [], colIdx: {}, stats: { total: 0, totalFollowers: 0 }, sheetTabName: sheetTabName };

  const rowsWithIdx = all.slice(1)
    .map((r, i) => ({ row: r, sheetRow: i + 2 }))
    .filter(({ row }) => row.some(c => c !== null && c.toString().trim() !== ''));

  const totalFollowers = rowsWithIdx.reduce((s, { row: r }) => s + (parseInt(r[COL_FOLLOWERS]) || 0), 0);

  return {
    headers : LISTUP_HEADERS.slice(),
    rows    : rowsWithIdx.map(x => x.row.map(c => c.toString())),
    rowNums : rowsWithIdx.map(x => x.sheetRow),
    colIdx  : {
      name      : COL_DISPLAY_NAME,
      handle    : COL_HANDLE,
      followers : COL_FOLLOWERS,
      following : COL_FOLLOWING,
      rank      : COL_RANK,
      email     : COL_EMAIL,
      outreach  : COL_OUTREACH,
      totalLikes: COL_TOTAL_LIKES,
      videoCount: COL_VIDEO_COUNT,
      engRate   : COL_ENGAGE_RATE,
    },
    stats   : { total: rowsWithIdx.length, totalFollowers },
    sheetTabName,
  };
}

function startCreatorSearch(params) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
    if (!token) return { error: 'Script Properties에 APIFY_TOKEN을 추가하세요. (프로젝트 설정 → 스크립트 속성)' };

    const runInput = {
      hashtags:                      params.tags || [],
      resultsPerPage:                Math.min(params.postsPerTag || 90, 200),
      region:                        'US',
      shouldDownloadVideos:          false,
      shouldDownloadCovers:          false,
      shouldDownloadSubtitles:       false,
      shouldDownloadSlideshowImages: false,
      maxRequestRetries:             3,
    };

    const res  = UrlFetchApp.fetch(
      'https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=' + token,
      { method: 'post', contentType: 'application/json', payload: JSON.stringify(runInput), muteHttpExceptions: true }
    );
    const body = JSON.parse(res.getContentText());
    if (!body.data) return { error: 'Apify 오류: ' + res.getContentText().substring(0, 300) };
    return { ok: true, runId: body.data.id, datasetId: body.data.defaultDatasetId, status: body.data.status };
  } catch (e) {
    return { error: e.toString() };
  }
}

function checkRunStatus(runId) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
    const res   = UrlFetchApp.fetch(
      'https://api.apify.com/v2/actor-runs/' + runId + '?token=' + token,
      { muteHttpExceptions: true }
    );
    const body  = JSON.parse(res.getContentText());
    return { status: body.data.status, datasetId: body.data.defaultDatasetId };
  } catch (e) {
    return { error: e.toString() };
  }
}

function getRunResults(datasetId, followerMin, followerMax, maxCreators) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
    const res   = UrlFetchApp.fetch(
      'https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + token + '&limit=500',
      { muteHttpExceptions: true }
    );
    const items      = JSON.parse(res.getContentText());
    const creatorsMap = {};

    for (const item of items) {
      const meta      = item.authorMeta || {};
      const handle    = meta.name;
      if (!handle) continue;
      const followers = meta.fans || 0;
      if (followerMin && followers < followerMin) continue;
      if (followerMax && followers > followerMax) continue;

      if (!creatorsMap[handle]) {
        const bio        = (meta.signature || '').substring(0, 300);
        const emailMatch = bio.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        creatorsMap[handle] = {
          handle,
          displayName : meta.nickName || '',
          followers,
          following   : meta.following || 0,
          bio,
          profileUrl  : 'https://www.tiktok.com/@' + handle,
          verified    : meta.verified ? 'Y' : '',
          email       : emailMatch ? emailMatch[0] : '',
          totalLikes  : meta.heart || meta.heartCount || meta.digg || 0,
          videoCount  : meta.video || meta.videoCount || 0,
          videos      : [],
        };
      }

      const plays    = parseInt(item.playCount)    || 0;
      const diggs    = parseInt(item.diggCount)    || 0;
      const comments = parseInt(item.commentCount) || 0;
      const shares   = parseInt(item.shareCount)   || 0;
      if (plays > 0 || diggs > 0) {
        creatorsMap[handle].videos.push({ plays, diggs, comments, shares });
      }
    }

    const creators = Object.values(creatorsMap).map(c => {
      const vids          = c.videos;
      const totalViews    = vids.length ? vids.reduce((s,v) => s+v.plays, 0) : 0;
      const totalLikesVid = vids.length ? vids.reduce((s,v) => s+v.diggs, 0) : 0;
      const avgViews      = vids.length > 0 ? Math.round(totalViews / vids.length) : 0;
      const engRate       = avgViews > 0
        ? parseFloat((totalLikesVid / avgViews * 100).toFixed(2)) : 0;
      return {
        handle     : c.handle,
        displayName: c.displayName,
        email      : c.email,
        followers  : c.followers,
        following  : c.following,
        ratio      : c.followers ? Math.round(c.following / c.followers * 100) + '%' : '',
        totalLikes : c.totalLikes,
        videoCount : c.videoCount,
        avgViews,
        engRate,
        bio        : c.bio,
        profileUrl : c.profileUrl,
      };
    });

    const limited = maxCreators > 0 ? creators.slice(0, maxCreators) : creators;
    return { ok: true, creators: limited };
  } catch (e) {
    return { error: e.toString() };
  }
}

function appendCreatorsToSheet(creators, rank, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(getActiveOutreachId());
    var target = sheetName || SHEET_K_BEAUTY;
    var ws = ss.getSheetByName(target);
    if (!ws) return { error: (sheetName || '시트') + '를 찾을 수 없습니다.' };
    // Always write the canonical headers to row 1
    ws.getRange(1, 1, 1, LISTUP_HEADERS.length).setValues([LISTUP_HEADERS]);
    ws.setFrozenRows(1);
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const rows = creators.map(c => [
      today,        // Timestamp
      rank,         // 순위
      c.handle,     // Handle
      c.displayName,// Display Name
      c.email,      // Email
      c.followers,  // Followers
      c.following,  // Following
      c.ratio,      // Following Ratio (%)
      c.totalLikes, // Total Likes
      c.videoCount, // Video Count
      c.engRate,    // Engagement Rate (%)
      c.bio,        // Bio
      c.profileUrl, // Profile URL
      '',           // Outreach
      '',           // Reply Body
      '',           // Reply Date
    ]);
    ws.getRange(ws.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return { ok: true, count: creators.length };
  } catch (e) {
    return { error: e.toString() };
  }
}

function deleteInfluencerRow(sheetRow, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(getActiveOutreachId());
    var ws = ss.getSheetByName(sheetName);
    if (!ws) return { ok: false, error: sheetName + ' 탭을 찾을 수 없습니다.' };
    ws.deleteRow(sheetRow);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

function routeListup(action, p, body) {
  const b = body || {}, q = p || {};
  switch (action) {
    case 'getInfluencerList':     return getInfluencerList();
    case 'checkRunStatus':        return checkRunStatus(q.runId || b.runId);
    case 'getRunResults':         return getRunResults(q.datasetId || b.datasetId, +(q.followerMin || b.followerMin) || 0, +(q.followerMax || b.followerMax) || 0, +(q.maxCreators || b.maxCreators) || 0);
    case 'startCreatorSearch':    return startCreatorSearch(b.params);
    case 'appendCreatorsToSheet': return appendCreatorsToSheet(b.creators, b.rank, b.sheetName);
    case 'deleteInfluencerRow':   return deleteInfluencerRow(b.sheetRow, b.sheetName);
    default: return null;
  }
}

