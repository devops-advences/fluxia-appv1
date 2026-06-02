'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Building2, User, ArrowLeft, Copy, Check, Trash2, Upload, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
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
  employees_none: boolean; accounts_none: boolean
  onboarding_score: number
}

type CustomerUser = {
  id: string; first_name: string; last_name: string; active: boolean; admin: boolean; created_at: string
}

type InviteRow = {
  id: string; email: string; status: string; expires_at: string; token: string
}

type Tab = 'informations' | 'utilisateurs' | 'collaborateurs' | 'comptes' | 'salaries' | 'services'

type ServiceCatalogRow = { id: string; name: string; group: string; frequency: string; country_codes: string[] | null }
type CustomerServiceRow = {
  id: string; start_date: string | null; end_date: string | null; comment: string | null; active: boolean
  service: { id: string; name: string; group: string; frequency: string; service_document_type: Array<{ document_type: { name: string } }> }
}

const GROUP_LABELS: Record<string, string> = { accounting: 'Comptabilité', tax: 'Fiscal', social: 'Social & Paie', legal: 'Juridique', audit: 'Audit', consulting: 'Conseil' }
const FREQ_LABELS:  Record<string, string> = { monthly: 'Mensuel', quarterly: 'Trimestriel', annual: 'Annuel', punctual: 'Ponctuel' }
const GROUP_ORDER = ['accounting', 'tax', 'social', 'legal', 'audit', 'consulting']

type Employee = {
  id: string; civility: string | null; last_name: string; first_name: string
  birth_date: string | null; identity_ref: string | null; social_ref: string | null
  contract_type: string | null; job_title: string | null
  entry_date: string | null; exit_date: string | null; active: boolean
}

type ImportRow = Omit<Employee, 'id' | 'active'>

const CIVILITIES      = ['M.', 'Mme', 'Dr', 'Me', 'Pr']
const CONTRACT_TYPES  = ['CDI', 'CDD', 'Intérim', 'Stage', 'Alternance']
const EMPTY_EMP_FORM  = { civility: '', last_name: '', first_name: '', birth_date: '', identity_ref: '', social_ref: '', contract_type: '', job_title: '', entry_date: '', exit_date: '' }

function fmtDate(d: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d }
}

type CollabUser = { id: string; first_name: string; last_name: string }

type BankRow = { id: string; name: string; logo_url: string | null }

type BankAccount = {
  id: string
  bank_id: string
  bank: BankRow
  type: 'current' | 'savings' | 'term' | 'foreign'
  name: string | null
  iban: string | null
  bic: string | null
  currency_code: string
}

const TYPE_LABELS: Record<string, string> = {
  current: 'Compte courant',
  savings: 'Épargne',
  term:    'Dépôt à terme',
  foreign: 'Devises',
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'MAD', 'TND', 'DZD', 'CHF']

