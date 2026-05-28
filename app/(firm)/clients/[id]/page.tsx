'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, User, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { SECTORS } from '@/lib/sectors'

const COUNTRIES = [
  { code: 'FR', label: 'France',  flag: '🇫🇷' },
  { code: 'TN', label: 'Tunisie', flag: '🇹🇳' },
  { code: 'MA', label: 'Maroc',   flag: '🇲🇦' },
]

type Customer = {
  id: string; name: string; legal_entity: boolean; country_code: string
  tax_ref_main: string | null; tax_ref_vat: string | null
  email: string | null; phone: string | null; website: string | null
  address: string | null; address_2: string | null; city: string | null; postal_code: string | null
  sector: string | null; sub_sector: string | null
  active: boolean
}

type CustomerUser = {
  id: string; first_name: string; last_name: string; active: boolean; admin: boolean; created_at: string
}

type InviteRow = {
  id: string; email: string; status: string; expires_at: string
}

type Tab = 'informations' | 'utilisateurs'

function Field({ label, value, readOnly, onChange }: {
  label: string; value: string; readOnly?: boolean; onChange?: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{label}</span>
      {readOnly ? (
        <span className="text-sm text-[#0F172A]">{value || '—'}</span>
      ) : (
        <input value={value} onChange={e => onChange?.(e.target.value)}
          className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors" />
      )}
    </div>
  )
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: { code: string; label: string; flag: string }[]; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors">
        {options.map(o => <option key={o.code} value={o.code}>{o.flag} {o.label}</option>)}
      </select>
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

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [tab, setTab]           = useState<Tab>('informations')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [users, setUsers]       = useState<CustomerUser[]>([])
  const [invites, setInvites]   = useState<InviteRow[]>([])
  const [firmId, setFirmId]     = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin]   = useState(false)
  const [loading, setLoading]   = useState(true)

  const [form, setForm]         = useState<Partial<Customer>>({})
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toggling, setToggling]   = useState(false)

  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviting, setInviting]         = useState(false)
  const [inviteSent, setInviteSent]     = useState(false)
  const [inviteError, setInviteError]   = useState('')
  const [cancelling, setCancelling]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)

      const { data: ud } = await supabase
        .from('user_data').select('firm_id, admin').eq('id', session.user.id).single()
      if (!ud?.firm_id) { setLoading(false); return }
      setFirmId(ud.firm_id)
      setIsAdmin(ud.admin ?? false)

      const [{ data: cust }, { data: ucData }, { data: invData }] = await Promise.all([
        supabase.from('customer').select('*').eq('id', id).eq('firm_id', ud.firm_id).single(),
        supabase
          .from('user_customer')
          .select('user_id, user_data(id, first_name, last_name, active, admin, created_at)')
          .eq('customer_id', id),
        supabase
          .from('user_invitation')
          .select('id, email, status, expires_at')
          .eq('customer_id', id)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString()),
      ])

      if (!cust) { router.push('/clients'); return }

      const c = cust as Customer
      setCustomer(c)
      setForm({
        name:         c.name,
        legal_entity: c.legal_entity,
        country_code: c.country_code,
        tax_ref_main: c.tax_ref_main ?? '',
        tax_ref_vat:  c.tax_ref_vat  ?? '',
        email:        c.email        ?? '',
        phone:        c.phone        ?? '',
        website:      c.website      ?? '',
        address:      c.address      ?? '',
        address_2:    c.address_2    ?? '',
        city:         c.city         ?? '',
        postal_code:  c.postal_code  ?? '',
        sector:       c.sector       ?? '',
        sub_sector:   c.sub_sector   ?? '',
      })

      if (ucData) {
        const mapped = ucData
          .map((r: { user_data: CustomerUser | CustomerUser[] | null }) =>
            Array.isArray(r.user_data) ? r.user_data[0] : r.user_data
          )
          .filter(Boolean) as CustomerUser[]
        setUsers(mapped)
      }

      if (invData) setInvites(invData as InviteRow[])
      setLoading(false)
    }
    load()
  }, [id, router])

  async function handleToggleActive() {
    if (!customer) return
    setToggling(true)
    const { error } = await supabase.from('customer').update({ active: !customer.active }).eq('id', customer.id)
    if (!error) setCustomer(prev => prev ? { ...prev, active: !prev.active } : prev)
    setToggling(false)
  }

  async function handleSave() {
    if (!customer) return
    setSaving(true); setSaved(false); setSaveError(null)
    const { error } = await supabase.from('customer').update({
      name:         form.name         || null,
      legal_entity: form.legal_entity ?? true,
      country_code: form.country_code || 'FR',
      tax_ref_main: form.tax_ref_main || null,
      tax_ref_vat:  form.tax_ref_vat  || null,
      email:        form.email        || null,
      phone:        form.phone        || null,
      website:      form.website      || null,
      address:      form.address      || null,
      address_2:    form.address_2    || null,
      city:         form.city         || null,
      postal_code:  form.postal_code  || null,
      sector:       form.sector       || null,
      sub_sector:   form.sub_sector   || null,
    }).eq('id', customer.id)
    if (error) setSaveError('Erreur lors de la sauvegarde')
    else { setSaved(true); setCustomer(prev => prev ? { ...prev, ...form as Customer } : prev) }
    setSaving(false)
  }

  async function handleInvite() {
    if (!customer || !currentUserId || !firmId) return
    setInviting(true); setInviteError('')
    const { data, error } = await supabase
      .from('user_invitation')
      .insert({
        firm_id:    firmId,
        customer_id: customer.id,
        email:      inviteEmail.trim(),
        role:       'customer',
        token:      crypto.randomUUID(),
        invited_by: currentUserId,
        status:     'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, email, status, expires_at')
      .single()

    if (error) {
      setInviteError(error.code === '23505' ? 'Invitation déjà en attente pour cet email.' : 'Erreur lors de l\'invitation.')
    } else {
      setInvites(prev => [data as InviteRow, ...prev])
      setInviteSent(true)
      setInviteEmail('')
    }
    setInviting(false)
  }

  async function handleToggleAdmin(userId: string, current: boolean) {
    const { error } = await supabase.from('user_data').update({ admin: !current }).eq('id', userId)
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, admin: !current } : u))
  }

  async function handleCancelInvite(invId: string) {
    setCancelling(invId)
    const { error } = await supabase.from('user_invitation').update({ status: 'revoked' }).eq('id', invId)
    if (!error) setInvites(prev => prev.filter(i => i.id !== invId))
    setCancelling(null)
  }

  function set(key: keyof Customer) {
    return (val: string) => { setForm(f => ({ ...f, [key]: val })); setSaved(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!customer) return null

  const Icon = customer.legal_entity ? Building2 : User

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/clients')}
          className="text-[#94A3B8] hover:text-[#0F172A] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <Icon size={18} strokeWidth={1.5} className="text-[#64748B]" />
        <h1 className="text-xl font-semibold text-[#0F172A]">{customer.name}</h1>
        <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          customer.active
            ? 'bg-[#F0FDF4] text-[#059669] border border-[#BBF7D0]'
            : 'bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]'
        }`}>
          {customer.active ? 'Actif' : 'Inactif'}
        </span>
        <button onClick={handleToggleActive} disabled={toggling}
          className={`ml-auto text-sm px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            customer.active
              ? 'border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]'
              : 'border-[#BBF7D0] text-[#059669] hover:bg-[#F0FDF4]'
          }`}>
          {toggling ? '…' : customer.active ? 'Désactiver' : 'Réactiver'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] mb-6">
        {(['informations', 'utilisateurs'] as Tab[]).map(t => {
          const labels: Record<Tab, string> = { informations: 'Informations', utilisateurs: 'Utilisateurs' }
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-[#1D4ED8] text-[#1D4ED8]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}>
              {labels[t]}
            </button>
          )
        })}
      </div>

      {/* Informations */}
      {tab === 'informations' && (
        <div className="flex flex-col gap-4">
          <Section title="Identité">
            <Field label="Nom" value={form.name ?? ''} onChange={set('name')} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Type</span>
              <div className="flex gap-3 pt-0.5">
                {[{ val: true, label: 'Personne morale' }, { val: false, label: 'Particulier' }].map(({ val, label }) => (
                  <label key={label} className="flex items-center gap-1.5 cursor-pointer text-sm text-[#0F172A]">
                    <input type="radio" checked={form.legal_entity === val}
                      onChange={() => { setForm(f => ({ ...f, legal_entity: val })); setSaved(false) }}
                      className="accent-[#1D4ED8] w-3.5 h-3.5 cursor-pointer" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <SelectField label="Pays" value={form.country_code ?? 'FR'} options={COUNTRIES}
              onChange={v => { setForm(f => ({ ...f, country_code: v })); setSaved(false) }} />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Secteur</span>
              <select value={form.sector ?? ''} onChange={e => { setForm(f => ({ ...f, sector: e.target.value, sub_sector: '' })); setSaved(false) }}
                className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors">
                <option value="">— Sélectionner —</option>
                {SECTORS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Sous-secteur</span>
              <select value={form.sub_sector ?? ''} onChange={e => { setForm(f => ({ ...f, sub_sector: e.target.value })); setSaved(false) }}
                disabled={!form.sector}
                className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors disabled:opacity-50">
                <option value="">— Sélectionner —</option>
                {SECTORS.find(s => s.label === form.sector)?.sub.map(ss => <option key={ss} value={ss}>{ss}</option>)}
              </select>
            </div>

            <Field label="Identifiant fiscal" value={form.tax_ref_main ?? ''} onChange={set('tax_ref_main')} />
            <Field label="Numéro TVA"         value={form.tax_ref_vat  ?? ''} onChange={set('tax_ref_vat')} />
          </Section>

          <Section title="Contact">
            <Field label="Email"     value={form.email   ?? ''} onChange={set('email')} />
            <Field label="Téléphone" value={form.phone   ?? ''} onChange={set('phone')} />
            <Field label="Site web"  value={form.website ?? ''} onChange={set('website')} />
          </Section>

          <Section title="Adresse">
            <Field label="Adresse"     value={form.address     ?? ''} onChange={set('address')} />
            <Field label="Complément"  value={form.address_2   ?? ''} onChange={set('address_2')} />
            <Field label="Code postal" value={form.postal_code ?? ''} onChange={set('postal_code')} />
            <Field label="Ville"       value={form.city        ?? ''} onChange={set('city')} />
          </Section>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {saved     && <span className="text-sm text-[#059669]">Modifications enregistrées</span>}
            {saveError && <span className="text-sm text-[#DC2626]">{saveError}</span>}
          </div>
        </div>
      )}

      {/* Utilisateurs */}
      {tab === 'utilisateurs' && (
        <div className="flex flex-col gap-6">
          {/* Users list */}
          {users.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Nom', 'Admin', 'Statut', 'Depuis'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} className={i < users.length - 1 ? 'border-b border-[#E2E8F0]' : ''}>
                      <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">
                        {`${u.first_name} ${u.last_name}`.trim() || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => isAdmin && handleToggleAdmin(u.id, u.admin)}
                          disabled={!isAdmin}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                            u.admin
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                              : 'bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0]'
                          } ${isAdmin ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}>
                          {u.admin ? 'Admin' : '—'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.active
                            ? 'bg-[#F0FDF4] text-[#059669] border border-[#BBF7D0]'
                            : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                        }`}>
                          {u.active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#94A3B8]">
                        {new Date(u.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending invitations */}
          {invites.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-[#0F172A] mb-3">Invitations en attente</p>
              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      {['Email', 'Expire le', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv, i) => (
                      <tr key={inv.id} className={i < invites.length - 1 ? 'border-b border-[#E2E8F0]' : ''}>
                        <td className="px-4 py-3 text-sm text-[#0F172A]">{inv.email}</td>
                        <td className="px-4 py-3 text-xs text-[#94A3B8]">
                          {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleCancelInvite(inv.id)} disabled={cancelling === inv.id}
                            className="text-xs text-[#DC2626] hover:underline disabled:opacity-40">
                            {cancelling === inv.id ? 'Annulation…' : 'Annuler'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invite form */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
            <p className="text-sm font-semibold text-[#0F172A] mb-1">Inviter l'accès portail</p>
            <p className="text-xs text-[#64748B] mb-4">Le client pourra déposer ses documents depuis son portail.</p>

            {inviteSent ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#059669]">Invitation créée.</span>
                <button onClick={() => setInviteSent(false)} className="text-sm text-[#1D4ED8] hover:underline">
                  Inviter un autre
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Email</span>
                  <input type="email" value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
                    placeholder="client@email.com"
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors" />
                </div>
                <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                  className="px-5 py-1.5 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {inviting ? 'Envoi…' : 'Inviter'}
                </button>
                {inviteError && <p className="text-xs text-[#DC2626] w-full">{inviteError}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
