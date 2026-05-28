'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, LayoutGrid, List, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const STATUS_CFG = {
  draft:     { label: 'Non qualifié', bg: '#f3f4f6', text: '#6b7280',  border: '#e5e7eb' },
  pending:   { label: 'En attente',   bg: '#fffbeb', text: '#92400e',  border: '#fde68a' },
  processed: { label: 'Traité',       bg: '#f0fdf4', text: '#166534',  border: '#86efac' },
  rejected:  { label: 'Rejeté',       bg: '#fef2f2', text: '#991b1b',  border: '#fca5a5' },
} as const
type Status = keyof typeof STATUS_CFG

const MONTHS_FR = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function formatPeriod(year: number, months: number[] | null): string {
  if (!months || months.length === 0) return String(year)
  if (months.length === 1) return `${MONTHS_FR[months[0]]} ${year}`
  return `${MONTHS_FR[months[0]]}–${MONTHS_FR[months[months.length - 1]]} ${year}`
}

type DocRow = {
  id: string
  filename: string | null
  storage_path: string | null
  year: number
  months: number[] | null
  status: Status
  notes: string | null
  created_at: string
  type: { name: string } | null
}

export default function MesDocumentsPage() {
  const router = useRouter()
  const [docs, setDocs]               = useState<DocRow[]>([])
  const [view, setView]               = useState<'kanban' | 'list'>('kanban')
  const [loading, setLoading]         = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) { router.push('/login'); return }

      const { data: uc } = await supabase
        .from('user_customer').select('customer_id').eq('user_id', session.user.id).limit(1).single()
      if (!active) return
      if (!uc?.customer_id) { setLoading(false); return }

      const { data } = await supabase
        .from('document')
        .select('id, filename, storage_path, year, months, status, notes, created_at, type:type_id(name)')
        .eq('customer_id', uc.customer_id)
        .order('created_at', { ascending: false })
      if (!active) return
      setDocs((data ?? []) as unknown as DocRow[])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [router])

  const byStatus = (s: Status) => docs.filter(d => d.status === s)

  const handleDownload = async (doc: DocRow) => {
    if (!doc.storage_path || downloading) return
    setDownloading(doc.id)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/documents/${doc.id}/download`, {
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
    })
    if (res.ok) {
      const { url } = await res.json() as { url: string }
      window.open(url, '_blank')
    }
    setDownloading(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Mes documents</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{docs.length} document{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-[#1D4ED8] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
              <LayoutGrid size={13} /> Kanban
            </button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-[#1D4ED8] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
              <List size={13} /> Liste
            </button>
          </div>
          <button
            onClick={() => router.push('/mes-documents/nouveau')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1D4ED8] text-white text-xs font-medium rounded-lg hover:bg-[#1e40af] transition-colors"
          >
            <Plus size={13} /> Nouveau
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', alignItems: 'start' }}>
          {(['draft', 'pending', 'processed', 'rejected'] as Status[]).map(status => {
            const cfg  = STATUS_CFG[status]
            const cols = byStatus(status)
            return (
              <div key={status} style={{ background: '#F8FAFC', borderRadius: '10px', padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>{cols.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {cols.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: '#CBD5E1' }}>—</div>
                  )}
                  {cols.map(d => (
                    <ClientDocCard key={d.id} doc={d} downloading={downloading} onDownload={handleDownload} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Type','Fichier','Période','Statut','Date',''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#94A3B8]">Aucun document déposé</td></tr>
              )}
              {docs.map(d => {
                const cfg = STATUS_CFG[d.status]
                return (
                  <tr key={d.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#64748B] max-w-[120px] truncate">{d.type?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-medium text-[#0F172A] max-w-[180px] truncate" title={d.filename ?? undefined}>{d.filename ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatPeriod(d.year, d.months)}</td>
                    <td className="px-4 py-3">
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      {d.storage_path && (
                        <button
                          title="Télécharger"
                          disabled={downloading === d.id}
                          onClick={() => handleDownload(d)}
                          style={{ width: '24px', height: '24px', border: '1px solid #E2E8F0', borderRadius: '5px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D4ED8', opacity: downloading === d.id ? 0.4 : 1 }}
                        >
                          <Download size={11} strokeWidth={2} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ClientDocCard({ doc: d, downloading, onDownload }: {
  doc: DocRow
  downloading: string | null
  onDownload: (d: DocRow) => void
}) {
  const cfg = STATUS_CFG[d.status]
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.filename ?? undefined}>
            {d.filename ?? '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            {d.type?.name ?? '—'} · {formatPeriod(d.year, d.months)}
          </div>
        </div>
        {d.storage_path && (
          <button
            title="Télécharger"
            disabled={downloading === d.id}
            onClick={() => onDownload(d)}
            style={{ width: '22px', height: '22px', flexShrink: 0, border: '1px solid #E2E8F0', borderRadius: '4px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D4ED8', opacity: downloading === d.id ? 0.4 : 1 }}
          >
            <Download size={10} strokeWidth={2} />
          </button>
        )}
      </div>
      {d.notes && (
        <div style={{ fontSize: '10px', color: '#64748B', background: '#F8FAFC', borderRadius: '3px', padding: '4px 6px', borderLeft: '2px solid #E2E8F0' }}>
          {d.notes}
        </div>
      )}
      {d.status === 'rejected' && (
        <button
          onClick={() => window.location.href = '/mes-documents/nouveau'}
          style={{ width: '100%', padding: '5px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: '#991b1b', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Redéposer →
        </button>
      )}
      <div style={{ fontSize: '10px', color: '#CBD5E1' }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</div>
    </div>
  )
}
