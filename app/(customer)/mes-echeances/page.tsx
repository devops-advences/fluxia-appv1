'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useCustomer } from '@/lib/CustomerContext'

type Obligation = {
  id: string
  label: string
  tax_type: string
  due_date: string
  amount: number | null
  payment_mode: string | null
  status: string
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-[#FEF3C7] text-[#D97706]',
  paid:     'bg-[#D1FAE5] text-[#059669]',
  rejected: 'bg-[#FEE2E2] text-[#DC2626]',
  failed:   'bg-[#FEE2E2] text-[#DC2626]',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', paid: 'Payé', rejected: 'Rejeté', failed: 'Échoué',
}

const TAX_LABELS: Record<string, string> = {
  value_added_tax:      'TVA',
  corporate_income_tax: 'IS',
  personal_income_tax:  'IR',
  social_contributions: 'Social',
  withholding_tax:      'RS',
}

const MODE_LABELS: Record<string, string> = {
  direct_debit:  'Prélèvement automatique',
  bank_transfer: 'Virement bancaire',
  cheque:        'Chèque',
  cash:          'Espèces',
}

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtAmount(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function monthKey(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return `${MONTHS_FR[parseInt(m) - 1]} ${y}`
}

export default function MesEcheancesPage() {
  const { activeCustomer }            = useCustomer()
  const currentYear                   = new Date().getFullYear()
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading]         = useState(true)
  const [fromOffset, setFromOffset] = useState(0)
  const [toOffset, setToOffset]     = useState(2)
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    if (!activeCustomer) return
    async function load() {
      setLoading(true)

      // Génère les obligations manquantes pour cette entité
      await Promise.all([
        supabase.rpc('generate_customer_obligations', { p_customer_id: activeCustomer.id, p_year: currentYear }),
        supabase.rpc('generate_customer_obligations', { p_customer_id: activeCustomer.id, p_year: currentYear + 1 }),
      ])

      const { data } = await supabase
        .from('tax_obligation')
        .select('id, label, tax_type, due_date, amount, payment_mode, status')
        .eq('customer_id', activeCustomer.id)
        .order('due_date', { ascending: true })

      setObligations((data ?? []) as Obligation[])
      setLoading(false)
    }
    load()
  }, [activeCustomer])

  const dateRange = useMemo(() => {
    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() + fromOffset, 1)
    const end   = new Date(now.getFullYear(), now.getMonth() + toOffset + 1, 0)
    return { start, end }
  }, [fromOffset, toOffset])

  const filtered = useMemo(() =>
    obligations.filter(o => {
      const d = new Date(o.due_date + 'T00:00:00')
      if (d < dateRange.start || d > dateRange.end) return false
      if (typeFilter && o.tax_type !== typeFilter) return false
      return true
    })
  , [obligations, typeFilter, dateRange])

  const grouped = useMemo(() => {
    const map = new Map<string, Obligation[]>()
    filtered.forEach(o => {
      const k = monthKey(o.due_date)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(o)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#0F172A]">Échéances fiscales</h1>
        <div className="flex items-center gap-3">
          {/* Filtre type */}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="text-sm px-3 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] outline-none focus:border-[#1D4ED8] transition-colors">
            <option value="">Tous les types</option>
            {Object.entries(TAX_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          {/* Depuis */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#94A3B8] font-medium">Depuis</span>
            <select value={fromOffset} onChange={e => setFromOffset(Number(e.target.value))}
              className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] outline-none focus:border-[#1D4ED8] transition-colors">
              {[-12,-9,-6,-3,-2,-1,0].map(v => (
                <option key={v} value={v}>{v === 0 ? 'Mois actuel' : `M${v}`}</option>
              ))}
            </select>
          </div>
          {/* Jusqu'à */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#94A3B8] font-medium">Jusqu'à</span>
            <select value={toOffset} onChange={e => setToOffset(Number(e.target.value))}
              className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] outline-none focus:border-[#1D4ED8] transition-colors">
              {[1,2,3,6,12].map(v => (
                <option key={v} value={v}>M+{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-16 text-center text-sm text-[#94A3B8]">
          Aucune échéance sur cette période
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([key, rows]) => (
            <div key={key} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <span className="text-sm font-semibold text-[#0F172A]">{monthLabel(key)}</span>
                <span className="ml-2 text-xs text-[#94A3B8]">{rows.length} échéance{rows.length > 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    {['Obligation', 'Type', 'Date limite', 'Montant', 'Mode', 'Statut'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {rows.map(o => {
                    const dueDate = new Date(o.due_date + 'T00:00:00')
                    const overdue = dueDate < today && o.status === 'pending'
                    return (
                      <tr key={o.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-4 py-3 text-[#0F172A]">{o.label}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                            {TAX_LABELS[o.tax_type] ?? o.tax_type}
                          </span>
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap font-medium ${overdue ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>
                          {fmtDate(o.due_date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#0F172A]">
                          {o.amount != null ? fmtAmount(o.amount) : <span className="text-[#94A3B8] italic text-xs">En attente</span>}
                        </td>
                        <td className="px-4 py-3 text-[#64748B] text-xs">
                          {o.payment_mode ? (MODE_LABELS[o.payment_mode] ?? o.payment_mode) : <span className="text-[#CBD5E1]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${STATUS_STYLES[o.status] ?? ''}`}>
                            {STATUS_LABELS[o.status] ?? o.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
