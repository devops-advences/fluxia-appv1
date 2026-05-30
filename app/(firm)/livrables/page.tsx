'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Clock, Check, Download, Eye, LayoutGrid, List, Pencil, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import ClientAutosuggest from '@/components/shared/ClientAutosuggest'

const STATUS_CFG = {
  pending:   { label: 'En attente',  bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  processed: { label: 'Traité',      bg: '#f0fdf4', text: '#166534', border: '#86efac' },
  rejected:  { label: 'Rejeté',      bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
} as const
type Status = keyof typeof STATUS_CFG
type StatusFilter = Status | 'all' | 'unprocessed'

const MONTHS_FR = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function formatPeriod(year: number, months: number[] | null): string {
  if (!months || months.length === 0) return String(year)
  if (months.length === 1) return `${MONTHS_FR[months[0]]} ${year}`
  return `${MONTHS_FR[months[0]]}–${MONTHS_FR[months[months.length - 1]]} ${year}`
}

function formatSize(kb: number | null): string {
  if (!kb) return ''
  return kb < 1024 ? `${kb} Ko` : `${(kb / 1024).toFixed(1)} Mo`
}

function SizeCell({ kb }: { kb: number | null }) {
  if (!kb) return <span className="text-xs text-[#94A3B8]">—</span>
  const label = formatSize(kb)
  if (kb > 10 * 1024) return <span style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626' }}>{label}</span>
  if (kb > 5 * 1024)  return <span style={{ fontSize: '11px', fontWeight: 600, color: '#D97706' }}>{label}</span>
  return <span className="text-xs text-[#94A3B8]">{label}</span>
}

function formatExt(filename: string | null): string {
  if (!filename) return ''
  return (filename.split('.').pop() ?? '').toUpperCase()
}

const EXT_COLORS: Record<string, { bg: string; text: string }> = {
  PDF:  { bg: '#FEF2F2', text: '#991B1B' },
  CSV:  { bg: '#F0FDF4', text: '#166534' },
  XLSX: { bg: '#F0FDF4', text: '#166534' },
  XLS:  { bg: '#F0FDF4', text: '#166534' },
  DOCX: { bg: '#EFF6FF', text: '#1D4ED8' },
  DOC:  { bg: '#EFF6FF', text: '#1D4ED8' },
  JPG:  { bg: '#F5F3FF', text: '#5B21B6' },
  JPEG: { bg: '#F5F3FF', text: '#5B21B6' },
  PNG:  { bg: '#F5F3FF', text: '#5B21B6' },
  WEBP: { bg: '#F5F3FF', text: '#5B21B6' },
  GIF:  { bg: '#F5F3FF', text: '#5B21B6' },
}

function ExtBadge({ filename }: { filename: string | null }) {
  const ext = formatExt(filename)
  if (!ext) return null
  const c = EXT_COLORS[ext] ?? { bg: '#F8FAFC', text: '#64748B' }
  return (
    <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: c.bg, color: c.text, letterSpacing: '0.02em' }}>
      {ext}
    </span>
  )
}

type CustomerFilter = { id: string; name: string }
type DocTypeOpt     = { id: string; name: string }

type DocRow = {
  id: string
  filename: string | null
  storage_path: string | null
  year: number
  months: number[] | null
  status: Status
  notes: string | null
  size_kb: number | null
  mime_type: string | null
  created_at: string
  type: { id: string; name: string; customer: boolean } | null
  customer: { id: string; name: string } | null
}

type EventRow = {
  id: string
  event_type: string
  old_status: string | null
  new_status: string | null
  comment: string | null
  created_at: string
  user: { first_name: string; last_name: string } | null
}

const EVENT_LABELS: Record<string, string> = {
  uploaded:       'Déposé',
  status_changed: 'Statut modifié',
  downloaded:     'Téléchargé',
  viewed:         'Consulté',
}

const SEL = "text-sm border border-[#E2E8F0] rounded-lg px-3 py-1.5 bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"

