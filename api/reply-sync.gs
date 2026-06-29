// ============================================================
//  Scheduled reply sync — runs as a GAS time-based trigger
//  Covers: brand_general, brand_personal, influencers
//
//  HOW TO SET UP THE TRIGGER:
//  1. Open GAS editor → Triggers (clock icon on left sidebar)
//  2. Click "+ Add Trigger" (bottom right)
//  3. Choose function: scheduledReplySync
//     Event source: Time-driven
//     Type: Hour timer → Every 6 hours  (or 12 hours)
//  4. Save → authorize when prompted
//
//  The function runs silently in the background, finds new replies
//  via Graph API, and writes results directly to Supabase.
//  No button click required.
// ============================================================

var SYNC_AWAITING_STATUSES = ['', 'yes', 'noreply'];

function scheduledReplySync() {
  var token;
  try {
    token = getOutlookAccessToken();
  } catch (e) {
    Logger.log('Outlook auth failed: ' + e.toString());
    return;
  }

  var brandStats      = _syncTable(token, _getBrandCandidates());
  var influencerStats = _syncTable(token, _getInfluencerCandidates());

  Logger.log(
    'scheduledReplySync complete' +
    ' | brands — updated: ' + brandStats.updated + ', skipped: ' + brandStats.skipped + ', errors: ' + brandStats.errors +
    ' | influencers — updated: ' + influencerStats.updated + ', skipped: ' + influencerStats.skipped + ', errors: ' + influencerStats.errors
  );
}

// ── Brand candidates ──────────────────────────────────────────

function _getBrandCandidates() {
  var candidates = [];

  try {
    var general = supabaseGet(
      '/rest/v1/brand_general?select=id,email,status,last_contact_at,last_reply_at,reply_count&contacted=eq.true'
    );
    (general || []).forEach(function(r) {
      var email = Array.isArray(r.email) ? r.email[0] : r.email;
      if (email && email.trim()) {
        candidates.push({
          id: r.id, table: 'brand_general',
          email: email.trim(),
          status: r.status || '',
          last_contact_at: r.last_contact_at || null,
          last_reply_at:   r.last_reply_at   || null,
          reply_count:     r.reply_count      || 0,
        });
      }
    });
  } catch (e) {
    Logger.log('brand_general fetch failed: ' + e.toString());
  }

  try {
    var personal = supabaseGet(
      '/rest/v1/brand_personal?select=id,personal_email,status,last_contact_at,last_reply_at,reply_count&contacted=eq.true'
    );
    (personal || []).forEach(function(r) {
      var email = Array.isArray(r.personal_email) ? r.personal_email[0] : r.personal_email;
      if (email && email.trim()) {
        candidates.push({
          id: r.id, table: 'brand_personal',
          email: email.trim(),
          status: r.status || '',
          last_contact_at: r.last_contact_at || null,
          last_reply_at:   r.last_reply_at   || null,
          reply_count:     r.reply_count      || 0,
        });
      }
    });
  } catch (e) {
    Logger.log('brand_personal fetch failed: ' + e.toString());
  }

  Logger.log('Brand candidates: ' + candidates.length);
  return candidates;
}

// ── Influencer candidates ─────────────────────────────────────

function _getInfluencerCandidates() {
  var candidates = [];

  try {
    var rows = supabaseGet(
      '/rest/v1/influencers?select=id,email,status,last_contact_at,last_reply_at,reply_count&contacted=eq.true'
    );
    (rows || []).forEach(function(r) {
      if (r.email && r.email.trim()) {
        candidates.push({
          id: r.id, table: 'influencers',
          email: r.email.trim(),
          status: r.status || '',
          last_contact_at: r.last_contact_at || null,
          last_reply_at:   r.last_reply_at   || null,
          reply_count:     r.reply_count      || 0,
        });
      }
    });
  } catch (e) {
    Logger.log('influencers fetch failed: ' + e.toString());
  }

  Logger.log('Influencer candidates: ' + candidates.length);
  return candidates;
}

// ── Core sync loop (shared by brands + influencers) ──────────

function _syncTable(token, candidates) {
  var updated = 0;
  var skipped = 0;
  var errors  = 0;

  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    try {
      var entry = _fetchLatestFromSender(token, c.email);
      if (!entry || !entry.receivedAt) { skipped++; continue; }

      var recvMs = new Date(entry.receivedAt).getTime();
      if (isNaN(recvMs)) { skipped++; continue; }

      // Skip if reply is older than when we last sent
      var sinceMs = c.last_contact_at ? new Date(c.last_contact_at).getTime() : NaN;
      if (!isNaN(sinceMs) && recvMs < sinceMs - 2000) { skipped++; continue; }

      // Skip if already recorded
      var lastMs = c.last_reply_at ? new Date(c.last_reply_at).getTime() : NaN;
      if (!isNaN(lastMs) && recvMs <= lastMs) { skipped++; continue; }

      var patch = {
        last_reply_at: entry.receivedAt,
        reply_count: (c.reply_count || 0) + 1,
      };
      if (SYNC_AWAITING_STATUSES.indexOf(c.status) >= 0) {
        patch.status = 'reply';
      }

      var result = supabasePatch(c.table, 'id=eq.' + c.id, patch);
      if (result.ok) {
        updated++;
        Logger.log('Updated: ' + c.email + ' (' + c.table + ')');
      } else {
        errors++;
        Logger.log('Patch failed for ' + c.email + ': ' + result.text);
      }
    } catch (e) {
      errors++;
      Logger.log('Error for ' + c.email + ': ' + e.toString());
    }
  }

  return { updated: updated, skipped: skipped, errors: errors };
}
