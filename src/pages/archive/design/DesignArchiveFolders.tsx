import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Folder, FolderPlus, ImagePlus, Trash2, Upload } from 'lucide-react'
import Modal from '@/components/Modal'
import Spinner from '@/components/Spinner'
import { useToast } from '@/contexts/ToastContext'
import {
  createDesignArchiveFolder,
  deleteDesignArchiveFile,
  deleteDesignArchiveFolder,
  loadDesignArchiveFiles,
  loadDesignArchiveFolders,
  uploadDesignArchiveFiles,
  type DesignArchiveFile,
  type DesignArchiveFolder,
} from './design-archive-folders'

interface Props {
  phaseId: string
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
    showConfirm(`"${folder.name}" 폴더와 안의 이미지를 모두 삭제할까요?`, () => {
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
        showToast(`${uploaded.length}개 이미지 업로드 완료`, 'success')
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
        <div className="design-folders__toolbar">
          <button
            type="button"
            className="cfg-btn cfg-btn--ghost design-folders__back"
            onClick={() => setOpenFolderId(null)}
          >
            <ArrowLeft size={14} />
            폴더 목록
          </button>
          <div className="design-folders__toolbar-title">
            <Folder size={16} />
            {openFolder.name}
            <span className="design-folders__count">{files.length}개</span>
          </div>
          <label className="cfg-btn design-folders__upload-btn">
            <Upload size={13} />
            {uploading ? '업로드 중…' : '이미지 업로드'}
            <input
              type="file"
              accept="image/*"
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

        {filesLoading ? (
          <div className="design-folders__loading">
            <Spinner />
          </div>
        ) : !files.length ? (
          <div className="design-folders__empty">
            <ImagePlus size={28} strokeWidth={1.5} />
            <p>이 폴더에 이미지가 없습니다.</p>
            <label className="cfg-btn cfg-btn--ghost">
              <Upload size={13} />
              이미지 업로드
              <input
                type="file"
                accept="image/*"
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
        ) : (
          <div className="design-folders__grid">
            {files.map(file => (
              <article key={file.id} className="design-folders__file">
                <div className="design-folders__file-media">
                  {file.imageUrl ? (
                    <img src={file.imageUrl} alt={file.file_name} />
                  ) : (
                    <span className="design-archive-asset__placeholder">미리보기 없음</span>
                  )}
                </div>
                <div className="design-folders__file-foot">
                  <span className="design-folders__file-name" title={file.file_name}>
                    {file.file_name}
                  </span>
                  <button
                    type="button"
                    className="design-folders__file-delete"
                    aria-label="삭제"
                    onClick={() => handleDeleteFile(file)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="design-folders">
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
        <div className="design-folders__empty">
          <Folder size={28} strokeWidth={1.5} />
          <p>폴더가 없습니다. 폴더를 만든 뒤 이미지를 업로드하세요.</p>
          <button type="button" className="cfg-btn cfg-btn--ghost" onClick={() => setCreateOpen(true)}>
            <FolderPlus size={13} />
            폴더 만들기
          </button>
        </div>
      ) : (
        <div className="design-folders__list">
          {folders.map(folder => (
            <article key={folder.id} className="design-folders__card">
              <button
                type="button"
                className="design-folders__card-open"
                onClick={() => setOpenFolderId(folder.id)}
              >
                <Folder size={22} strokeWidth={1.5} />
                <span className="design-folders__card-name">{folder.name}</span>
                <span className="design-folders__count">{folder.file_count ?? 0}개 이미지</span>
              </button>
              <button
                type="button"
                className="design-folders__card-delete"
                aria-label={`${folder.name} 삭제`}
                onClick={() => handleDeleteFolder(folder)}
              >
                <Trash2 size={14} />
              </button>
            </article>
          ))}
        </div>
      )}

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
