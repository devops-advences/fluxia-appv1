'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download, Eye, LayoutGrid, List, Mail, MoreHorizontal, Pencil, Search, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useCustomer } from '@/lib/CustomerContext'
import MessagesDrawer from '@/components/shared/MessagesDrawer'
import { formatPeriod, formatExt, EXT_COLORS, MONTHS_FR } from '@/lib/format'

const STATUS_CFG = {
  draft:     { label: 'Non qualifié', bg: '#f3f4f6', text: '#6b7280',  border: '#e5e7eb' },
  pending:   { label: 'En attente',   bg: '#fffbeb', text: '#92400e',  border: '#fde68a' },
  processed: { label: 'Traité',       bg: '#f0fdf4', text: '#166534',  border: '#86efac' },
  rejected:  { label: 'Rejeté',       bg: '#fef2f2', text: '#991b1b',  border: '#fca5a5' },
} as const
type Status = keyof typeof STATUS_CFG
type StatusFilter = Status | 'all' | 'unprocessed'

function SizeCell({ kb }: { kb: number | null }) {
  if (!kb) return <span className="text-xs text-[#94A3B8]">—</span>
  const label = kb < 1024 ? `${kb} Ko` : `${(kb / 1024).toFixed(1)} Mo`
  if (kb > 10 * 1024) return <span style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626' }}>{label}</span>
  if (kb > 5 * 1024)  return <span style={{ fontSize: '11px', fontWeight: 600, color: '#D97706' }}>{label}</span>
  return <span className="text-xs text-[#94A3B8]">{label}</span>
}

function ExtBadge({ filename }: { filename: string | null }) {
  const ext = formatExt(filename)
  if (!ext) return null
  const c = EXT_COLORS[ext] ?? { bg: '#F8FAFC', text: '#64748B' }
  return <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: c.bg, color: c.text }}>{ext}</span>
}

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
}

type DocTypeOpt = { id: string; name: string }

const SEL = "text-sm border border-[#E2E8F0] rounded-lg px-3 py-1.5 bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"

