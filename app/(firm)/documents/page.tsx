'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import dynamic from 'next/dynamic'
import DocumentFilters from './_components/DocumentFilters'
const DeleteConfirmModal = dynamic(() => import('./_components/DeleteConfirmModal'))
const NoteModal          = dynamic(() => import('./_components/NoteModal'))
const EventsDrawer       = dynamic(() => import('./_components/EventsDrawer'))
const MessagesDrawer     = dynamic(() => import('@/components/shared/MessagesDrawer'))
const PreviewModal       = dynamic(() => import('./_components/PreviewModal'))
import KanbanView from './_components/KanbanView'
import ListView from './_components/ListView'
import {
  CustomerFilter, DocTypeOpt, DocRow, EventRow,
  QualState, Status, StatusFilter,
} from './_components/types'

export default function DocumentsPage() {
  const router      = useRouter()
  const currentYear = new Date().getFullYear()

  // Static data — loaded once
  const [firmId, setFirmId]                     = useState<string | null>(null)
  const [customers, setCustomers]               = useState<CustomerFilter[]>([])
  const [docTypes, setDocTypes]                 = useState<DocTypeOpt[]>([])
  const [availableYears, setAvailableYears]     = useState<number[]>([currentYear])

  // Draft filters (UI — not applied until "Rechercher")
  const [draftYear, setDraftYear]               = useState(currentYear)
  const [draftStatus, setDraftStatus]           = useState<StatusFilter>('unprocessed')
  const [draftCust, setDraftCust]               = useState('all')

  // Applied filters (trigger loadDocs)
  const [yearFilter, setYearFilter]             = useState(currentYear)
  const [statusFilter, setStatusFilter]         = useState<StatusFilter>('unprocessed')
  const [typeFilter]                            = useState('all')
  const [custFilter, setCustFilter]             = useState('all')

  // View + pagination
  const [view, setView]         = useState<'kanban' | 'list'>('list')
  const [pageSize, setPageSize] = useState<10 | 20>(20)
  const [page, setPage]         = useState(0)
  const [total, setTotal]       = useState(0)

  // Docs
  const [docs, setDocs]               = useState<DocRow[]>([])
  const [initLoading, setInitLoading] = useState(true)
  const [docsLoading, setDocsLoading] = useState(false)

  // Inline qual edit
  const [editQual, setEditQual] = useState<QualState | null>(null)
  const [savedDoc, setSavedDoc] = useState<string | null>(null)

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<DocRow | null>(null)
  const [deleting, setDeleting]           = useState(false)

  // Modals
  const [previewDoc, setPreviewDoc]       = useState<{ url: string; filename: string | null; mime: string | null } | null>(null)
  const [editNote, setEditNote]           = useState<{ id: string; value: string } | null>(null)
  const [saving, setSaving]               = useState<string | null>(null)
  const [acting, setActing]               = useState<string | null>(null)
  const [eventsDoc, setEventsDoc]         = useState<DocRow | null>(null)
  const [events, setEvents]               = useState<EventRow[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [messagesDoc, setMessagesDoc]     = useState<DocRow | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setCurrentUserId(session.user.id)

      const { data: ud } = await supabase
        .from('user_data').select('firm_id').eq('id', session.user.id).single()
      if (!ud?.firm_id) { setInitLoading(false); return }

      const { data: firm } = await supabase
        .from('firm').select('id, country_code').eq('id', ud.firm_id).single()
      if (!firm) { setInitLoading(false); return }

      const [custsRes, typesRes, yearsRes] = await Promise.all([
        supabase.from('customer').select('id, name').eq('firm_id', firm.id).eq('active', true).order('name'),
        supabase.from('document_type').select('id, name').eq('country_code', firm.country_code).eq('customer', true).eq('active', true).order('rank'),
        supabase.from('document').select('year').eq('firm_id', firm.id).limit(100),
      ])

      setCustomers((custsRes.data ?? []) as CustomerFilter[])
      setDocTypes((typesRes.data ?? []) as DocTypeOpt[])

      const rawYears = (yearsRes.data ?? []).map(r => (r as { year: number }).year)
      const uniqueYears = [...new Set(rawYears)].sort((a, b) => b - a)
      setAvailableYears(uniqueYears.length > 0 ? uniqueYears : [currentYear])

      setFirmId(firm.id)
      setInitLoading(false)
    }
    init()
  }, [router, currentYear])

  // ── Load docs (server-side filter + pagination) ───────────────
  const loadDocs = useCallback(async (opts: {
    firmId: string
    year: number
    status: StatusFilter
    type: string
    cust: string
    page: number
    pageSize: number
  }) => {
    setDocsLoading(true)

    let q = supabase.from('document')
      .select(
        'id, filename, storage_path, year, months, status, notes, size_kb, mime_type, created_at, type:type_id(id, name, customer), customer:customer_id(id, name)',
        { count: 'exact' },
      )
      .eq('firm_id', opts.firmId)
      .eq('source', 'customer')
      .eq('year', opts.year)

    if (opts.status === 'all')              q = q.in('status', ['pending', 'processed', 'rejected'])
    else if (opts.status === 'unprocessed') q = q.in('status', ['pending', 'rejected'])
    else                                    q = q.eq('status', opts.status)

    if (opts.type === 'none')      q = q.is('type_id', null)
    else if (opts.type !== 'all')  q = q.eq('type_id', opts.type)

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
    setStatusFilter(draftStatus)
    setCustFilter(draftCust)
    setPage(0)
  }, [draftYear, draftStatus, draftCust])

  useEffect(() => {
    if (!firmId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadDocs({ firmId, year: yearFilter, status: statusFilter, type: typeFilter, cust: custFilter, page, pageSize })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [firmId, yearFilter, statusFilter, typeFilter, custFilter, page, pageSize, loadDocs])

  // ── Actions ───────────────────────────────────────────────────
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

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    const token = await getToken()
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
        ? { ...d, type: typeId ? { id: typeId, name: typeName ?? '', customer: true } : null, year, months }
        : d
      ))
      setSavedDoc(id)
      setTimeout(() => setSavedDoc(null), 1500)
    }
    setSaving(null)
  }, [docTypes])

  // ── Render ────────────────────────────────────────────────────
  if (initLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totalPages = Math.ceil(total / pageSize)
  const from       = total === 0 ? 0 : page * pageSize + 1
  const to         = Math.min((page + 1) * pageSize, total)
  const byStatus   = (s: Status) => docs.filter(d => d.status === s)
  const handlers   = {
    saving, acting,
    onStatusChange: handleStatusChange,
    onEditNote: (d: DocRow) => setEditNote({ id: d.id, value: d.notes ?? '' }),
    onView: handleView, onDownload: handleDownload, onEvents: handleOpenEvents,
    onMessages: (d: DocRow) => setMessagesDoc(d),
    editQual, setEditQual, onSaveQual: handleSaveQual, docTypes, savedDoc,
    onDelete: (d: DocRow) => setDeleteConfirm(d),
  }

  return (
    <div className="max-w-7xl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Documents</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} document{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => { setView('list'); setPage(0) }}
            className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-[#1D4ED8] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
          >
            <List size={13} /> Liste
          </button>
          <button
            onClick={() => { setView('kanban'); setPage(0) }}
            className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-[#1D4ED8] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
          >
            <LayoutGrid size={13} /> Kanban
          </button>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <DocumentFilters
        availableYears={availableYears}
        draftYear={draftYear}
        draftStatus={draftStatus}
        draftCust={draftCust}
        customers={customers}
        onYearChange={setDraftYear}
        onStatusChange={setDraftStatus}
        onCustChange={setDraftCust}
        onSearch={handleSearch}
      />

      {/* ── Modals ─────────────────────────────────────────────── */}
      {deleteConfirm && (
        <DeleteConfirmModal
          doc={deleteConfirm}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {previewDoc && (
        <PreviewModal
          url={previewDoc.url}
          filename={previewDoc.filename}
          mime={previewDoc.mime}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {editNote && (
        <NoteModal
          id={editNote.id}
          value={editNote.value}
          saving={saving}
          onChange={value => setEditNote(prev => prev ? { ...prev, value } : null)}
          onSave={handleSaveNote}
          onClose={() => setEditNote(null)}
        />
      )}

      {eventsDoc && (
        <EventsDrawer
          doc={eventsDoc}
          events={events}
          loading={eventsLoading}
          onClose={() => setEventsDoc(null)}
        />
      )}

      {/* ── Content ────────────────────────────────────────────── */}
      {docsLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        <KanbanView
          columns={[
            { key: 'pending',   label: 'En attente',  docs: byStatus('pending') },
            { key: 'processed', label: 'Traité',       docs: byStatus('processed') },
            { key: 'rejected',  label: 'Rejeté',       docs: byStatus('rejected') },
          ]}
          {...handlers}
        />
      ) : (
        <ListView docs={docs} {...handlers} />
      )}

      {/* ── Pagination ─────────────────────────────────────────── */}
      {!docsLoading && (
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-sm text-[#64748B]">
            <span>Afficher</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value) as 10 | 20); setPage(0) }}
              className="text-sm border border-[#E2E8F0] rounded-md px-2 py-1 bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            <span>par page</span>
          </div>

          {total > 0 && (
            <div className="flex items-center gap-3 text-sm text-[#64748B]">
              <span>{from}–{to} sur {total}</span>
              <div className="flex gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  style={{ width: '28px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: page === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === 0 ? '#CBD5E1' : '#64748B' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  style={{ width: '28px', height: '28px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: page >= totalPages - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page >= totalPages - 1 ? '#CBD5E1' : '#64748B' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {messagesDoc && currentUserId && (
        <MessagesDrawer
          doc={{ id: messagesDoc.id, filename: messagesDoc.filename, firm_id: firmId!, customer_id: messagesDoc.customer?.id ?? '' }}
          currentUserId={currentUserId}
          onClose={() => setMessagesDoc(null)}
        />
      )}
    </div>
  )
}
