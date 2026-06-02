'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download, Eye, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { formatPeriod, EXT_COLORS } from '@/lib/format'
import { useCustomer } from '@/lib/CustomerContext'

function SizeCell({ kb }: { kb: number | null }) {
  if (!kb) return <span className="text-xs text-[#94A3B8]">—</span>
  const label = kb < 1024 ? `${kb} Ko` : `${(kb / 1024).toFixed(1)} Mo`
  if (kb > 10 * 1024) return <span style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626' }}>{label}</span>
  if (kb > 5 * 1024)  return <span style={{ fontSize: '11px', fontWeight: 600, color: '#D97706' }}>{label}</span>
  return <span className="text-xs text-[#94A3B8]">{label}</span>
}

function ExtBadge({ filename }: { filename: string | null }) {
  if (!filename) return null
  const ext = (filename.split('.').pop() ?? '').toUpperCase()
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
  notes: string | null
  size_kb: number | null
  mime_type: string | null
  created_at: string
  type: { name: string } | null
}

const SEL = "text-sm border border-[#E2E8F0] rounded-lg px-3 py-1.5 bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"

export default function MesLivrablesPage() {
  const router      = useRouter()
  const currentYear = new Date().getFullYear()
  const { activeCustomer } = useCustomer()

  const [customerId, setCustomerId]   = useState<string | null>(null)
  const [typeIds, setTypeIds]         = useState<string[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear])

  const [draftYear, setDraftYear] = useState(currentYear)
  const [yearFilter, setYearFilter] = useState(currentYear)

  const [pageSize, setPageSize] = useState<10 | 20>(20)
  const [page, setPage]         = useState(0)
  const [total, setTotal]       = useState(0)

  const [docs, setDocs]               = useState<DocRow[]>([])
  const [initLoading, setInitLoading] = useState(true)
  const [docsLoading, setDocsLoading] = useState(false)
  const [acting, setActing]           = useState<string | null>(null)
  const [previewDoc, setPreviewDoc]   = useState<{ url: string; filename: string | null; mime: string | null } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!activeCustomer) return
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const [yearsRes, typesRes] = await Promise.all([
        supabase.from('document').select('year').eq('customer_id', activeCustomer.id),
        supabase.from('document_type').select('id').eq('country_code', activeCustomer.country_code).eq('customer', false).eq('active', true),
      ])

      const rawYears = (yearsRes.data ?? []).map(r => (r as { year: number }).year)
      const uniqueYears = [...new Set(rawYears)].sort((a, b) => b - a)
      setAvailableYears(uniqueYears.length > 0 ? uniqueYears : [currentYear])
      setTypeIds(((typesRes.data ?? []) as { id: string }[]).map(t => t.id))
      setCustomerId(activeCustomer.id)
      setInitLoading(false)
    }
    init()
  }, [router, currentYear, activeCustomer])

  const loadDocs = useCallback(async (opts: {
    customerId: string; year: number; typeIds: string[]; page: number; pageSize: number
  }) => {
    setDocsLoading(true)
    if (opts.typeIds.length === 0) { setDocs([]); setTotal(0); setDocsLoading(false); return }

    const { data, count } = await supabase.from('document')
      .select('id, filename, storage_path, year, months, notes, size_kb, mime_type, created_at, type:type_id(name)', { count: 'exact' })
      .eq('customer_id', opts.customerId)
      .eq('year', opts.year)
      .in('type_id', opts.typeIds)
      .order('created_at', { ascending: false })
      .range(opts.page * opts.pageSize, (opts.page + 1) * opts.pageSize - 1)

    setDocs((data ?? []) as unknown as DocRow[])
    setTotal(count ?? 0)
    setDocsLoading(false)
  }, [])

  useEffect(() => {
    if (!customerId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadDocs({ customerId, year: yearFilter, typeIds, page, pageSize })
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [customerId, typeIds, yearFilter, page, pageSize, loadDocs])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

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

  return (
    <div className="max-w-7xl">

      {previewDoc && (
        <div onClick={() => setPreviewDoc(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '12px', width: '90vw', height: '90vh', maxWidth: '1100px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 40px)' }}>{previewDoc.filename ?? 'Document'}</span>
              <button onClick={() => setPreviewDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(previewDoc.mime === 'application/pdf' || previewDoc.filename?.toLowerCase().endsWith('.pdf')) && (
                <iframe src={previewDoc.url} style={{ width: '100%', height: '100%', border: 'none' }} title={previewDoc.filename ?? ''} />
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
          <h1 className="text-xl font-semibold text-[#0F172A]">Mes livrables</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{total} livrable{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <select value={draftYear} onChange={e => setDraftYear(Number(e.target.value))} className={SEL}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={() => { setYearFilter(draftYear); setPage(0) }}
          className="px-4 py-1.5 text-sm font-medium bg-[#1D4ED8] text-white rounded-lg hover:bg-[#1e40af] transition-colors flex items-center gap-1.5">
          <Search size={13} /> Rechercher
        </button>
      </div>

      {docsLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-[#BFDBFE] rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#EFF6FF] border-b border-[#BFDBFE]">
                {['Type','Fichier','Format','Poids','Période','Date',''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold text-[#1D4ED8] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && (
                <tr><td colSpan={7}>
                  <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Aucun livrable</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>Aucun livrable déposé par votre cabinet pour cette année</div>
                  </div>
                </td></tr>
              )}
              {docs.map(d => {
                const busy = acting === d.id
                return (
                  <tr key={d.id} className="border-b border-[#EFF6FF] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#64748B] max-w-[120px] truncate">{d.type?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-medium text-[#0F172A] max-w-[180px] truncate" title={d.filename ?? undefined}>{d.filename ?? '—'}</td>
                    <td className="px-4 py-3"><ExtBadge filename={d.filename} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><SizeCell kb={d.size_kb} /></td>
                    <td className="px-4 py-3 text-xs text-[#64748B] whitespace-nowrap">{formatPeriod(d.year, d.months)}</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {d.storage_path && <ActionBtn title="Visualiser" color="#1D4ED8" loading={busy} onClick={() => handleView(d)}><Eye size={11} strokeWidth={2} /></ActionBtn>}
                        {d.storage_path && <ActionBtn title="Télécharger" color="#64748B" loading={busy} onClick={() => handleDownload(d)}><Download size={11} strokeWidth={2} /></ActionBtn>}
                      </div>
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
    </div>
  )
}

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
