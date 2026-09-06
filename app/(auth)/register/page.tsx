'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const COUNTRIES = [
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'TN', label: '🇹🇳 Tunisie' },
  { code: 'MA', label: '🇲🇦 Maroc' },
]

const cls = "w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[#64748B]">{label}</label>
      {children}
    </div>
  )
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken'

export default function RegisterPage() {
  const router = useRouter()

  const [firstName, setFirstName]     = useState('')
  const [lastName, setLastName]       = useState('')
  const [firmName, setFirmName]       = useState('')
  const [slug, setSlug]               = useState('')
  const [countryCode, setCountryCode] = useState('FR')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [slugStatus, setSlugStatus]   = useState<SlugStatus>('idle')
  const [showPassword, setShowPassword]   = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)

  const slugEditedRef = useRef(false)
  const slugTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('https://www.cloudflare.com/cdn-cgi/trace')
      .then(r => r.text())
      .then(text => {
        const match = text.match(/loc=([A-Z]{2})/)
        const code  = match?.[1]
        if (code && ['FR', 'TN', 'MA'].includes(code)) setCountryCode(code)
      })
      .catch(() => {})
  }, [])

  useEffect(() => () => { if (slugTimerRef.current) clearTimeout(slugTimerRef.current) }, [])

  async function checkSlug(value: string) {
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current)
    if (!value || value.length < 2) { setSlugStatus('idle'); return }
    setSlugStatus('checking')
    slugTimerRef.current = setTimeout(async () => {
      const { data } = await supabase.from('firm').select('id').eq('slug', value).maybeSingle()
      setSlugStatus(data ? 'taken' : 'available')
    }, 500)
  }

  function handleFirmNameChange(val: string) {
    setFirmName(val)
    if (!slugEditedRef.current) {
      const s = toSlug(val)
      setSlug(s)
      checkSlug(s)
    }
  }

  function handleSlugChange(val: string) {
    slugEditedRef.current = true
    const s = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40)
    setSlug(s)
    checkSlug(s)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (slugStatus === 'taken') { setError('Cet identifiant est déjà pris.'); return }

    setLoading(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError || !signUpData.user) {
      setError(signUpError?.message ?? 'Erreur lors de la création du compte.')
      setLoading(false)
      return
    }

    // Si email confirmation requise, pas de session immédiate
    if (!signUpData.session) {
      setError('Vérifiez votre email pour confirmer votre compte.')
      setLoading(false)
      return
    }

    const { error: rpcError } = await supabase.rpc('create_cabinet', {
      p_firm_name:    firmName.trim(),
      p_slug:         slug,
      p_country_code: countryCode,
      p_first_name:   firstName.trim(),
      p_last_name:    lastName.trim(),
    })

    if (rpcError) {
      setError('Erreur lors de la création du cabinet : ' + rpcError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-10">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 w-full max-w-md shadow-sm">

        <div className="flex items-center gap-2 mb-8">
          <span className="w-2 h-2 rounded-full bg-[#1D4ED8]" />
          <span className="text-lg font-bold text-[#0F172A] tracking-tight">
            Flux<span className="text-[#1D4ED8]">IA</span>
          </span>
        </div>

        <h1 className="text-base font-semibold text-[#0F172A] mb-1">Créer votre cabinet</h1>
        <p className="text-sm text-[#94A3B8] mb-7">Inscrivez votre cabinet comptable sur FluxIA</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Prénom / Nom */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                required maxLength={60} placeholder="Jean" className={cls} />
            </Field>
            <Field label="Nom">
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                required maxLength={60} placeholder="Dupont" className={cls} />
            </Field>
          </div>

          {/* Nom cabinet */}
          <Field label="Nom du cabinet">
            <input type="text" value={firmName} onChange={e => handleFirmNameChange(e.target.value)}
              required maxLength={120} placeholder="Cabinet Dupont & Associés" className={cls} />
          </Field>

          {/* Slug */}
          <Field label="Identifiant unique">
            <div className="flex items-center border border-[#E2E8F0] rounded-lg overflow-hidden focus-within:border-[#1D4ED8] focus-within:ring-1 focus-within:ring-[#1D4ED8] transition-colors">
              <span className="px-3 py-2 text-xs text-[#94A3B8] bg-[#F8FAFC] border-r border-[#E2E8F0] whitespace-nowrap select-none">
                fluxia /
              </span>
              <input type="text" value={slug} onChange={e => handleSlugChange(e.target.value)}
                required minLength={2} maxLength={40} placeholder="cabinet-dupont"
                className="flex-1 px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none bg-white" />
            </div>
            {slugStatus === 'idle' && (
              <p className="text-[11px] text-[#94A3B8]">Lettres minuscules, chiffres et underscores</p>
            )}
            {slugStatus === 'checking' && <p className="text-[11px] text-[#94A3B8]">Vérification…</p>}
            {slugStatus === 'available' && <p className="text-[11px] text-[#059669]">✓ Identifiant disponible</p>}
            {slugStatus === 'taken'     && <p className="text-[11px] text-[#DC2626]">✗ Identifiant déjà pris</p>}
          </Field>

          {/* Pays */}
          <Field label="Pays">
            <select value={countryCode} onChange={e => setCountryCode(e.target.value)} required className={cls}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>

          {/* Séparateur */}
          <div className="border-t border-[#E2E8F0] pt-4 flex flex-col gap-3">
            <p className="text-xs font-medium text-[#64748B]">Identifiants de connexion</p>

            <Field label="Email professionnel">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="vous@cabinet.com" className={cls} />
            </Field>

            <Field label="Mot de passe">
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8} placeholder="8 caractères minimum" className={`${cls} pr-9`} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <Field label="Confirmer le mot de passe">
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                  required minLength={8} placeholder="Répétez le mot de passe"
                  className={`${cls} pr-9 ${confirm && confirm !== password ? 'border-[#FCA5A5] focus:border-[#DC2626] focus:ring-[#DC2626]' : ''}`} />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors">
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || slugStatus === 'taken'}
            className="w-full py-2.5 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1">
            {loading ? 'Création en cours…' : 'Créer mon cabinet'}
          </button>
        </form>

        <p className="text-xs text-[#94A3B8] text-center mt-5">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-[#1D4ED8] font-medium hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
