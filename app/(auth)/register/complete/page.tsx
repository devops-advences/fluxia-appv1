'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Status = 'checking' | 'creating' | 'error'

export default function RegisterCompletePage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError]   = useState('')

  useEffect(() => {
    let cancelled = false

    async function run() {
      // Laisse le client Supabase parser le hash (#access_token=...) de l'URL de confirmation
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        if (!cancelled) {
          setStatus('error')
          setError('Lien de confirmation invalide ou expiré. Réessayez de vous connecter.')
        }
        return
      }

      const { data: existing } = await supabase
        .from('user_data').select('id').eq('id', session.user.id).maybeSingle()

      if (existing) {
        router.push('/dashboard')
        return
      }

      const meta = session.user.user_metadata as {
        firm_name?: string
        slug?: string
        country_code?: string
        first_name?: string
        last_name?: string
      }

      if (!meta.firm_name || !meta.slug || !meta.country_code) {
        if (!cancelled) {
          setStatus('error')
          setError("Informations du cabinet introuvables. Contactez le support.")
        }
        return
      }

      if (!cancelled) setStatus('creating')

      const { error: rpcError } = await supabase.rpc('create_cabinet', {
        p_firm_name:    meta.firm_name,
        p_slug:         meta.slug,
        p_country_code: meta.country_code,
        p_first_name:   meta.first_name ?? '',
        p_last_name:    meta.last_name ?? '',
      })

      if (rpcError) {
        if (!cancelled) {
          setStatus('error')
          setError('Erreur lors de la création du cabinet : ' + rpcError.message)
        }
        return
      }

      router.push('/dashboard')
    }

    run()
    return () => { cancelled = true }
  }, [router])

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 w-full max-w-sm shadow-sm text-center">
        <div className="mb-4">
          <span className="text-2xl font-bold text-[#0F172A]">Flux</span>
          <span className="text-2xl font-bold text-[#1D4ED8]">IA</span>
        </div>

        {status !== 'error' ? (
          <p className="text-sm text-[#64748B]">
            {status === 'checking' ? 'Confirmation en cours…' : 'Création de votre cabinet…'}
          </p>
        ) : (
          <>
            <p className="text-sm text-[#DC2626] mb-4">{error}</p>
            <a href="/login" className="text-sm text-[#1D4ED8] font-medium hover:underline">
              Retour à la connexion
            </a>
          </>
        )}
      </div>
    </div>
  )
}
