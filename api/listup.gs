// ============================================================
//  TikTok Creator Search — Apify integration
//  Influencer DB is now managed in Supabase (not Google Sheets).
// ============================================================

function buildHandleSet_(raw) {
  var set = {};
  if (!raw) return set;
  var list = Array.isArray(raw) ? raw : String(raw).split(',');
  for (var i = 0; i < list.length; i++) {
    var h = String(list[i] || '').trim().toLowerCase();
    if (h) set[h] = true;
  }
  return set;
}

function resolveSearchFilters_(searchFilters, filterConditions, legacy) {
  var sf = searchFilters || {};
  var leg = legacy || {};

  var flags = {
    followerMin:         +(sf.followerMin || leg.followerMin) || 0,
    followerMax:         +(sf.followerMax || leg.followerMax) || 0,
    maxCreators:         +(sf.maxCreators || leg.maxCreators || leg.targetCreators) || 0,
    maxFollowingRatio:   +(sf.maxRatio || sf.maxFollowingRatio || leg.maxFollowingRatio) || 0,
    maxUploadDays:       +(sf.maxUploadDays || leg.maxUploadDays) || 0,
    proxyCountry:        sf.proxyCountry || leg.proxyCountry || 'US',
    requireEmail:        sf.requireEmail !== false,
    dedupExisting:       false,
    manualReview:        [],
  };

  if (filterConditions && filterConditions.length) {
    for (var i = 0; i < filterConditions.length; i++) {
      var fc = filterConditions[i] || {};
      var cat = String(fc.cat || '').trim();
      var desc = String(fc.desc || '').trim();

      if (fc.manual || cat.indexOf('영상') !== -1 || cat.indexOf('퀄리티') !== -1) {
        if (cat) flags.manualReview.push({ cat: cat, desc: desc });
        continue;
      }
      if (fc.type === 'dedup' || cat.indexOf('중복') !== -1 || desc.indexOf('중복') !== -1) {
        if (fc.enabled !== false) flags.dedupExisting = true;
      }
      if (cat.indexOf('이메일') !== -1 || desc.indexOf('이메일') !== -1) {
        flags.requireEmail = true;
      }
    }
  }

  return flags;
}

function startCreatorSearch(params) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
    if (!token) return { error: 'Script Properties에 APIFY_TOKEN을 추가하세요.' };

    const flags        = resolveSearchFilters_(params.searchFilters, params.filterConditions, params);
    const queries      = params.hashtags || params.tags || [];
    const targetCreators = flags.maxCreators || 100;
    const proxyCountry = flags.proxyCountry || 'US';
    const queryCount   = Math.max(queries.length, 1);
    const postsPerQuery = Math.min(Math.ceil(targetCreators / queryCount / 0.25), 200);

    const runInput = {
      searchQueries:                 queries,
      resultsPerPage:                postsPerQuery,
      region:                        proxyCountry,
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
    return {
      ok: true,
      runId: body.data.id,
      datasetId: body.data.defaultDatasetId,
      status: body.data.status,
      appliedFilters: {
        proxyCountry: proxyCountry,
        maxCreators: targetCreators,
        queryCount: queries.length,
      },
    };
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
    if (res.getResponseCode() !== 200) {
      return { error: 'Run not found', notFound: true };
    }
    const body  = JSON.parse(res.getContentText());
    if (!body.data) return { error: 'Run not found', notFound: true };
    return { status: body.data.status, datasetId: body.data.defaultDatasetId };
  } catch (e) {
    return { error: e.toString() };
  }
}

