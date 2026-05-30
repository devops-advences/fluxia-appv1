'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

type UserInfo = {
  firmName: string
  countryCode: string
  userName: string
  logoUrl: string | null
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)

  useEffect(() => {
    let active = true

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!active) return

      if (!session) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('user_data')
        .select('role, first_name, last_name, firm_id')
        .eq('id', session.user.id)
        .single()

      if (!active) return

      if (error || !data) {
        router.push('/login')
        return
      }

      if (data.role === 'customer') {
        router.push('/mes-taches')
        return
      }

      let firmName = ''
      let countryCode = 'FR'
      let logoUrl: string | null = null

      if (data.firm_id) {
        const { data: firm } = await supabase
          .from('firm')
          .select('name, country_code, logo_url')
          .eq('id', data.firm_id)
          .single()
        firmName = (firm as { name: string; country_code: string; logo_url: string | null } | null)?.name ?? ''
        countryCode = (firm as { name: string; country_code: string; logo_url: string | null } | null)?.country_code ?? 'FR'
        logoUrl = (firm as { name: string; country_code: string; logo_url: string | null } | null)?.logo_url ?? null
      }

      if (!active) return
      setUserInfo({
        firmName,
        countryCode,
        logoUrl,
        userName: `${data.first_name} ${data.last_name}`,
      })
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router])

  if (!userInfo) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar {...userInfo} />
      <div className="flex-1 flex flex-col ml-56">
        <Header align="center" />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
