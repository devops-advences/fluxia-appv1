'use client'

import { Loader2 } from 'lucide-react'
import { type LoadedFile, type CabQualification, type CabSource, MONTHS, DOC_COLORS, FILE_KIND_META, qualKey, getAllDocs } from './types'

type Props = {
  source:       CabSource
  customerName: string
  files:        LoadedFile[]
  cuts:         Set<number>[]
  quals:        Record<string, CabQualification>
  submitting:   boolean
  submitError:  string | null
  onEdit:       (fi: number, di: number) => void
  onSubmit:     () => void
}

export default function Step3Confirm({ source, customerName, files, cuts, quals, submitting, submitError, onEdit, onSubmit }: Props) {
  const entries: { fi: number; di: number; name: string; q: CabQualification; range?: string }[] =
    getAllDocs(files, cuts).map(doc => {
      const q    = quals[qualKey(doc.fi, doc.di)] ?? { typeId: '', typeName: '', year: '', month: '', note: '' }
      const file = files[doc.fi]
      const range = file.fileKind !== 'pdf'
        ? FILE_KIND_META[file.fileKind].label
        : (doc.start === doc.end ? `p.${doc.start}` : `p.${doc.start}–${doc.end}`)
      return { fi: doc.fi, di: doc.di, name: doc.name, q, range }
    })

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>

      {/* Client badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Client</div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{customerName}</div>
      </div>

      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
        {entries.length} {source === 'firm' ? 'livrable' : 'document'}{entries.length > 1 ? 's' : ''} prêt{entries.length > 1 ? 's' : ''} à déposer
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {entries.map(({ fi, di, name, q, range }, i) => {
          const color  = DOC_COLORS[i % DOC_COLORS.length]
          const period = q.month ? `${MONTHS[q.month]} ${q.year}` : (q.year || '—')
          return (
            <div key={`${fi}-${di}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <span style={{ padding: '3px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', background: color.bg, color: color.text, flexShrink: 0 }}>
                {q.typeName || '—'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{period}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}{range ? ` · ${range}` : ''}{q.note ? ` · ${q.note}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => onEdit(fi, di)}
                style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '5px', fontSize: '11px', fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
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
        <button type="button" onClick={onSubmit} disabled={submitting}
          style={{
            width: '100%', padding: '14px', border: 'none', borderRadius: '8px',
            background: submitting ? '#d1d5db' : '#1D4ED8', color: '#fff',
            fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
            cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
          {submitting
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Dépôt en cours…</>
            : `✓ Déposer pour ${customerName}`
          }
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