export default function LivrablesPage() {
  const router      = useRouter()
  const currentYear = new Date().getFullYear()

  const [firmId, setFirmId]           = useState<string | null>(null)
  const [customers, setCustomers]     = useState<CustomerFilter[]>([])
  const [docTypes, setDocTypes]       = useState<DocTypeOpt[]>([])
  const [typeIds, setTypeIds]         = useState<string[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear])
  const [savedDoc, setSavedDoc]       = useState<string | null>(null)

  const [draftYear, setDraftYear]   = useState(currentYear)
  const [draftCust, setDraftCust]   = useState('all')
  const [yearFilter, setYearFilter] = useState(currentYear)
  const [custFilter, setCustFilter] = useState('all')
  const [pageSize, setPageSize] = useState<10 | 20>(20)
  const [page, setPage]         = useState(0)
  const [total, setTotal]       = useState(0)

  const [docs, setDocs]               = useState<DocRow[]>([])
  const [initLoading, setInitLoading] = useState(true)
  const [docsLoading, setDocsLoading] = useState(false)

  const [editQual, setEditQual] = useState<{ id: string; typeId: string; year: number; month: string } | null>(null)
  const [previewDoc, setPreviewDoc]   = useState<{ url: string; filename: string | null; mime: string | null } | null>(null)
  const [editNote, setEditNote]       = useState<{ id: string; value: string } | null>(null)
  const [saving, setSaving]           = useState<string | null>(null)
  const [acting, setActing]           = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DocRow | null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [eventsDoc, setEventsDoc]     = useState<DocRow | null>(null)
  const [events, setEvents]           = useState<EventRow[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: ud } = await supabase
        .from('user_data').select('firm_id').eq('id', session.user.id).single()
      if (!ud?.firm_id) { setInitLoading(false); return }

      const { data: firm } = await supabase
        .from('firm').select('id, country_code').eq('id', ud.firm_id).single()
      if (!firm) { setInitLoading(false); return }

      const [custsRes, typesRes, yearsRes] = await Promise.all([
        supabase.from('customer').select('id, name').eq('firm_id', firm.id).eq('active', true).order('name'),
        supabase.from('document_type').select('id, name').eq('country_code', firm.country_code).eq('customer', false).eq('active', true).order('rank'),
        supabase.from('document').select('year').eq('firm_id', firm.id),
      ])

      const types = (typesRes.data ?? []) as DocTypeOpt[]
      setDocTypes(types)
      setTypeIds(types.map(t => t.id))
      setCustomers((custsRes.data ?? []) as CustomerFilter[])

      const rawYears = (yearsRes.data ?? []).map(r => (r as { year: number }).year)
      const uniqueYears = [...new Set(rawYears)].sort((a, b) => b - a)
      setAvailableYears(uniqueYears.length > 0 ? uniqueYears : [currentYear])

      setFirmId(firm.id)
      setInitLoading(false)
    }
    init()
  }, [router, currentYear])

  const loadDocs = useCallback(async (opts: {
    firmId: string; year: number
    cust: string; page: number; pageSize: number; typeIds: string[]
  }) => {
    setDocsLoading(true)

    if (opts.typeIds.length === 0) {
      setDocs([]); setTotal(0); setDocsLoading(false); return
    }

    let q = supabase.from('document')
      .select('id, filename, storage_path, year, months, status, notes, size_kb, mime_type, created_at, type:type_id(id, name, customer), customer:customer_id(id, name)', { count: 'exact' })
      .eq('firm_id', opts.firmId)
      .eq('year', opts.year)
      .in('type_id', opts.typeIds)

    if (opts.cust !== 'all') q = q.eq('customer_id', opts.cust)

    q = q.order('created_at', { ascending: false })
    q = q.range(opts.page * opts.pageSize, (opts.page + 1) * opts.pageSize - 1)

    const { data, count } = await q
    setDocs((data ?? []) as unknown as DocRow[])
    setTotal(count ?? 0)
    setDocsLoading(false)
  }, [])

  const handleSearch = useCallback(() => {
    setYearFilter(draftYear)
    setCustFilter(draftCust)
    setPage(0)
  }, [draftYear, draftCust])

  useEffect(() => {
    if (!firmId || typeIds.length === 0) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadDocs({ firmId, year: yearFilter, cust: custFilter, page, pageSize, typeIds })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [firmId, typeIds, yearFilter, custFilter, page, pageSize, loadDocs])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const callApi = useCallback(async (id: string, body: Record<string, string | null>) => {
    const token = await getToken()
    const res = await fetch(`/api/firm/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  const handleView = useCallback(async (doc: DocRow) => {
    if (!doc.storage_path || acting) return
    setActing(doc.id)
    const token = await getToken()
    const res = await fetch(`/api/documents/${doc.id}/download`, { headers: { 'Authorization': `Bearer ${token}` } })
    if (res.ok) {
      const { url } = await res.json() as { url: string }
      setPreviewDoc({ url, filename: doc.filename, mime: doc.mime_type })
    }
    setActing(null)
  }, [acting])

  const handleDownload = useCallback(async (doc: DocRow) => {
    if (!doc.storage_path || acting) return
    setActing(doc.id)
    const token = await getToken()
    const res = await fetch(`/api/documents/${doc.id}/download`, { headers: { 'Authorization': `Bearer ${token}` } })
    if (res.ok) {
      const { url } = await res.json() as { url: string }
      const a = document.createElement('a')
      a.href = url; a.download = doc.filename ?? 'document'; a.click()
    }
    setActing(null)
  }, [acting])

  const handleOpenEvents = useCallback(async (doc: DocRow) => {
    setEventsDoc(doc); setEventsLoading(true); setEvents([])
    const { data } = await supabase
      .from('document_event')
      .select('id, event_type, old_status, new_status, comment, created_at, user:user_id(first_name, last_name)')
      .eq('document_id', doc.id)
      .order('created_at', { ascending: false })
    setEvents((data ?? []) as unknown as EventRow[])
    setEventsLoading(false)
  }, [])

  const handleSaveQual = useCallback(async (id: string, typeId: string, year: number, month: string) => {
    setSaving(id)
    const token = await getToken()
    const months = month ? [parseInt(month)] : null
    const typeName = docTypes.find(t => t.id === typeId)?.name ?? null
    const res = await fetch(`/api/firm/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type_id: typeId || null, year, months }),
    })
    if (res.ok) {
      setDocs(prev => prev.map(d => d.id === id
        ? { ...d, type: typeId ? { id: typeId, name: typeName ?? '', customer: false } : null, year, months }
        : d
      ))
      setSavedDoc(id)
      setTimeout(() => setSavedDoc(null), 1500)
    }
    setSaving(null)
  }, [docTypes])

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch(`/api/firm/documents/${deleteConfirm.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.ok) {
      setDocs(prev => prev.filter(d => d.id !== deleteConfirm.id))
      setTotal(prev => prev - 1)
      setDeleteConfirm(null)
    }
    setDeleting(false)
  }, [deleteConfirm])

  if (initLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totalPages = Math.ceil(total / pageSize)
  const from       = total === 0 ? 0 : page * pageSize + 1
  const to         = Math.min((page + 1) * pageSize, total)
  const handlers   = {
    saving, acting,
    onStatusChange: handleStatusChange,
    onEditNote: (d: DocRow) => setEditNote({ id: d.id, value: d.notes ?? '' }),
    onView: handleView, onDownload: handleDownload, onEvents: handleOpenEvents,
    editQual, setEditQual, onSaveQual: handleSaveQual, docTypes, savedDoc,
    onDelete: (d: DocRow) => setDeleteConfirm(d),
  }

  return (
    <div className="max-w-7xl">

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Livrables</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} livrable{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <select value={draftYear} onChange={e => setDraftYear(Number(e.target.value))} className={SEL}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <ClientAutosuggest options={customers} value={draftCust} onChange={setDraftCust} />
        <button onClick={handleSearch}
          className="px-4 py-1.5 text-sm font-medium bg-[#1D4ED8] text-white rounded-lg hover:bg-[#1e40af] transition-colors flex items-center gap-1.5">
          <Search size={13} /> Rechercher
        </button>
      </div>

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>Supprimer ce livrable ?</div>
            <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deleteConfirm.filename ?? '—'}</div>
            <div style={{ fontSize: '12px', color: '#DC2626', marginBottom: '24px' }}>Cette action est définitive.</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                style={{ padding: '8px 18px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding: '8px 18px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#DC2626', color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewDoc && (
        <PreviewModal url={previewDoc.url} filename={previewDoc.filename} mime={previewDoc.mime} onClose={() => setPreviewDoc(null)} />
      )}

      {editNote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', marginBottom: '12px' }}>Note interne</div>
            <textarea value={editNote.value} onChange={e => setEditNote(prev => prev ? { ...prev, value: e.target.value } : null)}
              rows={4} placeholder="Ajouter une note interne…"
              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: '#0F172A', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditNote(null)} style={{ padding: '7px 16px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={handleSaveNote} disabled={saving === editNote.id} style={{ padding: '7px 16px', border: 'none', borderRadius: '6px', fontSize: '13px', background: '#1D4ED8', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: saving === editNote.id ? 0.6 : 1 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {eventsDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '360px', background: '#fff', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Historique</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eventsDoc.filename ?? '—'}</div>
              </div>
              <button onClick={() => setEventsDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px', flexShrink: 0 }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {eventsLoading && <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '12px' }}>Chargement…</div>}
              {!eventsLoading && events.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: '#CBD5E1', fontSize: '12px' }}>Aucun événement</div>}
              {!eventsLoading && events.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#CBD5E1', marginTop: '5px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                      {EVENT_LABELS[e.event_type] ?? e.event_type}
                      {e.event_type === 'status_changed' && e.new_status && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: '#64748B' }}>→ {STATUS_CFG[e.new_status as Status]?.label ?? e.new_status}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
                      {e.user ? `${e.user.first_name} ${e.user.last_name}` : '—'}{' · '}
                      {new Date(e.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {e.comment && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', fontStyle: 'italic' }}>{e.comment}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {docsLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <ListView docs={docs} {...handlers} />
      )}

      {!docsLoading && (
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-sm text-[#64748B]">
            <span>Afficher</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value) as 10 | 20); setPage(0) }}
              className="text-sm border border-[#E2E8F0] rounded-md px-2 py-1 bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]">
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            <span>par page</span>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-3 text-sm text-[#64748B]">
              <span>{from}–{to} sur {total}</span>
              <div className="flex gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  style={{ width: '28px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: page === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === 0 ? '#CBD5E1' : '#64748B' }}>
                  <ChevronLeft size={14} />
                </button>
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                  style={{ width: '28px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: page >= totalPages - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page >= totalPages - 1 ? '#CBD5E1' : '#64748B' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Types ──────────────────────────────────────────────────── */

type ColDef = { key: Status; label: string; docs: DocRow[] }
type QualState = { id: string; typeId: string; year: number; month: string }
type CardHandlers = {
  saving: string | null
  acting: string | null
  onStatusChange: (id: string, s: Status) => void
  onEditNote: (d: DocRow) => void
  onView: (d: DocRow) => void
  onDownload: (d: DocRow) => void
  onEvents: (d: DocRow) => void
  editQual?: QualState | null
  setEditQual?: (q: QualState | null) => void
  onSaveQual?: (id: string, typeId: string, year: number, month: string) => void
  docTypes?: DocTypeOpt[]
  savedDoc?: string | null
  onDelete?: (d: DocRow) => void
}

/* ─── Kanban ─────────────────────────────────────────────────── */

function KanbanView({ columns, ...handlers }: { columns: ColDef[] } & CardHandlers) {
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
              {col.docs.length === 0 && <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#CBD5E1' }}>Aucun livrable</div>}
              {col.docs.map(d => <DocCard key={d.id} doc={d} {...handlers} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── List ───────────────────────────────────────────────────── */

function ListView({ docs, editQual, setEditQual, onSaveQual, docTypes = [], saving, savedDoc, ...handlers }: { docs: DocRow[] } & CardHandlers) {
  const YEARS = [2026, 2025, 2024, 2023, 2022]
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
      <style>{`.edit-cell-icon { opacity: 0.25; transition: opacity 0.15s; } .edit-cell-btn:hover .edit-cell-icon { opacity: 1; } .edit-cell-btn:hover { background: #F8FAFC !important; }`}</style>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
            {['Client','Type','Fichier','Format','Poids','Période','Date','Actions'].map(h => (
              <th key={h} className="px-3 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 && (
            <tr><td colSpan={8}>
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Aucun livrable</div>
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>Modifiez les critères et relancez la recherche</div>
              </div>
            </td></tr>
          )}
          {docs.map(d => {
            const isEditing = editQual?.id === d.id
            const eq        = editQual
            const openEdit  = () => setEditQual?.({ id: d.id, typeId: d.type?.id ?? '', year: d.year, month: d.months?.[0]?.toString() ?? '' })
            return (
              <tr key={d.id} className={`border-b border-[#F1F5F9] last:border-0 transition-colors ${isEditing ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'}`}>
                <td className="px-3 py-3 text-xs font-medium text-[#0F172A] max-w-[100px] truncate">{d.customer?.name ?? '—'}</td>
                <td className="px-3 py-2 max-w-[150px]">
                  {isEditing && eq ? (
                    <select value={eq.typeId} onChange={e => {
                      const val = e.target.value
                      setEditQual?.({ ...eq, typeId: val })
                      onSaveQual?.(eq.id, val, eq.year, eq.month)
                    }}
                      style={{ fontSize: '12px', border: '1px solid #BFDBFE', borderRadius: '5px', padding: '3px 6px', background: '#fff', outline: 'none', maxWidth: '130px' }}>
                      <option value="">— Aucun —</option>
                      {docTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  ) : (
                    <button onClick={openEdit} className="edit-cell-btn" style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', textAlign: 'left', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {d.type
                        ? <span className="text-xs text-[#64748B]">{d.type.name}</span>
                        : <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>Non qualifié</span>
                      }
                      <Pencil size={10} className="edit-cell-icon" style={{ color: '#CBD5E1', flexShrink: 0 }} />
                    </button>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-[#64748B] max-w-[140px] truncate" title={d.filename ?? undefined}>{d.filename ?? '—'}</td>
                <td className="px-3 py-3"><ExtBadge filename={d.filename} /></td>
                <td className="px-3 py-3 whitespace-nowrap"><SizeCell kb={d.size_kb} /></td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {isEditing && eq ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <select value={eq.year} onChange={e => {
                        const val = Number(e.target.value)
                        setEditQual?.({ ...eq, year: val })
                        onSaveQual?.(eq.id, eq.typeId, val, eq.month)
                      }}
                        style={{ fontSize: '12px', border: '1px solid #BFDBFE', borderRadius: '5px', padding: '3px 4px', background: '#fff', outline: 'none' }}>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select value={eq.month} onChange={e => {
                        const val = e.target.value
                        setEditQual?.({ ...eq, month: val })
                        onSaveQual?.(eq.id, eq.typeId, eq.year, val)
                      }}
                        style={{ fontSize: '12px', border: '1px solid #BFDBFE', borderRadius: '5px', padding: '3px 4px', background: '#fff', outline: 'none' }}>
                        <option value="">Tous</option>
                        {MONTHS_FR.slice(1).map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
                      </select>
                      {savedDoc === d.id && (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', flexShrink: 0 }}>✓</span>
                      )}
                      <button onClick={() => setEditQual?.(null)}
                        style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #E2E8F0', background: '#fff', color: '#94A3B8', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        title="Annuler">✕</button>
                    </div>
                  ) : (
                    <button onClick={openEdit} className="edit-cell-btn" style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '12px', color: '#64748B', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {formatPeriod(d.year, d.months)}
                      <Pencil size={10} className="edit-cell-icon" style={{ color: '#CBD5E1', flexShrink: 0 }} />
                    </button>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-[#94A3B8] whitespace-nowrap">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-3"><RowActions doc={d} saving={saving} {...handlers} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── DocCard ─────────────────────────────────────────────────── */

function DocCard({ doc: d, saving, acting, onStatusChange, onEditNote, onView, onDownload, onEvents }: { doc: DocRow } & CardHandlers) {
  return (
    <div style={{ background: '#fff', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '2px' }}>{d.customer?.name ?? '—'}</div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.filename ?? undefined}>
            {d.filename ?? '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {d.type
              ? <span>{d.type.name}</span>
              : <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>Non qualifié</span>
            }
            <span>·</span>
            <span>{formatPeriod(d.year, d.months)}</span>
            {d.size_kb && <><span>·</span><SizeCell kb={d.size_kb} /></>}
            {formatExt(d.filename) && <><span>·</span><ExtBadge filename={d.filename} /></>}
          </div>
        </div>
        <RowActions doc={d} saving={saving} acting={acting} onStatusChange={onStatusChange} onEditNote={onEditNote} onView={onView} onDownload={onDownload} onEvents={onEvents} />
      </div>
      {d.notes && (
        <div style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', borderRadius: '4px', padding: '6px 8px', borderLeft: '2px solid #E2E8F0' }}>
          {d.notes}
        </div>
      )}
      <div style={{ fontSize: '10px', color: '#CBD5E1' }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</div>
      {d.status === 'pending' && (
        <div style={{ display: 'flex', gap: '6px', paddingTop: '4px', borderTop: '1px solid #F1F5F9' }}>
          <button disabled={saving === d.id} onClick={() => onStatusChange(d.id, 'processed')}
            style={{ flex: 1, padding: '5px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: '#166534', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: saving === d.id ? 0.5 : 1 }}>
            <Check size={11} strokeWidth={2.5} /> Traiter
          </button>
          <button disabled={saving === d.id} onClick={() => onStatusChange(d.id, 'rejected')}
            style={{ flex: 1, padding: '5px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: '#991b1b', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: saving === d.id ? 0.5 : 1 }}>
            <X size={11} strokeWidth={2.5} /> Rejeter
          </button>
        </div>
      )}
      {(d.status === 'processed' || d.status === 'rejected') && (
        <button disabled={saving === d.id} onClick={() => onStatusChange(d.id, 'pending')}
          style={{ width: '100%', padding: '5px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '5px', fontSize: '11px', fontWeight: 500, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', opacity: saving === d.id ? 0.5 : 1 }}>
          <RotateCcw size={10} /> Remettre en attente
        </button>
      )}
    </div>
  )
}

/* ─── RowActions ─────────────────────────────────────────────── */

function RowActions({ doc: d, saving, acting, onStatusChange, onEditNote, onView, onDownload, onEvents, onDelete }: { doc: DocRow } & CardHandlers) {
  const busy = saving === d.id || acting === d.id
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
      {d.storage_path && <ActionBtn title="Visualiser" color="#1D4ED8" loading={busy} onClick={() => onView(d)}><Eye size={11} strokeWidth={2} /></ActionBtn>}
      {d.storage_path && <ActionBtn title="Télécharger" color="#64748B" loading={busy} onClick={() => onDownload(d)}><Download size={11} strokeWidth={2} /></ActionBtn>}
      <ActionBtn title={d.notes ? 'Modifier note' : 'Ajouter note'} color="#94A3B8" onClick={() => onEditNote(d)}><Pencil size={11} strokeWidth={2} /></ActionBtn>
      <ActionBtn title="Historique" color="#94A3B8" onClick={() => onEvents(d)}><Clock size={11} strokeWidth={2} /></ActionBtn>
      {onDelete && (
        <ActionBtn title="Supprimer" color="#DC2626" loading={busy} onClick={() => onDelete(d)}>
          <Trash2 size={11} strokeWidth={2} />
        </ActionBtn>
      )}
    </div>
  )
}

/* ─── ActionBtn ──────────────────────────────────────────────── */

function ActionBtn({ title, color, loading, onClick, children }: {
  title: string; color: string; loading?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button title={title} disabled={loading} onClick={onClick}
      style={{ width: '24px', height: '24px', border: '1px solid #E2E8F0', borderRadius: '5px', background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, opacity: loading ? 0.4 : 1, transition: 'opacity 0.1s' }}>
      {children}
    </button>
  )
}

/* ─── PreviewModal ───────────────────────────────────────────── */

function PreviewModal({ url, filename, mime, onClose }: { url: string; filename: string | null; mime: string | null; onClose: () => void }) {
  const isImage = mime?.startsWith('image/') ?? false
  const isPdf   = mime === 'application/pdf' || filename?.toLowerCase().endsWith('.pdf')
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '12px', width: '90vw', height: '90vh', maxWidth: '1100px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 40px)' }}>{filename ?? 'Document'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px', display: 'flex', flexShrink: 0 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isPdf && <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title={filename ?? 'Document'} />}
          {isImage && <img src={url} alt={filename ?? 'Document'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
          {!isPdf && !isImage && (
            <div style={{ textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: '13px', marginBottom: '12px' }}>Aperçu non disponible pour ce format</div>
              <a href={url} download={filename ?? 'document'} style={{ fontSize: '13px', color: '#1D4ED8', textDecoration: 'underline' }}>Télécharger le fichier</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
