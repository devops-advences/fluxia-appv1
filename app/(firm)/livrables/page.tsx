'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import dynamic from 'next/dynamic'
import LivrablesFilters from './_components/LivrablesFilters'
const DeleteConfirmModal = dynamic(() => import('./_components/DeleteConfirmModal'))
const NoteModal          = dynamic(() => import('./_components/NoteModal'))
const EventsDrawer       = dynamic(() => import('./_components/EventsDrawer'))
const PreviewModal       = dynamic(() => import('./_components/PreviewModal'))
import ListView from './_components/ListView'
import {
  CustomerFilter, DocTypeOpt, DocRow, EventRow,
  QualState, Status,
} from './_components/types'

export default function LivrablesPage() {
  const router      = useRouter()
  const currentYear = new Date().getFullYear()

  const [firmId, setFirmId]                 = useState<string | null>(null)
  const [customers, setCustomers]           = useState<CustomerFilter[]>([])
  const [docTypes, setDocTypes]             = useState<DocTypeOpt[]>([])
  const [typeIds, setTypeIds]               = useState<string[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear])
  const [savedDoc, setSavedDoc]             = useState<string | null>(null)

  const [draftYear, setDraftYear]   = useState(currentYear)
  const [draftCust, setDraftCust]   = useState('all')
  const [yearFilter, setYearFilter] = useState(currentYear)
  const [custFilter, setCustFilter] = useState('all')
  const [pageSize, setPageSize]     = useState<10 | 20>(20)
  const [page, setPage]             = useState(0)
  const [total, setTotal]           = useState(0)

  const [docs, setDocs]               = useState<DocRow[]>([])
  const [initLoading, setInitLoading] = useState(true)
  const [docsLoading, setDocsLoading] = useState(false)

  const [editQual, setEditQual]           = useState<QualState | null>(null)
  const [previewDoc, setPreviewDoc]       = useState<{ url: string; filename: string | null; mime: string | null } | null>(null)
  const [editNote, setEditNote]           = useState<{ id: string; value: string } | null>(null)
  const [saving, setSaving]               = useState<string | null>(null)
  const [acting, setActing]               = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DocRow | null>(null)
  const [deleting, setDeleting]           = useState(false)
  const [eventsDoc, setEventsDoc]         = useState<DocRow | null>(null)
  const [events, setEvents]               = useState<EventRow[]>([])
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

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Livrables</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} livrable{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <LivrablesFilters
        availableYears={availableYears}
        draftYear={draftYear}
        draftCust={draftCust}
        customers={customers}
        onYearChange={setDraftYear}
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
    </div>
  )
}
