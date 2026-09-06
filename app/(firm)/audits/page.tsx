'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Search, Pencil, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

type Severity = 'high' | 'medium' | 'low'

type DossierOption = { customer_id: string; name: string; open_count: number }

type Run = { id: string; period_start: string; period_end: string; status: string }

type Finding = {
  id: string; object_name: string | null; object_ref: string
  message: string; message_override: string | null
  severity: Severity; status: string
  detail_lines: { montant_total?: number } | null
  check_type: { name: string } | { name: string }[] | null
}

const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 }

const SEV_STYLE: Record<Severity, { badge: string; dot: string; label: string }> = {
  high:   { badge: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]', dot: '🔴', label: 'HAUTE' },
  medium: { badge: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]', dot: '🟡', label: 'MOYENNE' },
  low:    { badge: 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]', dot: '⚪', label: 'FAIBLE' },
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d }
}

function displayText(f: Finding) {
  return f.message_override ?? f.message
}

export default function AuditsPage() {
  const [dossiers, setDossiers] = useState<DossierOption[]>([])
  const [selected, setSelected] = useState('')
  const [dossierName, setDossierName] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [firmName, setFirmName] = useState('')
  const [firmLogoUrl, setFirmLogoUrl] = useState<string | null>(null)

  const [run, setRun] = useState<Run | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [ignoringId, setIgnoringId] = useState<string | null>(null)
  const [ignoreComment, setIgnoreComment] = useState('')
  const [savingStatus, setSavingStatus] = useState<string | null>(null)

  // Liste des dossiers ayant un audit
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingList(false); return }

      const { data: ud } = await supabase.from('user_data').select('firm_id').eq('id', session.user.id).single()
      if (ud?.firm_id) {
        const { data: firm } = await supabase.from('firm').select('name, logo_url').eq('id', ud.firm_id).single()
        if (firm) { setFirmName(firm.name); setFirmLogoUrl(firm.logo_url) }
      }

      const [{ data: runs }, { data: findingsData }] = await Promise.all([
        supabase.from('audit_run').select('customer_id, created_at, customer:customer_id(name)').order('created_at', { ascending: false }),
        supabase.from('audit_finding').select('customer_id, status'),
      ])

      type RunRow = { customer_id: string; customer: { name: string } | { name: string }[] | null }
      const seen = new Map<string, string>()
      for (const r of (runs ?? []) as RunRow[]) {
        if (seen.has(r.customer_id)) continue
        const cust = Array.isArray(r.customer) ? r.customer[0] : r.customer
        seen.set(r.customer_id, cust?.name ?? '—')
      }

      const openCounts = new Map<string, number>()
      for (const f of (findingsData ?? []) as { customer_id: string; status: string }[]) {
        if (f.status !== 'open') continue
        openCounts.set(f.customer_id, (openCounts.get(f.customer_id) ?? 0) + 1)
      }

      const options: DossierOption[] = Array.from(seen.entries()).map(([customer_id, name]) => ({
        customer_id, name, open_count: openCounts.get(customer_id) ?? 0,
      }))
      options.sort((a, b) => a.name.localeCompare(b.name))

      setDossiers(options)
      if (options.length > 0) setSelected(options[0].customer_id)
      setLoadingList(false)
    }
    load()
  }, [])

  // Findings du dossier sélectionné
  useEffect(() => {
    if (!selected) { setRun(null); setFindings([]); return }
    async function loadDetail() {
      setLoadingDetail(true)
      setSearch(''); setSeverityFilter('all'); setPage(1)
      setDossierName(dossiers.find(d => d.customer_id === selected)?.name ?? '')

      const { data: runs } = await supabase
        .from('audit_run').select('id, period_start, period_end, status')
        .eq('customer_id', selected).order('created_at', { ascending: false }).limit(1)

      const latestRun = runs?.[0] as Run | undefined
      setRun(latestRun ?? null)

      if (latestRun) {
        const { data: findingsData } = await supabase
          .from('audit_finding')
          .select('id, object_name, object_ref, message, message_override, severity, status, detail_lines, check_type:check_type_id(name)')
          .eq('customer_id', selected)
        if (findingsData) {
          const sorted = [...(findingsData as unknown as Finding[])].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])
          setFindings(sorted)
        } else {
          setFindings([])
        }
      } else {
        setFindings([])
      }
      setLoadingDetail(false)
    }
    loadDetail()
  }, [selected, dossiers])

  async function saveOverride(id: string) {
    setSavingEdit(true)
    const value = editText.trim() || null
    const { error } = await supabase.from('audit_finding').update({ message_override: value }).eq('id', id)
    if (!error) {
      setFindings(prev => prev.map(f => f.id === id ? { ...f, message_override: value } : f))
      setEditingId(null)
    }
    setSavingEdit(false)
  }

  async function ignoreFinding(id: string) {
    if (!ignoreComment.trim()) return
    setSavingStatus(id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSavingStatus(null); return }
    const { error } = await supabase.from('audit_finding').update({ status: 'ignored' }).eq('id', id)
    if (!error) {
      await supabase.from('audit_finding_event').insert({
        finding_id: id, user_id: session.user.id, event_type: 'ignored', comment: ignoreComment.trim(),
      })
      setFindings(prev => prev.map(f => f.id === id ? { ...f, status: 'ignored' } : f))
      setIgnoringId(null); setIgnoreComment('')
    }
    setSavingStatus(null)
  }

  async function reopenFinding(id: string) {
    setSavingStatus(id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSavingStatus(null); return }
    const { error } = await supabase.from('audit_finding').update({ status: 'open' }).eq('id', id)
    if (!error) {
      await supabase.from('audit_finding_event').insert({
        finding_id: id, user_id: session.user.id, event_type: 'reopened',
      })
      setFindings(prev => prev.map(f => f.id === id ? { ...f, status: 'open' } : f))
    }
    setSavingStatus(null)
  }

  function handlePrint() {
    const original = document.title
    if (run) {
      const start = fmtDate(run.period_start).replace(/\//g, '-')
      const end = fmtDate(run.period_end).replace(/\//g, '-')
      document.title = `Audit ${dossierName} ${start}_${end}`
    }
    window.print()
    setTimeout(() => { document.title = original }, 500)
  }

  const openFindings = findings.filter(f => f.status === 'open')
  const visibleFindings = findings.filter(f => f.status === 'open' || f.status === 'ignored')
  const counts = { high: 0, medium: 0, low: 0 } as Record<Severity, number>
  for (const f of openFindings) counts[f.severity]++

  function matchesFilters(f: Finding) {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const name = (f.object_name ?? f.object_ref).toLowerCase()
      if (!name.includes(q)) return false
    }
    return true
  }

  const filteredFindings = visibleFindings.filter(matchesFilters)
  const printableFindings = openFindings.filter(matchesFilters) // jamais les ignorés dans l'export
  const totalPages = Math.max(1, Math.ceil(filteredFindings.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageFindings = filteredFindings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function renderPrintEntry(f: Finding, index: number) {
    const amount = f.detail_lines?.montant_total
    const amountStr = typeof amount === 'number'
      ? `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € concernés`
      : null
    return (
      <div key={f.id} className="mb-4" style={{ breakInside: 'avoid' }}>
        <p className="text-sm font-semibold text-[#0F172A]">
          {index + 1}. {f.object_name ?? f.object_ref}{amountStr ? ` — ${amountStr}` : ''}
        </p>
        <p className="text-sm text-[#0F172A] mt-1 leading-relaxed">{displayText(f)}</p>
      </div>
    )
  }

  function renderCard(f: Finding) {
    const ct = Array.isArray(f.check_type) ? f.check_type[0] : f.check_type
    const style = SEV_STYLE[f.severity]
    const isIgnored = f.status === 'ignored'
    const isEditing = editingId === f.id
    const isIgnoring = ignoringId === f.id
    const amount = f.detail_lines?.montant_total
    const amountStr = typeof amount === 'number'
      ? `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € concernés`
      : null
    return (
      <div key={f.id} className={`bg-white border rounded-xl p-4 ${isIgnored ? 'border-[#E2E8F0] opacity-60' : 'border-[#E2E8F0]'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.badge}`}>
            {style.dot} {style.label}
          </span>
          <span className="text-sm font-semibold text-[#0F172A]">
            {f.object_name ?? f.object_ref}{amountStr ? ` — ${amountStr}` : ''}
          </span>
          {isIgnored && <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider">Ignoré</span>}
        </div>

        {isEditing ? (
          <div className="mb-1.5 flex flex-col gap-2 print:hidden">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={3}
              className="w-full text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
            />
            <div className="flex gap-2">
              <button onClick={() => saveOverride(f.id)} disabled={savingEdit}
                className="text-xs px-3 py-1 rounded-lg bg-[#1D4ED8] text-white hover:bg-[#1e40af] disabled:opacity-50 transition-colors">
                {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button onClick={() => setEditingId(null)}
                className="text-xs px-3 py-1 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#0F172A] mb-1.5">{displayText(f)}</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-[#94A3B8]">[{ct?.name ?? '—'}]</span>
          {!isEditing && (
            <div className="flex items-center gap-3 print:hidden">
              <button onClick={() => { setEditingId(f.id); setEditText(displayText(f)) }}
                className="text-xs text-[#64748B] hover:text-[#1D4ED8] flex items-center gap-1 transition-colors">
                <Pencil size={12} /> Modifier
              </button>
              {isIgnored ? (
                <button onClick={() => reopenFinding(f.id)} disabled={savingStatus === f.id}
                  className="text-xs text-[#059669] hover:underline disabled:opacity-50">
                  {savingStatus === f.id ? '…' : 'Rouvrir'}
                </button>
              ) : (
                <button onClick={() => { setIgnoringId(f.id); setIgnoreComment('') }}
                  className="text-xs text-[#DC2626] hover:underline">
                  Ignorer
                </button>
              )}
            </div>
          )}
        </div>

        {isIgnoring && (
          <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex flex-col gap-2 print:hidden">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Motif (obligatoire)</span>
            <input
              value={ignoreComment}
              onChange={e => setIgnoreComment(e.target.value)}
              placeholder="Ex : situation normale pour ce fournisseur"
              className="w-full text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
            />
            <div className="flex gap-2">
              <button onClick={() => ignoreFinding(f.id)} disabled={!ignoreComment.trim() || savingStatus === f.id}
                className="text-xs px-3 py-1 rounded-lg bg-[#DC2626] text-white hover:bg-[#b91c1c] disabled:opacity-50 transition-colors">
                {savingStatus === f.id ? 'Enregistrement…' : 'Confirmer'}
              </button>
              <button onClick={() => setIgnoringId(null)}
                className="text-xs px-3 py-1 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4 print:hidden">
        <ShieldCheck size={18} strokeWidth={1.5} className="text-[#64748B]" />
        <h1 className="text-xl font-semibold text-[#0F172A]">Audits comptes fournisseurs</h1>
      </div>

      {/* En-tête visible uniquement à l'impression */}
      <div className="hidden print:block mb-8">
        {firmLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={firmLogoUrl} alt={firmName} className="max-h-10 object-contain mb-3" />
        )}
        <p className="text-xs text-[#64748B] mb-1">{firmName}</p>
        <h1 className="text-lg font-bold text-[#0F172A]">Points à clarifier sur vos comptes fournisseurs</h1>
        <p className="text-sm text-[#64748B] mt-1">{dossierName}</p>
        {run && <p className="text-xs text-[#94A3B8] mt-0.5">Période du {fmtDate(run.period_start)} au {fmtDate(run.period_end)}</p>}
      </div>

      {loadingList ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dossiers.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-8 text-center text-sm text-[#94A3B8]">
          Aucun audit encore réalisé.
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3 print:hidden">
            <select value={selected} onChange={e => setSelected(e.target.value)}
              className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors">
              {dossiers.map(d => (
                <option key={d.customer_id} value={d.customer_id}>
                  {d.name}{d.open_count > 0 ? ` (${d.open_count})` : ''}
                </option>
              ))}
            </select>
            {run && <span className="text-xs text-[#94A3B8]">Période : {fmtDate(run.period_start)} → {fmtDate(run.period_end)}</span>}
            {run && (
              <button onClick={handlePrint}
                className="ml-auto text-sm px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] flex items-center gap-1.5 transition-colors">
                <Printer size={14} /> Exporter en PDF
              </button>
            )}
          </div>

          {loadingDetail ? (
            <div className="flex items-center justify-center h-32 print:hidden">
              <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !run ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-8 text-center text-sm text-[#94A3B8]">
              Aucun audit encore réalisé pour ce dossier.
            </div>
          ) : (
            <>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mb-3 print:hidden">
                <span className="text-sm font-medium text-[#0F172A]">{openFindings.length} point{openFindings.length > 1 ? 's' : ''} à vérifier</span>
                {counts.high   > 0 && <span className="text-sm">🔴 {counts.high} haute{counts.high > 1 ? 's' : ''}</span>}
                {counts.medium > 0 && <span className="text-sm">🟡 {counts.medium} moyenne{counts.medium > 1 ? 's' : ''}</span>}
                {counts.low    > 0 && <span className="text-sm">⚪ {counts.low} faible{counts.low > 1 ? 's' : ''}</span>}

                {openFindings.length > 0 && (
                  <div className="ml-auto flex items-center gap-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                      <input
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Rechercher un tiers…"
                        className="text-sm pl-8 pr-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
                      />
                    </div>
                    <select
                      value={severityFilter}
                      onChange={e => { setSeverityFilter(e.target.value as 'all' | Severity); setPage(1) }}
                      className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
                    >
                      <option value="all">Toutes sévérités</option>
                      <option value="high">Haute</option>
                      <option value="medium">Moyenne</option>
                      <option value="low">Faible</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Vue interactive (écran) */}
              <div className="print:hidden">
                {filteredFindings.length === 0 ? (
                  <div className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-8 text-center text-sm text-[#94A3B8]">
                    {openFindings.length === 0 ? 'Aucune anomalie détectée.' : 'Aucun résultat pour cette recherche.'}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      {pageFindings.map(f => renderCard(f))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 text-sm">
                        <span className="text-xs text-[#94A3B8]">
                          {filteredFindings.length} résultat{filteredFindings.length > 1 ? 's' : ''} — page {currentPage}/{totalPages}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC] transition-colors"
                          >
                            Précédent
                          </button>
                          <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC] transition-colors"
                          >
                            Suivant
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Vue impression : liste numérotée sobre, non paginée, jamais les ignorés */}
              <div className="hidden print:block">
                {printableFindings.map((f, i) => renderPrintEntry(f, i))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
