import { supabase } from '@/lib/supabase'
import { defaultProfileUrl } from '@/lib/content-platforms'

export interface InfluencerConfirmSource {
  id: string
  handle: string
  display_name: string | null
  email: string | null
  followers: number
  profile_url: string | null
  platform: string | null
}

export type ConfirmSyncResult =
  | { ok: true; confirmedId: string; created: boolean }
  | { ok: false; error: string }

type ConfirmedRowRef = {
  id: string
  influencer_id: string | null
  phase_id?: string
  email?: string | null
  form_submitted?: boolean | null
  phone?: string | null
  seq?: number | null
  created_at?: string
  influencers?: { handle?: string | null } | null
  influencer_platform?: Array<{ handle?: string | null }> | null
}

export function normalizeHandle(handle: string | null | undefined): string {
  return (handle ?? '').replace(/^@/, '').trim().toLowerCase()
}

function normalizePlatform(platform: string | null | undefined): string {
  return (platform ?? '').trim().toLowerCase()
}

export function platformAccountKey(platform: string, handle: string): string {
  return `${normalizePlatform(platform)}:${normalizeHandle(handle)}`
}

export function uniquePlatformAccounts<T extends { platform: string; handle: string }>(accounts: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const a of accounts) {
    const key = platformAccountKey(a.platform, a.handle)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

function rowHandle(row: ConfirmedRowRef): string {
  const fromInf = normalizeHandle(row.influencers?.handle)
  if (fromInf) return fromInf
  for (const p of row.influencer_platform ?? []) {
    const h = normalizeHandle(p.handle)
    if (h) return h
  }
  return ''
}

function rowScore(row: ConfirmedRowRef): number {
  let score = 0
  if (row.influencer_id) score += 100
  if (row.form_submitted) score += 50
  if (row.phone) score += 10
  if (row.email) score += 5
  if ((row.influencer_platform?.length ?? 0) > 0) score += 3
  if (row.seq != null) score += 1
  return score
}

async function nextConfirmedSeq(phaseId: string): Promise<number> {
  const { data } = await supabase
    .from('confirmed_influencers')
    .select('seq')
    .eq('phase_id', phaseId)
    .order('seq', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  return (data?.seq ?? 0) + 1
}

async function loadConfirmedInPhase(phaseId: string): Promise<ConfirmedRowRef[]> {
  const { data, error } = await supabase
    .from('confirmed_influencers')
    .select(`
      id, influencer_id, phase_id, email, form_submitted, phone, seq, created_at,
      influencers(handle),
      influencer_platform(handle)
    `)
    .eq('phase_id', phaseId)

  if (error) throw new Error(error.message)
  return (data ?? []) as ConfirmedRowRef[]
}

async function findExistingConfirmed(
  inf: InfluencerConfirmSource,
  phaseId: string,
  phaseRows?: ConfirmedRowRef[],
): Promise<ConfirmedRowRef | null> {
  const { data: byInfluencer } = await supabase
    .from('confirmed_influencers')
    .select('id, influencer_id, phase_id, email, form_submitted, phone, seq, created_at')
    .eq('influencer_id', inf.id)
    .maybeSingle()

  if (byInfluencer) return byInfluencer as ConfirmedRowRef

  const email = inf.email?.trim()
  if (email) {
    const { data: byEmail } = await supabase
      .from('confirmed_influencers')
      .select('id, influencer_id, phase_id, email, form_submitted, phone, seq, created_at')
      .eq('phase_id', phaseId)
      .eq('email', email)
      .maybeSingle()

    if (byEmail) return byEmail as ConfirmedRowRef
  }

  const handle = normalizeHandle(inf.handle)
  if (!handle) return null

  const rows = phaseRows ?? await loadConfirmedInPhase(phaseId)
  return rows.find(r => rowHandle(r) === handle) ?? null
}

async function ensureInfluencerPlatform(
  confirmedId: string,
  inf: InfluencerConfirmSource,
): Promise<string | null> {
  const platform   = inf.platform || 'TikTok'
  const rawHandle  = inf.handle || ''
  const key        = platformAccountKey(platform, rawHandle)

  const { data: platforms } = await supabase
    .from('influencer_platform')
    .select('id, platform, handle')
    .eq('confirmed_influencer_id', confirmedId)

  const exists = (platforms ?? []).some(
    p => platformAccountKey(p.platform, p.handle ?? '') === key,
  )
  if (exists) return null

  const { error } = await supabase.from('influencer_platform').insert({
    confirmed_influencer_id: confirmedId,
    platform,
    handle: rawHandle,
    followers:   inf.followers || 0,
    profile_url: inf.profile_url || defaultProfileUrl(platform, rawHandle),
  })
  return error?.message ?? null
}

async function dedupePlatformsForConfirmed(confirmedId: string): Promise<number> {
  const { data: platforms, error } = await supabase
    .from('influencer_platform')
    .select('id, platform, handle, followers')
    .eq('confirmed_influencer_id', confirmedId)

  if (error || !platforms?.length) return 0

  const groups = new Map<string, typeof platforms>()
  for (const p of platforms) {
    const k = platformAccountKey(p.platform, p.handle ?? '')
    const list = groups.get(k) ?? []
    list.push(p)
    groups.set(k, list)
  }

  const deleteIds: string[] = []
  for (const [, list] of groups) {
    if (list.length < 2) continue
    const sorted = [...list].sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))
    deleteIds.push(...sorted.slice(1).map(p => p.id))
  }

  if (!deleteIds.length) return 0

  const { error: delErr } = await supabase
    .from('influencer_platform')
    .delete()
    .in('id', deleteIds)

  return delErr ? 0 : deleteIds.length
}