function maskIban(iban: string | null) {
  if (!iban) return '—'
  const c = iban.replace(/\s/g, '')
  if (c.length <= 8) return iban
  return c.slice(0, 4) + ' •••• •••• ' + c.slice(-4)
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

  const searchParams            = useSearchParams()
  const [tab, setTab]           = useState<Tab>((searchParams.get('tab') as Tab) ?? 'informations')
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
  const [toggling, setToggling]         = useState(false)
  const [togglingUserActive, setTogglingUserActive] = useState<string | null>(null)

  // Accès collaborateurs
  const [collabs, setCollabs]               = useState<CollabUser[]>([])
  const [assignedCollabIds, setAssignedCollabIds] = useState<Set<string>>(new Set())
  const [togglingCollab, setTogglingCollab] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviting, setInviting]         = useState(false)
  const [inviteSent, setInviteSent]     = useState(false)
  const [inviteError, setInviteError]   = useState('')
  const [cancelling, setCancelling]     = useState<string | null>(null)
  const [resending, setResending]       = useState<string | null>(null)
  const [copiedId, setCopiedId]         = useState<string | null>(null)

  // Comptes bancaires
  const [banks, setBanks]               = useState<BankRow[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [addForm, setAddForm]           = useState({ bank_id: '', type: 'current', name: '', iban: '', bic: '', currency_code: 'EUR' })
  const [addSaving, setAddSaving]       = useState(false)
  const [deletingAccount, setDeletingAccount]           = useState<string | null>(null)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<string | null>(null)

  // Services
  const [serviceCatalog, setServiceCatalog]     = useState<ServiceCatalogRow[]>([])
  const [customerServices, setCustomerServices] = useState<CustomerServiceRow[]>([])
  const [showAddService, setShowAddService]     = useState(false)
  const [svcForm, setSvcForm]                   = useState({ service_id: '', start_date: '', end_date: '', comment: '' })
  const [svcSaving, setSvcSaving]               = useState(false)
  const [confirmDeleteSvc, setConfirmDeleteSvc] = useState<string | null>(null)
  const [deletingSvc, setDeletingSvc]           = useState<string | null>(null)

  // Salariés
  const [employees, setEmployees]           = useState<Employee[]>([])
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [empForm, setEmpForm]               = useState(EMPTY_EMP_FORM)
  const [empSaving, setEmpSaving]           = useState(false)
  const [confirmDeleteEmp, setConfirmDeleteEmp] = useState<string | null>(null)
  const [deletingEmp, setDeletingEmp]       = useState<string | null>(null)
  const [importRows, setImportRows]         = useState<ImportRow[]>([])
  const [importDupWarnings, setImportDupWarnings] = useState<string[]>([])
  const [importResult, setImportResult]     = useState<{ ok: number; skipped: number } | null>(null)
  const [importing, setImporting]           = useState(false)
  const [empAddError, setEmpAddError]       = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

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

      const { data: ud } = await supabase
        .from('user_data').select('firm_id, admin').eq('id', session.user.id).single()
      if (!ud?.firm_id) { setLoading(false); return }
      setFirmId(ud.firm_id)
      setIsAdmin(ud.admin ?? false)

      const [{ data: cust }, { data: ucData }, { data: invData }, { data: firmUsers }] = await Promise.all([
        supabase.from('customer').select('*').eq('id', id).eq('firm_id', ud.firm_id).single(),
        supabase
          .from('user_customer')
          .select('user_id, user_data(id, first_name, last_name, active, admin, role, created_at)')
          .eq('customer_id', id),
        supabase
          .from('user_invitation')
          .select('id, email, status, expires_at, token')
          .eq('customer_id', id)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString()),
        supabase
          .from('user_data')
          .select('id, first_name, last_name')
          .eq('firm_id', ud.firm_id)
          .eq('role', 'firm')
          .eq('admin', false)
          .eq('active', true)
          .order('first_name'),
      ])

      if (!cust) { router.push('/clients'); return }

      const c = cust as Customer
      setCustomer(c)
      setForm({
        name:           c.name,
        legal_entity:   c.legal_entity,
        country_code:   c.country_code,
        tax_ref_main:   c.tax_ref_main ?? '',
        tax_ref_vat:    c.tax_ref_vat  ?? '',
        email:          c.email        ?? '',
        phone:          c.phone        ?? '',
        website:        c.website      ?? '',
        address:        c.address      ?? '',
        address_2:      c.address_2    ?? '',
        city:           c.city         ?? '',
        postal_code:    c.postal_code  ?? '',
        sector:         c.sector       ?? '',
        sub_sector:     c.sub_sector   ?? '',
        employees_none: c.employees_none,
        accounts_none:  c.accounts_none,
      })

      if (ucData) {
        type UcRow = { user_id: string; user_data: (CustomerUser & { role: string }) | (CustomerUser & { role: string })[] | null }
        const allLinked = (ucData as UcRow[]).map(r => Array.isArray(r.user_data) ? r.user_data[0] : r.user_data).filter(Boolean) as (CustomerUser & { role: string })[]
        setUsers(allLinked.filter(u => u.role === 'customer') as CustomerUser[])
        setAssignedCollabIds(new Set(allLinked.filter(u => u.role === 'firm').map(u => u.id)))
      }

      setCollabs((firmUsers ?? []) as CollabUser[])

      if (invData) setInvites(invData as InviteRow[])

      // Banques (filtrées par pays du client) + comptes existants
      const [{ data: banksData }, { data: accountsData }] = await Promise.all([
        supabase.from('bank').select('id, name, logo_url').eq('country_code', c.country_code).eq('active', true).order('rank'),
        supabase.from('customer_bank_account')
          .select('id, bank_id, type, name, iban, bic, currency_code, bank:bank_id(id, name, logo_url)')
          .eq('customer_id', id).eq('firm_id', ud.firm_id).order('created_at'),
      ])
      if (banksData) {
        setBanks(banksData as BankRow[])
        setAddForm(f => ({ ...f, bank_id: banksData[0]?.id ?? '' }))
      }
      if (accountsData) setBankAccounts(accountsData as unknown as BankAccount[])

      const { data: empData } = await supabase
        .from('customer_employee')
        .select('id, civility, last_name, first_name, birth_date, identity_ref, social_ref, contract_type, job_title, entry_date, exit_date, active')
        .eq('customer_id', id).eq('firm_id', ud.firm_id).order('last_name')
      if (empData) setEmployees(empData as Employee[])

      const [{ data: catalogData }, { data: csData }] = await Promise.all([
        supabase.from('service').select('id, name, group, frequency, country_codes').eq('active', true).order('rank'),
        supabase.from('customer_service')
          .select('id, start_date, end_date, comment, active, service:service_id(id, name, group, frequency, service_document_type(document_type:document_type_id(name)))')
          .eq('customer_id', id).eq('firm_id', ud.firm_id).order('created_at'),
      ])
      if (catalogData) {
        const filtered = (catalogData as ServiceCatalogRow[]).filter(s => !s.country_codes || s.country_codes.includes(c.country_code))
        setServiceCatalog(filtered)
        setSvcForm(f => ({ ...f, service_id: filtered[0]?.id ?? '' }))
      }
      if (csData) setCustomerServices(csData as unknown as CustomerServiceRow[])

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
    const empNone = form.employees_none ?? false
    const accNone = form.accounts_none  ?? false
    if (empNone && tab === 'salaries') setTab('informations')
    if (accNone && tab === 'comptes')  setTab('informations')
    const { error } = await supabase.from('customer').update({
      name:           form.name         || null,
      legal_entity:   form.legal_entity ?? true,
      country_code:   form.country_code || 'FR',
      tax_ref_main:   form.tax_ref_main || null,
      tax_ref_vat:    form.tax_ref_vat  || null,
      email:          form.email        || null,
      phone:          form.phone        || null,
      website:        form.website      || null,
      address:        form.address      || null,
      address_2:      form.address_2    || null,
      city:           form.city         || null,
      postal_code:    form.postal_code  || null,
      sector:         form.sector       || null,
      sub_sector:     form.sub_sector   || null,
      employees_none: empNone,
      accounts_none:  accNone,
    }).eq('id', customer.id)
    if (error) setSaveError('Erreur lors de la sauvegarde')
    else { setSaved(true); setCustomer(prev => prev ? { ...prev, ...form as Customer } : prev); refreshScore() }
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
      .select('id, email, status, expires_at, token')
      .single()

    if (error) {
      setInviteError(error.code === '23505' ? 'Invitation déjà en attente pour cet email.' : 'Erreur lors de l\'invitation.')
    } else {
      setInvites(prev => [data as InviteRow, ...prev])
      setInviteSent(true)
      setInviteEmail('')
      // Envoyer l'email d'invitation en best-effort
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        fetch('/api/invite/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ invitationId: data.id }),
        }).catch(() => {})
      }
    }
    setInviting(false)
  }

  async function handleToggleAdmin(userId: string, current: boolean) {
    const { error } = await supabase.from('user_data').update({ admin: !current }).eq('id', userId)
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, admin: !current } : u))
  }

  async function handleToggleUserActive(userId: string, current: boolean) {
    setTogglingUserActive(userId)
    const { error } = await supabase.from('user_data').update({ active: !current }).eq('id', userId)
    if (!error) { setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !current } : u)); refreshScore() }
    setTogglingUserActive(null)
  }

  async function handleCancelInvite(invId: string) {
    setCancelling(invId)
    const { error } = await supabase.from('user_invitation').update({ status: 'revoked' }).eq('id', invId)
    if (!error) setInvites(prev => prev.filter(i => i.id !== invId))
    setCancelling(null)
  }

  async function handleResendInvite(invId: string) {
    setResending(invId)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      await fetch('/api/invite/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ invitationId: invId }),
      })
    }
    setResending(null)
  }

  async function handleToggleCollab(userId: string) {
    if (!customer) return
    setTogglingCollab(userId)
    if (assignedCollabIds.has(userId)) {
      const { error } = await supabase.from('user_customer').delete()
        .eq('user_id', userId).eq('customer_id', customer.id)
      if (!error) setAssignedCollabIds(prev => { const s = new Set(prev); s.delete(userId); return s })
    } else {
      const { error } = await supabase.from('user_customer').insert({ user_id: userId, customer_id: customer.id })
      if (!error) setAssignedCollabIds(prev => new Set([...prev, userId]))
    }
    setTogglingCollab(null)
  }

  function set(key: keyof Customer) {
    return (val: string) => { setForm(f => ({ ...f, [key]: val })); setSaved(false) }
  }

  async function refreshScore() {
    if (!customer) return
    const { data } = await supabase.rpc('refresh_onboarding_score', { p_customer_id: customer.id })
    void data
    const { data: updated } = await supabase.from('customer').select('onboarding_score').eq('id', customer.id).single()
    if (updated) setCustomer(prev => prev ? { ...prev, onboarding_score: (updated as { onboarding_score: number }).onboarding_score } : prev)
  }

  async function handleAddService() {
    if (!customer || !firmId || !svcForm.service_id) return
    setSvcSaving(true)
    const { data, error } = await supabase.from('customer_service').insert({
      firm_id: firmId, customer_id: customer.id, service_id: svcForm.service_id,
      start_date: svcForm.start_date || null, end_date: svcForm.end_date || null, comment: svcForm.comment || null,
    }).select('id, start_date, end_date, comment, active, service:service_id(id, name, group, frequency, service_document_type(document_type:document_type_id(name)))').single()
    if (!error && data) {
      setCustomerServices(prev => [...prev, data as unknown as CustomerServiceRow])
      setSvcForm(f => ({ ...f, start_date: '', end_date: '', comment: '' }))
      setShowAddService(false)
      refreshScore()
    }
    setSvcSaving(false)
  }

  async function handleDeleteService(svcId: string) {
    setDeletingSvc(svcId); setConfirmDeleteSvc(null)
    const { error } = await supabase.from('customer_service').delete().eq('id', svcId)
    if (!error) { setCustomerServices(prev => prev.filter(s => s.id !== svcId)); refreshScore() }
    setDeletingSvc(null)
  }

  async function handleToggleService(svcId: string, current: boolean) {
    const { error } = await supabase.from('customer_service').update({ active: !current }).eq('id', svcId)
    if (!error) { setCustomerServices(prev => prev.map(s => s.id === svcId ? { ...s, active: !current } : s)); refreshScore() }
  }

  async function handleAddEmployee() {
    if (!customer || !firmId || !empForm.last_name || !empForm.first_name) return
    setEmpSaving(true); setEmpAddError(null)
    const { data, error } = await supabase.from('customer_employee').insert({
      firm_id: firmId, customer_id: customer.id,
      civility:      empForm.civility      || null,
      last_name:     empForm.last_name,
      first_name:    empForm.first_name,
      birth_date:    empForm.birth_date    || null,
      identity_ref:  empForm.identity_ref  || null,
      social_ref:    empForm.social_ref    || null,
      contract_type: empForm.contract_type || null,
      job_title:     empForm.job_title     || null,
      entry_date:    empForm.entry_date    || null,
      exit_date:     empForm.exit_date     || null,
    }).select('id, civility, last_name, first_name, birth_date, identity_ref, social_ref, contract_type, job_title, entry_date, exit_date, active').single()
    if (error) {
      setEmpAddError(
        error.code === '23505'
          ? (error.message.includes('identity') ? 'Ce N° identité existe déjà pour ce client.' : 'Ce N° social existe déjà pour ce client.')
          : 'Erreur lors de l\'enregistrement.'
      )
    } else if (data) {
      setEmployees(prev => [...prev, data as Employee].sort((a, b) => a.last_name.localeCompare(b.last_name)))
      setEmpForm(EMPTY_EMP_FORM); setShowAddEmployee(false)
      refreshScore()
    }
    setEmpSaving(false)
  }

  async function handleDeleteEmployee(empId: string) {
    setDeletingEmp(empId); setConfirmDeleteEmp(null)
    const { error } = await supabase.from('customer_employee').delete().eq('id', empId)
    if (!error) { setEmployees(prev => prev.filter(e => e.id !== empId)); refreshScore() }
    setDeletingEmp(null)
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb  = XLSX.read(ev.target?.result, { type: 'binary', cellDates: true })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      const normalize = (s: unknown) => String(s ?? '').trim()
      const toDate    = (v: unknown) => {
        if (!v) return ''
        if (v instanceof Date) return v.toISOString().slice(0, 10)
        const d = new Date(String(v))
        return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
      }
      const allRows: ImportRow[] = raw.map(r => ({
        civility:      normalize(r['Civilité'] ?? r['civility']),
        last_name:     normalize(r['Nom']      ?? r['last_name']),
        first_name:    normalize(r['Prénom']   ?? r['first_name']),
        birth_date:    toDate(r['Date naissance'] ?? r['birth_date']) || null,
        identity_ref:  normalize(r['N° Identité']  ?? r['identity_ref'])  || null,
        social_ref:    normalize(r['N° Social']     ?? r['social_ref'])    || null,
        contract_type: normalize(r['Contrat']       ?? r['contract_type']) || null,
        job_title:     normalize(r['Poste']          ?? r['job_title'])     || null,
        entry_date:    toDate(r['Date entrée'] ?? r['entry_date']) || null,
        exit_date:     toDate(r['Date sortie'] ?? r['exit_date'])  || null,
      }))
      // Lignes incomplètes filtrées
      const rows = allRows.filter(r => r.last_name && r.first_name)
      const skippedEmpty = allRows.length - rows.length
      // Doublons intra-batch (même identity_ref ou social_ref)
      const seenId  = new Set<string>()
      const seenSoc = new Set<string>()
      const warnings: string[] = []
      if (skippedEmpty > 0) warnings.push(`${skippedEmpty} ligne(s) ignorée(s) — Nom ou Prénom manquant`)
      const unique = rows.filter(r => {
        if (r.identity_ref && seenId.has(r.identity_ref))  { warnings.push(`Doublon N° identité : ${r.identity_ref} (${r.last_name} ${r.first_name})`); return false }
        if (r.social_ref   && seenSoc.has(r.social_ref))   { warnings.push(`Doublon N° social : ${r.social_ref} (${r.last_name} ${r.first_name})`); return false }
        if (r.identity_ref) seenId.add(r.identity_ref)
        if (r.social_ref)   seenSoc.add(r.social_ref)
        return true
      })
      setImportRows(unique)
      setImportDupWarnings(warnings)
      setImportResult(null)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  async function handleConfirmImport() {
    if (!customer || !firmId || importRows.length === 0) return
    setImporting(true)
    let ok = 0; let skipped = 0
    for (const r of importRows) {
      const { data, error } = await supabase.from('customer_employee')
        .insert({ ...r, firm_id: firmId, customer_id: customer.id })
        .select('id, civility, last_name, first_name, birth_date, identity_ref, social_ref, contract_type, job_title, entry_date, exit_date, active')
        .single()
      if (!error && data) { setEmployees(prev => [...prev, data as Employee]); ok++ }
      else skipped++
    }
    setEmployees(prev => [...prev].sort((a, b) => a.last_name.localeCompare(b.last_name)))
    setImportRows([]); setImportDupWarnings([])
    setImportResult({ ok, skipped })
    if (ok > 0) refreshScore()
    setImporting(false)
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([['Civilité','Nom','Prénom','Date naissance','N° Identité','N° Social','Contrat','Poste','Date entrée','Date sortie']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Salariés')
    XLSX.writeFile(wb, 'modele_salaries.xlsx')
  }

  async function handleAddAccount() {
    if (!customer || !firmId || !addForm.bank_id) return
    setAddSaving(true)
    const { data, error } = await supabase
      .from('customer_bank_account')
      .insert({
        firm_id:       firmId,
        customer_id:   customer.id,
        bank_id:       addForm.bank_id,
        type:          addForm.type,
        name:          addForm.name || null,
        iban:          addForm.iban || null,
        bic:           addForm.bic  || null,
        currency_code: addForm.currency_code,
      })
      .select('id, bank_id, type, name, iban, bic, currency_code, bank:bank_id(id, name, logo_url)')
      .single()
    if (!error && data) {
      setBankAccounts(prev => [...prev, data as unknown as BankAccount])
      setAddForm(f => ({ ...f, name: '', iban: '', bic: '', type: 'current', currency_code: 'EUR' }))
      setShowAddAccount(false)
      refreshScore()
    }
    setAddSaving(false)
  }

  async function handleDeleteAccount(accountId: string) {
    setDeletingAccount(accountId)
    setConfirmDeleteAccount(null)
    const { error } = await supabase.from('customer_bank_account').delete().eq('id', accountId)
    if (!error) { setBankAccounts(prev => prev.filter(a => a.id !== accountId)); refreshScore() }
    setDeletingAccount(null)
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

      {/* Onboarding score */}
      {(() => {
        const s = customer.onboarding_score
        const color = s >= 80 ? '#059669' : s >= 50 ? '#D97706' : '#DC2626'
        const JALONS = [
          { label: 'Données générales', done: !!(customer.tax_ref_main) },
          { label: 'Comptes bancaires',  done: customer.accounts_none  || bankAccounts.length > 0 },
          { label: 'Salariés',           done: customer.employees_none || employees.length > 0 },
          { label: 'Services',           done: customerServices.some(sv => sv.active) },
          { label: 'Utilisateurs',       done: users.length > 0 },
        ]
        if (s === 100) return null
        return (
          <div className="mb-5 bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center gap-5">
            <div className="shrink-0 text-center">
              <div className="text-2xl font-bold" style={{ color }}>{s}%</div>
              <div className="text-[10px] text-[#94A3B8] mt-0.5">Complétion</div>
            </div>
            <div className="flex-1">
              <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full mb-3 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${s}%`, backgroundColor: color }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {JALONS.map(j => (
                  <span key={j.label} className={`text-xs flex items-center gap-1 ${j.done ? 'text-[#94A3B8] line-through' : 'text-[#0F172A]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${j.done ? 'bg-[#059669]' : 'bg-[#DC2626]'}`} />
                    {j.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] mb-6">
        {(['informations', 'utilisateurs', 'collaborateurs', 'comptes', 'salaries', 'services'] as Tab[]).filter(t => !(t === 'comptes' && customer?.accounts_none) && !(t === 'salaries' && customer?.employees_none)).map(t => {
          const labels: Record<Tab, string> = {
            informations:   'Informations',
            utilisateurs:   'Utilisateurs côté client',
            collaborateurs: 'Accès collaborateurs',
            comptes:        'Comptes bancaires',
            salaries:       'Salariés',
            services:       'Services',
          }
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
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                isActive ? 'border-[#1D4ED8] text-[#1D4ED8]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}>
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

          <Section title="Configuration du dossier">
            {([
              { label: 'Ce client n\'a pas de salariés',          key: 'employees_none' },
              { label: 'Ce client n\'a pas de comptes bancaires', key: 'accounts_none'  },
            ] as { label: string; key: 'employees_none' | 'accounts_none' }[]).map(({ label, key }) => {
              const val = form[key] ?? false
              return (
                <label key={key} className="flex items-center gap-3 cursor-pointer col-span-2">
                  <button role="switch" aria-checked={val}
                    onClick={() => { setForm(f => ({ ...f, [key]: !val })); setSaved(false) }}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${val ? 'bg-[#1D4ED8]' : 'bg-[#CBD5E1]'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-4' : ''}`} />
                  </button>
                  <span className="text-sm text-[#0F172A]">{label}</span>
                </label>
              )
            })}
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

      {/* Accès collaborateurs */}
      {tab === 'collaborateurs' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <p className="text-sm font-semibold text-[#0F172A]">Collaborateurs ayant accès à ce dossier</p>
            <p className="text-xs text-[#64748B] mt-1">Les admins ont accès à tous les dossiers par défaut et n'apparaissent pas ici.</p>
          </div>
          {collabs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#94A3B8]">
              Aucun collaborateur non-admin dans ce cabinet.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Collaborateur</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider w-24">Accès</th>
                </tr>
              </thead>
              <tbody>
                {collabs.map((c, i) => {
                  const assigned = assignedCollabIds.has(c.id)
                  const busy     = togglingCollab === c.id
                  return (
                    <tr key={c.id} className={`${i < collabs.length - 1 ? 'border-b border-[#E2E8F0]' : ''} transition-colors hover:bg-[#F8FAFC]`}>
                      <td className="px-5 py-3 text-sm text-[#0F172A]">
                        {c.first_name} {c.last_name}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggleCollab(c.id)}
                          disabled={busy || !isAdmin}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px', cursor: isAdmin && !busy ? 'pointer' : 'default',
                            background: 'none', border: 'none', padding: 0, opacity: busy ? 0.5 : 1
                          }}
                        >
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${assigned ? '#1D4ED8' : '#CBD5E1'}`,
                            background: assigned ? '#1D4ED8' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s', flexShrink: 0
                          }}>
                            {assigned && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span className="text-xs text-[#64748B]">{assigned ? 'Accès accordé' : 'Pas d\'accès'}</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Utilisateurs côté client */}
      {tab === 'utilisateurs' && (
        <div className="flex flex-col gap-6">
          {/* Users list */}
          {users.length > 0 && (
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          u.active
                            ? 'bg-[#F0FDF4] text-[#059669] border-[#BBF7D0]'
                            : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
                        }`}>
                          {u.active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#94A3B8]">
                        {new Date(u.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isAdmin && (
                          <button
                            onClick={() => handleToggleUserActive(u.id, u.active)}
                            disabled={togglingUserActive === u.id}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              u.active
                                ? 'border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]'
                                : 'border-[#BBF7D0] text-[#059669] hover:bg-[#F0FDF4]'
                            }`}>
                            {togglingUserActive === u.id ? '…' : u.active ? 'Désactiver' : 'Réactiver'}
                          </button>
                        )}
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
                      {['Email', 'Expire le', 'Lien', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv, i) => {
                      const link = `${window.location.origin}/invite/${inv.token}`
                      const copied = copiedId === inv.id
                      return (
                      <tr key={inv.id} className={i < invites.length - 1 ? 'border-b border-[#E2E8F0]' : ''}>
                        <td className="px-4 py-3 text-sm text-[#0F172A]">{inv.email}</td>
                        <td className="px-4 py-3 text-xs text-[#94A3B8]">
                          {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(link)
                              setCopiedId(inv.id)
                              setTimeout(() => setCopiedId(null), 2000)
                            }}
                            className="flex items-center gap-1.5 text-xs text-[#1D4ED8] hover:underline"
                          >
                            {copied
                              ? <><Check size={12} className="text-[#059669]" /><span className="text-[#059669]">Copié</span></>
                              : <><Copy size={12} /><span>Copier le lien</span></>
                            }
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
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
                      )
                    })}
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

      {/* Comptes bancaires */}
      {tab === 'comptes' && (
        <div className="flex flex-col gap-4">

          {/* Liste */}
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

          {/* Formulaire ajout */}
          {showAddAccount ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 flex flex-col gap-4">
              <p className="text-sm font-semibold text-[#0F172A]">Nouveau compte</p>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Banque</span>
                  <select value={addForm.bank_id} onChange={e => setAddForm(f => ({ ...f, bank_id: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]">
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
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
                <button onClick={() => setShowAddAccount(false)}
                  className="text-sm text-[#64748B] hover:text-[#0F172A]">Annuler</button>
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

          {/* Barre d'actions */}
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

          {/* Prévisualisation import */}
          {importResult && (
            <div className={`border rounded-xl px-4 py-3 text-sm font-medium ${importResult.skipped > 0 ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#059669]'}`}>
              {importResult.ok} salarié(s) importé(s){importResult.skipped > 0 ? ` · ${importResult.skipped} ignoré(s) (doublon CIN/CNSS déjà en base)` : ''}
              <button onClick={() => setImportResult(null)} className="ml-3 text-xs underline opacity-70 hover:opacity-100">Fermer</button>
            </div>
          )}

          {importRows.length > 0 && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-[#92400E]">{importRows.length} salarié(s) à importer — vérifiez avant de confirmer</p>
              {importDupWarnings.length > 0 && (
                <ul className="text-xs text-[#92400E] list-disc list-inside space-y-0.5">
                  {importDupWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#FDE68A]">
                      {['Civ.','Nom','Prénom','Naissance','Contrat','Poste','Entrée'].map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-semibold text-[#92400E]">{h}</th>
                      ))}
                    </tr>
                  </thead>
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
                  {importing ? 'Import…' : `Confirmer l'import (${importRows.length})`}
                </button>
                <button onClick={() => { setImportRows([]); setImportDupWarnings([]) }} className="text-sm text-[#64748B] hover:text-[#0F172A]">Annuler</button>
              </div>
            </div>
          )}

          {/* Tableau salariés */}
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

          {/* Formulaire ajout */}
          {showAddEmployee && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 flex flex-col gap-4">
              <p className="text-sm font-semibold text-[#0F172A]">Nouveau salarié</p>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Civilité</span>
                  <select value={empForm.civility} onChange={e => setEmpForm(f => ({ ...f, civility: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]">
                    <option value="">—</option>
                    {CIVILITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Nom *</span>
                  <input value={empForm.last_name} onChange={e => setEmpForm(f => ({ ...f, last_name: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Prénom *</span>
                  <input value={empForm.first_name} onChange={e => setEmpForm(f => ({ ...f, first_name: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Date naissance</span>
                  <input type="date" value={empForm.birth_date} onChange={e => setEmpForm(f => ({ ...f, birth_date: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">N° Identité</span>
                  <input value={empForm.identity_ref} onChange={e => setEmpForm(f => ({ ...f, identity_ref: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">N° Social (CNSS)</span>
                  <input value={empForm.social_ref} onChange={e => setEmpForm(f => ({ ...f, social_ref: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Type de contrat</span>
                  <select value={empForm.contract_type} onChange={e => setEmpForm(f => ({ ...f, contract_type: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]">
                    <option value="">—</option>
                    {CONTRACT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Poste</span>
                  <input value={empForm.job_title} onChange={e => setEmpForm(f => ({ ...f, job_title: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Date entrée</span>
                  <input type="date" value={empForm.entry_date} onChange={e => setEmpForm(f => ({ ...f, entry_date: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Date sortie</span>
                  <input type="date" value={empForm.exit_date} onChange={e => setEmpForm(f => ({ ...f, exit_date: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={handleAddEmployee} disabled={empSaving || !empForm.last_name || !empForm.first_name}
                  className="px-5 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {empSaving ? 'Enregistrement…' : 'Ajouter'}
                </button>
                <button onClick={() => { setShowAddEmployee(false); setEmpForm(EMPTY_EMP_FORM); setEmpAddError(null) }}
                  className="text-sm text-[#64748B] hover:text-[#0F172A]">Annuler</button>
                {empAddError && <span className="text-xs text-[#DC2626]">{empAddError}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Services */}
      {tab === 'services' && (
        <div className="flex flex-col gap-4">

          {/* Services par groupe */}
          {GROUP_ORDER.filter(g => customerServices.some(s => s.service.group === g)).map(g => (
            <div key={g} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{GROUP_LABELS[g]}</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    {['Service','Fréquence','Depuis','Jusqu\'au','Commentaire','Statut',''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customerServices.filter(s => s.service.group === g).map((cs, i, arr) => (
                    <tr key={cs.id} className={i < arr.length - 1 ? 'border-b border-[#F1F5F9]' : ''}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-[#0F172A]">{cs.service.name}</div>
                        {cs.service.service_document_type.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {[...new Set(cs.service.service_document_type.map(d => d.document_type.name))].map(d => (
                              <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{d}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                          {FREQ_LABELS[cs.service.frequency] ?? cs.service.frequency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{fmtDate(cs.start_date)}</td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">{fmtDate(cs.end_date)}</td>
                      <td className="px-4 py-3 text-sm text-[#64748B] max-w-[160px] truncate">{cs.comment ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggleService(cs.id, cs.active)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            cs.active ? 'border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]' : 'border-[#BBF7D0] text-[#059669] hover:bg-[#F0FDF4]'
                          }`}>
                          {cs.active ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {confirmDeleteSvc === cs.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-[#64748B]">Supprimer ?</span>
                            <button onClick={() => handleDeleteService(cs.id)} disabled={deletingSvc === cs.id}
                              className="text-xs px-2 py-0.5 bg-[#DC2626] text-white rounded hover:bg-[#b91c1c] disabled:opacity-40 transition-colors">
                              {deletingSvc === cs.id ? '…' : 'Confirmer'}
                            </button>
                            <button onClick={() => setConfirmDeleteSvc(null)} className="text-xs text-[#64748B] hover:text-[#0F172A]">Annuler</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteSvc(cs.id)}
                            className="text-[#94A3B8] hover:text-[#DC2626] transition-colors p-1 rounded">
                            <Trash2 size={14} strokeWidth={1.75} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {customerServices.length === 0 && !showAddService && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-10 text-center text-sm text-[#94A3B8]">
              Aucun service ajouté pour ce client.
            </div>
          )}

          {/* Formulaire ajout */}
          {showAddService ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 flex flex-col gap-4">
              <p className="text-sm font-semibold text-[#0F172A]">Ajouter un service</p>
              <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Service</span>
                  <select value={svcForm.service_id} onChange={e => setSvcForm(f => ({ ...f, service_id: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]">
                    {GROUP_ORDER.map(g => {
                      const items = serviceCatalog.filter(s => s.group === g)
                      if (!items.length) return null
                      return (
                        <optgroup key={g} label={GROUP_LABELS[g]}>
                          {items.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </optgroup>
                      )
                    })}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Date de début</span>
                  <input type="date" value={svcForm.start_date} onChange={e => setSvcForm(f => ({ ...f, start_date: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Date de fin</span>
                  <input type="date" value={svcForm.end_date} onChange={e => setSvcForm(f => ({ ...f, end_date: e.target.value }))}
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Commentaire</span>
                  <input value={svcForm.comment} onChange={e => setSvcForm(f => ({ ...f, comment: e.target.value }))}
                    placeholder="ex. Inclus dans le forfait mensuel"
                    className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleAddService} disabled={svcSaving || !svcForm.service_id}
                  className="px-5 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {svcSaving ? 'Enregistrement…' : 'Ajouter'}
                </button>
                <button onClick={() => setShowAddService(false)} className="text-sm text-[#64748B] hover:text-[#0F172A]">Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddService(true)}
              className="self-start px-4 py-2 text-sm font-medium text-[#1D4ED8] border border-[#1D4ED8] rounded-lg hover:bg-[#EFF6FF] transition-colors">
              + Ajouter un service
            </button>
          )}
        </div>
      )}
    </div>
  )
}
