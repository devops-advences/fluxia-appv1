'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

type Customer = { id: string; name: string }
type DocType  = { id: string; name: string }

const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => THIS_YEAR - i)
const MONTHS_FR = [
  { v: 1, l: 'Janvier' },  { v: 2, l: 'Février' },   { v: 3, l: 'Mars' },
  { v: 4, l: 'Avril' },    { v: 5, l: 'Mai' },        { v: 6, l: 'Juin' },
  { v: 7, l: 'Juillet' },  { v: 8, l: 'Août' },       { v: 9, l: 'Septembre' },
  { v: 10, l: 'Octobre' }, { v: 11, l: 'Novembre' },  { v: 12, l: 'Décembre' },
]

const ALLOWED_EXTS = ['.pdf','.jpg','.jpeg','.png','.webp','.tiff','.tif','.heic','.heif','.xlsx','.xls','.csv','.docx','.doc']
const MAX_SIZE = 20 * 1024 * 1024

export function UploadCabModal({ customers, onClose, onUploaded }: {
  customers:  Customer[]
  onClose:    () => void
  onUploaded: () => void
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '')
  const [typeId,     setTypeId]     = useState('')
  const [year,       setYear]       = useState(THIS_YEAR)
  const [month,      setMonth]      = useState<number | ''>('')
  const [file,       setFile]       = useState<File | null>(null)
  const [types,      setTypes]      = useState<DocType[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('document_type')
      .select('id, name')
      .eq('customer', true)
      .eq('active', true)
      .order('rank')
      .then(({ data }) => setTypes(data ?? []))
  }, [])

  const validateFile = (f: File) => {
    const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) { setError(`Format non supporté : ${f.name}`); return false }
    if (f.size > MAX_SIZE)            { setError('Fichier trop volumineux (max 20 Mo)');  return false }
    if (f.size === 0)                 { setError('Fichier vide');                         return false }
    return true
  }

  const handleFile = (f: File) => {
    if (!validateFile(f)) return
    setError(null)
    setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleSubmit = async () => {
    if (!customerId || !typeId || !file) { setError('Tous les champs obligatoires'); return }
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expirée'); setLoading(false); return }

    const fd = new FormData()
    fd.append('customerId', customerId)
    fd.append('typeId',     typeId)
    fd.append('year',       String(year))
    if (month) fd.append('month', String(month))
    fd.append('file', file)

    const res = await fetch('/api/firm/documents/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
      body: fd,
    })

    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setError(data.error ?? 'Erreur lors du dépôt')
      setLoading(false)
      return
    }

    onUploaded()
  }

  const fieldCls = 'w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]'
  const canSubmit = !!customerId && !!typeId && !!file && !loading

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>Uploader un document client</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', display: 'block', marginBottom: '4px' }}>Client *</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} className={fieldCls}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', display: 'block', marginBottom: '4px' }}>Type de document *</label>
            <select value={typeId} onChange={e => setTypeId(e.target.value)} className={fieldCls}>
              <option value="">Sélectionner…</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', display: 'block', marginBottom: '4px' }}>Année *</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className={fieldCls}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', display: 'block', marginBottom: '4px' }}>Mois</label>
              <select value={month} onChange={e => setMonth(e.target.value ? Number(e.target.value) : '')} className={fieldCls}>
                <option value="">—</option>
                {MONTHS_FR.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', display: 'block', marginBottom: '4px' }}>Fichier *</label>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${file ? '#1D4ED8' : '#E2E8F0'}`,
                borderRadius: '8px', padding: '20px', textAlign: 'center',
                cursor: 'pointer', background: file ? '#EFF6FF' : '#F8FAFC',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              {file ? (
                <div style={{ fontSize: '13px', color: '#1D4ED8', fontWeight: 500 }}>{file.name}</div>
              ) : (
                <>
                  <Upload size={18} style={{ color: '#94A3B8', margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Glisser-déposer ou <span style={{ color: '#1D4ED8', fontWeight: 500 }}>parcourir</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>PDF, image, Excel, Word — 20 Mo max</div>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          </div>

          {error && (
            <div style={{ fontSize: '12px', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '8px 10px' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#64748B' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: '#1D4ED8', color: '#fff', fontFamily: 'inherit', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.6 }}
          >
            {loading ? 'Dépôt en cours…' : 'Déposer'}
          </button>
        </div>

      </div>
    </div>
  )
}
