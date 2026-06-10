import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useToast } from '../../../../contexts/ToastContext'

interface BrandContact {
  id: string
  brand_type: string
  contacted: boolean
  company: string | null
  name: string | null
  department: string | null
  position: string | null
  email: string | null
  mobile: string | null
  extension: string | null
  website: string | null
  created_at: string
}

const FIELDS: { key: keyof BrandContact; label: string; width: number }[] = [
  { key: 'company',    label: '회사',    width: 140 },
  { key: 'name',       label: '성명',    width: 90  },
  { key: 'department', label: '소속',    width: 120 },
  { key: 'position',   label: '직급',    width: 90  },
  { key: 'email',      label: '이메일',  width: 190 },
  { key: 'mobile',     label: '휴대폰',  width: 120 },
  { key: 'extension',  label: '내선',    width: 80  },
  { key: 'website',    label: '홈페이지', width: 150 },
]

export default function BrandDbContacts({ brandType = 'personal' }: { brandType?: string }) {
  const { showToast } = useToast()

  const [allRows,   setAllRows]   = useState<BrandContact[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editCell,  setEditCell]  = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [search,    setSearch]    = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (editCell) inputRef.current?.focus()
  }, [editCell])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('brand_contacts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setAllRows((data ?? []) as BrandContact[])
    setLoading(false)
  }

  function startEdit(id: string, field: string, current: string | null) {
    setEditCell({ id, field })
    setEditValue(current ?? '')
  }

  async function commitEdit() {
    if (!editCell) return
    const { id, field } = editCell
    const prev = allRows.find(r => r.id === id)
    if (!prev) { setEditCell(null); return }
    const prevVal = (prev as any)[field] ?? ''
    if (editValue === prevVal) { setEditCell(null); return }

    setSaving(true)
    const { error } = await supabase
      .from('brand_contacts')
      .update({ [field]: editValue || null })
      .eq('id', id)
    if (error) { showToast(error.message, 'error') }
    else setAllRows(prev => prev.map(r => r.id === id ? { ...r, [field]: editValue || null } : r))
    setEditCell(null)
    setSaving(false)
  }

  async function toggleContacted(id: string, current: boolean) {
    const next = !current
    const { error } = await supabase.from('brand_contacts').update({ contacted: next }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else setAllRows(prev => prev.map(r => r.id === id ? { ...r, contacted: next } : r))
  }

  async function addRow() {
    const { data, error } = await supabase
      .from('brand_contacts')
      .insert({ brand_type: brandType, contacted: false })
      .select()
      .single()
    if (error) { showToast(error.message, 'error'); return }
    setAllRows(prev => [data as BrandContact, ...prev])
  }

  async function deleteRow(id: string) {
    const { error } = await supabase.from('brand_contacts').delete().eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setAllRows(prev => prev.filter(r => r.id !== id))
  }

  // Stats (global across both types)
  const generalCount  = allRows.filter(r => r.brand_type === 'general').length
  const personalCount = allRows.filter(r => r.brand_type === 'personal').length
  const currentRows   = allRows.filter(r => r.brand_type === brandType)
  const contactedCount = currentRows.filter(r => r.contacted).length

  // Table rows: filtered by type + search
  const filtered = currentRows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return FIELDS.some(f => ((r as any)[f.key] ?? '').toLowerCase().includes(q))
  })

  const isGeneral = brandType === 'general'

  return (
    <div>
      {/* Toolbar */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="page-banner-btn" style={{ marginRight: 'auto' }} onClick={addRow}>+ 행 추가</button>
        <button className="page-banner-btn page-banner-btn--secondary" onClick={load}>↻ 새로고침</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="회사, 성명, 이메일로 검색..."
          style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--gray-3)', borderRadius: 8, outline: 'none', width: 280, fontFamily: 'inherit' }}
        />
        <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>
          {filtered.length}<span style={{ fontWeight: 400 }}> 건</span>
        </span>
        {saving && <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>저장 중...</span>}
      </div>

      {/* Table card */}
      <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'clip' }}>
        <div style={{ overflowX: 'auto', overflowY: 'scroll', maxHeight: 'calc(100vh - 340px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 52 }} />
              {FIELDS.map(f => <col key={f.key} style={{ width: f.width }} />)}
              <col style={{ width: 44 }} />
            </colgroup>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--gray-1)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-6)', borderBottom: '2px solid var(--gray-2)', whiteSpace: 'nowrap' }}>
                  컨택
                </th>
                {FIELDS.map(f => (
                  <th key={f.key} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-6)', borderBottom: '2px solid var(--gray-2)', whiteSpace: 'nowrap' }}>
                    {f.label}
                  </th>
                ))}
                <th style={{ padding: '10px 8px', borderBottom: '2px solid var(--gray-2)' }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={FIELDS.length + 2} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={FIELDS.length + 2} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>데이터가 없습니다.</td></tr>
              ) : filtered.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--gray-2)', background: row.contacted ? '#f0fdf4' : undefined }}>
                  {/* Contacted toggle */}
                  <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '0 8px' }}>
                    <button
                      onClick={() => toggleContacted(row.id, row.contacted)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                        border: `1.5px solid ${row.contacted ? '#6ee7b7' : '#e2e8f0'}`,
                        background: row.contacted ? '#d1fae5' : '#f1f5f9',
                        color: row.contacted ? '#065f46' : '#94a3b8',
                        fontWeight: 700, fontSize: 13,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {row.contacted ? '✓' : '—'}
                    </button>
                  </td>

                  {/* Data cells */}
                  {FIELDS.map(f => {
                    const isEditing = editCell?.id === row.id && editCell?.field === f.key
                    const val = (row as any)[f.key] as string | null

                    if (isEditing) {
                      return (
                        <td key={f.key} style={{ padding: 0 }}>
                          <input
                            ref={inputRef}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditCell(null) }}
                            style={{ width: '100%', height: 40, padding: '0 10px', border: 'none', borderBottom: '2px solid var(--teal-dk)', outline: 'none', fontSize: 13, fontFamily: 'inherit', background: '#f0faf9', boxSizing: 'border-box' }}
                          />
                        </td>
                      )
                    }

                    return (
                      <td key={f.key}
                        onClick={() => startEdit(row.id, f.key, val)}
                        style={{ padding: '0 12px', height: 40, cursor: 'text', verticalAlign: 'middle', overflow: 'hidden' }}>
                        {f.key === 'website' && val ? (
                          <a href={val.startsWith('http') ? val : 'https://' + val} target="_blank" rel="noopener"
                            onClick={e => e.stopPropagation()}
                            className="video-link" style={{ fontSize: 12 }}>↗ 열기</a>
                        ) : f.key === 'email' && val ? (
                          <span style={{ fontSize: 13, color: '#1558b0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{val}</span>
                        ) : (
                          <span style={{ fontSize: 13, color: val ? 'var(--gray-8)' : 'var(--gray-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                            {val ?? '—'}
                          </span>
                        )}
                      </td>
                    )
                  })}

                  {/* Delete */}
                  <td style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <button
                      onClick={() => deleteRow(row.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', fontSize: 14, padding: 4, borderRadius: 4 }}
                      title="삭제">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
