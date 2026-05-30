'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import CabUploadWizard from './_components/CabUploadWizard'
import type { CabWizardContext } from './_components/types'

export default function NouveauDocumentCabPage() {
  const router = useRouter()
  const [ctx,     setCtx]     = useState<CabWizardContext | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) { router.push('/login'); return }

      const { data: ud } = await supabase
        .from('user_data').select('firm_id, role').eq('id', session.user.id).single()
      if (!active) return
      if (!ud?.firm_id || ud.role !== 'firm') { router.push('/dashboard'); return }

      const [firmRes, custsRes] = await Promise.all([
        supabase.from('firm').select('name').eq('id', ud.firm_id).single(),
        supabase.from('customer').select('id, name, country_code').eq('firm_id', ud.firm_id).eq('active', true).order('name'),
      ])
      if (!active) return
      if (!firmRes.data) { setError('Cabinet introuvable.'); setLoading(false); return }

      setCtx({
        firmName:    firmRes.data.name,
        customers:   (custsRes.data ?? []) as { id: string; name: string; country_code: string }[],
        accessToken: session.access_token,
      })
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !ctx) {
    return (
      <div style={{ padding: '16px', fontSize: '13px', color: '#DC2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
        {error ?? 'Impossible de charger cet espace.'}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 104px)' }}>
      <CabUploadWizard {...ctx} />
    </div>
  )
}
