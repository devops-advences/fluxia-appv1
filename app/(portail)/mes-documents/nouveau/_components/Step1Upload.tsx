'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, X, FileText, FileImage, FileSpreadsheet, Loader2 } from 'lucide-react'
import { type LoadedFile, type FileKind, getFileKind, FILE_KIND_META } from './types'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.tiff,.tif,.heic,.xlsx,.xls,.csv,.docx,.doc'
const REJECTED_EXTS = ['.zip', '.xml', '.ods', '.odt', '.rtf', '.gz', '.tar']

const MAX_SIZE: Record<FileKind, number> = {
  pdf:   20 * 1024 * 1024,
  image: 20 * 1024 * 1024,
  table: 10 * 1024 * 1024,
  doc:   10 * 1024 * 1024,
}

function isRejectedExt(file: File) {
  const n = file.name.toLowerCase()
  return REJECTED_EXTS.some(ext => n.endsWith(ext))
}

function FileKindIcon({ kind, size = 16 }: { kind: FileKind; size?: number }) {
  const meta = FILE_KIND_META[kind]
  const Icon = kind === 'image' ? FileImage : kind === 'table' ? FileSpreadsheet : FileText
  return (
    <div style={{ width: '34px', height: '34px', background: meta.bg, borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size} color={meta.color} strokeWidth={2} />
    </div>
  )
}

type Props = {
  files: LoadedFile[]
  onFilesLoaded: (files: LoadedFile[]) => void
  onNext: () => void
  onSubmitRaw: () => void
  submittingRaw: boolean
  existingFilenames: string[]
}

export default function Step1Upload({ files, onFilesLoaded, onNext, onSubmitRaw, submittingRaw, existingFilenames }: Props) {
  const [loading, setLoading]                     = useState(false)
  const [error, setError]                         = useState<string | null>(null)
  const [sessionDupWarning, setSessionDupWarning] = useState<string | null>(null)
  const [dbDupNames, setDbDupNames]               = useState<Set<string>>(new Set())
  const [dragging, setDragging]                   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadFiles = useCallback(async (incoming: File[]) => {
    const rejected = incoming.filter(isRejectedExt)
    if (rejected.length > 0) {
      setError(`Format non supporté : ${rejected.map(f => f.name).join(', ')}. Formats acceptés : PDF, images, Excel, CSV, Word.`)
      return
    }

    const oversized = incoming.find(f => f.size > MAX_SIZE[getFileKind(f)])
    if (oversized) {
      const limitMb = MAX_SIZE[getFileKind(oversized)] / (1024 * 1024)
      setError(`Fichier trop lourd (max ${limitMb} Mo) : ${oversized.name}`)
      return
    }

    const sessionDups = incoming.filter(f => files.some(e => e.name === f.name))
    setSessionDupWarning(sessionDups.length > 0
      ? `Déjà dans la sélection : ${sessionDups.map(f => f.name).join(', ')}`
      : null)

    setError(null)
    setLoading(true)

    try {
      const loaded: LoadedFile[] = await Promise.all(incoming.map(async (file) => {
        const id   = crypto.randomUUID()
        const kind = getFileKind(file)

        if (kind === 'pdf') {
          const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
          GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
          const pdfBytes = await file.arrayBuffer()
          const pdfProxy = await getDocument({ data: pdfBytes.slice(0) }).promise
          return { id, file, name: file.name, fileKind: 'pdf' as const, pageCount: pdfProxy.numPages, pdfProxy, pdfBytes }
        }

        if (kind === 'image') {
          const previewUrl = URL.createObjectURL(file)
          return { id, file, name: file.name, fileKind: 'image' as const, pageCount: 1, previewUrl }
        }

        return { id, file, name: file.name, fileKind: kind, pageCount: 1 }
      }))

      const newDbDups = loaded.filter(f => existingFilenames.includes(f.name)).map(f => f.name)
      if (newDbDups.length > 0) setDbDupNames(prev => new Set([...prev, ...newDbDups]))

      const existing = files.filter(f => !loaded.some(n => n.name === f.name))
      onFilesLoaded([...existing, ...loaded])
    } catch {
      setError('Erreur lors du chargement du fichier.')
    } finally {
      setLoading(false)
    }
  }, [files, onFilesLoaded, existingFilenames])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    loadFiles(Array.from(e.dataTransfer.files))
  }, [loadFiles])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length) loadFiles(picked)
    e.target.value = ''
  }

  const removeFile = (id: string) => {
    const removed = files.find(f => f.id === id)
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
    onFilesLoaded(files.filter(f => f.id !== id))
    if (removed) setDbDupNames(prev => { const next = new Set(prev); next.delete(removed.name); return next })
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#1D4ED8' : '#d1d5db'}`,
          borderRadius: '10px', padding: '48px 32px',
          textAlign: 'center', cursor: 'pointer',
          background: dragging ? '#EFF6FF' : '#fff',
          transition: 'all 0.15s',
        }}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={onInputChange} />
        <div style={{ width: '44px', height: '44px', margin: '0 auto 14px', background: '#f3f4f6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading
            ? <Loader2 size={22} color="#9ca3af" style={{ animation: 'spin 1s linear infinite' }} />
            : <Upload size={22} color="#9ca3af" strokeWidth={1.5} />
          }
        </div>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
          {loading ? 'Chargement…' : 'Glissez vos fichiers ici'}
        </div>
        {!loading && (
          <>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '14px' }}>ou</div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
              style={{ padding: '7px 20px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Choisir des fichiers
            </button>
            <div style={{ fontSize: '11px', color: '#d1d5db', marginTop: '10px' }}>PDF · Images · Excel · CSV · Word · 20 Mo max</div>
          </>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {sessionDupWarning && (
        <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
          ⚠ {sessionDupWarning}
        </div>
      )}

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {files.map(f => {
            const meta = FILE_KIND_META[f.fileKind]
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <FileKindIcon kind={f.fileKind} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                    {f.fileKind === 'pdf' ? `${f.pageCount} page${f.pageCount > 1 ? 's' : ''}` : meta.label}
                    {' · '}{(f.file.size / 1024 / 1024).toFixed(1)} Mo
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: meta.bg, color: meta.color, flexShrink: 0 }}>
                  {meta.label}
                </span>
                {dbDupNames.has(f.name) && (
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    ⚠ Déjà déposé
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  style={{ width: '26px', height: '26px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#d1d5db', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {files.length > 0 && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onSubmitRaw}
            disabled={submittingRaw}
            style={{
              flex: 1, padding: '12px 16px', background: '#fff', border: '1px solid #d1d5db',
              borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#374151',
              cursor: submittingRaw ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: submittingRaw ? 0.6 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {submittingRaw && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              {submittingRaw ? 'Envoi…' : 'Déposer sans qualifier'}
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>
              Stocké dans votre espace · en attente de qualification
            </span>
          </button>
          <button
            type="button"
            onClick={onNext}
            style={{
              flex: 1, padding: '12px 16px', background: '#1D4ED8', border: 'none',
              borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center',
            }}
          >
            <span>Qualifier avant d&apos;envoyer</span>
            <span style={{ fontSize: '11px', color: '#BFDBFE', fontWeight: 400 }}>Renseigner type et période</span>
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
