'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { SECTORS } from '@/lib/sectors'

const COUNTRIES = [
  { code: 'FR', label: 'France',  flag: '🇫🇷' },
  { code: 'TN', label: 'Tunisie', flag: '🇹🇳' },
  { code: 'MA', label: 'Maroc',   flag: '🇲🇦' },
]

const cls = "text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors w-full"

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cls} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
      <p className="text-sm font-semibold text-[#0F172A] mb-4">{title}</p>
      <div className="grid grid-cols-3 gap-x-8 gap-y-5">{children}</div>
    </div>
  )
}

export default function NouveauClientPage() {
  const router = useRouter()

  const [legalEntity, setLegalEntity] = useState(true)
  const [name, setName]               = useState('')
  const [countryCode, setCountryCode] = useState('FR')
  const [taxRefMain, setTaxRefMain]   = useState('')
  const [taxRefVat, setTaxRefVat]     = useState('')
  const [email, setEmail]             = useState('')
  const [phone, setPhone]             = useState('')
  const [website, setWebsite]         = useState('')
  const [address, setAddress]         = useState('')
  const [address2, setAddress2]       = useState('')
  const [postalCode, setPostalCode]   = useState('')
  const [city, setCity]               = useState('')
  const [sector, setSector]           = useState('')
  const [subSector, setSubSector]     = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Non authentifié'); setLoading(false); return }

    const { data: ud } = await supabase
      .from('user_data').select('firm_id').eq('id', session.user.id).single()
    if (!ud?.firm_id) { setError('Cabinet introuvable'); setLoading(false); return }

    const { error: insertError } = await supabase.from('customer').insert({
      firm_id:      ud.firm_id,
      name:         name.trim(),
      legal_entity: legalEntity,
      country_code: countryCode,
      tax_ref_main: taxRefMain   || null,
      tax_ref_vat:  taxRefVat    || null,
      email:        email        || null,
      phone:        phone        || null,
      website:      website      || null,
      address:      address      || null,
      address_2:    address2     || null,
      postal_code:  postalCode   || null,
      city:         city         || null,
      sector:       sector       || null,
      sub_sector:   subSector    || null,
      active:       true,
    })

    if (insertError) { setError('Erreur lors de la création.'); setLoading(false); return }
    router.push('/clients')
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">Nouveau client</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <Section title="Identité">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Nom</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              required maxLength={120} placeholder="Ex : Dupont SARL"
              className={cls} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Type</span>
            <div className="flex gap-3 pt-0.5">
              {[{ val: true, label: 'Personne morale' }, { val: false, label: 'Particulier' }].map(({ val, label }) => (
                <label key={label} className="flex items-center gap-1.5 cursor-pointer text-sm text-[#0F172A]">
                  <input type="radio" checked={legalEntity === val}
                    onChange={() => setLegalEntity(val)}
                    className="accent-[#1D4ED8] w-3.5 h-3.5 cursor-pointer" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Pays</span>
            <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className={cls}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Secteur</span>
            <select value={sector} onChange={e => { setSector(e.target.value); setSubSector('') }} className={cls}>
              <option value="">— Sélectionner —</option>
              {SECTORS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Sous-secteur</span>
            <select value={subSector} onChange={e => setSubSector(e.target.value)} disabled={!sector} className={cls}>
              <option value="">— Sélectionner —</option>
              {SECTORS.find(s => s.label === sector)?.sub.map(ss => <option key={ss} value={ss}>{ss}</option>)}
            </select>
          </div>

          <Field label="Identifiant fiscal" value={taxRefMain} onChange={setTaxRefMain} placeholder="Ex : 1234567A" />
          <Field label="Numéro TVA"         value={taxRefVat}  onChange={setTaxRefVat}  placeholder="Ex : FR12345678901" />
        </Section>

        <Section title="Contact">
          <Field label="Email"     value={email}   onChange={setEmail}   type="email" placeholder="contact@client.com" />
          <Field label="Téléphone" value={phone}   onChange={setPhone}   placeholder="+33 6 …" />
          <Field label="Site web"  value={website} onChange={setWebsite} placeholder="https://…" />
        </Section>

        <Section title="Adresse">
          <Field label="Adresse"     value={address}    onChange={setAddress}    />
          <Field label="Complément"  value={address2}   onChange={setAddress2}   />
          <Field label="Code postal" value={postalCode} onChange={setPostalCode} />
          <Field label="Ville"       value={city}       onChange={setCity}       />
        </Section>

        {error && <p className="text-sm text-[#DC2626]">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.push('/clients')}
            className="px-4 py-2 text-sm text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={loading || !name.trim()}
            className="px-5 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? 'Création…' : 'Créer le client'}
          </button>
        </div>
      </form>
    </div>
  )
}
