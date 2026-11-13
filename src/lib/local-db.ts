type Row = Record<string, any>
type DemoData = (Row[] & Row) | null

const phaseId = 'demo-dashboard'
const influencers: Row[] = [
  { id: 'demo-inf-1', phase_id: phaseId, handle: 'demo.glowbyava', display_name: 'Ava Kim', email: 'ava@example.com', followers: 28400, contacted: true, status: 'yes', tiers: { rank: '1순위' } },
  { id: 'demo-inf-2', phase_id: phaseId, handle: 'demo.skinwithmia', display_name: 'Mia Park', email: 'mia@example.com', followers: 19300, contacted: true, status: 'reply', tiers: { rank: '1순위' } },
  { id: 'demo-inf-3', phase_id: phaseId, handle: 'demo.beautybyzoe', display_name: 'Zoe Lee', email: 'zoe@example.com', followers: 12700, contacted: true, status: 'negotiate', tiers: { rank: '2순위' } },
  { id: 'demo-inf-4', phase_id: phaseId, handle: 'demo.routinebylia', display_name: 'Lia Chen', email: 'lia@example.com', followers: 8600, contacted: false, status: 'target', tiers: { rank: '3순위' } },
  { id: 'demo-inf-5', phase_id: phaseId, handle: 'demo.glowwithnoa', display_name: 'Noa Smith', email: 'noa@example.com', followers: 7200, contacted: false, status: 'target', tiers: { rank: '4순위' } },
  { id: 'demo-inf-6', phase_id: phaseId, handle: 'demo.kbeautywithsam', display_name: 'Sam Rivera', email: 'sam@example.com', followers: 5600, contacted: false, status: 'target', tiers: { rank: '4순위' } },
]

const confirmedInfluencers: Row[] = [
  { id: 'demo-confirmed-1', phase_id: phaseId, influencer_id: 'demo-inf-1', email: 'ava@example.com', upload_status: 'Delivered', form_submitted: true },
  { id: 'demo-confirmed-2', phase_id: phaseId, influencer_id: 'demo-inf-2', email: 'mia@example.com', upload_status: 'In Transit', form_submitted: true },
  { id: 'demo-confirmed-3', phase_id: phaseId, influencer_id: 'demo-inf-3', email: 'zoe@example.com', upload_status: 'Exception', form_submitted: true },
  { id: 'demo-confirmed-4', phase_id: phaseId, influencer_id: 'demo-inf-4', email: 'lia@example.com', upload_status: 'Pending', form_submitted: false },
]

const brands: Row[] = [
  { id: 'demo-brand-1', phase_id: phaseId, brand_name: '루미나', brand_en: 'Lumina', company: 'Lumina Beauty', email: ['hello@lumina.example'], status: 'yes', contacted: true },
  { id: 'demo-brand-2', phase_id: phaseId, brand_name: '어반글로우', brand_en: 'Urban Glow', company: 'Urban Glow Inc.', email: ['partnerships@urbanglow.example'], status: 'reply', contacted: true },
  { id: 'demo-brand-3', phase_id: phaseId, brand_name: '세이지랩', brand_en: 'Sage Lab', company: 'Sage Lab Co.', email: ['team@sagelab.example'], status: 'positive', contacted: true },
  { id: 'demo-brand-4', phase_id: phaseId, brand_name: '포레스트온', brand_en: 'Forest On', company: 'Forest On', email: ['hello@foreston.example'], status: 'target', contacted: false },
  { id: 'demo-brand-5', phase_id: phaseId, brand_name: '클라우드나인', brand_en: 'Cloud Nine', company: 'Cloud Nine Beauty', email: ['hello@cloudnine.example'], status: 'target', contacted: false },
]

const confirmedBrands: Row[] = [
  { id: 'demo-confirmed-brand-1', phase_id: phaseId, brand_name: '루미나', email: 'hello@lumina.example', product: 'Barrier Cream', received: true },
  { id: 'demo-confirmed-brand-2', phase_id: phaseId, brand_name: '어반글로우', email: 'partnerships@urbanglow.example', product: 'Glow Tint', received: false },
]

const platforms: Row[] = confirmedInfluencers.map((row, i) => ({
  id: `demo-platform-${i + 1}`, confirmed_influencer_id: row.id, platform: 'TikTok',
  handle: influencers[i].handle, followers: influencers[i].followers,
}))

const tracking: Row[] = confirmedInfluencers.map((row, i) => ({
  id: `demo-tracking-${i + 1}`, confirmed_influencer_id: row.id, phase_id: phaseId,
  ems_number: `DEMO10000${i + 1}`, status: ['Delivered', 'In Transit', 'Exception', 'Preparing'][i],
}))

