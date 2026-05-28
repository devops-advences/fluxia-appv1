'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { CheckSquare, Upload, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const NAV = [
  { label: 'Mes tâches',    href: '/mes-taches',    icon: CheckSquare },
  { label: 'Mes documents', href: '/mes-documents',  icon: Upload },
]

type Info = {
  userName: string
  initials: string
  firmName: string
  customerName: string
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

      let firmName = '', customerName = ''

      const [{ data: firm }, { data: uc }] = await Promise.all([
        ud.firm_id
          ? supabase.from('firm').select('name').eq('id', ud.firm_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('user_customer').select('customer_id').eq('user_id', session.user.id).limit(1).maybeSingle(),
      ])

      firmName = firm?.name ?? ''

      if (uc?.customer_id) {
        const { data: cust } = await supabase.from('customer').select('name').eq('id', uc.customer_id).single()
        customerName = cust?.name ?? ''
      }

      if (!active) return
      setInfo({ userName: fullName, initials, firmName, customerName })
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

        {/* Cabinet + Client context */}
        <div className="px-4 py-4 border-b border-[#E2E8F0] flex flex-col gap-1.5">
          {info.firmName && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#94A3B8] w-8 shrink-0">Cab</span>
              <span className="text-xs text-[#64748B] font-medium truncate">{info.firmName}</span>
            </div>
          )}
          {info.customerName && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#94A3B8] w-8 shrink-0">Client</span>
              <span className="text-xs text-[#0F172A] font-semibold truncate">{info.customerName}</span>
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
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
