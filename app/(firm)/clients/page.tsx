'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, User, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const COUNTRY_FLAGS: Record<string, string> = { FR: '🇫🇷', TN: '🇹🇳', MA: '🇲🇦' }
const COUNTRY_LABELS: Record<string, string> = { FR: 'France', TN: 'Tunisie', MA: 'Maroc' }

type CustomerRow = {
  id: string
  name: string
  country_code: string
  legal_entity: boolean
  tax_ref_main: string | null
  active: boolean
  onboarding_score: number
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626'
  const bg    = score >= 80 ? '#F0FDF4' : score >= 50 ? '#FFFBEB' : '#FEF2F2'
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
        style={{ color, backgroundColor: bg }}>
        {score}%
      </span>
    </div>
  )
}

export default function ClientsPage() {
  const router = useRouter()
  const [rows, setRows]       = useState<CustomerRow[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: ud } = await supabase
        .from('user_data').select('firm_id').eq('id', (await supabase.auth.getSession()).data.session?.user.id ?? '').single()
      if (!ud?.firm_id) { setLoading(false); return }

      const { data } = await supabase
        .from('customer')
        .select('id, name, country_code, legal_entity, tax_ref_main, active, onboarding_score')
        .eq('firm_id', ud.firm_id)
        .order('name', { ascending: true })
        .limit(500)

      if (data) setRows(data as CustomerRow[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = search.trim()
    ? rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : rows

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#0F172A]">Clients</h1>
        <button
          onClick={() => router.push('/clients/nouveau')}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] transition-colors"
        >
          <Plus size={15} />
          Nouveau client
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un client…"
          className="w-64 text-sm px-3 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
        />

        {filtered.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-16 text-center text-sm text-[#94A3B8]">
            {search ? 'Aucun résultat.' : 'Aucun client pour l\'instant.'}
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {['Nom', 'Type', 'Pays', 'N° fiscal', 'Statut', 'Complétion'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/clients/${c.id}`)}
                    className={`cursor-pointer hover:bg-[#F8FAFC] transition-colors ${i < filtered.length - 1 ? 'border-b border-[#E2E8F0]' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                        {c.legal_entity
                          ? <Building2 size={14} strokeWidth={1.5} className="text-[#94A3B8] shrink-0" />
                          : <User      size={14} strokeWidth={1.5} className="text-[#94A3B8] shrink-0" />
                        }
                        {c.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B]">
                      {c.legal_entity ? 'Personne morale' : 'Particulier'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B]">
                      {COUNTRY_FLAGS[c.country_code] ?? ''} {COUNTRY_LABELS[c.country_code] ?? c.country_code}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B] font-mono">
                      {c.tax_ref_main ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.active
                          ? 'bg-[#F0FDF4] text-[#059669] border border-[#BBF7D0]'
                          : 'bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]'
                      }`}>
                        {c.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={c.onboarding_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
