'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2, Upload, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import type { UserCustomerRow } from '@/lib/db-types'
import { useCustomer } from '@/lib/CustomerContext'

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
  default_payment_mode: string | null
  employees_none: boolean
  accounts_none: boolean
}

const PAYMENT_MODES = [
  { code: '',               label: '— Non défini —' },
  { code: 'direct_debit',  label: 'Prélèvement automatique' },
  { code: 'bank_transfer', label: 'Virement bancaire' },
  { code: 'cheque',        label: 'Chèque' },
  { code: 'cash',          label: 'Espèces' },
]

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

type Tab = 'donnees' | 'utilisateurs' | 'comptes' | 'salaries' | 'services'

type CustomerServiceRow = {
  id: string
  start_date: string | null
  end_date: string | null
  comment: string | null
  active: boolean
  service: {
    name: string
    group: string
    frequency: string
    service_document_type: Array<{ document_type: { name: string; country_code: string } }>
  }
}

const GROUP_LABELS: Record<string, string> = {
  accounting: 'Comptabilité', tax: 'Fiscal', social: 'Social & Paie',
  legal: 'Juridique', audit: 'Audit', consulting: 'Conseil',
}
const FREQ_LABELS: Record<string, string> = {
  monthly: 'Mensuel', quarterly: 'Trimestriel', annual: 'Annuel', punctual: 'Ponctuel',
}
const GROUP_ORDER = ['accounting', 'tax', 'social', 'legal', 'audit', 'consulting']

type Employee  = { id: string; civility: string | null; last_name: string; first_name: string; birth_date: string | null; identity_ref: string | null; social_ref: string | null; contract_type: string | null; job_title: string | null; entry_date: string | null; exit_date: string | null; active: boolean }
type ImportRow = Omit<Employee, 'id' | 'active'>

