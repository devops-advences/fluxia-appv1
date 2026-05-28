'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, LayoutGrid, List, Pencil, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const STATUS_CFG = {
  pending:   { label: 'En attente',  bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  processed: { label: 'Traité',      bg: '#f0fdf4', text: '#166534', border: '#86efac' },
  rejected:  { label: 'Rejeté',      bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
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
  customer: { id: string; name: string } | null
}

type CustomerFilter = { id: string; name: string }

export default function DocumentsPage() {
  const router = useRouter()
  const [firmId, setFirmId]           = useState<string | null>(null)
  const [docs, setDocs]               = useState<DocRow[]>([])
  const [customers, setCustomers]     = useState<CustomerFilter[]>([])
  const [custFilter, setCustFilter]   = useState<string>('all')
  const [view, setView]               = useState<'kanban' | 'list'>('kanban')
  const [loading, setLoading]         = useState(true)
  const [editNote, setEditNote]       = useState<{ id: string; value: string } | null>(null)
  const [saving, setSaving]           = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: ud } = await supabase
        .from('user_data').select('firm_id').eq('id', session.user.id).single()
      if (!ud?.firm_id) { setLoading(false); return }
      setFirmId(ud.firm_id)

      const [docsRes, custsRes] = await Promise.all([
        supabase.from('document')
          .select('id, filename, storage_path, year, months, status, notes, created_at, type:type_id(name), customer:customer_id(id, name)')
          .eq('firm_id', ud.firm_id)
          .in('status', ['pending', 'processed', 'rejected'])
          .order('created_at', { ascending: false }),
        supabase.from('customer')
          .select('id, name')
          .eq('firm_id', ud.firm_id)
          .eq('active', true)
          .order('name'),
      ])

      setDocs((docsRes.data ?? []) as unknown as DocRow[])
      setCustomers((custsRes.data ?? []) as CustomerFilter[])
      setLoading(false)
    }
    load()
  }, [router])

  const filtered = custFilter === 'all'
    ? docs
    : docs.filter(d => d.customer?.id === custFilter)

  const byStatus = (s: Status) => filtered.filter(d => d.status === s)

  const callApi = useCallback(async (id: string, body: Record<string, string | null>) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/firm/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  }, [])

  const handleStatusChange = useCallback(async (id: string, newStatus: Status) => {
    setSaving(id)
    const ok = await callApi(id, { status: newStatus })
    if (ok) setDocs(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d))
    setSaving(null)
  }, [callApi])

  const handleSaveNote = useCallback(async () => {
    if (!editNote) return
    setSaving(editNote.id)
    const ok = await callApi(editNote.id, { notes: editNote.value || null })
    if (ok) {
      setDocs(prev => prev.map(d => d.id === editNote.id ? { ...d, notes: editNote.value || null } : d))
      setEditNote(null)
    }
    setSaving(null)
  }, [editNote, callApi])

  const handleDownload = useCallback(async (doc: DocRow) => {
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
  }, [downloading])

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Documents</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={custFilter}
            onChange={e => setCustFilter(e.target.value)}
            className="text-sm border border-[#E2E8F0] rounded-lg px-3 py-1.5 bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
          >
            <option value="all">Tous les clients</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-[#1D4ED8] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
              <LayoutGrid size={13} /> Kanban
            </button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-[#1D4ED8] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
              <List size={13} /> Liste
            </button>
          </div>
        </div>
      </div>

      {/* Note modal */}
      {editNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '12px' }}>Modifier la note</div>
            <textarea
              value={editNote.value}
              onChange={e => setEditNote(prev => prev ? { ...prev, value: e.target.value } : null)}
              rows={4}
              placeholder="Ajouter une note interne…"
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: '#0F172A', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditNote(null)} style={{ padding: '7px 16px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={handleSaveNote} disabled={saving === editNote.id} style={{ padding: '7px 16px', border: 'none', borderRadius: '6px', fontSize: '13px', background: '#1D4ED8', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: saving === editNote.id ? 0.6 : 1 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {view === 'kanban' ? (
        <KanbanView
          columns={[
            { key: 'pending',   label: 'En attente',  docs: byStatus('pending') },
            { key: 'processed', label: 'Traité',       docs: byStatus('processed') },
            { key: 'rejected',  label: 'Rejeté',       docs: byStatus('rejected') },
          ]}
          saving={saving}
          downloading={downloading}
          onStatusChange={handleStatusChange}
          onEditNote={d => setEditNote({ id: d.id, value: d.notes ?? '' })}
          onDownload={handleDownload}
        />
      ) : (
        <ListView
          docs={filtered}
          saving={saving}
          downloading={downloading}
          onStatusChange={handleStatusChange}
          onEditNote={d => setEditNote({ id: d.id, value: d.notes ?? '' })}
          onDownload={handleDownload}
        />
      )}
    </div>
  )
}

/* ─── Kanban ─────────────────────────────────────────────────── */

type ColDef = { key: Status; label: string; docs: DocRow[] }

