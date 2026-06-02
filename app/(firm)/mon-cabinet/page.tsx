'use client'

import { useEffect, useState } from 'react'
import { ImageUp, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

type FirmData = {
  id: string
  name: string
  slug: string
  email: string | null
  phone: string | null
  website: string | null
  tax_ref_main: string | null
  tax_ref_vat: string | null
  accounting_software: string | null
  software_version: string | null
  hosting_type: string | null
  address: string | null
  address_2: string | null
  city: string | null
  postal_code: string | null
  country_code: string
  storage_quota_mb: number
  storage_used_kb: number
}

type UserRow = {
  id: string
  first_name: string
  last_name: string
  admin: boolean
  active: boolean
  created_at: string
}

type InviteRow = {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  created_at: string
}

type Tab = 'donnees' | 'utilisateurs'

function Field({ label, value, readOnly, onChange }: {
  label: string; value: string; readOnly?: boolean; onChange?: (val: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{label}</span>
      {readOnly ? (
        <span className="text-sm text-[#0F172A]">{value || '—'}</span>
      ) : (
        <input
          value={value}
          onChange={e => onChange?.(e.target.value)}
          className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
        />
      )}
    </div>
  )
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (val: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
      >
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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

export default function MonCabinetPage() {
  const [tab, setTab]                     = useState<Tab>('donnees')
  const [firm, setFirm]                   = useState<FirmData | null>(null)
  const [isAdmin, setIsAdmin]             = useState(false)
  const [users, setUsers]                 = useState<UserRow[]>([])
  const [invites, setInvites]             = useState<InviteRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading]             = useState(true)

  // form
  const [form, setForm]         = useState<Partial<FirmData>>({})
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // logo
  const [logoUrl, setLogoUrl]       = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError]   = useState<string | null>(null)

  // invite form
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteAdmin, setInviteAdmin]   = useState(false)
  const [inviting, setInviting]         = useState(false)
  const [inviteSent, setInviteSent]     = useState(false)
  const [inviteError, setInviteError]   = useState('')
  const [cancelling, setCancelling]       = useState<string | null>(null)
  const [resending, setResending]         = useState<string | null>(null)
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null)
  const [togglingActive, setTogglingActive] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setCurrentUserId(session.user.id)

      const { data: ud } = await supabase
        .from('user_data')
        .select('firm_id, admin')
        .eq('id', session.user.id)
        .single()

      if (!ud?.firm_id) { setLoading(false); return }
      setIsAdmin(!!ud.admin)

      const [{ data: firmData }, { data: usersData }, { data: invitesData }] = await Promise.all([
        supabase.from('firm').select('*, logo_url').eq('id', ud.firm_id).single(),
        supabase
          .from('user_data')
          .select('id, first_name, last_name, admin, active, created_at')
          .eq('firm_id', ud.firm_id)
          .eq('role', 'firm')
          .order('created_at', { ascending: true }),
        supabase
          .from('user_invitation')
          .select('id, email, role, status, expires_at, created_at')
          .eq('firm_id', ud.firm_id)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ])

      if (firmData) {
        const f = firmData as FirmData & { logo_url?: string | null }
        setFirm(f)
        setLogoUrl(f.logo_url ?? null)
        setForm({
          name:                f.name,
          email:               f.email               ?? '',
          phone:               f.phone               ?? '',
          website:             f.website             ?? '',
          tax_ref_main:        f.tax_ref_main        ?? '',
          tax_ref_vat:         f.tax_ref_vat         ?? '',
          accounting_software: f.accounting_software ?? '',
          software_version:    f.software_version    ?? '',
          hosting_type:        f.hosting_type        ?? '',
          address:             f.address             ?? '',
          address_2:           f.address_2           ?? '',
          city:                f.city                ?? '',
          postal_code:         f.postal_code         ?? '',
        })
      }

      if (usersData)  setUsers(usersData as UserRow[])
      if (invitesData) setInvites(invitesData as InviteRow[])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    if (!firm) return
    setSaving(true); setSaved(false); setSaveError(null)
    const { error } = await supabase.from('firm').update({
      name:                form.name                || null,
      email:               form.email               || null,
      phone:               form.phone               || null,
      website:             form.website             || null,
      tax_ref_main:        form.tax_ref_main        || null,
      tax_ref_vat:         form.tax_ref_vat         || null,
      accounting_software: form.accounting_software || null,
      software_version:    form.software_version    || null,
      hosting_type:        form.hosting_type        || null,
      address:             form.address             || null,
      address_2:           form.address_2           || null,
      city:                form.city                || null,
      postal_code:         form.postal_code         || null,
    }).eq('id', firm.id)
    if (error) setSaveError('Erreur lors de la sauvegarde')
    else setSaved(true)
    setSaving(false)
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true); setLogoError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const form = new FormData()
    form.append('logo', file)
    const res = await fetch('/api/firm/logo', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form,
    })
    if (res.ok) {
      const { logo_url } = await res.json() as { logo_url: string }
      setLogoUrl(logo_url)
    } else {
      const { error } = await res.json() as { error: string }
      setLogoError(error ?? 'Erreur lors de l\'upload')
    }
    setLogoUploading(false)
  }

  async function handleLogoDelete() {
    setLogoUploading(true); setLogoError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    await fetch('/api/firm/logo', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
    setLogoUrl(null)
    setLogoUploading(false)
  }

  async function handleInvite() {
    if (!firm || !currentUserId) return
    setInviting(true); setInviteError('')
    const { data, error } = await supabase
      .from('user_invitation')
      .insert({
        firm_id:    firm.id,
        email:      inviteEmail.trim(),
        role:       'firm',
        token:      crypto.randomUUID(),
        invited_by: currentUserId,
        status:     'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, email, role, status, expires_at, created_at')
      .single()

    if (error) {
      setInviteError(
        error.code === '23505'
          ? 'Une invitation est déjà en attente pour cet email.'
          : 'Erreur lors de l\'invitation.'
      )
    } else {
      setInvites(prev => [data as InviteRow, ...prev])
      setInviteSent(true)
      setInviteEmail('')
      setInviteAdmin(false)
      // Envoyer l'email d'invitation
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
    setTogglingAdmin(userId)
    const { error } = await supabase
      .from('user_data')
      .update({ admin: !current })
      .eq('id', userId)
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, admin: !current } : u))
    setTogglingAdmin(null)
  }

  async function handleToggleUserActive(userId: string, current: boolean) {
    setTogglingActive(userId)
    const { error } = await supabase
      .from('user_data')
      .update({ active: !current })
      .eq('id', userId)
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !current } : u))
    setTogglingActive(null)
  }

  async function handleCancel(id: string) {
    setCancelling(id)
    const { error } = await supabase
      .from('user_invitation')
      .update({ status: 'revoked' })
      .eq('id', id)
    if (!error) setInvites(prev => prev.filter(i => i.id !== id))
    setCancelling(null)
  }

  async function handleResend(id: string) {
    setResending(id)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      await fetch('/api/invite/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ invitationId: id }),
      })
    }
    setResending(null)
  }

  function set(key: keyof FirmData) {
    return (val: string) => { setForm(f => ({ ...f, [key]: val })); setSaved(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!firm) return <p className="text-sm text-[#64748B]">Aucun cabinet associé à ce compte.</p>

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">Mon cabinet</h1>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] mb-6">
        {(['donnees', 'utilisateurs'] as Tab[]).map(t => {
          const labels: Record<Tab, string> = { donnees: 'Données générales', utilisateurs: 'Utilisateurs' }
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-[#1D4ED8] text-[#1D4ED8]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {labels[t]}
            </button>
          )
        })}
      </div>

      {/* Données générales */}
      {tab === 'donnees' && (
        <div className="flex flex-col gap-4">

          {/* Logo */}
          {isAdmin && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <p className="text-sm font-semibold text-[#0F172A] mb-4">Logo du cabinet</p>
              <div className="flex flex-col items-start gap-2">
                <div className="w-32 h-14 border border-[#E2E8F0] rounded-lg flex items-center justify-center bg-[#F8FAFC] shrink-0 overflow-hidden">
                  {logoUrl
                    ? <img src={logoUrl} alt="Logo" className="max-h-12 max-w-[120px] object-contain" />
                    : <span className="text-xs text-[#94A3B8]">Aucun logo</span>
                  }
                </div>
                <div className="flex items-center gap-1.5">
                  <label
                    title={logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
                    className={`w-8 h-8 flex items-center justify-center border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors ${logoUploading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <ImageUp size={15} strokeWidth={1.75} />
                    <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                      disabled={logoUploading}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }} />
                  </label>
                  {logoUrl && (
                    <button
                      onClick={handleLogoDelete}
                      disabled={logoUploading}
                      title="Supprimer le logo"
                      className="w-8 h-8 flex items-center justify-center border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#DC2626] hover:border-[#FECACA] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
                {logoError && <span className="text-xs text-[#DC2626]">{logoError}</span>}
                <span className="text-xs text-[#94A3B8]">PNG, JPG, SVG, WEBP · max 2 Mo</span>
              </div>
            </div>
          )}

          <Section title="Identité">
            <Field label="Nom du cabinet"    value={form.name         ?? ''} onChange={set('name')} />
            <Field label="Référence"          value={firm.slug}              readOnly />
            <Field label="Pays"               value={firm.country_code}      readOnly />
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

          <Section title="Logiciel comptable">
            <Field label="Logiciel" value={form.accounting_software ?? ''} onChange={set('accounting_software')} />
            <Field label="Version"  value={form.software_version    ?? ''} onChange={set('software_version')} />
            <SelectField label="Hébergement" value={form.hosting_type ?? ''} onChange={set('hosting_type')}
              options={[
                { value: 'local_pc',     label: 'Sur PC' },
                { value: 'local_server', label: 'Sur serveur bureau' },
                { value: 'cloud',        label: 'Cloud' },
              ]}
            />
          </Section>

          {(() => {
            const usedMb       = Math.round(firm.storage_used_kb / 1024)
            const quotaGb      = Math.round(firm.storage_quota_mb / 1024)
            const pct          = Math.min(100, Math.round((firm.storage_used_kb / (firm.storage_quota_mb * 1024)) * 100))
            const fillColor    = pct > 90 ? '#DC2626' : pct >= 70 ? '#D97706' : '#059669'
            return (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
                <p className="text-sm font-semibold text-[#0F172A] mb-3">Stockage</p>
                <p className="text-sm text-[#64748B] mb-2">{usedMb} Mo / {quotaGb} Go utilisés</p>
                <div className="h-2 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    style={{ width: `${pct}%`, backgroundColor: fillColor }}
                    className="h-full rounded-full transition-all"
                  />
                </div>
                {pct > 90 && (
                  <p className="mt-2 text-xs text-[#DC2626]">Quota de stockage presque atteint. Contactez le support pour augmenter votre limite.</p>
                )}
              </div>
            )
          })()}

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
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

          {/* Users table */}
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
                      {u.id === currentUserId && <span className="ml-1.5 text-xs text-[#94A3B8]">(vous)</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && u.id !== currentUserId ? (
                        <button
                          onClick={() => handleToggleAdmin(u.id, u.admin)}
                          disabled={togglingAdmin === u.id}
                          title="Cliquer pour changer"
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40 cursor-pointer ${
                            u.admin
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                              : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]'
                          }`}
                        >
                          {u.admin ? 'Admin' : 'Collaborateur'}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.admin
                            ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                            : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]'
                        }`}>
                          {u.admin ? 'Admin' : 'Collaborateur'}
                        </span>
                      )}
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
                        <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">
                          {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (
                            <div className="flex items-center justify-end gap-3">
                              <button onClick={() => handleResend(inv.id)} disabled={resending === inv.id || cancelling === inv.id}
                                className="text-xs text-[#1D4ED8] hover:underline disabled:opacity-40">
                                {resending === inv.id ? 'Envoi…' : 'Renvoyer'}
                              </button>
                              <button onClick={() => handleCancel(inv.id)} disabled={cancelling === inv.id || resending === inv.id}
                                className="text-xs text-[#DC2626] hover:underline disabled:opacity-40">
                                {cancelling === inv.id ? 'Annulation…' : 'Annuler'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invite form — admin only */}
          {isAdmin && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
              <p className="text-sm font-semibold text-[#0F172A] mb-1">Inviter un collaborateur</p>
              <p className="text-xs text-[#64748B] mb-4">Un lien d'invitation sera généré pour rejoindre le cabinet.</p>

              {inviteSent ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#059669]">Invitation créée.</span>
                  <button onClick={() => setInviteSent(false)}
                    className="text-sm text-[#1D4ED8] hover:underline">
                    Inviter un autre
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Email</span>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
                      placeholder="collaborateur@cabinet.com"
                      className="text-sm px-2.5 py-1.5 border border-[#E2E8F0] rounded-lg bg-white text-[#0F172A] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Rôle</span>
                    <div className="flex gap-4 py-1.5">
                      {([{ val: false, label: 'Collaborateur' }, { val: true, label: 'Admin' }] as const).map(({ val, label }) => (
                        <label key={label} className="flex items-center gap-1.5 cursor-pointer text-sm text-[#0F172A]">
                          <input type="radio" checked={inviteAdmin === val} onChange={() => setInviteAdmin(val)}
                            className="accent-[#1D4ED8] w-3.5 h-3.5 cursor-pointer" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="px-5 py-1.5 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {inviting ? 'Envoi…' : 'Inviter'}
                  </button>
                  {inviteError && <p className="text-xs text-[#DC2626] w-full">{inviteError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
