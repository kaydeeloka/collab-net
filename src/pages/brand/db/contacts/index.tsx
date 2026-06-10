import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useToast } from '../../../../contexts/ToastContext'

interface BrandContact {
  id: string
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

const FIELDS: { key: keyof BrandContact; label: string; width?: number }[] = [
  { key: 'company',    label: '회사',   width: 140 },
  { key: 'name',       label: '성명',   width: 90  },
  { key: 'department', label: '소속',   width: 120 },
  { key: 'position',   label: '직급',   width: 90  },
  { key: 'email',      label: '이메일', width: 180 },
  { key: 'mobile',     label: '휴대폰', width: 120 },
  { key: 'extension',  label: '내선',   width: 80  },
  { key: 'website',    label: '홈페이지', width: 160 },
]

export default function BrandDbContacts() {
  const { showToast } = useToast()
  const [rows, setRows]     = useState<BrandContact[]>([])
  const [loading, setLoading] = useState(true)
  const [editCell, setEditCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
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
    setRows((data ?? []) as BrandContact[])
    setLoading(false)
  }

  function startEdit(id: string, field: string, current: string | null) {
    setEditCell({ id, field })
    setEditValue(current ?? '')
  }

  async function commitEdit() {
    if (!editCell) return
    const { id, field } = editCell
    const prev = rows.find(r => r.id === id)
    if (!prev) { setEditCell(null); return }
    const prevVal = (prev as any)[field] ?? ''
    if (editValue === prevVal) { setEditCell(null); return }

    setSaving(true)
    const { error } = await supabase
      .from('brand_contacts')
      .update({ [field]: editValue || null })
      .eq('id', id)
    if (error) { showToast(error.message, 'error') }
    else {
      setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: editValue || null } : r))
    }
    setEditCell(null)
    setSaving(false)
  }

  async function addRow() {
    const { data, error } = await supabase
      .from('brand_contacts')
      .insert({})
      .select()
      .single()
    if (error) { showToast(error.message, 'error'); return }
    setRows(prev => [data as BrandContact, ...prev])
  }

  async function deleteRow(id: string) {
    const { error } = await supabase.from('brand_contacts').delete().eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return FIELDS.some(f => ((r as any)[f.key] ?? '').toLowerCase().includes(q))
  })

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">👤</span>
        <div>
          <div className="page-banner-title">개인 연락처 DB</div>
          <div className="page-banner-desc">브랜드 담당자 개인 연락처 데이터베이스를 관리합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={load}>↻ 새로고침</button>
          <button className="page-banner-btn" onClick={addRow}>+ 행 추가</button>
        </div>
      </div>

      <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'clip' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="검색..."
            style={{ padding: '6px 12px', fontSize: 13, border: '1px solid var(--gray-3)', borderRadius: 8, outline: 'none', width: 220, fontFamily: 'inherit' }}
          />
          <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>
            {filtered.length}<span style={{ fontWeight: 400 }}> 건</span>
          </span>
          {saving && <span style={{ fontSize: 11, color: 'var(--gray-4)', marginLeft: 4 }}>저장 중...</span>}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', overflowY: 'scroll', maxHeight: 'calc(100vh - 220px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--gray-1)' }}>
                {FIELDS.map(f => (
                  <th key={f.key} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-6)', borderBottom: '2px solid var(--gray-2)', whiteSpace: 'nowrap', width: f.width }}>
                    {f.label}
                  </th>
                ))}
                <th style={{ width: 48, padding: '10px 8px', borderBottom: '2px solid var(--gray-2)' }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={FIELDS.length + 1} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-5)' }}>불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={FIELDS.length + 1} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-5)' }}>데이터가 없습니다.</td></tr>
              ) : filtered.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--gray-2)' }}>
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
                        style={{ padding: '0 12px', height: 40, cursor: 'text', verticalAlign: 'middle', maxWidth: f.width, overflow: 'hidden' }}>
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
                  <td style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                    <button
                      onClick={() => deleteRow(row.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-4)', fontSize: 14, lineHeight: 1, padding: 4, borderRadius: 4 }}
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
