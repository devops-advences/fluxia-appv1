'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { CheckSquare, Upload, FolderOutput, CalendarClock, Building2, LogOut, UserCircle, User } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import Header from '@/components/shared/Header'
import { CustomerContext, CustomerEntity } from '@/lib/CustomerContext'

const NAV = [
  { label: 'Mes tâches',         href: '/mes-taches',    icon: CheckSquare },
  { label: 'Mes documents',      href: '/mes-documents',  icon: Upload },
  { label: 'Livrables cabinet',  href: '/mes-livrables',  icon: FolderOutput },
  { label: 'Échéances fiscales', href: '/mes-echeances',  icon: CalendarClock },
  { label: 'Ma société',         href: '/ma-societe',     icon: Building2 },
  { label: 'Mon profil',         href: '/mon-compte',     icon: UserCircle },
]

const FLAGS: Record<string, string> = { FR: '🇫🇷', TN: '🇹🇳', MA: '🇲🇦' }

type FirmInfo = {
  firmName: string
  firmCountry: string
  firmLogoUrl: string | null
  userName: string
  initials: string
  avatarUrl: string | null
}

export default function PortailLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [firmInfo, setFirmInfo]               = useState<FirmInfo | null>(null)
  const [customers, setCustomers]             = useState<CustomerEntity[]>([])
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null)

  const activeCustomer = useMemo(
    () => customers.find(c => c.id === activeCustomerId) ?? null,
    [customers, activeCustomerId]
  )

  useEffect(() => {
    let active = true

    async function load() {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (!active) return
      if (sessionError || !session) { router.push('/login'); return }

      const { data: ud } = await supabase
        .from('user_data')
        .select('role, first_name, last_name, firm_id, avatar_url, active')
        .eq('id', session.user.id)
        .single()
      if (!active) return
      if (!ud || ud.role !== 'customer') { router.push('/dashboard'); return }
      if ((ud as { active?: boolean }).active === false) {
        await supabase.auth.signOut()
        router.push('/login?suspended=1')
        return
      }

      const fullName = `${ud.first_name} ${ud.last_name}`.trim()
      const initials = ((ud.first_name?.[0] ?? '') + (ud.last_name?.[0] ?? '')).toUpperCase() || '?'
      const avatarPath = (ud as { avatar_url?: string | null }).avatar_url

      // Firm info, avatar URL et entités en parallèle
      const [firmResult, avatarResult, ucResult] = await Promise.all([
        ud.firm_id
          ? supabase.from('firm').select('name, country_code, logo_url').eq('id', ud.firm_id).single()
          : Promise.resolve({ data: null }),
        avatarPath
          ? supabase.storage.from('avatars').createSignedUrl(avatarPath, 3600)
          : Promise.resolve({ data: null }),
        supabase.from('user_customer').select('customer_id, admin').eq('user_id', session.user.id),
      ])

      const f = firmResult.data as { name: string; country_code: string; logo_url?: string | null } | null
      const firmName    = f?.name ?? ''
      const firmCountry = f?.country_code ?? ''
      const firmLogoUrl: string | null = f?.logo_url ?? null
      const avatarUrl: string | null = (avatarResult.data as { signedUrl?: string } | null)?.signedUrl ?? null
      const ucRows = ucResult.data

      if (ucRows && ucRows.length > 0) {
        const ids = ucRows.map((r: { customer_id: string; admin: boolean }) => r.customer_id)
        const { data: custData } = await supabase
          .from('customer')
          .select('id, name, country_code, legal_entity, firm_id')
          .in('id', ids)

        const entities: CustomerEntity[] = ((custData ?? []) as {
          id: string; name: string; country_code: string; legal_entity: boolean; firm_id: string
        }[]).map(c => ({
          ...c,
          admin: (ucRows as { customer_id: string; admin: boolean }[]).find(r => r.customer_id === c.id)?.admin ?? false,
        }))

        if (!active) return
        setCustomers(entities)
        setActiveCustomerId(entities[0]?.id ?? null)
      }

      if (!active) return
      setFirmInfo({ firmName, firmCountry, firmLogoUrl, userName: fullName, initials, avatarUrl })
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) router.push('/login')
    })

    return () => { active = false; subscription.unsubscribe() }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!firmInfo || !activeCustomer) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <CustomerContext.Provider value={{ activeCustomer, customers, setActiveCustomerId }}>
      <div className="flex min-h-screen bg-[#F8FAFC]">

        {/* Sidebar */}
        <aside className="w-56 h-screen flex flex-col bg-white border-r border-[#E2E8F0] fixed left-0 top-0">

          {/* Firm + entity context */}
          <div className="px-4 py-3 border-b border-[#E2E8F0] flex flex-col items-center gap-1.5">
            {firmInfo.firmLogoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={firmInfo.firmLogoUrl} alt={firmInfo.firmName} className="max-h-8 max-w-[160px] object-contain" />
            )}
            {firmInfo.firmName && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#64748B] font-medium truncate">{firmInfo.firmName}</span>
                {firmInfo.firmCountry && <span className="text-sm">{FLAGS[firmInfo.firmCountry] ?? ''}</span>}
              </div>
            )}

            {/* Sélecteur entité */}
            <div className="mt-0.5 pt-1.5 border-t border-[#F1F5F9] w-full">
              {customers.length === 1 ? (
                <div className="flex items-center justify-center gap-1.5">
                  {activeCustomer.legal_entity
                    ? <Building2 size={12} className="text-[#94A3B8] shrink-0" />
                    : <User       size={12} className="text-[#94A3B8] shrink-0" />
                  }
                  <span className="text-xs text-[#0F172A] font-semibold truncate">{activeCustomer.name}</span>
                  {activeCustomer.country_code && <span className="text-sm">{FLAGS[activeCustomer.country_code] ?? ''}</span>}
                </div>
              ) : (
                <select
                  value={activeCustomerId ?? ''}
                  onChange={e => setActiveCustomerId(e.target.value)}
                  className="w-full text-xs font-semibold text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-1.5 outline-none focus:border-[#1D4ED8] transition-colors cursor-pointer"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.legal_entity ? '🏢' : '👤'} {c.name} {FLAGS[c.country_code] ?? ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-0.5">
              {NAV.map(({ label, href, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <li key={href}>
                    <Link href={href}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                        isActive
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
                {firmInfo.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={firmInfo.avatarUrl} alt={firmInfo.userName} className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-[#E2E8F0]" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                    {firmInfo.initials}
                  </div>
                )}
                <span className="text-xs text-[#64748B] truncate">{firmInfo.userName}</span>
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
    </CustomerContext.Provider>
  )
}
