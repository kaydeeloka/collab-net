// ============================================================
//  supabase.gs — shared Supabase REST helpers
//
//  Script Properties: SUPABASE_PROJECT_URL, SUPABASE_KEY
//  Used by monitoring.gs, beauty-news.gs, 17-track.gs, etc.
// ============================================================

function supabaseConfig() {
  var url = scriptProp('SUPABASE_PROJECT_URL') || '';
  if (url.charAt(url.length - 1) === '/') url = url.slice(0, -1);
  return { url: url, key: scriptProp('SUPABASE_KEY') || '' };
}

function supabaseHeaders(extra) {
  var cfg = supabaseConfig();
  var h = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  if (extra) {
    Object.keys(extra).forEach(function(k) { h[k] = extra[k]; });
  }
  return h;
}

function supabaseRequireConfig() {
  var cfg = supabaseConfig();
  if (!cfg.url || !cfg.key) throw new Error('SUPABASE_PROJECT_URL / SUPABASE_KEY missing');
  return cfg;
}

/** @returns {{ ok: boolean, status: number, data: *, text: string }} */
function supabaseRequest(pathQuery, options) {
  options = options || {};
  var cfg = supabaseRequireConfig();
  var headers = supabaseHeaders(options.headers);
  if (options.prefer) headers.Prefer = options.prefer;

  var opts = {
    method: (options.method || 'get').toUpperCase(),
    headers: headers,
    muteHttpExceptions: true,
  };
  if (options.payload !== undefined) {
    opts.contentType = 'application/json';
    opts.payload = typeof options.payload === 'string'
      ? options.payload
      : JSON.stringify(options.payload);
  }

  var res = UrlFetchApp.fetch(cfg.url + pathQuery, opts);
  var status = res.getResponseCode();
  var text = res.getContentText() || '';
  var data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = text; }
  }
  return { ok: status >= 200 && status < 300, status: status, data: data, text: text };
}

function supabaseGet(pathQuery) {
  var result = supabaseRequest(pathQuery, { method: 'get' });
  if (!result.ok) {
    throw new Error('Supabase GET HTTP ' + result.status + ': ' + result.text.slice(0, 200));
  }
  return result.data;
}

function supabaseUpsert(table, payload, onConflict) {
  var path = '/rest/v1/' + table;
  if (onConflict) path += '?on_conflict=' + encodeURIComponent(onConflict);
  return supabaseRequest(path, {
    method: 'post',
    payload: payload,
    prefer: onConflict ? 'resolution=merge-duplicates' : undefined,
  });
}

function supabasePatch(table, matchQuery, payload) {
  return supabaseRequest('/rest/v1/' + table + '?' + matchQuery, {
    method: 'PATCH',
    payload: payload,
    prefer: 'return=minimal',
  });
}
