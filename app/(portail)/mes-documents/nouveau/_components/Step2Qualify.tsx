'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PdfPageCanvas from './PdfPageCanvas'
import { FileImage, FileSpreadsheet, FileText } from 'lucide-react'
import {
  type LoadedFile, type Qualification, type FileKind,
  CUSTOMER_DOC_TYPES, MONTHS, DOC_COLORS, FILE_KIND_META,
  qualKey, getDocs, getAllDocs,
} from './types'

function NonPdfPreview({ fileKind, name }: { fileKind: FileKind; name: string }) {
  const meta = FILE_KIND_META[fileKind]
  const Icon = fileKind === 'image' ? FileImage : fileKind === 'table' ? FileSpreadsheet : FileText
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px', flex: 1 }}>
      <div style={{ width: '56px', height: '56px', background: meta.bg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={28} color={meta.color} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>Aperçu non disponible</div>
      <div style={{ fontSize: '12px', color: '#374151', fontWeight: 500, textAlign: 'center', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
    </div>
  )
}

type Props = {
  files: LoadedFile[]
  cuts: Set<number>[]
  skips: Set<number>[]
  quals: Record<string, Qualification>
  curFi: number
  curDi: number
  previewP: number
  onCutToggle: (fi: number, afterPage: number) => void
  onSkipToggle: (fi: number, page: number) => void
  onSelectPage: (fi: number, di: number, page: number) => void
  onQualChange: (key: string, q: Qualification) => void
  onAllDone: () => void
}

async function detectFromPage(pdfProxy: NonNullable<LoadedFile['pdfProxy']>, pageNum: number): Promise<Partial<Qualification>> {
  try {
    const page    = await pdfProxy.getPage(pageNum)
    const content = await page.getTextContent()
    const text    = content.items.map((i: unknown) => (i as { str: string }).str).join(' ').toUpperCase()

    let type: string | undefined
    if (/\bFACTURE\b.*\bVENTE\b|\bINVOICE\b/.test(text))          type = 'Facture vente'
    else if (/\bFACTURE\b.*\bACHAT\b|FOURNISSEUR/.test(text))     type = 'Facture achat'
    else if (/RELEV[EÉ]\s+DE\s+COMPTE|RELEV[EÉ]\s+BANCAIRE|SOLDE\s+AU/.test(text)) type = 'Relevé bancaire'
    else if (/NOTE\s+DE\s+FRAIS|FRAIS\s+PROFESSIONNELS/.test(text))               type = 'Note de frais'
    else if (/CONTRAT\s+DE\s+TRAVAIL|CONTRAT\s+D.EMBAUCHE/.test(text))           type = "Contrat d'embauche"
    else if (/CONTRAT\s+(FOURNISSEUR|PRESTATAIRE|MAINTENANCE)/.test(text))        type = 'Contrat fournisseur'
    else if (/\bFACTURE\b/.test(text))                                            type = 'Facture vente'

    let year: string | undefined
    let month: string | undefined

    const dateMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
    if (dateMatch) { month = dateMatch[2]; year = dateMatch[3] }

    if (!month) {
      const monthNames: Record<string, string> = {
        'JANVIER':'01','FÉVRIER':'02','FEVRIER':'02','MARS':'03','AVRIL':'04',
        'MAI':'05','JUIN':'06','JUILLET':'07','AOÛT':'08','AOUT':'08',
        'SEPTEMBRE':'09','OCTOBRE':'10','NOVEMBRE':'11','DÉCEMBRE':'12','DECEMBRE':'12',
      }
      for (const [name, num] of Object.entries(monthNames)) {
        const re = new RegExp(`${name}\\s+(20\\d{2})`)
        const m  = text.match(re)
        if (m) { month = num; year = m[1]; break }
      }
    }

    if (!year) {
      const yearMatch = text.match(/\b(202[0-9]|203[0-9])\b/)
      if (yearMatch) year = yearMatch[1]
    }

    return { type, year, month }
  } catch {
    return {}
  }
}

export default function Step2Qualify({
  files, cuts, skips, quals, curFi, curDi, previewP,
  onCutToggle, onSkipToggle, onSelectPage, onQualChange, onAllDone,
}: Props) {
  const allDocs     = useMemo(() => getAllDocs(files, cuts), [files, cuts])
  const gi          = useMemo(() => allDocs.findIndex(d => d.fi === curFi && d.di === curDi), [allDocs, curFi, curDi])
  const curDoc      = allDocs[gi]
  const curFile     = files[curFi]
  const key         = qualKey(curFi, curDi)
  const q           = quals[key] ?? { type: '', year: new Date().getFullYear().toString(), month: '', note: '' }
  const allCommitted = allDocs.every(d => !!quals[qualKey(d.fi, d.di)]?.committed)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!curFile || !curDoc) return
    if (curFile.fileKind !== 'pdf' || !curFile.pdfProxy) return
    const alreadyQualified = !!(quals[key]?.type && quals[key]?.year)
    if (alreadyQualified) return
    onQualChange(key, { type: '', year: new Date().getFullYear().toString(), month: '', note: '' })
    detectFromPage(curFile.pdfProxy, curDoc.start).then(detected => {
      if (!detected.type && !detected.year) return
      onQualChange(key, {
        type:  detected.type  ?? '',
        year:  detected.year  ?? new Date().getFullYear().toString(),
        month: detected.month ?? '',
        note:  '',
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curFi, curDi])

  const setField = useCallback((field: keyof Qualification, value: string) => {
    onQualChange(key, { ...q, [field]: value })
  }, [key, q, onQualChange])

  const isQualified = (fi: number, di: number) => {
    const qq = quals[qualKey(fi, di)]
    return !!(qq?.type && qq?.year)
  }

  if (!curFile || !curDoc) return null

  const safePreviewP = previewP >= curDoc.start && previewP <= curDoc.end ? previewP : curDoc.start
  const noCutsYet    = cuts.every(s => s.size === 0)
  const hasPdfs      = files.some(f => f.fileKind === 'pdf')

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* ── Colonne gauche : pages + coupures ── */}
      <div style={{ width: '195px', flexShrink: 0, borderRight: '1px solid #e5e7eb', overflowY: 'auto', background: '#f9fafb' }}>
        {noCutsYet && hasPdfs && (
          <div style={{ margin: '8px 8px 0', padding: '7px 9px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '11px', color: '#92400e', lineHeight: 1.4 }}>
            ✂ Cliquez <strong>entre deux pages</strong> pour séparer en plusieurs documents
          </div>
        )}
        {files.map((file, fi) => {
          const docs = getDocs(file.pageCount, cuts[fi])
          return (
            <div key={file.id}>
              <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {docs.map((doc, di) => {
                  const color     = DOC_COLORS[di % DOC_COLORS.length]
                  const isActive  = fi === curFi && di === curDi
                  const qual      = quals[qualKey(fi, di)]
                  const committed = !!qual?.committed
                  const typeLabel = CUSTOMER_DOC_TYPES.find(t => t.value === qual?.type)?.label ?? ''
                  const period    = qual?.year ? `${qual.month ? (MONTHS[qual.month] ?? '') + ' ' : ''}${qual.year}` : ''
                  const isLastDoc = di === docs.length - 1
                  const globalIdx = allDocs.findIndex(d => d.fi === fi && d.di === di)
                  const docLabel  = `Document ${globalIdx + 1}`

                  if (committed) {
                    return (
                      <div key={di}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', padding: '4px 5px 2px' }}>{docLabel}</div>
                        <div
                          onClick={() => { setEditing(true); onSelectPage(fi, di, doc.start) }}
                          title="Cliquer pour modifier"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer', background: '#dcfce7', border: '1px solid #bbf7d0' }}
                        >
                          <span style={{ fontSize: '11px', color: '#059669', flexShrink: 0 }}>✓</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#065f46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeLabel}</div>
                            {period && <div style={{ fontSize: '10px', color: '#059669' }}>{period}</div>}
                          </div>
                          {file.fileKind === 'pdf' && (
                            <span style={{ fontSize: '10px', color: '#86efac', flexShrink: 0 }}>{doc.end - doc.start + 1}p</span>
                          )}
                        </div>
                        {!isLastDoc && file.fileKind === 'pdf' && (
                          <CutZone hasCut={cuts[fi].has(doc.end)} onClick={() => onCutToggle(fi, doc.end)} />
                        )}
                      </div>
                    )
                  }

                  if (file.fileKind !== 'pdf') {
                    const kindMeta = FILE_KIND_META[file.fileKind]
                    return (
                      <div key={di} style={{ marginTop: di > 0 ? '2px' : 0 }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', padding: '4px 5px 2px' }}>{docLabel}</div>
                        <div
                          onClick={() => onSelectPage(fi, di, 1)}
                          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '5px', cursor: 'pointer', border: `1px solid ${isActive ? kindMeta.color : '#e5e7eb'}`, background: isActive ? kindMeta.bg : '#fff' }}
                        >
                          <div style={{ width: '24px', height: '24px', background: kindMeta.bg, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '10px', color: kindMeta.color, fontWeight: 700 }}>{kindMeta.label.slice(0, 3).toUpperCase()}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                            <span style={{ fontSize: '10px', color: '#f59e0b' }}>Non traité</span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={di} style={{ marginTop: di > 0 ? '2px' : 0 }}>
                      <div onClick={() => onSelectPage(fi, di, doc.start)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 5px 3px', cursor: 'pointer' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color.text, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>{docLabel}</span>
                          <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '5px' }}>Non traité</span>
                        </div>
                      </div>
                      {Array.from({ length: doc.end - doc.start + 1 }, (_, i) => doc.start + i).map(p => {
                        const isPrev = isActive && p === safePreviewP
                        const isSkip = skips[fi]?.has(p)
                        const hasCut = cuts[fi].has(p)
                        return (
                          <div key={p}>
                            <div
                              className="page-thumb-row"
                              onClick={() => !isSkip && onSelectPage(fi, di, p)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '7px',
                                padding: '4px 5px', borderRadius: '5px',
                                cursor: isSkip ? 'default' : 'pointer',
                                borderTop:    `1px solid ${isPrev ? '#1D4ED8' : 'transparent'}`,
                                borderRight:  `1px solid ${isPrev ? '#1D4ED8' : 'transparent'}`,
                                borderBottom: `1px solid ${isPrev ? '#1D4ED8' : 'transparent'}`,
                                borderLeft:   `3px solid ${isActive ? color.text : 'transparent'}`,
                                background: isSkip ? '#fef2f2' : isPrev ? '#EFF6FF' : isActive ? '#EFF6FF' : 'transparent',
                                opacity: isSkip ? 0.5 : 1,
                                transition: 'all 0.1s', position: 'relative',
                              }}
                            >
                              <div style={{ width: '30px', height: '40px', flexShrink: 0, border: `1px solid ${isSkip ? '#fca5a5' : '#d1d5db'}`, borderRadius: '2px', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                <PdfPageCanvas pdfProxy={file.pdfProxy!} pageNumber={p} scale={0.1} className="pdf-thumb" />
                                {isSkip && (
                                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(254,226,226,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#ef4444' }}>✕</div>
                                )}
                              </div>
                              <span style={{ fontSize: '11px', color: isSkip ? '#9ca3af' : '#374151', flex: 1, textDecoration: isSkip ? 'line-through' : 'none' }}>Page {p}</span>
                              <button
                                type="button"
                                className="skip-btn"
                                onClick={e => { e.stopPropagation(); onSkipToggle(fi, p) }}
                                title={isSkip ? 'Restaurer la page' : 'Ignorer cette page'}
                                style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSkip ? '#ef4444' : '#9ca3af', color: '#fff', opacity: isSkip ? 1 : 0, transition: 'opacity 0.12s', fontFamily: 'inherit' }}
                              >
                                {isSkip ? '↩' : '✕'}
                              </button>
                            </div>
                            {p < file.pageCount && (
                              <CutZone hasCut={hasCut} onClick={() => onCutToggle(fi, p)} />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Colonne centre : preview ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
        <div style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e5e7eb', background: '#f3f4f6', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{curFile.name}</span>
            <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
              {curFile.file.size < 1024 * 1024
                ? `${Math.round(curFile.file.size / 1024)} Ko`
                : `${(curFile.file.size / (1024 * 1024)).toFixed(1)} Mo`}
            </span>
          </div>
          {curFile.fileKind === 'pdf' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <NavBtn disabled={safePreviewP <= curDoc.start} onClick={() => onSelectPage(curFi, curDi, safePreviewP - 1)}>‹</NavBtn>
              <span style={{ fontSize: '11px', color: '#6b7280', minWidth: '44px', textAlign: 'center' }}>p.{safePreviewP - curDoc.start + 1} / {curDoc.end - curDoc.start + 1}</span>
              <NavBtn disabled={safePreviewP >= curDoc.end} onClick={() => onSelectPage(curFi, curDi, safePreviewP + 1)}>›</NavBtn>
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '16px 20px' }}>
          {curFile.fileKind === 'pdf' && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'inline-block', lineHeight: 0, maxWidth: '100%' }}>
              <PdfPageCanvas pdfProxy={curFile.pdfProxy!} pageNumber={safePreviewP} scale={1.2} className="pdf-preview" />
            </div>
          )}
          {curFile.fileKind === 'image' && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'inline-block', maxWidth: '100%' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={curFile.previewUrl} alt={curFile.name} style={{ display: 'block', maxWidth: '100%', maxHeight: '600px', objectFit: 'contain' }} />
            </div>
          )}
          {(curFile.fileKind === 'table' || curFile.fileKind === 'doc') && (
            <NonPdfPreview fileKind={curFile.fileKind} name={curFile.name} />
          )}
        </div>
      </div>

      {/* ── Colonne droite : formulaire ── */}
      <div style={{ width: '240px', flexShrink: 0, borderLeft: '1px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>Document {gi + 1} / {allDocs.length}</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
            {curFile.fileKind === 'pdf'
              ? (curDoc.start === curDoc.end ? `Page ${curDoc.start}` : `Pages ${curDoc.start}–${curDoc.end}`)
              : FILE_KIND_META[curFile.fileKind].label
            }
          </div>
          <div style={{ marginTop: '8px' }}>
            {isQualified(curFi, curDi)
              ? <Badge variant="qualified">✓ Qualifié</Badge>
              : <Badge variant="pending">⚠ À qualifier</Badge>
            }
          </div>
        </div>

        {allCommitted && !editing && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '28px' }}>✓</span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>Tous les documents<br />sont qualifiés</div>
            <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.5 }}>Cliquez sur un document<br />à gauche pour le modifier</div>
          </div>
        )}

        {(!allCommitted || editing) && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormGroup label="Type de document" required>
              <select value={q.type} onChange={e => setField('type', e.target.value)} style={selectStyle}>
                <option value="">— Sélectionner —</option>
                {CUSTOMER_DOC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="Période" required>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <select value={q.year} onChange={e => setField('year', e.target.value)} style={selectStyle}>
                  {[2026, 2025, 2024, 2023].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select value={q.month} onChange={e => setField('month', e.target.value)} style={selectStyle}>
                  <option value="">Tous</option>
                  {Object.entries(MONTHS).sort(([a], [b]) => a.localeCompare(b)).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </FormGroup>

            <FormGroup label="Note au cabinet comptable">
              <textarea
                value={q.note}
                onChange={e => setField('note', e.target.value)}
                placeholder="Ex : Factures Q4, Relevé SG…"
                rows={4}
                style={{ ...selectStyle, resize: 'none', backgroundImage: 'none', height: '80px', paddingRight: '10px' }}
              />
            </FormGroup>

            {(() => {
              const canValidate = !!(q.type && q.year)
              const next = allDocs.slice(gi + 1).find(d => !quals[qualKey(d.fi, d.di)]?.committed)
              return (
                <button
                  type="button"
                  disabled={!canValidate}
                  onClick={() => {
                    onQualChange(key, { ...q, committed: true })
                    setEditing(false)
                    if (next) onSelectPage(next.fi, next.di, next.start)
                    else onAllDone()
                  }}
                  style={{ ...btnPrimary, width: '100%', justifyContent: 'center', opacity: canValidate ? 1 : 0.4, cursor: canValidate ? 'pointer' : 'not-allowed' }}
                >
                  Valider et passer →
                </button>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

function CutZone({ hasCut, onClick }: { hasCut: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className={`cut-zone ${hasCut ? 'has-cut' : ''}`} style={{ height: '20px', display: 'flex', alignItems: 'center', margin: '0 3px', position: 'relative', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: hasCut ? '2px' : '1px', background: hasCut ? 'repeating-linear-gradient(90deg,#fca5a5 0,#fca5a5 5px,transparent 5px,transparent 10px)' : 'repeating-linear-gradient(90deg,#d1d5db 0,#d1d5db 4px,transparent 4px,transparent 8px)' }} />
      <div className="cut-label" style={{ position: 'relative', zIndex: 1, fontSize: '10px', fontWeight: 500, padding: '1px 6px', borderRadius: '3px', border: `1px solid ${hasCut ? '#fca5a5' : '#93C5FD'}`, background: hasCut ? '#fff' : '#EFF6FF', color: hasCut ? '#ef4444' : '#1D4ED8', display: 'flex', alignItems: 'center', gap: '3px', opacity: hasCut ? 1 : 0, transition: 'opacity 0.12s', whiteSpace: 'nowrap' }}>
        ✂ {hasCut ? 'Retirer' : 'Couper ici'}
      </div>
      {!hasCut && (
        <span className="cut-hint" style={{ position: 'relative', zIndex: 1, fontSize: '10px', color: '#9ca3af', opacity: 0.35, transition: 'opacity 0.12s', pointerEvents: 'none' }}>✂</span>
      )}
      <style>{`
        .cut-zone:hover .cut-label { opacity: 1 !important; }
        .cut-zone:hover .cut-hint  { opacity: 0 !important; }
        .cut-zone.has-cut .cut-label { opacity: 1 !important; }
        .page-thumb-row:hover .skip-btn { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

function NavBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      style={{ width: '24px', height: '24px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1, fontFamily: 'inherit' }}>
      {children}
    </button>
  )
}

function FormGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Badge({ variant, children }: { variant: 'qualified' | 'pending'; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: variant === 'qualified' ? '#dcfce7' : '#fef3c7', color: variant === 'qualified' ? '#059669' : '#92400e' }}>
      {children}
    </span>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
  fontSize: '13px', color: '#111827', background: '#fff', outline: 'none',
  fontFamily: 'inherit', width: '100%',
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '30px',
}

const btnBase: React.CSSProperties = {
  padding: '7px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center',
  gap: '4px', fontFamily: 'inherit', lineHeight: 1.4, transition: 'all 0.12s',
}
const btnPrimary: React.CSSProperties = { ...btnBase, background: '#1D4ED8', color: '#fff' }