const CIVILITIES     = ['M.', 'Mme', 'Dr', 'Me', 'Pr']
const CONTRACT_TYPES = ['CDI', 'CDD', 'Intérim', 'Stage', 'Alternance']
const EMPTY_EMP_FORM = { civility: '', last_name: '', first_name: '', birth_date: '', identity_ref: '', social_ref: '', contract_type: '', job_title: '', entry_date: '', exit_date: '' }
function fmtDate(d: string | null) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d } }

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
  const { activeCustomer } = useCustomer()
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
  const [resending, setResending]           = useState<string | null>(null)
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

  // Salariés
  const [customerServices, setCustomerServices] = useState<CustomerServiceRow[]>([])

  const [employees, setEmployees]               = useState<Employee[]>([])
  const [showAddEmployee, setShowAddEmployee]   = useState(false)
  const [empForm, setEmpForm]                   = useState(EMPTY_EMP_FORM)
  const [empSaving, setEmpSaving]               = useState(false)
  const [confirmDeleteEmp, setConfirmDeleteEmp] = useState<string | null>(null)
  const [deletingEmp, setDeletingEmp]           = useState<string | null>(null)
  const [importRows, setImportRows]             = useState<ImportRow[]>([])
  const [importing, setImporting]               = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  // Auto-sélectionne la première banque dès qu'elles chargent
  useEffect(() => {
    if (banks.length > 0 && !addForm.bank_id) {
      setAddForm(f => ({ ...f, bank_id: banks[0].id }))
    }
  }, [banks])

  useEffect(() => {
    if (!activeCustomer) return
    const customer = activeCustomer
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)
      setIsAdmin(customer.admin)

      const [{ data: custData }, { data: ucData }, { data: invData }] = await Promise.all([
        supabase.from('customer').select('id, name, firm_id, email, phone, website, address, address_2, city, postal_code, country_code, tax_ref_main, tax_ref_vat, default_payment_mode, employees_none, accounts_none').eq('id', customer.id).single(),
        supabase.from('user_customer').select('admin, created_at, user_data:user_id(id, first_name, last_name, active)').eq('customer_id', customer.id),
        supabase.from('user_invitation').select('id, email, status, expires_at, created_at').eq('customer_id', customer.id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
      ])

      if (custData) {
        const c = custData as CustomerData
        setCustomer(c)
        setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', website: c.website ?? '', address: c.address ?? '', address_2: c.address_2 ?? '', city: c.city ?? '', postal_code: c.postal_code ?? '', tax_ref_main: c.tax_ref_main ?? '', tax_ref_vat: c.tax_ref_vat ?? '', default_payment_mode: c.default_payment_mode ?? '', employees_none: c.employees_none, accounts_none: c.accounts_none })

        setCustomerId(customer.id)
        const [{ data: banksData }, { data: accountsData }] = await Promise.all([
          supabase.from('bank').select('id, name, logo_url').eq('country_code', c.country_code).eq('active', true).order('rank'),
          supabase.from('customer_bank_account')
            .select('id, bank_id, type, name, iban, bic, currency_code, bank:bank_id(id, name, logo_url)')
            .eq('customer_id', customer.id).order('created_at'),
        ])
        if (banksData) {
          setBanks(banksData as BankRow[])
          setAddForm(f => ({ ...f, bank_id: banksData[0]?.id ?? '' }))
        }
        if (accountsData) setBankAccounts(accountsData as unknown as BankAccount[])

        const { data: empData } = await supabase
          .from('customer_employee')
          .select('id, civility, last_name, first_name, birth_date, identity_ref, social_ref, contract_type, job_title, entry_date, exit_date, active')
          .eq('customer_id', customer.id).order('last_name')
        if (empData) setEmployees(empData as Employee[])

        const { data: svcData } = await supabase
          .from('customer_service')
          .select('id, start_date, end_date, comment, active, service:service_id(name, group, frequency, service_document_type(document_type:document_type_id(name, country_code)))')
          .eq('customer_id', customer.id)
          .eq('active', true)
          .order('created_at')
        if (svcData) setCustomerServices(svcData as unknown as CustomerServiceRow[])
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
  }, [activeCustomer])

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

  async function handleResendInvite(id: string) {
    setResending(id)
    const token = await getToken()
    await fetch('/api/invite/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ invitationId: id }),
    })
    setResending(null)
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

  async function handleAddEmployee() {
    if (!customerId || !customer?.firm_id || !empForm.last_name || !empForm.first_name) return
    setEmpSaving(true)
    const { data, error } = await supabase.from('customer_employee').insert({
      firm_id: customer.firm_id, customer_id: customerId,
      civility: empForm.civility || null, last_name: empForm.last_name, first_name: empForm.first_name,
      birth_date: empForm.birth_date || null, identity_ref: empForm.identity_ref || null,
      social_ref: empForm.social_ref || null, contract_type: empForm.contract_type || null,
      job_title: empForm.job_title || null, entry_date: empForm.entry_date || null, exit_date: empForm.exit_date || null,
    }).select('id, civility, last_name, first_name, birth_date, identity_ref, social_ref, contract_type, job_title, entry_date, exit_date, active').single()
    if (!error && data) {
      setEmployees(prev => [...prev, data as Employee].sort((a, b) => a.last_name.localeCompare(b.last_name)))
      setEmpForm(EMPTY_EMP_FORM); setShowAddEmployee(false)
    }
    setEmpSaving(false)
  }

  async function handleDeleteEmployee(empId: string) {
    setDeletingEmp(empId); setConfirmDeleteEmp(null)
    const { error } = await supabase.from('customer_employee').delete().eq('id', empId)
    if (!error) setEmployees(prev => prev.filter(e => e.id !== empId))
    setDeletingEmp(null)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb  = XLSX.read(ev.target?.result, { type: 'binary', cellDates: true })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      const normalize = (s: unknown) => String(s ?? '').trim()
      const toDate    = (v: unknown) => { if (!v) return ''; if (v instanceof Date) return v.toISOString().slice(0, 10); const d = new Date(String(v)); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10) }
      const rows: ImportRow[] = raw.map(r => ({
        civility: normalize(r['Civilité'] ?? r['civility']), last_name: normalize(r['Nom'] ?? r['last_name']),
        first_name: normalize(r['Prénom'] ?? r['first_name']), birth_date: toDate(r['Date naissance'] ?? r['birth_date']) || null,
        identity_ref: normalize(r['N° Identité'] ?? r['identity_ref']) || null, social_ref: normalize(r['N° Social'] ?? r['social_ref']) || null,
        contract_type: normalize(r['Contrat'] ?? r['contract_type']) || null, job_title: normalize(r['Poste'] ?? r['job_title']) || null,
        entry_date: toDate(r['Date entrée'] ?? r['entry_date']) || null, exit_date: toDate(r['Date sortie'] ?? r['exit_date']) || null,
      })).filter(r => r.last_name && r.first_name)
      setImportRows(rows)
    }
    reader.readAsBinaryString(file); e.target.value = ''
  }

  async function handleConfirmImport() {
    if (!customerId || !customer?.firm_id || importRows.length === 0) return
    setImporting(true)
    const rows = importRows.map(r => ({ ...r, firm_id: customer.firm_id, customer_id: customerId }))
    const { data } = await supabase.from('customer_employee').insert(rows)
      .select('id, civility, last_name, first_name, birth_date, identity_ref, social_ref, contract_type, job_title, entry_date, exit_date, active')
    if (data) setEmployees(prev => [...prev, ...(data as Employee[])].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    setImportRows([]); setImporting(false)
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([['Civilité','Nom','Prénom','Date naissance','N° Identité','N° Social','Contrat','Poste','Date entrée','Date sortie']])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Salariés')
    XLSX.writeFile(wb, 'modele_salaries.xlsx')
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
        {(['donnees', 'utilisateurs', 'comptes', 'salaries', 'services'] as Tab[]).filter(t => !(t === 'comptes' && customer?.accounts_none) && !(t === 'salaries' && customer?.employees_none)).map(t => {
          const labels: Record<Tab, string> = { donnees: 'Données générales', utilisateurs: 'Utilisateurs', comptes: 'Comptes bancaires', salaries: 'Salariés', services: 'Nos services' }
          const counts: Partial<Record<Tab, number>> = {
            utilisateurs: users.length,
            comptes:      bankAccounts.length,
            salaries:     employees.length,
            services:     customerServices.length,
          }
          const count = counts[t]
          const isActive = tab === t
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${isActive ? 'border-[#1D4ED8] text-[#1D4ED8]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}>
              {labels[t]}
              {count !== undefined && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  count === 0
                    ? 'bg-[#FEF2F2] text-[#DC2626]'
                    : isActive
                      ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'bg-[#EFF6FF] text-[#3B82F6]'
                }`}>{count}</span>
              )}
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
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Mode de paiement impôt</span>
              <select value={form.default_payment_mode ?? ''} onChange={e => { setForm(f => ({ ...f, default_payment_mode: e.target.value })); setSaved(false) }}
                className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors">
                {PAYMENT_MODES.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}
              </select>
            </div>
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

          <Section title="Configuration du dossier">
            {([
              { label: "Je n'ai pas de salariés",          key: 'employees_none' },
              { label: "Je n'ai pas de comptes bancaires", key: 'accounts_none'  },
            ] as { label: string; key: 'employees_none' | 'accounts_none' }[]).map(({ label, key }) => {
              const val = form[key] ?? false
              return (
                <label key={key} className="flex items-center gap-3 cursor-pointer col-span-2">
                  <button type="button" role="switch" aria-checked={val}
                    onClick={() => { setForm(f => ({ ...f, [key]: !val })); setSaved(false) }}
                    className={`relative w-9 h-5 rounded-full overflow-hidden transition-colors shrink-0 ${val ? 'bg-[#1D4ED8]' : 'bg-[#CBD5E1]'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-4' : ''}`} />
                  </button>
                  <span className="text-sm text-[#0F172A]">{label}</span>
                </label>
              )
            })}
          </Section>

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
                              <div className="flex items-center gap-3">
                                <button onClick={() => handleResendInvite(inv.id)} disabled={resending === inv.id || cancelling === inv.id}
                                  className="text-xs text-[#1D4ED8] hover:underline disabled:opacity-40">
                                  {resending === inv.id ? 'Envoi…' : 'Renvoyer'}
                                </button>
                                <button onClick={() => handleCancelInvite(inv.id)} disabled={cancelling === inv.id || resending === inv.id}
                                  className="text-xs text-[#DC2626] hover:underline disabled:opacity-40">
                                  {cancelling === inv.id ? 'Annulation…' : 'Annuler'}
                                </button>
                              </div>
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

      {/* Salariés */}
      {tab === 'salaries' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setShowAddEmployee(true); setImportRows([]) }}
              className="px-4 py-1.5 text-sm font-medium text-[#1D4ED8] border border-[#1D4ED8] rounded-lg hover:bg-[#EFF6FF] transition-colors">
              + Ajouter un salarié
            </button>
            <label className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] cursor-pointer transition-colors">
              <Upload size={14} />
              Importer Excel
              <input ref={importRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImportFile} />
            </label>
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors">
              <FileDown size={14} />
              Modèle
            </button>
          </div>

          {importRows.length > 0 && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-[#92400E]">{importRows.length} salarié(s) détecté(s) — vérifiez avant de confirmer</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[#FDE68A]">
                    {['Civ.','Nom','Prénom','Naissance','Contrat','Poste','Entrée'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold text-[#92400E]">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} className="border-b border-[#FEF3C7]">
                        <td className="px-2 py-1">{r.civility ?? '—'}</td>
                        <td className="px-2 py-1 font-medium">{r.last_name}</td>
                        <td className="px-2 py-1">{r.first_name}</td>
                        <td className="px-2 py-1">{fmtDate(r.birth_date)}</td>
                        <td className="px-2 py-1">{r.contract_type ?? '—'}</td>
                        <td className="px-2 py-1">{r.job_title ?? '—'}</td>
                        <td className="px-2 py-1">{fmtDate(r.entry_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleConfirmImport} disabled={importing}
                  className="px-4 py-1.5 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 transition-colors">
                  {importing ? 'Import…' : `Confirmer l'import`}
                </button>
                <button onClick={() => setImportRows([])} className="text-sm text-[#64748B] hover:text-[#0F172A]">Annuler</button>
              </div>
            </div>
          )}

          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            {employees.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[#94A3B8]">Aucun salarié enregistré.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Salarié','Poste','Contrat','Entrée','Sortie','Statut',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e, i) => (
                    <tr key={e.id} className={i < employees.length - 1 ? 'border-b border-[#E2E8F0]' : ''}>
                      <td className="px-4 py-3 text-sm font-medium text-[#0F172A]">
                        {[e.civility, e.last_name, e.first_name].filter(Boolean).join(' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{e.job_title ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{e.contract_type ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{fmtDate(e.entry_date)}</td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{fmtDate(e.exit_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          e.active ? 'bg-[#F0FDF4] text-[#059669] border-[#BBF7D0]' : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                        }`}>{e.active ? 'Actif' : 'Inactif'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {confirmDeleteEmp === e.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-[#64748B]">Supprimer ?</span>
                            <button onClick={() => handleDeleteEmployee(e.id)} disabled={deletingEmp === e.id}
                              className="text-xs px-2 py-0.5 bg-[#DC2626] text-white rounded hover:bg-[#b91c1c] disabled:opacity-40 transition-colors">
                              {deletingEmp === e.id ? '…' : 'Confirmer'}
                            </button>
                            <button onClick={() => setConfirmDeleteEmp(null)} className="text-xs text-[#64748B] hover:text-[#0F172A]">Annuler</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteEmp(e.id)}
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

          {showAddEmployee && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 flex flex-col gap-4">
              <p className="text-sm font-semibold text-[#0F172A]">Nouveau salarié</p>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                {[
                  ['Civilité', 'civility', 'select'],['Nom *', 'last_name', 'text'],['Prénom *', 'first_name', 'text'],
                  ['Date naissance', 'birth_date', 'date'],['N° Identité', 'identity_ref', 'text'],['N° Social (CNSS)', 'social_ref', 'text'],
                  ['Type de contrat', 'contract_type', 'select-contract'],['Poste', 'job_title', 'text'],
                  ['Date entrée', 'entry_date', 'date'],['Date sortie', 'exit_date', 'date'],
                ].map(([label, key, type]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{label}</span>
                    {type === 'select' ? (
                      <select value={empForm[key as keyof typeof empForm]} onChange={e => setEmpForm(f => ({ ...f, [key]: e.target.value }))}
                        className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]">
                        <option value="">—</option>
                        {CIVILITIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : type === 'select-contract' ? (
                      <select value={empForm[key as keyof typeof empForm]} onChange={e => setEmpForm(f => ({ ...f, [key]: e.target.value }))}
                        className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]">
                        <option value="">—</option>
                        {CONTRACT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input type={type} value={empForm[key as keyof typeof empForm]} onChange={e => setEmpForm(f => ({ ...f, [key]: e.target.value }))}
                        className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleAddEmployee} disabled={empSaving || !empForm.last_name || !empForm.first_name}
                  className="px-5 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {empSaving ? 'Enregistrement…' : 'Ajouter'}
                </button>
                <button onClick={() => { setShowAddEmployee(false); setEmpForm(EMPTY_EMP_FORM) }}
                  className="text-sm text-[#64748B] hover:text-[#0F172A]">Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Services — consultation uniquement */}
      {tab === 'services' && (
        <div className="flex flex-col gap-4">
          {customerServices.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-12 text-center text-sm text-[#94A3B8]">
              Aucun service souscrit pour le moment.
            </div>
          ) : (
            GROUP_ORDER
              .filter(g => customerServices.some(s => s.service.group === g))
              .map(g => (
                <div key={g} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{GROUP_LABELS[g]}</p>
                  </div>
                  <div className="divide-y divide-[#F1F5F9]">
                    {customerServices
                      .filter(s => s.service.group === g)
                      .map(cs => {
                        const uniqDoctypes = [...new Set(cs.service.service_document_type.map(d => d.document_type.name))]
                        return (
                          <div key={cs.id} className="px-5 py-4 flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-sm font-medium text-[#0F172A]">{cs.service.name}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                                  {FREQ_LABELS[cs.service.frequency] ?? cs.service.frequency}
                                </span>
                              </div>
                              {uniqDoctypes.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                  <span className="text-[10px] text-[#94A3B8]">Livrables :</span>
                                  {uniqDoctypes.map(d => (
                                    <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{d}</span>
                                  ))}
                                </div>
                              )}
                              {cs.comment && <p className="text-xs text-[#64748B] mt-1 italic">{cs.comment}</p>}
                            </div>
                            <div className="text-right shrink-0 text-xs text-[#94A3B8] space-y-0.5">
                              {cs.start_date && <div>Depuis le {fmtDate(cs.start_date)}</div>}
                              {cs.end_date   && <div>Jusqu&apos;au {fmtDate(cs.end_date)}</div>}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  )
}
