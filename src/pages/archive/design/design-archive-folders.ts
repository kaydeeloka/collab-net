import { demoDb } from '@/lib/local-db'
import { BUCKET, getSignedUrl } from '@/pages/brand/confirmed/archive/shared'

export interface DesignArchiveFolder {
  id: string
  phase_id: string
  name: string
  sort_order: number
  created_at: string
  file_count?: number
  sub_folder_count?: number
  parent_folder_id?: string | null
}

export interface DesignArchiveFile {
  id: string
  folder_id: string
  file_name: string
  storage_path: string
  file_size: number | null
  mime_type: string | null
  sort_order: number
  created_at: string
  imageUrl?: string | null
}

function buildFilePath(phaseId: string, folderId: string, fileName: string, index: number) {
  const rawExt = fileName.includes('.') ? fileName.split('.').pop() ?? 'jpg' : 'jpg'
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg'
  const token = `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 10)}`
  return `${phaseId}/design/folders/${folderId}/${token}.${ext}`
}

export async function loadDesignArchiveFolders(phaseId: string, parentId: string | null = null): Promise<DesignArchiveFolder[]> {
  let query = demoDb
    .from('design_archive_folders')
    .select('id, phase_id, name, sort_order, created_at, parent_folder_id')
    .eq('phase_id', phaseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (parentId === null) {
    query = query.is('parent_folder_id', null)
  } else {
    query = query.eq('parent_folder_id', parentId)
  }

  const { data: folders, error } = await query

  if (error || !folders?.length) {
    if (error) console.error('loadDesignArchiveFolders:', error.message)
    return []
  }

  const { data: counts } = await demoDb
    .from('design_archive_files')
    .select('folder_id')
    .in('folder_id', folders.map(f => f.id))

  const countByFolder = new Map<string, number>()
  for (const row of counts ?? []) {
    const fid = row.folder_id as string
    countByFolder.set(fid, (countByFolder.get(fid) ?? 0) + 1)
  }

  let subCountByFolder = new Map<string, number>()
  if (parentId === null) {
    const { data: subRows } = await demoDb
      .from('design_archive_folders')
      .select('parent_folder_id')
      .in('parent_folder_id', folders.map(f => f.id))
    for (const row of subRows ?? []) {
      const pid = row.parent_folder_id as string
      subCountByFolder.set(pid, (subCountByFolder.get(pid) ?? 0) + 1)
    }
  }

  return folders.map(f => ({
    ...f,
    file_count: countByFolder.get(f.id) ?? 0,
    sub_folder_count: subCountByFolder.get(f.id) ?? 0,
  }))
}

export async function createDesignArchiveFolder(phaseId: string, name: string, parentFolderId?: string | null) {
  const trimmed = name.trim()
  if (!trimmed) return { folder: null, error: '폴더 이름을 입력하세요' }

  const { data, error } = await demoDb
    .from('design_archive_folders')
    .insert({
      phase_id: phaseId,
      name: trimmed,
      ...(parentFolderId ? { parent_folder_id: parentFolderId } : {}),
    })
    .select('id, phase_id, name, sort_order, created_at, parent_folder_id')
    .single()

  if (error) return { folder: null, error: error.message }
  return { folder: { ...data, file_count: 0 } as DesignArchiveFolder, error: null }
}

export async function deleteDesignArchiveFolder(folderId: string) {
  const { data: files } = await demoDb
    .from('design_archive_files')
    .select('storage_path')
    .eq('folder_id', folderId)

  const paths = (files ?? []).map(f => f.storage_path as string)
  if (paths.length) {
    await demoDb.storage.from(BUCKET).remove(paths)
  }

  const { error } = await demoDb.from('design_archive_folders').delete().eq('id', folderId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function renameDesignArchiveFolder(folderId: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) return { error: '폴더 이름을 입력하세요' }

  const { error } = await demoDb
    .from('design_archive_folders')
    .update({ name: trimmed })
    .eq('id', folderId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function loadDesignArchiveFiles(folderId: string): Promise<DesignArchiveFile[]> {
  const { data, error } = await demoDb
    .from('design_archive_files')
    .select('id, folder_id, file_name, storage_path, file_size, mime_type, sort_order, created_at')
    .eq('folder_id', folderId)
    .order('file_name', { ascending: true })

  if (error || !data?.length) {
    if (error) console.error('loadDesignArchiveFiles:', error.message)
    return []
  }

  const withUrls = await Promise.all(
    data.map(async row => {
      const signed = await getSignedUrl(row.storage_path)
      return {
        ...(row as DesignArchiveFile),
        imageUrl: signed.url,
      }
    }),
  )
  return withUrls
}

export async function uploadDesignArchiveFiles(
  phaseId: string,
  folderId: string,
  files: File[],
) {
  const uploaded: DesignArchiveFile[] = []
  const errors: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const path = buildFilePath(phaseId, folderId, file.name, i)
    const { error: upErr } = await demoDb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })
    if (upErr) {
      errors.push(`${file.name}: ${upErr.message}`)
      continue
    }

    const { data: row, error: insErr } = await demoDb
      .from('design_archive_files')
      .insert({
        folder_id: folderId,
        file_name: file.name,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        sort_order: i,
      })
      .select('id, folder_id, file_name, storage_path, file_size, mime_type, sort_order, created_at')
      .single()

    if (insErr) {
      await demoDb.storage.from(BUCKET).remove([path])
      errors.push(`${file.name}: ${insErr.message}`)
      continue
    }

    uploaded.push({
      ...(row as DesignArchiveFile),
      imageUrl: (await getSignedUrl(row.storage_path)).url,
    })
  }

  return { uploaded, error: errors.length ? errors.join('\n') : null }
}

export async function renameDesignArchiveFile(fileId: string, newName: string) {
  const trimmed = newName.trim()
  if (!trimmed) return { error: '파일 이름을 입력하세요' }
  const { error } = await demoDb.from('design_archive_files').update({ file_name: trimmed }).eq('id', fileId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function reorderDesignArchiveFolders(ordered: DesignArchiveFolder[]) {
  const results = await Promise.all(
    ordered.map((f, i) =>
      demoDb.from('design_archive_folders').update({ sort_order: i }).eq('id', f.id)
    )
  )
  const err = results.find(r => r.error)?.error
  return { error: err?.message ?? null }
}

export async function deleteDesignArchiveFile(fileId: string, storagePath: string) {
  const { error: storageErr } = await demoDb.storage.from(BUCKET).remove([storagePath])
  if (storageErr) return { error: storageErr.message }

  const { error } = await demoDb.from('design_archive_files').delete().eq('id', fileId)
  if (error) return { error: error.message }
  return { error: null }
}
