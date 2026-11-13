import { demoDb } from '@/lib/local-db'
import { removeInfluencerOnUnaccept } from '@/lib/influencer/confirm-influencer'

export async function markInfluencerContact(
  influencerId: string,
  currentlyContacted: boolean,
  currentStatus: string,
): Promise<{ ok: boolean; error?: string }> {
  if (currentlyContacted) {
    const { error } = await demoDb
      .from('influencers')
      .update({ contacted: false })
      .eq('id', influencerId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const patch: { contacted: boolean; status?: string } = { contacted: true }
  if (!currentStatus) patch.status = 'target'
  const { error } = await demoDb.from('influencers').update(patch).eq('id', influencerId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function cancelInfluencerContact(
  influencerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await demoDb
    .from('influencers')
    .update({ contacted: false })
    .eq('id', influencerId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function cancelBrandContact(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await demoDb.from('brand_contacts').update({ contacted: false }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
