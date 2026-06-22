import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { usePhase } from '@/contexts/PhaseContext'
import Modal from '@/components/Modal'

type BrandTable = 'brand_general' | 'brand_personal'

function generalDedupKey(row: { brand_name?: string | null; email?: string[] | null }) {
  const name = String(row.brand_name ?? '').trim().toLowerCase()
  const email = Array.isArray(row.email) ? (row.email[0] ?? '').trim().toLowerCase() : ''
  return `${name}|${email}`
}

function personalDedupKey(row: { brand_name?: string | null; contact_name?: string | null; personal_email?: string[] | null }) {
  const name = String(row.brand_name ?? '').trim().toLowerCase()
  const contact = String(row.contact_name ?? '').trim().toLowerCase()
  const email = Array.isArray(row.personal_email) ? (row.personal_email[0] ?? '').trim().toLowerCase() : ''
  return `${name}|${contact}|${email}`
}

export default function BrandDbPhaseImport({
  table,
  onImported,
}: {
  table: BrandTable
  onImported: () => void
}) {
  const { selectedPhaseId, phases } = usePhase()
  const { showToast } = useToast()

  const otherPhases = useMemo(
    () => phases.filter(p => p.id !== selectedPhaseId),
    [phases, selectedPhaseId],
  )
  const phaseNameById = useMemo(
    () => Object.fromEntries(phases.map(p => [p.id, p.name])),
    [phases],
  )

  const [showModal, setShowModal] = useState(false)
  const [importPhaseId, setImportPhaseId] = useState('')
  const [importContactedOnly, setImportContactedOnly] = useState(false)
  const [importPreview, setImportPreview] = useState<{ add: number; skip: number } | null>(null)
  const [importing, setImporting] = useState(false)

  const dedupKey = table === 'brand_general' ? generalDedupKey : personalDedupKey

  const loadImportPreview = useCallback(async () => {
    if (!selectedPhaseId || !importPhaseId) { setImportPreview(null); return }

    const select = table === 'brand_general'
      ? 'brand_name, email, contacted'
      : 'brand_name, contact_name, personal_email, contacted'

    const [{ data: current }, { data: source }] = await Promise.all([
      supabase.from(table).select(select).eq('phase_id', selectedPhaseId),
      supabase.from(table).select(select).eq('phase_id', importPhaseId),
    ])

    const existingSet = new Set((current ?? []).map(r => dedupKey(r)))
    const filtered = (source ?? []).filter(r => !importContactedOnly || r.contacted === true)
    const add = filtered.filter(r => !existingSet.has(dedupKey(r))).length
    setImportPreview({ add, skip: filtered.length - add })
  }, [selectedPhaseId, importPhaseId, importContactedOnly, table])

  useEffect(() => {
    if (!showModal) return
    void loadImportPreview()
  }, [showModal, loadImportPreview])

  async function importFromPhase() {
    if (!selectedPhaseId || !importPhaseId) {
      showToast('불러올 차수를 선택하세요.', 'error')
      return
    }
    if (!importPreview?.add) {
      showToast('추가할 브랜드가 없습니다.', 'error')
      return
    }

    setImporting(true)
    try {
      const [{ data: current }, { data: source }] = await Promise.all([
        supabase.from(table).select(
          table === 'brand_general'
            ? 'brand_name, email'
            : 'brand_name, contact_name, personal_email',
        ).eq('phase_id', selectedPhaseId),
        supabase.from(table).select('*').eq('phase_id', importPhaseId),
      ])

      const existingSet = new Set((current ?? []).map(r => dedupKey(r)))
      const rows = (source ?? [])
        .filter(r => !importContactedOnly || r.contacted === true)
        .filter(r => !existingSet.has(dedupKey(r)))
        .map(r => {
          const base = {
            phase_id:        selectedPhaseId,
            source_phase_id: importPhaseId,
            contacted:       false,
            status:       '',
            send_count:   0,
            reply_count:  0,
            notes:        null,
            last_reply_at: null,
          }
          if (table === 'brand_general') {
            return {
              ...base,
              brand_name:       r.brand_name,
              company:          r.company ?? null,
              email:            Array.isArray(r.email) ? r.email : r.email ? [r.email] : null,
              telephone:        r.telephone ?? null,
              website:          r.website ?? null,
              product_category: r.product_category ?? null,
              overseas:         r.overseas ?? false,
            }
          }
          return {
            ...base,
            brand_name:       r.brand_name,
            company:          r.company ?? null,
            contact_name:     r.contact_name ?? null,
            department:       r.department ?? null,
            position:         r.position ?? null,
            personal_email:   Array.isArray(r.personal_email)
              ? r.personal_email
              : r.personal_email ? [r.personal_email] : null,
            personal_phone:   r.personal_phone ?? null,
            website:          r.website ?? null,
            rep_email:        r.rep_email ?? null,
            telephone:        r.telephone ?? null,
            product_category: r.product_category ?? null,
            overseas:         r.overseas ?? false,
          }
        })

      if (!rows.length) {
        showToast('추가할 브랜드가 없습니다.', 'error')
        return
      }

      const { error } = await supabase.from(table).insert(rows)
      if (error) throw error

      showToast(`${rows.length}건을 ${phaseNameById[importPhaseId] ?? '이전 차수'}에서 불러왔습니다`, 'success')
      setShowModal(false)
      onImported()
    } catch (e: unknown) {
      showToast((e as Error).message || '불러오기 실패', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setImportPhaseId(otherPhases[0]?.id ?? '')
          setImportContactedOnly(false)
          setShowModal(true)
        }}
        disabled={!otherPhases.length}
        style={{
          padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8,
          border: '1.5px solid var(--teal-dk)',
          background: 'var(--white)', color: 'var(--teal-dk)',
          cursor: otherPhases.length ? 'pointer' : 'not-allowed',
          opacity: otherPhases.length ? 1 : 0.5, whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}
      >
        이전 차수 불러오기
      </button>

      <Modal open={showModal} onClose={() => !importing && setShowModal(false)} title="이전 차수 불러오기">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 320 }}>
          <p style={{ fontSize: 13, color: 'var(--gray-6)', lineHeight: 1.6, margin: 0 }}>
            다른 차수의 브랜드 DB를 현재 차수에 복사합니다. 중복 브랜드는 제외됩니다.
          </p>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 6 }}>불러올 차수</label>
            <select
              value={importPhaseId}
              onChange={e => setImportPhaseId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}
            >
              <option value="">선택…</option>
              {otherPhases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gray-7)', cursor: 'pointer' }}>
            <input type="checkbox" checked={importContactedOnly} onChange={e => setImportContactedOnly(e.target.checked)} />
            컨택 완료(contacted)만 불러오기
          </label>
          {importPreview && importPhaseId && (
            <div style={{ fontSize: 12, color: 'var(--gray-6)', background: 'var(--gray-1)', borderRadius: 8, padding: '10px 12px' }}>
              <strong style={{ color: 'var(--teal-dk)' }}>{importPreview.add}건</strong> 추가 · 중복 {importPreview.skip}건 제외
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="cfg-btn cfg-btn--ghost" disabled={importing} onClick={() => setShowModal(false)}>취소</button>
            <button
              type="button"
              className="cfg-btn"
              disabled={importing || !importPhaseId || !importPreview?.add}
              style={{ background: 'var(--teal-dk)', color: '#fff', borderColor: 'var(--teal-dk)' }}
              onClick={() => { void importFromPhase() }}
            >
              {importing ? '불러오는 중…' : `${importPreview?.add ?? 0}건 불러오기`}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
