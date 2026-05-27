'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { type LoadedFile, type Qualification, CUSTOMER_DOC_TYPES, MONTHS, DOC_COLORS, FILE_KIND_META, qualKey, getAllDocs } from './types'

type Props = {
  files: LoadedFile[]
  cuts: Set<number>[]
  quals: Record<string, Qualification>
  cabinetName: string
  submitting: boolean
  submitError: string | null
  onEdit: (fi: number, di: number) => void
  onSubmit: () => void
}

export default function Step3Confirm({ files, cuts, quals, cabinetName, submitting, submitError, onEdit, onSubmit }: Props) {
  const allDocs = useMemo(() => getAllDocs(files, cuts), [files, cuts])

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
        {allDocs.length} document{allDocs.length > 1 ? 's' : ''} prêt{allDocs.length > 1 ? 's' : ''} à envoyer
      </div>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a',
        borderRadius: '8px', fontSize: '12px', color: '#92400e', lineHeight: 1.5,
      }}>
        <span>⚠</span>
        <span>
          Ces documents seront transmis à <strong>{cabinetName}</strong>.
          Assurez-vous que les types et périodes sont corrects avant d&apos;envoyer.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {allDocs.map((doc, i) => {
          const q      = quals[qualKey(doc.fi, doc.di)] ?? { type: '', year: '', month: '', note: '' }
          const color  = DOC_COLORS[i % DOC_COLORS.length]
          const file   = files[doc.fi]
          const label  = CUSTOMER_DOC_TYPES.find(t => t.value === q.type)?.label ?? '—'
          const period = q.month ? `${MONTHS[q.month]} ${q.year}` : (q.year || '—')
          const range  = file.fileKind !== 'pdf'
            ? FILE_KIND_META[file.fileKind].label
            : (doc.start === doc.end ? `p.${doc.start}` : `p.${doc.start}–${doc.end}`)

          return (
            <div key={`${doc.fi}-${doc.di}`} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px', background: '#f9fafb',
              border: '1px solid #e5e7eb', borderRadius: '8px',
            }}>
              <span style={{ padding: '3px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', background: color.bg, color: color.text, flexShrink: 0 }}>
                {label}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{period}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  {doc.name} · {range}{q.note ? ` · ${q.note}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onEdit(doc.fi, doc.di)}
                style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '11px', fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Modifier
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ paddingTop: '8px' }}>
        {submitError && (
          <div style={{ marginBottom: '10px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '7px', fontSize: '12px', color: '#dc2626' }}>
            {submitError}
          </div>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          style={{
            width: '100%', padding: '14px', border: 'none', borderRadius: '8px',
            background: submitting ? '#d1d5db' : '#1D4ED8', color: '#fff',
            fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
            cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {submitting
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Envoi en cours…</>
            : `✓ Envoyer à ${cabinetName}`
          }
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