function DocActionMenu({ doc, busy, onView, onDownload, onMessages, onDelete }: {
  doc: DocRow
  busy: boolean
  onView: () => void
  onDownload: () => void
  onMessages: () => void
  onDelete?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      const target = e.target as Node
      const menu = document.getElementById('doc-action-menu')
      if (menu && !menu.contains(target) && !btnRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }

  function run(fn: () => void) { setOpen(false); fn() }

  return (
    <div ref={btnRef} style={{ display: 'inline-flex' }}>
      <ActionBtn title="Actions" color="#64748B" loading={busy} onClick={handleOpen}>
        <MoreHorizontal size={13} strokeWidth={2} />
      </ActionBtn>
      {open && pos && (
        <div
          id="doc-action-menu"
          style={{
            position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999,
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.10)', minWidth: '190px', overflow: 'hidden',
          }}
        >
          {doc.storage_path && (
            <MenuItemRow icon={<Eye size={14} />} label="Visualiser" onClick={() => run(onView)} />
          )}
          {doc.storage_path && (
            <MenuItemRow icon={<Download size={14} />} label="Télécharger" onClick={() => run(onDownload)} />
          )}
          <MenuItemRow icon={<Mail size={14} />} label="Envoyer un message" onClick={() => run(onMessages)} />
          {onDelete && (
            <>
              <div style={{ borderTop: '1px solid #F1F5F9', margin: '2px 0' }} />
              <MenuItemRow icon={<Trash2 size={14} />} label="Supprimer" onClick={() => run(onDelete)} danger />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItemRow({ icon, label, onClick, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-[#F8FAFC] ${danger ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}
    >
      <span className={`shrink-0 ${danger ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>{icon}</span>
      {label}
    </button>
  )
}

export default function MesDocumentsPage() {
  const router      = useRouter()
  const currentYear = new Date().getFullYear()
  const { activeCustomer } = useCustomer()

  const [customerId, setCustomerId]   = useState<string | null>(null)
  const [firmId, setFirmId]           = useState<string | null>(null)
  const [docTypes, setDocTypes]       = useState<DocTypeOpt[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear])
  const [editQual, setEditQual]       = useState<{ id: string; typeId: string; year: number; month: string } | null>(null)
  const [saving, setSaving]           = useState<string | null>(null)
  const [savedDoc, setSavedDoc]       = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DocRow | null>(null)
  const [deleting, setDeleting]           = useState(false)

  const [draftYear, setDraftYear]     = useState(currentYear)
  const [draftStatus, setDraftStatus] = useState<StatusFilter>('unprocessed')

  const [yearFilter, setYearFilter]     = useState(currentYear)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unprocessed')

  const [view, setView]         = useState<'kanban' | 'list'>('list')
  const [pageSize, setPageSize] = useState<10 | 20>(20)
  const [page, setPage]         = useState(0)
  const [total, setTotal]       = useState(0)

  const [docs, setDocs]               = useState<DocRow[]>([])
  const [initLoading, setInitLoading] = useState(true)
  const [docsLoading, setDocsLoading] = useState(false)
  const [acting, setActing]           = useState<string | null>(null)
  const [previewDoc, setPreviewDoc]   = useState<{ url: string; filename: string | null; mime: string | null } | null>(null)
  const [messagesDoc, setMessagesDoc] = useState<DocRow | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activeCustomer) return
    const customer = activeCustomer
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setCurrentUserId(session.user.id)
      setFirmId(customer.firm_id)

      const [yearsRes, typesRes] = await Promise.all([
        supabase.from('document').select('year').eq('customer_id', customer.id).limit(1000),
        supabase.from('document_type').select('id, name').eq('country_code', customer.country_code).eq('customer', true).eq('active', true).order('rank'),
      ])

      const rawYears = (yearsRes.data ?? []).map(r => (r as { year: number }).year)
      const uniqueYears = [...new Set(rawYears)].sort((a, b) => b - a)
      setAvailableYears(uniqueYears.length > 0 ? uniqueYears : [currentYear])
      setDocTypes((typesRes.data ?? []) as DocTypeOpt[])
      setCustomerId(customer.id)
      setInitLoading(false)
    }
    init()
  }, [router, currentYear, activeCustomer])

  const loadDocs = useCallback(async (opts: {
    customerId: string; year: number; status: StatusFilter; page: number; pageSize: number
  }) => {
    setDocsLoading(true)

    let q = supabase.from('document')
      .select('id, filename, storage_path, year, months, status, notes, size_kb, mime_type, created_at, type:type_id(id, name, customer)', { count: 'exact' })
      .eq('customer_id', opts.customerId)
      .eq('year', opts.year)
      .not('type.customer', 'is', false)

    if (opts.status === 'all')              q = q.in('status', ['draft', 'pending', 'processed', 'rejected'])
    else if (opts.status === 'unprocessed') q = q.in('status', ['draft', 'pending'])
    else                                    q = q.eq('status', opts.status)

    q = q.order('created_at', { ascending: false })
    q = q.range(opts.page * opts.pageSize, (opts.page + 1) * opts.pageSize - 1)

    const { data, count } = await q
    const clientDocs = ((data ?? []) as unknown as DocRow[]).filter(d => !d.type || d.type.customer)
    setDocs(clientDocs)
    setTotal(count ?? 0)
    setDocsLoading(false)
  }, [])

  const handleSearch = useCallback(() => {
    setYearFilter(draftYear)
    setStatusFilter(draftStatus)
    setPage(0)
  }, [draftYear, draftStatus])

  useEffect(() => {
    if (!customerId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadDocs({ customerId, year: yearFilter, status: statusFilter, page, pageSize })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [customerId, yearFilter, statusFilter, page, pageSize, loadDocs])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    const token = await getToken()
    const res = await fetch(`/api/customer/documents/${deleteConfirm.id}`, {
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

  const handleSaveQual = useCallback(async (id: string, typeId: string, year: number, month: string) => {
    setSaving(id)
    const token = await getToken()
    const months = month ? [parseInt(month)] : null
    const typeName = docTypes.find(t => t.id === typeId)?.name ?? null
    const res = await fetch(`/api/customer/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type_id: typeId || null, year, months }),
    })
    if (res.ok) {
      setDocs(prev => prev.map(d => d.id === id
        ? { ...d, type: typeId ? { id: typeId, name: typeName ?? '', customer: true } : null, year, months }
        : d
      ))
      setSavedDoc(id)
      setTimeout(() => setSavedDoc(null), 1500)
    }
    setSaving(null)
  }, [docTypes])

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

  if (initLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totalPages = Math.ceil(total / pageSize)
  const from       = total === 0 ? 0 : page * pageSize + 1
  const to         = Math.min((page + 1) * pageSize, total)
  const byStatus   = (s: Status) => docs.filter(d => d.status === s)

  return (
    <div className="max-w-7xl">

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>Supprimer ce document ?</div>
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
        <div onClick={() => setPreviewDoc(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '12px', width: '90vw', height: '90vh', maxWidth: '1100px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 40px)' }}>{previewDoc.filename ?? 'Document'}</span>
              <button onClick={() => setPreviewDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(previewDoc.mime === 'application/pdf' || previewDoc.filename?.toLowerCase().endsWith('.pdf')) && (
                <iframe src={previewDoc.url} style={{ width: '100%', height: '100%', border: 'none' }} title={previewDoc.filename ?? 'Document'} />
              )}
              {previewDoc.mime?.startsWith('image/') && (
                <img src={previewDoc.url} alt={previewDoc.filename ?? ''} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              )}
              {!previewDoc.mime?.startsWith('image/') && previewDoc.mime !== 'application/pdf' && !previewDoc.filename?.toLowerCase().endsWith('.pdf') && (
                <div style={{ textAlign: 'center', color: '#94A3B8' }}>
                  <div style={{ fontSize: '13px', marginBottom: '12px' }}>Aperçu non disponible pour ce format</div>
                  <a href={previewDoc.url} download={previewDoc.filename ?? 'document'} style={{ fontSize: '13px', color: '#1D4ED8', textDecoration: 'underline' }}>Télécharger le fichier</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Mes documents</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} document{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
            <button onClick={() => { setView('list'); setPage(0) }} className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-[#1D4ED8] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
              <List size={13} /> Liste
            </button>
            <button onClick={() => { setView('kanban'); setPage(0) }} className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-[#1D4ED8] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
              <LayoutGrid size={13} /> Kanban
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <select value={draftYear} onChange={e => setDraftYear(Number(e.target.value))} className={SEL}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={draftStatus} onChange={e => setDraftStatus(e.target.value as StatusFilter)} className={SEL}>
          <option value="unprocessed">Non traité</option>
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="processed">Traité</option>
          <option value="rejected">Rejeté</option>
        </select>
        <button onClick={handleSearch}
          className="px-4 py-1.5 text-sm font-medium bg-[#1D4ED8] text-white rounded-lg hover:bg-[#1e40af] transition-colors flex items-center gap-1.5">
          <Search size={13} /> Rechercher
        </button>
      </div>

      {docsLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'kanban' ? (
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
                  {cols.length === 0 && <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: '#CBD5E1' }}>—</div>}
                  {cols.map(d => (
                    <DocCard key={d.id} doc={d} acting={acting} onView={handleView} onDownload={handleDownload} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <style>{`.edit-cell-icon { opacity: 0.6; transition: opacity 0.15s; } .edit-cell-btn:hover .edit-cell-icon { opacity: 1; } .edit-cell-btn:hover { background: #F8FAFC !important; }`}</style>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Type','Fichier','Format','Poids','Période','Statut','Date','Actions'].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr><td colSpan={8}>
                  <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Aucun document</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>Modifiez les critères et relancez la recherche</div>
                  </div>
                </td></tr>
              )}
              {docs.map(d => {
                const cfg       = STATUS_CFG[d.status]
                const busy      = acting === d.id || saving === d.id
                const isEditing = editQual?.id === d.id
                const eq        = editQual
                const YEARS     = [2026, 2025, 2024, 2023, 2022]
                const openEdit  = () => setEditQual({ id: d.id, typeId: d.type?.id ?? '', year: d.year, month: d.months?.[0]?.toString() ?? '' })
                return (
                  <tr key={d.id} className={`border-b border-[#F1F5F9] last:border-0 transition-colors ${isEditing ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'}`}>
                    <td className="px-4 py-2 max-w-[150px]">
                      {isEditing && eq ? (
                        <select value={eq.typeId} onChange={e => {
                            const val = e.target.value
                            setEditQual({ ...eq, typeId: val })
                            handleSaveQual(eq.id, val, eq.year, eq.month)
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
                          <Pencil size={10} className="edit-cell-icon" style={{ color: '#94A3B8', flexShrink: 0 }} />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-[#0F172A] max-w-[180px] truncate" title={d.filename ?? undefined}>{d.filename ?? '—'}</td>
                    <td className="px-4 py-3"><ExtBadge filename={d.filename} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><SizeCell kb={d.size_kb} /></td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {isEditing && eq ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <select value={eq.year} onChange={e => {
                              const val = Number(e.target.value)
                              setEditQual({ ...eq, year: val })
                              handleSaveQual(eq.id, eq.typeId, val, eq.month)
                            }}
                            style={{ fontSize: '12px', border: '1px solid #BFDBFE', borderRadius: '5px', padding: '3px 4px', background: '#fff', outline: 'none' }}>
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                          <select value={eq.month} onChange={e => {
                              const val = e.target.value
                              setEditQual({ ...eq, month: val })
                              handleSaveQual(eq.id, eq.typeId, eq.year, val)
                            }}
                            style={{ fontSize: '12px', border: '1px solid #BFDBFE', borderRadius: '5px', padding: '3px 4px', background: '#fff', outline: 'none' }}>
                            <option value="">Tous</option>
                            {MONTHS_FR.slice(1).map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
                          </select>
                          {savedDoc === d.id && (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', flexShrink: 0 }}>✓</span>
                          )}
                          <button onClick={() => setEditQual(null)}
                            style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid #E2E8F0', background: '#fff', color: '#94A3B8', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Annuler">✕</button>
                        </div>
                      ) : (
                        <button onClick={openEdit} className="edit-cell-btn" style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', fontSize: '12px', color: '#64748B', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {formatPeriod(d.year, d.months)}
                          <Pencil size={10} className="edit-cell-icon" style={{ color: '#94A3B8', flexShrink: 0 }} />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <DocActionMenu
                        doc={d}
                        busy={busy}
                        onView={() => handleView(d)}
                        onDownload={() => handleDownload(d)}
                        onMessages={() => setMessagesDoc(d)}
                        onDelete={(d.status === 'pending' || d.status === 'draft') ? () => setDeleteConfirm(d) : undefined}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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

      {messagesDoc && currentUserId && firmId && (
        <MessagesDrawer
          doc={{ id: messagesDoc.id, filename: messagesDoc.filename, firm_id: firmId, customer_id: customerId ?? '' }}
          currentUserId={currentUserId}
          onClose={() => setMessagesDoc(null)}
        />
      )}
    </div>
  )
}

/* ─── DocCard (Kanban) ───────────────────────────────────────── */

function DocCard({ doc: d, acting, onView, onDownload }: {
  doc: DocRow; acting: string | null
  onView: (d: DocRow) => void; onDownload: (d: DocRow) => void
}) {
  const cfg  = STATUS_CFG[d.status]
  const busy = acting === d.id
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.filename ?? undefined}>
            {d.filename ?? '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            {d.type
              ? d.type.name
              : <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '3px', background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>Non qualifié</span>
            }
            {' · '}{d.year}
          </div>
          <div style={{ fontSize: '10px', color: '#CBD5E1', marginTop: '1px', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            <ExtBadge filename={d.filename} />
            <SizeCell kb={d.size_kb} />
          </div>
        </div>
        {d.storage_path && (
          <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
            <ActionBtn title="Visualiser" color="#1D4ED8" loading={busy} onClick={() => onView(d)}><Eye size={10} strokeWidth={2} /></ActionBtn>
            <ActionBtn title="Télécharger" color="#64748B" loading={busy} onClick={() => onDownload(d)}><Download size={10} strokeWidth={2} /></ActionBtn>
          </div>
        )}
      </div>
      {d.notes && (
        <div style={{ fontSize: '10px', color: '#64748B', background: '#F8FAFC', borderRadius: '3px', padding: '4px 6px', borderLeft: '2px solid #E2E8F0' }}>
          {d.notes}
        </div>
      )}
      {d.status === 'rejected' && (
        <button onClick={() => window.location.href = '/mes-documents/nouveau'}
          style={{ width: '100%', padding: '5px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '5px', fontSize: '11px', fontWeight: 600, color: '#991b1b', cursor: 'pointer', fontFamily: 'inherit' }}>
          Redéposer →
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
        <span style={{ fontSize: '10px', color: '#CBD5E1' }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  )
}

/* ─── ActionBtn ──────────────────────────────────────────────── */

function ActionBtn({ title, color, loading, onClick, children }: {
  title: string; color: string; loading?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button title={title} disabled={loading} onClick={onClick}
      style={{ width: '24px', height: '24px', border: '1px solid #E2E8F0', borderRadius: '5px', background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, opacity: loading ? 0.4 : 1 }}>
      {children}
    </button>
  )
}
