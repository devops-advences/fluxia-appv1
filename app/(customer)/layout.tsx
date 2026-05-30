'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { CheckSquare, Upload, FolderOutput, Building2, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/Header'

const NAV = [
  { label: 'Mes tâches',        href: '/mes-taches',   icon: CheckSquare },
  { label: 'Mes documents',     href: '/mes-documents', icon: Upload },
  { label: 'Livrables cabinet', href: '/mes-livrables', icon: FolderOutput },
  { label: 'Ma société',        href: '/ma-societe',    icon: Building2 },
]

const FLAGS: Record<string, string> = { FR: '🇫🇷', TN: '🇹🇳', MA: '🇲🇦' }

type Info = {
  userName: string
  initials: string
  firmName: string
  firmCountry: string
  firmLogoUrl: string | null
  customerName: string
  customerCountry: string
}

export default function PortailLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) { router.push('/login'); return }

      const { data: ud } = await supabase
        .from('user_data')
        .select('role, first_name, last_name, firm_id')
        .eq('id', session.user.id)
        .single()
      if (!active) return
      if (!ud || ud.role !== 'customer') { router.push('/dashboard'); return }

      const fullName = `${ud.first_name} ${ud.last_name}`.trim()
      const initials = ((ud.first_name?.[0] ?? '') + (ud.last_name?.[0] ?? '')).toUpperCase() || '?'

      let firmName = '', firmCountry = '', firmLogoUrl: string | null = null, customerName = '', customerCountry = ''

      const [{ data: firm }, { data: uc }] = await Promise.all([
        ud.firm_id
          ? supabase.from('firm').select('name, country_code, logo_url').eq('id', ud.firm_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('user_customer').select('customer_id').eq('user_id', session.user.id).limit(1).maybeSingle(),
      ])

      const firmData = firm as { name: string; country_code: string; logo_url?: string | null } | null
      firmName    = firmData?.name ?? ''
      firmCountry = firmData?.country_code ?? ''
      firmLogoUrl = firmData?.logo_url ?? null

      if (uc?.customer_id) {
        const { data: cust } = await supabase.from('customer').select('name, country_code').eq('id', uc.customer_id).single()
        customerName    = (cust as { name: string; country_code: string } | null)?.name ?? ''
        customerCountry = (cust as { name: string; country_code: string } | null)?.country_code ?? ''
      }

      if (!active) return
      setInfo({ userName: fullName, initials, firmName, firmCountry, firmLogoUrl, customerName, customerCountry })
    }
    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') router.push('/login')
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">

      {/* Sidebar */}
      <aside className="w-56 h-screen flex flex-col bg-white border-r border-[#E2E8F0] fixed left-0 top-0">

        {/* Cab + Client context */}
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex flex-col items-center gap-1.5">
          {info.firmLogoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={info.firmLogoUrl} alt={info.firmName} className="max-h-8 max-w-[160px] object-contain" />
          )}
          {info.firmName && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#64748B] font-medium truncate">{info.firmName}</span>
              {info.firmCountry && <span className="text-sm">{FLAGS[info.firmCountry] ?? ''}</span>}
            </div>
          )}
          {info.customerName && (
            <div className="flex items-center gap-1.5 mt-0.5 pt-1.5 border-t border-[#F1F5F9] w-full justify-center">
              <span className="text-xs text-[#0F172A] font-semibold truncate">{info.customerName}</span>
              {info.customerCountry && <span className="text-sm">{FLAGS[info.customerCountry] ?? ''}</span>}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {NAV.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <li key={href}>
                  <Link href={href}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] font-medium'
                        : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                    }`}>
                    <Icon size={15} strokeWidth={1.8} />
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User + logout */}
        <div className="px-3 py-3 border-t border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white text-xs font-medium shrink-0">
                {info.initials}
              </div>
              <span className="text-xs text-[#64748B] truncate">{info.userName}</span>
            </div>
            <button onClick={handleLogout} className="text-[#94A3B8] hover:text-[#DC2626] transition-colors" title="Se déconnecter">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col ml-56">
        <Header href="/mes-documents/nouveau" label="Déposer un document" align="center" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