function getRunResults(datasetId, searchFilters, filterConditions, existingHandles, legacy) {
  try {
    const flags = resolveSearchFilters_(searchFilters, filterConditions, legacy);
    const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
    const limit = Math.min(500, Math.max(50, (flags.maxCreators || 100) * 5));
    const res   = UrlFetchApp.fetch(
      'https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + token + '&limit=' + limit,
      { muteHttpExceptions: true }
    );
    const items = JSON.parse(res.getContentText());

    const creatorsMap = {};
    const existingSet = flags.dedupExisting ? buildHandleSet_(existingHandles) : {};

    for (const item of items) {
      const meta      = item.authorMeta || {};
      const handle    = meta.name;
      if (!handle) continue;
      const followers = meta.fans || 0;
      if (flags.followerMin && followers < flags.followerMin) continue;
      if (flags.followerMax && followers > flags.followerMax) continue;

      const following = meta.following || 0;
      if (flags.maxFollowingRatio > 0 && followers > 0 && (following / followers * 100) > flags.maxFollowingRatio) continue;

      if (!creatorsMap[handle]) {
        const bio        = (meta.signature || '').substring(0, 300);
        const emailMatch = bio.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        creatorsMap[handle] = {
          handle,
          displayName : meta.nickName || '',
          followers,
          following,
          bio,
          profileUrl  : 'https://www.tiktok.com/@' + handle,
          email       : emailMatch ? emailMatch[0] : '',
          totalLikes  : meta.heart || meta.heartCount || meta.digg || 0,
          videoCount  : meta.video || meta.videoCount || 0,
          videos      : [],
          latestPost  : null,
        };
      }

      const postDate = item.createTimeISO ? new Date(item.createTimeISO)
                     : item.createTime    ? new Date(item.createTime * 1000)
                     : null;
      if (postDate && (!creatorsMap[handle].latestPost || postDate > creatorsMap[handle].latestPost)) {
        creatorsMap[handle].latestPost = postDate;
      }

      const plays    = parseInt(item.playCount)    || 0;
      const diggs    = parseInt(item.diggCount)    || 0;
      const comments = parseInt(item.commentCount) || 0;
      const shares   = parseInt(item.shareCount)   || 0;
      if (plays > 0 || diggs > 0) {
        creatorsMap[handle].videos.push({ plays, diggs, comments, shares });
      }
    }

    const cutoff = flags.maxUploadDays > 0 ? new Date(Date.now() - flags.maxUploadDays * 86400000) : null;

    const mapped = Object.values(creatorsMap)
      .filter(function(c) { return !cutoff || !c.latestPost || c.latestPost >= cutoff; })
      .map(c => {
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

    var noEmailSkipped = 0;
    var dedupSkipped   = 0;
    var filtered       = [];
    var cap            = flags.maxCreators > 0 ? flags.maxCreators : 0;

    for (var i = 0; i < mapped.length; i++) {
      var c = mapped[i];
      if (flags.requireEmail && (!c.email || !String(c.email).trim())) { noEmailSkipped++; continue; }
      if (flags.dedupExisting && existingSet[String(c.handle).toLowerCase()]) { dedupSkipped++; continue; }
      filtered.push(c);
      if (cap > 0 && filtered.length >= cap) break;
    }

    const limited = cap > 0 ? filtered.slice(0, cap) : filtered;
    return {
      ok: true,
      creators: limited,
      noEmailSkipped: noEmailSkipped,
      dedupSkipped: dedupSkipped,
      appliedFilters: {
        followerMin: flags.followerMin,
        followerMax: flags.followerMax,
        maxFollowingRatio: flags.maxFollowingRatio,
        maxUploadDays: flags.maxUploadDays,
        maxCreators: flags.maxCreators,
        requireEmail: flags.requireEmail,
        dedupExisting: flags.dedupExisting,
      },
      manualReview: flags.manualReview,
    };
  } catch (e) {
    return { error: e.toString() };
  }
}

function resolveDatasetId_(id) {
  if (!id) return { error: 'ID가 필요합니다.' };
  var token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) return { error: 'Script Properties에 APIFY_TOKEN을 추가하세요.' };

  var runRes = UrlFetchApp.fetch(
    'https://api.apify.com/v2/actor-runs/' + id + '?token=' + token,
    { muteHttpExceptions: true }
  );
  if (runRes.getResponseCode() === 200) {
    var runBody = JSON.parse(runRes.getContentText());
    if (runBody.data) {
      if (runBody.data.status !== 'SUCCEEDED') {
        return { error: 'Run 미완료: ' + runBody.data.status, status: runBody.data.status };
      }
      return { datasetId: runBody.data.defaultDatasetId };
    }
  }

  var dsRes = UrlFetchApp.fetch(
    'https://api.apify.com/v2/datasets/' + id + '?token=' + token,
    { muteHttpExceptions: true }
  );
  if (dsRes.getResponseCode() === 200) return { datasetId: id };

  return { error: '유효하지 않은 Run ID 또는 Dataset ID입니다.' };
}

function loadCreatorResults(params) {
  var p = params || {};
  var datasetId = p.datasetId;
  if (!datasetId) {
    var resolved = resolveDatasetId_(p.runId || p.id);
    if (resolved.error) return resolved;
    datasetId = resolved.datasetId;
  }
  return getRunResults(
    datasetId,
    p.searchFilters,
    p.filterConditions,
    p.existingHandles,
    p
  );
}

function routeListup(action, p, body) {
  const b = body || {}, q = p || {};
  switch (action) {
    case 'checkRunStatus':
      return checkRunStatus(q.runId || b.runId);
    case 'getRunResults':
      return getRunResults(
        q.datasetId || b.datasetId,
        b.searchFilters || q.searchFilters,
        b.filterConditions || q.filterConditions,
        b.existingHandles || q.existingHandles,
        b
      );
    case 'loadCreatorResults':
      return loadCreatorResults(b);
    case 'startCreatorSearch':
      return startCreatorSearch(b);
    default:
      return null;
  }
}