const monitoring: Row[] = [
  { id: 'demo-review-1', influencer_platform_id: platforms[0].id, phase_id: phaseId, brand: 'collabnet', review_link: 'https://example.com/demo-review-1', views: 12400, likes: 840, comments: 62 },
  { id: 'demo-review-2', influencer_platform_id: platforms[1].id, phase_id: phaseId, brand: 'collabnet', review_link: 'https://example.com/demo-review-2', views: 8700, likes: 512, comments: 38 },
  { id: 'demo-review-3', influencer_platform_id: platforms[2].id, phase_id: phaseId, brand: 'collabnet', review_link: 'https://example.com/demo-review-3', views: 4200, likes: 290, comments: 21 },
  { id: 'demo-review-4', influencer_platform_id: platforms[3].id, phase_id: phaseId, brand: '루미나', review_link: 'https://example.com/demo-brand-review-1', views: 6300, likes: 410, comments: 19 },
  { id: 'demo-review-5', influencer_platform_id: platforms[0].id, phase_id: phaseId, brand: '어반글로우', review_link: 'https://example.com/demo-brand-review-2', views: 5100, likes: 330, comments: 17 },
]

const phases: Row[] = [{
  id: phaseId, name: 'Demo · Dashboard', is_active: true, started_at: '2026-11-01',
  ended_at: '2026-12-31', kit_send_date: '2026-11-20',
  project_concept: 'Demo data for the CollabNet dashboard',
}]

const tables: Record<string, Row[]> = {
  phases, influencers, confirmed_influencers: confirmedInfluencers, brand_contacts: brands,
  confirmed_brands: confirmedBrands, influencer_platform: platforms, ems_tracking: tracking,
  monitoring, monitoring_keywords: [], app_config: [], tiers: [], beauty_news_archives: [{
    id: 'demo-news-1', windows_start: '2026-11-09', windows_end: '2026-11-15',
    report_title: '이번 주 뷰티 브리핑 — CollabNet',
    keywords: [
      { tag: '#BarrierFirst', explanation: '피부 장벽 케어와 보습 루틴이 주목받고 있습니다.' },
      { tag: '#GlowTint', explanation: '촉촉한 베이스 메이크업이 데일리 콘텐츠의 핵심입니다.' },
    ],
  }],
}

function matches(row: Row, filters: Array<[string, any]>) {
  return filters.every(([key, value]) => row[key] === value)
}

class LocalQuery implements PromiseLike<any> {
  private rows: Row[]
  private filters: Array<[string, any]> = []
  private resultSingle = false
  private resultHead = false

  constructor(private readonly table: string) {
    this.rows = tables[table] ?? []
  }

  select(_columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.resultHead = !!options?.head
    return this
  }
  eq(key: string, value: any) { this.filters.push([key, value]); return this }
  is(key: string, value: any) { this.filters.push([key, value]); return this }
  neq(key: string, value: any) { this.rows = this.rows.filter(row => row[key] !== value); return this }
  in(key: string, values: any[]) { this.rows = this.rows.filter(row => values.includes(row[key])); return this }
  or(_expression: string) { return this }
  order(_key: string, _options?: unknown) { return this }
  limit(count: number) { this.rows = this.rows.slice(0, count); return this }
  range(start: number, end: number) { this.rows = this.rows.slice(start, end + 1); return this }
  single() { this.resultSingle = true; return this }
  maybeSingle() { this.resultSingle = true; return this }
  insert(value: Row | Row[]) { const rows = Array.isArray(value) ? value : [value]; this.rows.push(...rows); return this }
  upsert(value: Row | Row[], ..._args: any[]) { return this.insert(value) }
  update(patch: Row) { this.rows = this.rows.map(row => matches(row, this.filters) ? { ...row, ...patch } : row); return this }
  delete() { this.rows = this.rows.filter(row => !matches(row, this.filters)); return this }
  then<TResult1 = { data: DemoData; error: any; count: number }, TResult2 = never>(
    resolve?: ((value: { data: DemoData; error: any; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    _reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const rows = this.rows.filter(row => matches(row, this.filters))
    const data = (this.resultHead ? null : this.resultSingle ? (rows[0] ?? null) : rows) as DemoData
    return Promise.resolve({ data, error: null, count: rows.length }).then(resolve as any)
  }
}

const localStorage = {
  from: (_bucket: string) => ({
    upload: async (..._args: any[]) => ({ data: null, error: null }),
    remove: async (..._args: any[]) => ({ data: null, error: null }),
    download: async (..._args: any[]) => ({ data: null, error: null }),
    createSignedUrl: async (..._args: any[]) => ({ data: { signedUrl: '' }, error: null }),
    getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
  }),
}

export const demoDb: any = {
  from: (table: string) => new LocalQuery(table),
  rpc: async (..._args: any[]) => ({ data: [], error: null }),
  storage: localStorage,
}
