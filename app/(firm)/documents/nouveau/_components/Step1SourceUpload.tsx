'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, X, FileText, FileImage, FileSpreadsheet, FolderInput, FolderOutput, Loader2, ChevronDown } from 'lucide-react'
import { type LoadedFile, type CabSource, type Customer, getFileKind, FILE_KIND_META } from './types'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.tiff,.tif,.heic,.xlsx,.xls,.csv,.docx,.doc'
const MAX_SIZE = 20 * 1024 * 1024

type Props = {
  source:             CabSource | null
  selectedCustomerId: string
  files:              LoadedFile[]
  customers:          Customer[]
  submittingRaw:      boolean
  onSourceChange:     (s: CabSource) => void
  onCustomerChange:   (id: string) => void
  onFilesLoaded:      (files: LoadedFile[]) => void
  onNext:             () => void
  onSubmitRaw:        () => void
}

export default function Step1SourceUpload({
  source, selectedCustomerId, files, customers, submittingRaw,
  onSourceChange, onCustomerChange, onFilesLoaded, onNext, onSubmitRaw,
}: Props) {
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [dragging,        setDragging]        = useState(false)
  const [clientMenuOpen,  setClientMenuOpen]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  const loadFiles = useCallback(async (incoming: File[]) => {
    const oversized = incoming.find(f => f.size > MAX_SIZE)
    if (oversized) { setError(`Fichier trop lourd (max 20 Mo) : ${oversized.name}`); return }
    setError(null)
    setLoading(true)
    try {
      const loaded: LoadedFile[] = await Promise.all(incoming.map(async (file) => {
        const id   = crypto.randomUUID()
        const kind = getFileKind(file)
        if (kind === 'pdf') {
          const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
          GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs'
          const pdfBytes = await file.arrayBuffer()
          const pdfProxy = await getDocument({ data: pdfBytes.slice(0) }).promise
          return { id, file, name: file.name, fileKind: 'pdf' as const, pageCount: pdfProxy.numPages, pdfProxy, pdfBytes }
        }
        if (kind === 'image') {
          return { id, file, name: file.name, fileKind: 'image' as const, pageCount: 1, previewUrl: URL.createObjectURL(file) }
        }
        return { id, file, name: file.name, fileKind: kind, pageCount: 1 }
      }))
      const existing = files.filter(f => !loaded.some(n => n.name === f.name))
      onFilesLoaded([...existing, ...loaded])
    } catch {
      setError('Erreur lors du chargement.')
    } finally {
      setLoading(false)
    }
  }, [files, onFilesLoaded])

  const removeFile = (id: string) => {
    const removed = files.find(f => f.id === id)
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
    onFilesLoaded(files.filter(f => f.id !== id))
  }

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const showSource  = !!selectedCustomerId
  const showUpload  = !!selectedCustomerId && !!source
  const canProceed  = showUpload && files.length > 0 && !loading

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' }}>

      {/* ── 1. Client ────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          1 · Client
        </div>

        {/* Client selector card */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setClientMenuOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 16px',
              border: `2px solid ${selectedCustomer ? '#1D4ED8' : '#E2E8F0'}`,
              borderRadius: '10px',
              background: selectedCustomer ? '#EFF6FF' : '#F8FAFC',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', textAlign: 'left',
            }}
          >
            {selectedCustomer ? (
              <>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: '#1D4ED8', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 700,
                }}>
                  {initials(selectedCustomer.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedCustomer.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#1D4ED8', marginTop: '1px' }}>Client sélectionné · cliquer pour changer</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                  👤
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>Sélectionner un client</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>Obligatoire pour continuer</div>
                </div>
              </>
            )}
            <ChevronDown size={16} color="#94A3B8" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: clientMenuOpen ? 'rotate(180deg)' : 'none' }} />
          </button>

          {/* Dropdown */}
          {clientMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '240px', overflowY: 'auto',
            }}>
              {customers.length === 0 && (
                <div style={{ padding: '16px', fontSize: '13px', color: '#94A3B8', textAlign: 'center' }}>Aucun client actif</div>
              )}
              {customers.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onCustomerChange(c.id); setClientMenuOpen(false) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', background: c.id === selectedCustomerId ? '#EFF6FF' : 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (c.id !== selectedCustomerId) (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC' }}
                  onMouseLeave={e => { if (c.id !== selectedCustomerId) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: c.id === selectedCustomerId ? '#1D4ED8' : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: c.id === selectedCustomerId ? '#fff' : '#64748B', flexShrink: 0 }}>
                    {initials(c.name)}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: c.id === selectedCustomerId ? 600 : 400, color: '#0F172A' }}>{c.name}</span>
                  {c.id === selectedCustomerId && <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#1D4ED8' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Source ─────────────────────────────────────── */}
      {showSource && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            2 · Type de document
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <SourceBtn active={source === 'customer'} icon={FolderInput}  iconBg="#DBEAFE" iconColor="#1D4ED8" activeBorder="#1D4ED8" activeBg="#EFF6FF" label="Document client"  sub="Facture, relevé, contrat reçu"  onClick={() => onSourceChange('customer')} />
            <SourceBtn active={source === 'firm'}     icon={FolderOutput} iconBg="#DCFCE7" iconColor="#059669" activeBorder="#059669" activeBg="#F0FDF4" label="Livrable cabinet" sub="Bilan, déclaration, fiche de paie" onClick={() => onSourceChange('firm')} />
          </div>
        </div>
      )}

      {/* ── 3. Fichiers ───────────────────────────────────── */}
      {showUpload && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            3 · Fichiers
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); loadFiles(Array.from(e.dataTransfer.files)) }}
            onClick={() => !loading && inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#1D4ED8' : '#d1d5db'}`,
              borderRadius: '10px', padding: '32px', textAlign: 'center',
              cursor: loading ? 'default' : 'pointer',
              background: dragging ? '#EFF6FF' : '#fff', transition: 'all 0.15s',
            }}
          >
            <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden
              onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) loadFiles(f); e.target.value = '' }} />
            <div style={{ width: '40px', height: '40px', margin: '0 auto 12px', background: '#f3f4f6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={20} color="#9ca3af" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '3px' }}>
              {loading ? 'Chargement…' : 'Glissez vos fichiers ici'}
            </div>
            {!loading && (
              <>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>ou</div>
                <button type="button" onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
                  style={{ padding: '6px 18px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Choisir des fichiers
                </button>
                <div style={{ fontSize: '11px', color: '#d1d5db', marginTop: '8px' }}>PDF · Images · Excel · CSV · Word · 20 Mo max</div>
              </>
            )}
          </div>

          {error && (
            <div style={{ marginTop: '10px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', color: '#dc2626' }}>
              {error}
            </div>
          )}

          {files.length > 0 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {files.map(f => {
                  const meta = FILE_KIND_META[f.fileKind]
                  const Icon = f.fileKind === 'image' ? FileImage : f.fileKind === 'table' ? FileSpreadsheet : FileText
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                      <div style={{ width: '32px', height: '32px', background: meta.bg, borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={15} color={meta.color} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                          {f.fileKind === 'pdf' ? `${f.pageCount} page${f.pageCount > 1 ? 's' : ''}` : meta.label}
                          {' · '}{(f.file.size / 1024 / 1024).toFixed(1)} Mo
                        </div>
                      </div>
                      <button type="button" onClick={() => removeFile(f.id)}
                        style={{ width: '26px', height: '26px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#d1d5db', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={onSubmitRaw} disabled={submittingRaw || !canProceed}
                  style={{ flex: 1, padding: '11px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#374151', cursor: canProceed && !submittingRaw ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: canProceed && !submittingRaw ? 1 : 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {submittingRaw && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                    {submittingRaw ? 'Envoi…' : 'Déposer sans qualifier'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>À qualifier plus tard</span>
                </button>
                <button type="button" onClick={onNext} disabled={!canProceed}
                  style={{ flex: 1, padding: '11px 14px', background: '#1D4ED8', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#fff', cursor: canProceed ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: canProceed ? 1 : 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span>Qualifier les fichiers →</span>
                  <span style={{ fontSize: '11px', color: '#BFDBFE', fontWeight: 400 }}>Type et période</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function SourceBtn({ active, icon: Icon, iconBg, iconColor, activeBorder, activeBg, label, sub, onClick }: {
  active: boolean; icon: React.ElementType; iconBg: string; iconColor: string
  activeBorder: string; activeBg: string; label: string; sub: string; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px',
      border: `2px solid ${active ? activeBorder : '#E2E8F0'}`,
      borderRadius: '10px', background: active ? activeBg : '#F8FAFC',
      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s', width: '100%',
    }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color={iconColor} />
      </div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.3 }}>{sub}</div>
      </div>
    </button>
  )
}