/** Remove duplicate platform rows (same platform + handle) within each confirmed influencer. */
export async function dedupePlatformsInPhase(
  phaseId: string,
): Promise<{ removed: number; error?: string }> {
  if (!phaseId) return { removed: 0 }

  const { data: rows, error } = await supabase
    .from('confirmed_influencers')
    .select('id')
    .eq('phase_id', phaseId)

  if (error) return { removed: 0, error: error.message }

  let removed = 0
  for (const row of rows ?? []) {
    removed += await dedupePlatformsForConfirmed(row.id)
  }
  return { removed }
}

/** Create or link confirmed_influencers (+ influencer_platform) when status becomes accept. */
export async function syncInfluencerOnAccept(
  inf: InfluencerConfirmSource,
  phaseId: string,
  phaseRows?: ConfirmedRowRef[],
): Promise<ConfirmSyncResult> {
  if (!phaseId) return { ok: false, error: '차수가 선택되지 않았습니다' }

  const existing = await findExistingConfirmed(inf, phaseId, phaseRows)
  let confirmedId = existing?.id ?? null
  let created = false

  if (confirmedId) {
    const patch: Record<string, unknown> = {}
    if (existing!.influencer_id !== inf.id) patch.influencer_id = inf.id
    if (existing!.phase_id && existing!.phase_id !== phaseId) patch.phase_id = phaseId
    if (inf.email && existing!.email !== inf.email) patch.email = inf.email

    if (Object.keys(patch).length) {
      const { error } = await supabase
        .from('confirmed_influencers')
        .update(patch)
        .eq('id', confirmedId)
      if (error) return { ok: false, error: error.message }
    }
  } else {
    const { data: inserted, error: ciErr } = await supabase
      .from('confirmed_influencers')
      .insert({
        influencer_id: inf.id,
        phase_id:      phaseId,
        email:         inf.email,
        upload_status: 'Pending',
        seq:           await nextConfirmedSeq(phaseId),
      })
      .select('id')
      .single()
    if (ciErr) return { ok: false, error: ciErr.message }
    confirmedId = inserted.id
    created = true
  }

  const platformErr = await ensureInfluencerPlatform(confirmedId!, inf)
  if (platformErr) return { ok: false, error: platformErr }

  return { ok: true, confirmedId: confirmedId!, created }
}

