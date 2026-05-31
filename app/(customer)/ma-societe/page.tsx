'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import type { UserCustomerRow } from '@/lib/db-types'

type CustomerData = {
  id: string
  name: string
  firm_id: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  address_2: string | null
  city: string | null
  postal_code: string | null
  country_code: string
  tax_ref_main: string | null
  tax_ref_vat: string | null
}

type UserRow = {
  id: string
  first_name: string
  last_name: string
  active: boolean
  admin: boolean
  created_at: string
}

type InviteRow = {
  id: string
  email: string
  status: string
  expires_at: string
  created_at: string
}

type Tab = 'donnees' | 'utilisateurs' | 'comptes'

type BankRow     = { id: string; name: string; logo_url: string | null }
type BankAccount = { id: string; bank_id: string; bank: BankRow; type: string; name: string | null; iban: string | null; bic: string | null; currency_code: string }

const TYPE_LABELS: Record<string, string> = { current: 'Compte courant', savings: 'Épargne', term: 'Dépôt à terme', foreign: 'Devises' }
const CURRENCIES = ['EUR', 'USD', 'GBP', 'MAD', 'TND', 'DZD', 'CHF']
function maskIban(iban: string | null) {
  if (!iban) return '—'
  const c = iban.replace(/\s/g, '')
  return c.length <= 8 ? iban : c.slice(0, 4) + ' •••• •••• ' + c.slice(-4)
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
      <p className="text-sm font-semibold text-[#0F172A] mb-4">{title}</p>
      <div className="grid grid-cols-3 gap-x-8 gap-y-5">{children}</div>
    </div>
  )
}