function KanbanView({ columns, saving, downloading, onStatusChange, onEditNote, onDownload }: {
  columns: ColDef[]
  saving: string | null
  downloading: string | null
  onStatusChange: (id: string, s: Status) => void
  onEditNote: (d: DocRow) => void
  onDownload: (d: DocRow) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'start' }}>
      {columns.map(col => {
        const cfg = STATUS_CFG[col.key]
        return (
          <div key={col.key} style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
              <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>{col.docs.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {col.docs.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#CBD5E1' }}>Aucun document</div>
              )}
              {col.docs.map(d => (
                <DocCard key={d.id} doc={d} showActions saving={saving} downloading={downloading}
                  onStatusChange={onStatusChange} onEditNote={onEditNote} onDownload={onDownload} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── List ───────────────────────────────────────────────────── */

function ListView({ docs, saving, downloading, onStatusChange, onEditNote, onDownload }: {
  docs: DocRow[]
  saving: string | null
  downloading: string | null
  onStatusChange: (id: string, s: Status) => void
  onEditNote: (d: DocRow) => void
  onDownload: (d: DocRow) => void
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
            {['Client','Type','Fichier','Période','Statut','Date','Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-[#94A3B8]">Aucun document</td></tr>
          )}
          {docs.map(d => {
            const cfg = STATUS_CFG[d.status]
            return (
              <tr key={d.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                <td className="px-4 py-3 text-xs font-medium text-[#0F172A] max-w-[120px] truncate">{d.customer?.name ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#64748B] max-w-[120px] truncate">{d.type?.name ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#64748B] max-w-[160px] truncate" title={d.filename ?? undefined}>{d.filename ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatPeriod(d.year, d.months)}</td>
                <td className="px-4 py-3">
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                </td>
                <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3">
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {d.status === 'pending' && (
                      <>
                        <ActionBtn label="Traité" color="#059669" loading={saving === d.id} onClick={() => onStatusChange(d.id, 'processed')}>
                          <Check size={11} strokeWidth={2.5} />
                        </ActionBtn>
                        <ActionBtn label="Rejeté" color="#DC2626" loading={saving === d.id} onClick={() => onStatusChange(d.id, 'rejected')}>
                          <X size={11} strokeWidth={2.5} />
                        </ActionBtn>
                      </>
                    )}
                    <ActionBtn label={d.notes ? 'Modifier note' : 'Ajouter note'} color="#64748B" onClick={() => onEditNote(d)}>
                      <Pencil size={11} strokeWidth={2} />
                    </ActionBtn>
                    {d.storage_path && (
                      <ActionBtn label="Télécharger" color="#1D4ED8" loading={downloading === d.id} onClick={() => onDownload(d)}>
                        <Download size={11} strokeWidth={2} />
                      </ActionBtn>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── DocCard ─────────────────────────────────────────────────── */

function DocCard({ doc: d, saving, downloading, onStatusChange, onEditNote, onDownload }: {
  doc: DocRow
  showActions: boolean
  saving: string | null
  downloading: string | null
  onStatusChange: (id: string, s: Status) => void
  onEditNote: (d: DocRow) => void
  onDownload: (d: DocRow) => void
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '2px' }}>{d.customer?.name ?? '—'}</div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.filename ?? undefined}>
            {d.filename ?? '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            {d.type?.name ?? 'Non qualifié'} · {formatPeriod(d.year, d.months)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          {d.storage_path && (
            <ActionBtn label="Télécharger" color="#1D4ED8" loading={downloading === d.id} onClick={() => onDownload(d)}>
              <Download size={11} strokeWidth={2} />
            </ActionBtn>
          )}
          <ActionBtn label={d.notes ? 'Modifier note' : 'Ajouter note'} color="#64748B" onClick={() => onEditNote(d)}>
            <Pencil size={11} strokeWidth={2} />
          </ActionBtn>
        </div>
      </div>

      {d.notes && (
        <div style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', borderRadius: '4px', padding: '6px 8px', borderLeft: '2px solid #E2E8F0' }}>
          {d.notes}
        </div>
      )}

      <div style={{ fontSize: '10px', color: '#CBD5E1' }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</div>

      {d.status === 'pending' && (
        <div style={{ display: 'flex', gap: '6px', paddingTop: '4px', borderTop: '1px solid #F1F5F9' }}>
          <button
            disabled={saving === d.id}
            onClick={() => onStatusChange(d.id, 'processed')}
            style={{ flex: 1, padding: '5px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: '#166534', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: saving === d.id ? 0.5 : 1 }}>
            <Check size={11} strokeWidth={2.5} /> Traité
          </button>
          <button
            disabled={saving === d.id}
            onClick={() => onStatusChange(d.id, 'rejected')}
            style={{ flex: 1, padding: '5px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: '#991b1b', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: saving === d.id ? 0.5 : 1 }}>
            <X size={11} strokeWidth={2.5} /> Rejeté
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── ActionBtn ──────────────────────────────────────────────── */

function ActionBtn({ label, color, loading, onClick, children }: {
  label: string; color: string; loading?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      title={label}
      disabled={loading}
      onClick={onClick}
      style={{
        width: '24px', height: '24px', border: '1px solid #E2E8F0', borderRadius: '5px',
        background: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, opacity: loading ? 0.4 : 1, transition: 'opacity 0.1s',
      }}
    >
      {children}
    </button>
  )
}
