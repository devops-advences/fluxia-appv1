'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import UploadWizard from './_components/UploadWizard'
import type { WizardContext } from './_components/types'

export default function NouveauDocumentPage() {
  const router = useRouter()
  const [ctx, setCtx]       = useState<WizardContext | null>(null)
  const [error, setError]   = useState<string | null>(null)
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
      if (!ud?.firm_id || ud.role !== 'customer') { router.push('/mes-documents'); return }

      const [firmRes, ucRes] = await Promise.all([
        supabase.from('firm').select('name').eq('id', ud.firm_id).single(),
        supabase.from('user_customer').select('customer_id').eq('user_id', session.user.id).limit(1).single(),
      ])
      if (!active) return
      if (!firmRes.data || !ucRes.data) { setError('Configuration introuvable.'); setLoading(false); return }

      const customerId = ucRes.data.customer_id
      const [custRes, docsRes] = await Promise.all([
        supabase.from('customer').select('name').eq('id', customerId).single(),
        supabase.from('document').select('filename').eq('customer_id', customerId).not('filename', 'is', null),
      ])
      if (!active) return
      if (!custRes.data) { setError('Client introuvable.'); setLoading(false); return }

      const existingFilenames = ((docsRes.data ?? []) as { filename: string | null }[])
        .map(d => d.filename)
        .filter((n): n is string => n !== null)

      setCtx({
        customerId,
        customerName:      custRes.data.name,
        cabinetName:       firmRes.data.name,
        existingFilenames,
        accessToken:       session.access_token,
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      <UploadWizard {...ctx} />
    </div>
  )
}
