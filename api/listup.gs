// ============================================================
//  TikTok Creator Search — Apify integration
//  Influencer DB is now managed in Supabase (not Google Sheets).
// ============================================================

function startCreatorSearch(params) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
    if (!token) return { error: 'Script Properties에 APIFY_TOKEN을 추가하세요.' };

    const queries        = params.hashtags || params.tags || [];
    const targetCreators = params.targetCreators || 100;
    const proxyCountry   = params.proxyCountry || 'US';
    const queryCount     = Math.max(queries.length, 1);
    const postsPerQuery  = Math.min(Math.ceil(targetCreators / queryCount / 0.25), 200);

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

function getRunResults(datasetId, followerMin, followerMax, maxCreators, maxFollowingRatio, maxUploadDays) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
    const res   = UrlFetchApp.fetch(
      'https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + token + '&limit=500',
      { muteHttpExceptions: true }
    );
    const items = JSON.parse(res.getContentText());

    const creatorsMap = {};

    for (const item of items) {
      const meta      = item.authorMeta || {};
      const handle    = meta.name;
      if (!handle) continue;
      const followers = meta.fans || 0;
      if (followerMin && followers < followerMin) continue;
      if (followerMax && followers > followerMax) continue;

      const following = meta.following || 0;
      if (maxFollowingRatio > 0 && followers > 0 && (following / followers * 100) > maxFollowingRatio) continue;

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

    const cutoff = maxUploadDays > 0 ? new Date(Date.now() - maxUploadDays * 86400000) : null;

    const creators = Object.values(creatorsMap)
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

    const limited = maxCreators > 0 ? creators.slice(0, maxCreators) : creators;
    return { ok: true, creators: limited };
  } catch (e) {
    return { error: e.toString() };
  }
}

function routeListup(action, p, body) {
  const b = body || {}, q = p || {};
  switch (action) {
    case 'checkRunStatus':     return checkRunStatus(q.runId || b.runId);
    case 'getRunResults':      return getRunResults(q.datasetId || b.datasetId, +(q.followerMin || b.followerMin) || 0, +(q.followerMax || b.followerMax) || 0, +(q.maxCreators || b.maxCreators) || 0, +(q.maxFollowingRatio || b.maxFollowingRatio) || 0, +(q.maxUploadDays || b.maxUploadDays) || 0);
    case 'startCreatorSearch': return startCreatorSearch(b);
    default: return null;
  }
}