export default function MaSocietePage() {
  const [tab, setTab]             = useState<Tab>('donnees')
  const [customer, setCustomer]   = useState<CustomerData | null>(null)
  const [isAdmin, setIsAdmin]     = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [users, setUsers]         = useState<UserRow[]>([])
  const [invites, setInvites]     = useState<InviteRow[]>([])
  const [loading, setLoading]     = useState(true)

  const [form, setForm]           = useState<Partial<CustomerData>>({})
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviting, setInviting]         = useState(false)
  const [inviteSent, setInviteSent]     = useState(false)
  const [inviteError, setInviteError]   = useState('')
  const [cancelling, setCancelling]         = useState<string | null>(null)
  const [togglingAdmin, setTogglingAdmin]   = useState<string | null>(null)
  const [togglingActive, setTogglingActive] = useState<string | null>(null)

  const [banks, setBanks]                   = useState<BankRow[]>([])
  const [bankAccounts, setBankAccounts]     = useState<BankAccount[]>([])
  const [customerId, setCustomerId]         = useState<string | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [addForm, setAddForm]               = useState({ bank_id: '', type: 'current', name: '', iban: '', bic: '', currency_code: 'EUR' })
  const [addSaving, setAddSaving]           = useState(false)
  const [deletingAccount, setDeletingAccount]           = useState<string | null>(null)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<string | null>(null)

  // Auto-sélectionne la première banque dès qu'elles chargent
  useEffect(() => {
    if (banks.length > 0 && !addForm.bank_id) {
      setAddForm(f => ({ ...f, bank_id: banks[0].id }))
    }
  }, [banks])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)

      const { data: uc } = await supabase
        .from('user_customer').select('customer_id, admin').eq('user_id', session.user.id).limit(1).single()
      if (!uc?.customer_id) { setLoading(false); return }
      setIsAdmin(!!uc.admin)

      const [{ data: custData }, { data: ucData }, { data: invData }] = await Promise.all([
        supabase.from('customer').select('id, name, firm_id, email, phone, website, address, address_2, city, postal_code, country_code, tax_ref_main, tax_ref_vat').eq('id', uc.customer_id).single(),
        supabase.from('user_customer').select('admin, created_at, user_data:user_id(id, first_name, last_name, active)').eq('customer_id', uc.customer_id),
        supabase.from('user_invitation').select('id, email, status, expires_at, created_at').eq('customer_id', uc.customer_id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
      ])

      if (custData) {
        const c = custData as CustomerData
        setCustomer(c)
        setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', website: c.website ?? '', address: c.address ?? '', address_2: c.address_2 ?? '', city: c.city ?? '', postal_code: c.postal_code ?? '', tax_ref_main: c.tax_ref_main ?? '', tax_ref_vat: c.tax_ref_vat ?? '' })

        // Banques + comptes
        setCustomerId(uc.customer_id)
        const [{ data: banksData }, { data: accountsData }] = await Promise.all([
          supabase.from('bank').select('id, name, logo_url').eq('country_code', c.country_code).eq('active', true).order('rank'),
          supabase.from('customer_bank_account')
            .select('id, bank_id, type, name, iban, bic, currency_code, bank:bank_id(id, name, logo_url)')
            .eq('customer_id', uc.customer_id).order('created_at'),
        ])
        if (banksData) {
          setBanks(banksData as BankRow[])
          setAddForm(f => ({ ...f, bank_id: banksData[0]?.id ?? '' }))
        }
        if (accountsData) setBankAccounts(accountsData as unknown as BankAccount[])
      }

      if (ucData) {
        const rows = (ucData as unknown as UserCustomerRow[])
          .map(r => ({ ...r.user_data, admin: r.admin, created_at: r.created_at }))
          .filter(Boolean)
        setUsers(rows as UserRow[])
      }

      if (invData) setInvites(invData as InviteRow[])
      setLoading(false)
    }
    load()
  }, [])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function handleSave() {
    setSaving(true); setSaved(false); setSaveError(null)
    const token = await getToken()
    const res = await fetch('/api/customer/profile', {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) setSaved(true)
    else setSaveError('Erreur lors de la sauvegarde')
    setSaving(false)
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteError('')
    const token = await getToken()
    const res = await fetch('/api/customer/invite', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    if (res.ok) {
      const { invite } = await res.json() as { invite: InviteRow }
      setInvites(prev => [invite, ...prev])
      setInviteSent(true)
      setInviteEmail('')
    } else {
      const { error } = await res.json() as { error: string }
      setInviteError(error ?? 'Erreur lors de l\'invitation')
    }
    setInviting(false)
  }

  async function handleToggleAdmin(userId: string, current: boolean) {
    setTogglingAdmin(userId)
    const token = await getToken()
    const res = await fetch(`/api/customer/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin: !current }),
    })
    if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, admin: !current } : u))
    setTogglingAdmin(null)
  }

  async function handleToggleUserActive(userId: string, current: boolean) {
    setTogglingActive(userId)
    const token = await getToken()
    const res = await fetch(`/api/customer/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !current }),
    })
    if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !current } : u))
    setTogglingActive(null)
  }

  async function handleCancelInvite(id: string) {
    setCancelling(id)
    const token = await getToken()
    await fetch('/api/customer/invite', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setInvites(prev => prev.filter(i => i.id !== id))
    setCancelling(null)
  }

  function set(key: keyof CustomerData) {
    return (val: string) => { setForm(f => ({ ...f, [key]: val })); setSaved(false) }
  }

  async function handleAddAccount() {
    if (!customerId || !customer?.firm_id || !addForm.bank_id) return
    setAddSaving(true)
    const { data, error } = await supabase
      .from('customer_bank_account')
      .insert({ firm_id: customer.firm_id, customer_id: customerId, bank_id: addForm.bank_id, type: addForm.type, name: addForm.name || null, iban: addForm.iban || null, bic: addForm.bic || null, currency_code: addForm.currency_code })
      .select('id, bank_id, type, name, iban, bic, currency_code, bank:bank_id(id, name, logo_url)')
      .single()
    if (!error && data) {
      setBankAccounts(prev => [...prev, data as unknown as BankAccount])
      setAddForm(f => ({ ...f, name: '', iban: '', bic: '', type: 'current', currency_code: 'EUR' }))
      setShowAddAccount(false)
    }
    setAddSaving(false)
  }

  async function handleDeleteAccount(accountId: string) {
    setDeletingAccount(accountId)
    setConfirmDeleteAccount(null)
    const { error } = await supabase.from('customer_bank_account').delete().eq('id', accountId)
    if (!error) setBankAccounts(prev => prev.filter(a => a.id !== accountId))
    setDeletingAccount(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!customer) return <p className="text-sm text-[#64748B]">Aucune société associée à ce compte.</p>

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">Ma société</h1>

      <div className="flex border-b border-[#E2E8F0] mb-6">
        {(['donnees', 'utilisateurs', 'comptes'] as Tab[]).map(t => {
          const labels: Record<Tab, string> = { donnees: 'Données générales', utilisateurs: 'Utilisateurs', comptes: 'Comptes bancaires' }
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-[#1D4ED8] text-[#1D4ED8]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
              {labels[t]}
            </button>
          )
        })}
      </div>

      {tab === 'donnees' && (
        <div className="flex flex-col gap-4">
          <Section title="Identité">
            <Field label="Nom de la société" value={form.name ?? ''} onChange={set('name')} />
            <Field label="Référence"         value={customer.id.slice(0, 8).toUpperCase()} readOnly />
            <Field label="Pays"              value={customer.country_code} readOnly />
            <Field label="Identifiant fiscal" value={form.tax_ref_main ?? ''} onChange={set('tax_ref_main')} />
            <Field label="Numéro TVA"        value={form.tax_ref_vat  ?? ''} onChange={set('tax_ref_vat')} />
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
              className="px-5 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 transition-colors">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {saved     && <span className="text-sm text-[#059669]">Modifications enregistrées</span>}
            {saveError && <span className="text-sm text-[#DC2626]">{saveError}</span>}
          </div>

          <p className="text-xs text-[#94A3B8]">Pour modifier le pays ou le statut juridique, contactez votre cabinet.</p>
        </div>
      )}

      {tab === 'utilisateurs' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {['Nom', 'Admin', 'Statut', 'Depuis', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[#94A3B8]">Aucun utilisateur</td></tr>}
                {users.map((u, i) => (
                  <tr key={u.id} className={i < users.length - 1 ? 'border-b border-[#E2E8F0]' : ''}>
                    <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">
                      {`${u.first_name} ${u.last_name}`.trim() || '—'}
                      {u.id === currentUserId && <span className="ml-1.5 text-xs text-[#94A3B8]">(vous)</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && u.id !== currentUserId ? (
                        <button onClick={() => handleToggleAdmin(u.id, u.admin)} disabled={togglingAdmin === u.id}
                          title="Cliquer pour changer"
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40 cursor-pointer ${u.admin ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]' : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]'}`}>
                          {u.admin ? 'Admin' : 'Utilisateur'}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.admin ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]' : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]'}`}>
                          {u.admin ? 'Admin' : 'Utilisateur'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        u.active ? 'bg-[#F0FDF4] text-[#059669] border-[#BBF7D0]' : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                      }`}>
                        {u.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && u.id !== currentUserId && !u.admin && (
                        <button
                          onClick={() => handleToggleUserActive(u.id, u.active)}
                          disabled={togglingActive === u.id}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            u.active
                              ? 'border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]'
                              : 'border-[#BBF7D0] text-[#059669] hover:bg-[#F0FDF4]'
                          }`}>
                          {togglingActive === u.id ? '…' : u.active ? 'Désactiver' : 'Réactiver'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isAdmin && (
            <>
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
                            <td className="px-4 py-3 text-xs text-[#94A3B8]">{new Date(inv.expires_at).toLocaleDateString('fr-FR')}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => handleCancelInvite(inv.id)} disabled={cancelling === inv.id}
                                className="text-xs text-[#DC2626] hover:underline disabled:opacity-40">
                                Annuler
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                <p className="text-sm font-semibold text-[#0F172A] mb-4">Inviter un utilisateur</p>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1 block">Adresse email</label>
                    <input
                      value={inviteEmail}
                      onChange={e => { setInviteEmail(e.target.value); setInviteSent(false); setInviteError('') }}
                      placeholder="prenom.nom@societe.com"
                      type="email"
                      className="w-full text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                    />
                  </div>
                  <button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}
                    className="px-4 py-1.5 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 transition-colors whitespace-nowrap">
                    {inviting ? 'Envoi…' : 'Envoyer l\'invitation'}
                  </button>
                </div>
                {inviteSent  && <p className="text-sm text-[#059669] mt-2">Invitation envoyée avec succès.</p>}
                {inviteError && <p className="text-sm text-[#DC2626] mt-2">{inviteError}</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Comptes bancaires */}
      {tab === 'comptes' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            {bankAccounts.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[#94A3B8]">Aucun compte bancaire enregistré.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Banque', 'Type', 'Libellé', 'IBAN', 'BIC', 'Devise', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bankAccounts.map((a, i) => (
                    <tr key={a.id} className={i < bankAccounts.length - 1 ? 'border-b border-[#E2E8F0]' : ''}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {a.bank.logo_url ? (
                            <img src={a.bank.logo_url} alt={a.bank.name} className="w-6 h-6 object-contain rounded shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded bg-[#EFF6FF] flex items-center justify-center text-[9px] font-bold text-[#1D4ED8] shrink-0">
                              {a.bank.name.charAt(0)}
                            </div>
                          )}
                          <span className="text-sm text-[#0F172A]">{a.bank.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{TYPE_LABELS[a.type] ?? a.type}</td>
                      <td className="px-4 py-3 text-sm text-[#0F172A]">{a.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-[#64748B]">{maskIban(a.iban)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-[#64748B]">{a.bic ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{a.currency_code}</td>
                      <td className="px-4 py-3 text-right">
                        {confirmDeleteAccount === a.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-[#64748B]">Supprimer ?</span>
                            <button onClick={() => handleDeleteAccount(a.id)} disabled={deletingAccount === a.id}
                              className="text-xs px-2 py-0.5 bg-[#DC2626] text-white rounded hover:bg-[#b91c1c] disabled:opacity-40 transition-colors">
                              {deletingAccount === a.id ? '…' : 'Confirmer'}
                            </button>
                            <button onClick={() => setConfirmDeleteAccount(null)}
                              className="text-xs text-[#64748B] hover:text-[#0F172A]">Annuler</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteAccount(a.id)}
                            className="text-[#94A3B8] hover:text-[#DC2626] transition-colors p-1 rounded">
                            <Trash2 size={14} strokeWidth={1.75} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {showAddAccount ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 flex flex-col gap-4">
              <p className="text-sm font-semibold text-[#0F172A]">Nouveau compte</p>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Banque</span>
                  <select value={addForm.bank_id} onChange={e => setAddForm(f => ({ ...f, bank_id: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]">
                    {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Type</span>
                  <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Devise</span>
                  <select value={addForm.currency_code} onChange={e => setAddForm(f => ({ ...f, currency_code: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Libellé</span>
                  <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="ex. Compte principal"
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">IBAN</span>
                  <input value={addForm.iban} onChange={e => setAddForm(f => ({ ...f, iban: e.target.value }))}
                    placeholder="FR76 …"
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">BIC / SWIFT</span>
                  <input value={addForm.bic} onChange={e => setAddForm(f => ({ ...f, bic: e.target.value }))}
                    placeholder="BNPAFRPP"
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] font-mono" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleAddAccount} disabled={addSaving || !addForm.bank_id}
                  className="px-5 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {addSaving ? 'Enregistrement…' : 'Ajouter'}
                </button>
                <button onClick={() => setShowAddAccount(false)} className="text-sm text-[#64748B] hover:text-[#0F172A]">Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddAccount(true)}
              className="self-start px-4 py-2 text-sm font-medium text-[#1D4ED8] border border-[#1D4ED8] rounded-lg hover:bg-[#EFF6FF] transition-colors">
              + Ajouter un compte
            </button>
          )}
        </div>
      )}
    </div>
  )
}