/** Remove confirmed_influencers row when status moves away from accept. */
export async function removeInfluencerOnUnaccept(
  influencerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('confirmed_influencers')
    .delete()
    .eq('influencer_id', influencerId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Remove duplicate confirmed rows in a phase (same handle). Keeps the richest row. */
export async function dedupeConfirmedInPhase(
  phaseId: string,
): Promise<{ removed: number; error?: string }> {
  if (!phaseId) return { removed: 0 }

  try {
    const rows = await loadConfirmedInPhase(phaseId)
    const groups = new Map<string, ConfirmedRowRef[]>()

    for (const row of rows) {
      const handle = rowHandle(row)
      const email = row.email?.trim().toLowerCase()
      const key = handle || (email ? `__email__:${email}` : `__id__:${row.id}`)
      const list = groups.get(key) ?? []
      list.push(row)
      groups.set(key, list)
    }

    const deleteIds: string[] = []

    for (const [, list] of groups) {
      if (list.length < 2) continue

      const sorted = [...list].sort((a, b) => {
        const scoreDiff = rowScore(b) - rowScore(a)
        if (scoreDiff !== 0) return scoreDiff
        return (a.seq ?? 999999) - (b.seq ?? 999999)
      })

      const keeper = sorted[0]
      for (const dup of sorted.slice(1)) {
        if (dup.influencer_id && !keeper.influencer_id) {
          await supabase
            .from('confirmed_influencers')
            .update({ influencer_id: dup.influencer_id })
            .eq('id', keeper.id)
          keeper.influencer_id = dup.influencer_id
        }
        deleteIds.push(dup.id)
      }
    }

    if (!deleteIds.length) return { removed: 0 }

    const { error } = await supabase
      .from('confirmed_influencers')
      .delete()
      .in('id', deleteIds)

    if (error) return { removed: 0, error: error.message }
    return { removed: deleteIds.length }
  } catch (e) {
    return { removed: 0, error: e instanceof Error ? e.message : '중복 정리 실패' }
  }
}

/** Renumber seq to 1..N within a phase (preserves current order). */
export async function renumberConfirmedSeqInPhase(
  phaseId: string,
): Promise<{ renumbered: boolean; error?: string }> {
  if (!phaseId) return { renumbered: false }

  const { data: rows, error } = await supabase
    .from('confirmed_influencers')
    .select('id, seq, created_at')
    .eq('phase_id', phaseId)
    .order('seq', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) return { renumbered: false, error: error.message }
  if (!rows?.length) return { renumbered: false }

  const needsUpdate = rows.some((row, i) => row.seq !== i + 1)
  if (!needsUpdate) return { renumbered: false }

  for (let i = 0; i < rows.length; i++) {
    const nextSeq = i + 1
    if (rows[i].seq === nextSeq) continue
    const { error: updErr } = await supabase
      .from('confirmed_influencers')
      .update({ seq: nextSeq })
      .eq('id', rows[i].id)
    if (updErr) return { renumbered: false, error: updErr.message }
  }

  return { renumbered: true }
}

/** Dedupe confirmed rows and platform rows in a phase. */
export async function dedupeConfirmedPhaseData(
  phaseId: string,
): Promise<{ confirmedRemoved: number; platformsRemoved: number; seqRenumbered: boolean; error?: string }> {
  const confirmed = await dedupeConfirmedInPhase(phaseId)
  if (confirmed.error) {
    return { confirmedRemoved: 0, platformsRemoved: 0, seqRenumbered: false, error: confirmed.error }
  }

  const platforms = await dedupePlatformsInPhase(phaseId)
  if (platforms.error) {
    return {
      confirmedRemoved: confirmed.removed,
      platformsRemoved: 0,
      seqRenumbered: false,
      error: platforms.error,
    }
  }

  const renumber = await renumberConfirmedSeqInPhase(phaseId)
  if (renumber.error) {
    return {
      confirmedRemoved: confirmed.removed,
      platformsRemoved: platforms.removed,
      seqRenumbered: false,
      error: renumber.error,
    }
  }

  return {
    confirmedRemoved: confirmed.removed,
    platformsRemoved: platforms.removed,
    seqRenumbered: renumber.renumbered,
  }
}

/** Sync influencers already marked accept; dedupes first, then links missing rows. */
export async function backfillAcceptedToConfirmed(
  phaseId: string,
  accepted: InfluencerConfirmSource[],
): Promise<{ synced: number; failed: number; deduped: number; errors: string[] }> {
  if (!phaseId || !accepted.length) return { synced: 0, failed: 0, deduped: 0, errors: [] }

  const { removed, error: dedupeErr } = await dedupeConfirmedInPhase(phaseId)
  if (dedupeErr) return { synced: 0, failed: accepted.length, deduped: 0, errors: [dedupeErr] }

  await dedupePlatformsInPhase(phaseId)
  await renumberConfirmedSeqInPhase(phaseId)

  const phaseRows = await loadConfirmedInPhase(phaseId)
  const linkedIds = new Set(
    phaseRows.filter(r => r.influencer_id).map(r => r.influencer_id as string),
  )
  const linkedHandles = new Set(phaseRows.map(rowHandle).filter(Boolean))

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const inf of accepted) {
    const handle = normalizeHandle(inf.handle)
    if (linkedIds.has(inf.id) || (handle && linkedHandles.has(handle))) {
      const result = await syncInfluencerOnAccept(inf, phaseId, phaseRows)
      if (!result.ok) {
        failed++
        errors.push(`${inf.display_name || inf.handle}: ${result.error}`)
      }
      continue
    }

    const result = await syncInfluencerOnAccept(inf, phaseId, phaseRows)
    if (result.ok) {
      if (result.created) synced++
      linkedIds.add(inf.id)
      if (handle) linkedHandles.add(handle)
    } else {
      failed++
      errors.push(`${inf.display_name || inf.handle}: ${result.error}`)
    }
  }

  return { synced, failed, deduped: removed, errors }
}
