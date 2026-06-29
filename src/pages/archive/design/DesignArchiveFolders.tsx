import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import JSZip from 'jszip'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, FileText, Folder, FolderPlus, ImagePlus, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import Modal from '@/components/Modal'
import Spinner from '@/components/Spinner'
import { useToast } from '@/contexts/ToastContext'
import {
  createDesignArchiveFolder,
  deleteDesignArchiveFile,
  deleteDesignArchiveFolder,
  loadDesignArchiveFiles,
  loadDesignArchiveFolders,
  renameDesignArchiveFile,
  renameDesignArchiveFolder,
  reorderDesignArchiveFolders,
  uploadDesignArchiveFiles,
  type DesignArchiveFile,
  type DesignArchiveFolder,
} from './design-archive-folders'

interface Props {
  phaseId: string
}

function isImage(f: DesignArchiveFile) {
  return (f.mime_type?.startsWith('image/') ?? false) || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.file_name)
}

function isPdf(f: DesignArchiveFile) {
  return f.mime_type === 'application/pdf' || f.file_name.toLowerCase().endsWith('.pdf')
}

function FileTypeBadge({ file }: { file: DesignArchiveFile }) {
  const color = isPdf(file) ? '#dc2626' : '#d97706'
  const label = isPdf(file) ? 'PDF' : 'AI'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <FileText size={30} color={color} strokeWidth={1.5} />
      <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
    </div>
  )
}

function DesignFileLightbox({
  files,
  index,
  onClose,
  onChangeIndex,
}: {
  files: DesignArchiveFile[]
  index: number
  onClose: () => void
  onChangeIndex: (i: number) => void
}) {
  const file = files[index]
  const hasPrev = index > 0
  const hasNext = index < files.length - 1

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onChangeIndex(index - 1)
      if (e.key === 'ArrowRight' && hasNext) onChangeIndex(index + 1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, index, hasPrev, hasNext, onChangeIndex])

  if (!file) return null

  const navBtn: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,.12)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    padding: '12px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
      >
        <X size={20} />
      </button>

      {hasPrev && (
        <button type="button" style={{ ...navBtn, left: 16 }} onClick={e => { e.stopPropagation(); onChangeIndex(index - 1) }}>
          <ChevronLeft size={24} />
        </button>
      )}

      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {isImage(file) && file.imageUrl ? (
          <img
            src={file.imageUrl}
            alt={file.file_name}
            style={{ maxWidth: '88vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 8 }}
          />
        ) : isPdf(file) && file.imageUrl ? (
          <>
            <iframe
              src={file.imageUrl}
              title={file.file_name}
              style={{ width: '82vw', height: '76vh', border: 'none', borderRadius: 8, background: '#fff', display: 'block' }}
            />
            <a
              href={file.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '7px 18px', background: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={13} />
              새 탭에서 열기
            </a>
          </>
        ) : file.imageUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 64px', background: 'rgba(255,255,255,.06)', borderRadius: 12 }}>
            <FileText size={64} color="#d97706" strokeWidth={1} />
            <span style={{ color: 'rgba(255,255,255,.8)', fontSize: 14, fontWeight: 600 }}>{file.file_name}</span>
            <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 12 }}>브라우저에서 AI 파일을 미리보기할 수 없습니다.</span>
            <a
              href={file.imageUrl}
              download={file.file_name}
              style={{ padding: '10px 24px', background: '#fff', color: '#111', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Download size={14} />
              다운로드
            </a>
          </div>
        ) : null}
      </div>

      {hasNext && (
        <button type="button" style={{ ...navBtn, right: 16 }} onClick={e => { e.stopPropagation(); onChangeIndex(index + 1) }}>
          <ChevronRight size={24} />
        </button>
      )}

      <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.6)', fontSize: 12, padding: '0 80px', pointerEvents: 'none' }}>
        {file.file_name}
        {files.length > 1 && <span style={{ marginLeft: 8, color: 'rgba(255,255,255,.4)' }}>{index + 1} / {files.length}</span>}
      </div>
    </div>,
    document.body,
  )
}

