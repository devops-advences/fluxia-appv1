'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [suspended, setSuspended] = useState(false)

  useEffect(() => {
    setSuspended(new URLSearchParams(window.location.search).get('suspended') === '1')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuspended(false)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    const { data: userData } = await supabase
      .from('user_data')
      .select('role, active')
      .eq('id', data.user.id)
      .single()

    if (!userData?.active) {
      await supabase.auth.signOut()
      setSuspended(true)
      setLoading(false)
      return
    }

    if (userData.role === 'customer') {
      router.push('/mes-taches')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 w-full max-w-sm shadow-sm">

        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-[#0F172A]">Flux</span>
          <span className="text-2xl font-bold text-[#1D4ED8]">IA</span>
          <p className="text-sm text-[#64748B] mt-1">Pré-comptabilité</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#0F172A] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="votre@email.com"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#0F172A] mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
            />
          </div>

          {suspended && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2.5">
              <p className="text-sm text-[#DC2626] font-medium">Compte suspendu</p>
              <p className="text-xs text-[#DC2626] mt-0.5">Contactez votre cabinet pour réactiver votre accès.</p>
            </div>
          )}
          {error && (
            <p className="text-sm text-[#DC2626]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1D4ED8] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#1e40af] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p className="text-xs text-[#94A3B8] text-center mt-5">
          Pas encore de compte ?{' '}
          <a href="/register" className="text-[#1D4ED8] font-medium hover:underline">Créer un cabinet</a>
        </p>
      </div>
    </div>
  )
}