export default function DesignArchiveFolders({ phaseId }: Props) {
  const { showToast, showConfirm } = useToast()
  const [folders, setFolders] = useState<DesignArchiveFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const [files, setFiles] = useState<DesignArchiveFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [renamingFile, setRenamingFile] = useState<DesignArchiveFile | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renamingFolder, setRenamingFolder] = useState<DesignArchiveFolder | null>(null)
  const [renameFolderValue, setRenameFolderValue] = useState('')
  const [renamingFolderSaving, setRenamingFolderSaving] = useState(false)
  const [downloadingFolderId, setDownloadingFolderId] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const openFolder = folders.find(f => f.id === openFolderId) ?? null

  const reloadFolders = useCallback(async () => {
    setLoading(true)
    const rows = await loadDesignArchiveFolders(phaseId)
    setFolders(rows)
    setLoading(false)
  }, [phaseId])

  const reloadFiles = useCallback(async (folderId: string) => {
    setFilesLoading(true)
    const rows = await loadDesignArchiveFiles(folderId)
    setFiles(rows)
    setFilesLoading(false)
  }, [])

  useEffect(() => {
    void reloadFolders()
  }, [reloadFolders])

  useEffect(() => {
    if (!openFolderId) {
      setFiles([])
      return
    }
    void reloadFiles(openFolderId)
  }, [openFolderId, reloadFiles])

  async function handleCreateFolder() {
    if (creating) return
    setCreating(true)
    const { folder, error } = await createDesignArchiveFolder(phaseId, newFolderName)
    setCreating(false)
    if (error || !folder) {
      showToast(error ?? '폴더 생성 실패', 'error')
      return
    }
    setFolders(prev => [...prev, folder])
    setNewFolderName('')
    setCreateOpen(false)
    showToast('폴더가 생성되었습니다', 'success')
  }

  function handleDeleteFolder(folder: DesignArchiveFolder) {
    showConfirm(`"${folder.name}" 폴더와 안의 파일을 모두 삭제할까요?`, () => {
      void (async () => {
        const { error } = await deleteDesignArchiveFolder(folder.id)
        if (error) {
          showToast(error, 'error')
          return
        }
        setFolders(prev => prev.filter(f => f.id !== folder.id))
        if (openFolderId === folder.id) setOpenFolderId(null)
        showToast('폴더가 삭제되었습니다', 'success')
      })()
    })
  }

  async function handleUpload(filesList: FileList | null) {
    if (!openFolderId || !filesList?.length || uploading) return
    setUploading(true)
    try {
      const { uploaded, error } = await uploadDesignArchiveFiles(
        phaseId,
        openFolderId,
        Array.from(filesList),
      )
      if (uploaded.length) {
        setFiles(prev => [...prev, ...uploaded])
        setFolders(prev => prev.map(f => (
          f.id === openFolderId
            ? { ...f, file_count: (f.file_count ?? 0) + uploaded.length }
            : f
        )))
        showToast(`${uploaded.length}개 파일 업로드 완료`, 'success')
      }
      if (error) showToast(error, 'error')
    } finally {
      setUploading(false)
    }
  }

  function handleDeleteFile(file: DesignArchiveFile) {
    showConfirm(`"${file.file_name}"을(를) 삭제할까요?`, () => {
      void (async () => {
        const { error } = await deleteDesignArchiveFile(file.id, file.storage_path)
        if (error) {
          showToast(error, 'error')
          return
        }
        setFiles(prev => prev.filter(f => f.id !== file.id))
        if (openFolderId) {
          setFolders(prev => prev.map(f => (
            f.id === openFolderId
              ? { ...f, file_count: Math.max(0, (f.file_count ?? 1) - 1) }
              : f
          )))
        }
        showToast('삭제되었습니다', 'success')
      })()
    })
  }

  function getFileExt(fileName: string) {
    const i = fileName.lastIndexOf('.')
    return i > 0 ? fileName.slice(i) : ''
  }

  function openRenameFile(file: DesignArchiveFile) {
    const ext = getFileExt(file.file_name)
    setRenamingFile(file)
    setRenameValue(ext ? file.file_name.slice(0, -ext.length) : file.file_name)
  }

  async function handleRenameFile() {
    if (!renamingFile || renaming) return
    setRenaming(true)
    const ext = getFileExt(renamingFile.file_name)
    const newName = renameValue.trim() + ext
    const { error } = await renameDesignArchiveFile(renamingFile.id, newName)
    setRenaming(false)
    if (error) {
      showToast(error, 'error')
      return
    }
    setFiles(prev => prev.map(f => f.id === renamingFile.id ? { ...f, file_name: newName } : f))
    setRenamingFile(null)
    showToast('이름이 변경되었습니다', 'success')
  }

  async function handleRenameFolder() {
    if (!renamingFolder || renamingFolderSaving) return
    setRenamingFolderSaving(true)
    const { error } = await renameDesignArchiveFolder(renamingFolder.id, renameFolderValue)
    setRenamingFolderSaving(false)
    if (error) { showToast(error, 'error'); return }
    setFolders(prev => prev.map(f => f.id === renamingFolder.id ? { ...f, name: renameFolderValue.trim() } : f))
    setRenamingFolder(null)
    showToast('폴더 이름이 변경되었습니다', 'success')
  }

  async function handleDownloadFolder(folder: DesignArchiveFolder) {
    if (downloadingFolderId) return
    setDownloadingFolderId(folder.id)
    try {
      const folderFiles = await loadDesignArchiveFiles(folder.id)
      if (!folderFiles.length) { showToast('폴더에 파일이 없습니다', 'error'); return }
      const zip = new JSZip()
      const seen = new Map<string, number>()
      await Promise.all(folderFiles.map(async file => {
        if (!file.imageUrl) return
        try {
          const res = await fetch(file.imageUrl)
          const blob = await res.blob()
          const base = file.file_name
          const n = seen.get(base) ?? 0
          seen.set(base, n + 1)
          const zipName = n === 0 ? base : `${base.replace(/(\.[^.]+)$/, '')}_${n}${base.match(/(\.[^.]+)$/)?.[1] ?? ''}`
          zip.file(zipName, blob)
        } catch { /* skip failed files */ }
      }))
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${folder.name}.zip`
      a.click()
      URL.revokeObjectURL(url)
      showToast(`"${folder.name}" 다운로드 완료`, 'success')
    } catch {
      showToast('다운로드 중 오류가 발생했습니다', 'error')
    } finally {
      setDownloadingFolderId(null)
    }
  }

  function handleDrop(toIdx: number) {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOverIdx(null); return }
    const next = [...folders]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(toIdx, 0, moved)
    setFolders(next)
    setDragIdx(null)
    setDragOverIdx(null)
    void reorderDesignArchiveFolders(next)
  }

  if (loading) {
    return (
      <div className="design-folders__loading">
        <Spinner />
      </div>
    )
  }

  if (openFolder) {
    return (
      <section className="design-folders">
        <div className="brand-archive-detail">
          <div className="brand-archive-detail__header">
            <div className="brand-archive-detail__header-row">
              <button
                type="button"
                className="brand-archive-detail__back"
                onClick={() => setOpenFolderId(null)}
              >
                <ArrowLeft size={14} />
                폴더 목록
              </button>
              <label className="cfg-btn design-folders__upload-btn">
                <Upload size={13} />
                {uploading ? '업로드 중…' : '파일 업로드'}
                <input
                  type="file"
                  accept="image/*,.ai,.pdf,application/pdf"
                  multiple
                  hidden
                  disabled={uploading}
                  onChange={e => {
                    void handleUpload(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <Folder size={18} strokeWidth={1.5} color="var(--teal-dk)" />
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>{openFolder.name}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-5)' }}>{files.length}개</span>
            </div>
          </div>

          <div className="brand-archive-detail__body">
        {filesLoading ? (
          <div className="design-folders__loading">
            <Spinner />
          </div>
        ) : !files.length ? (
          <div className="design-folders__empty">
            <ImagePlus size={28} strokeWidth={1.5} />
            <p>이 폴더에 파일이 없습니다.</p>
            <label className="cfg-btn cfg-btn--ghost">
              <Upload size={13} />
              파일 업로드
              <input
                type="file"
                accept="image/*,.ai,.pdf,application/pdf"
                multiple
                hidden
                disabled={uploading}
                onChange={e => {
                  void handleUpload(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        ) : (() => {
          const imageFiles = files.filter(f => isImage(f))
          const docFiles = files.filter(f => !isImage(f))
          const orderedFiles = [...imageFiles, ...docFiles]

          function FileCard({ file }: { file: DesignArchiveFile }) {
            const idx = orderedFiles.indexOf(file)
            return (
              <article key={file.id} className="design-folders__file">
                <button
                  type="button"
                  className="design-folders__file-media"
                  onClick={() => setLightboxIdx(idx)}
                  style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '100%' }}
                >
                  {isImage(file) && file.imageUrl ? (
                    <img src={file.imageUrl} alt={file.file_name} />
                  ) : (
                    <FileTypeBadge file={file} />
                  )}
                </button>
                <div className="design-folders__file-foot">
                  {renamingFile?.id === file.id ? (
                    <>
                      <input
                        type="text"
                        className="design-folders__rename-input"
                        value={renameValue}
                        autoFocus
                        maxLength={200}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && renameValue.trim()) void handleRenameFile()
                          if (e.key === 'Escape') setRenamingFile(null)
                        }}
                      />
                      <span style={{ fontSize: 10, color: 'var(--gray-5)', flexShrink: 0 }}>
                        {getFileExt(renamingFile.file_name)}
                      </span>
                      <button
                        type="button"
                        className="design-folders__file-action"
                        style={{ opacity: 1 }}
                        aria-label="저장"
                        disabled={renaming || !renameValue.trim()}
                        onClick={() => { void handleRenameFile() }}
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        className="design-folders__file-delete"
                        style={{ opacity: 1 }}
                        aria-label="취소"
                        onClick={() => setRenamingFile(null)}
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="design-folders__file-name" title={file.file_name}>
                        {file.file_name}
                      </span>
                      <button
                        type="button"
                        className="design-folders__file-action"
                        aria-label="이름 변경"
                        onClick={() => openRenameFile(file)}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className="design-folders__file-delete"
                        aria-label="삭제"
                        onClick={() => handleDeleteFile(file)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            )
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {imageFiles.length > 0 && (
                <div>
                  {docFiles.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>이미지</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }} />
                    </div>
                  )}
                  <div className="design-folders__grid">
                    {imageFiles.map(file => <FileCard key={file.id} file={file} />)}
                  </div>
                </div>
              )}
              {docFiles.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>문서</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--gray-2)' }} />
                  </div>
                  <div className="design-folders__grid">
                    {docFiles.map(file => <FileCard key={file.id} file={file} />)}
                  </div>
                </div>
              )}
              {lightboxIdx !== null && (
                <DesignFileLightbox
                  files={orderedFiles}
                  index={lightboxIdx}
                  onClose={() => setLightboxIdx(null)}
                  onChangeIndex={setLightboxIdx}
                />
              )}
            </div>
          )
        })()}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="design-folders">
      <div className="design-folders__panel">
        <div className="design-folders__toolbar">
          <h2 className="design-archive-assets__heading">자료 폴더</h2>
          <button
            type="button"
            className="cfg-btn"
            onClick={() => setCreateOpen(true)}
          >
            <FolderPlus size={13} />
            폴더 만들기
          </button>
        </div>

      {!folders.length ? (
        <div className="design-folders__empty" style={{ border: 'none', background: 'transparent' }}>
          <Folder size={28} strokeWidth={1.5} />
          <p>폴더가 없습니다. 폴더를 만든 뒤 파일을 업로드하세요.</p>
          <button type="button" className="cfg-btn cfg-btn--ghost" onClick={() => setCreateOpen(true)}>
            <FolderPlus size={13} />
            폴더 만들기
          </button>
        </div>
      ) : (
        <div className="design-folders__list">
          {folders.map((folder, idx) => (
            <article
              key={folder.id}
              className={[
                'design-folders__card',
                dragIdx === idx ? 'is-dragging' : '',
                dragOverIdx === idx && dragIdx !== idx ? 'is-drag-over' : '',
              ].join(' ')}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
            >
              <button
                type="button"
                className="design-folders__card-open"
                onClick={() => setOpenFolderId(folder.id)}
              >
                <div className="design-folders__card-folder">
                  <span className="design-folders__card-count">{folder.file_count ?? 0}</span>
                </div>
                {renamingFolder?.id === folder.id ? (
                  <div className="design-folders__card-rename" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      className="design-folders__rename-input"
                      value={renameFolderValue}
                      autoFocus
                      maxLength={80}
                      onChange={e => setRenameFolderValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && renameFolderValue.trim()) void handleRenameFolder()
                        if (e.key === 'Escape') setRenamingFolder(null)
                      }}
                    />
                    <button type="button" className="design-folders__file-action" style={{ opacity: 1, flexShrink: 0 }} disabled={renamingFolderSaving || !renameFolderValue.trim()} onClick={() => { void handleRenameFolder() }}><Check size={12} /></button>
                    <button type="button" className="design-folders__file-delete" style={{ opacity: 1, flexShrink: 0 }} onClick={() => setRenamingFolder(null)}><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <span className="design-folders__card-name">{folder.name}</span>
                    <span className="design-folders__card-filecount">{folder.file_count ?? 0}개 파일</span>
                  </>
                )}
              </button>
              <div className="design-folders__card-actions">
                <button
                  type="button"
                  className="design-folders__card-action"
                  aria-label="이름 변경"
                  onClick={e => { e.stopPropagation(); setRenamingFolder(folder); setRenameFolderValue(folder.name) }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  className="design-folders__card-action"
                  aria-label="다운로드"
                  disabled={downloadingFolderId === folder.id}
                  onClick={e => { e.stopPropagation(); void handleDownloadFolder(folder) }}
                >
                  {downloadingFolderId === folder.id ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
                </button>
                <button
                  type="button"
                  className="design-folders__card-action design-folders__card-action--danger"
                  aria-label="삭제"
                  onClick={e => { e.stopPropagation(); handleDeleteFolder(folder) }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          ))}
          <article className="design-folders__card design-folders__card--add">
            <button
              type="button"
              className="design-folders__card-open"
              onClick={() => setCreateOpen(true)}
            >
              <div className="design-folders__add-icon-wrap">
                <div className="design-folders__add-circle">
                  <Plus size={24} />
                </div>
              </div>
              <span className="design-folders__card-name">새 폴더</span>
              <span className="design-folders__card-filecount">&nbsp;</span>
            </button>
          </article>
        </div>
      )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => {
          if (!creating) {
            setCreateOpen(false)
            setNewFolderName('')
          }
        }}
        title="새 폴더"
        footer={(
          <>
            <button
              type="button"
              className="cfg-btn cfg-btn--ghost"
              disabled={creating}
              onClick={() => {
                setCreateOpen(false)
                setNewFolderName('')
              }}
            >
              취소
            </button>
            <button
              type="button"
              className="cfg-btn"
              disabled={creating || !newFolderName.trim()}
              onClick={() => { void handleCreateFolder() }}
            >
              {creating ? '생성 중…' : '만들기'}
            </button>
          </>
        )}
      >
        <label className="design-folders__field">
          <span>폴더 이름</span>
          <input
            type="text"
            className="cfg-input"
            value={newFolderName}
            placeholder="예: 키트 박스 시안"
            maxLength={80}
            autoFocus
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newFolderName.trim()) void handleCreateFolder()
            }}
          />
        </label>
      </Modal>

    </section>
  )
}
