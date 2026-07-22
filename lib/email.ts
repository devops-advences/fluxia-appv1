import sgMail from '@sendgrid/mail'
import { createClient } from '@supabase/supabase-js'

function sendgrid() {
  if (!process.env.SENDGRID_API_KEY) return null
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  return sgMail
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:3000'
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type NotifyDepositParams = {
  customerId:   string
  customerName: string
  firmId:       string
  firmName:     string
  fileNames:    string[]
}

type NotifyStatusParams = {
  customerId: string
  firmName:   string
  fileName:   string
  status:     'processed' | 'rejected'
}

type NotifyInvitationParams = {
  email:        string
  firmName:     string
  customerName: string | null
  token:        string
}

export async function notifyDeposit(p: NotifyDepositParams) {
  const sg = sendgrid()
  if (!sg) return

  const db = serviceClient()

  const { data: users } = await db
    .from('user_data')
    .select('email')
    .eq('firm_id', p.firmId)
    .eq('role', 'firm')

  const emails = (users ?? []).map(u => u.email).filter(Boolean) as string[]
  if (emails.length === 0) return

  const n        = p.fileNames.length
  const plural   = n > 1
  const listHtml = p.fileNames.map(f => `<li style="margin-bottom:4px;">${esc(f)}</li>`).join('')

  await sg.send({
    from:    'Fluxia <noreply@advences.io>',
    to:      emails,
    subject: `${esc(p.customerName)} a déposé ${n} document${plural ? 's' : ''}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff;">
        <div style="margin-bottom:24px;">
          <span style="font-size:16px;font-weight:700;color:#0F172A;">Fluxia</span>
        </div>
        <h1 style="font-size:20px;font-weight:600;color:#0F172A;margin:0 0 8px;">
          Nouveau${plural ? 'x' : ''} document${plural ? 's' : ''} reçu${plural ? 's' : ''}
        </h1>
        <p style="font-size:14px;color:#64748B;margin:0 0 16px;">
          Votre client <strong>${esc(p.customerName)}</strong> vient de déposer ${n} document${plural ? 's' : ''} :
        </p>
        <ul style="padding:0 0 0 20px;margin:0 0 24px;font-size:13px;color:#0F172A;">
          ${listHtml}
        </ul>
        <a href="${appUrl()}/documents" style="display:inline-block;padding:10px 24px;background:#1D4ED8;color:#fff;font-size:13px;font-weight:500;border-radius:6px;text-decoration:none;">
          Voir les documents
        </a>
        <p style="font-size:12px;color:#94A3B8;margin-top:24px;">
          Vous recevez cet email car vous gérez cet espace documentaire sur Fluxia.
        </p>
      </div>
    `,
  })
}

export async function notifyStatus(p: NotifyStatusParams) {
  const sg = sendgrid()
  if (!sg) return

  const db = serviceClient()

  const { data: links } = await db
    .from('user_customer')
    .select('user:user_id(email, role)')
    .eq('customer_id', p.customerId)

  const emails = (links ?? [])
    .map(l => (l.user as unknown as { email: string; role: string } | null))
    .filter(u => u?.role === 'customer')
    .map(u => u!.email)
    .filter(Boolean) as string[]

  if (emails.length === 0) return

  const rejected = p.status === 'rejected'
  const headline = rejected ? 'Document rejeté' : 'Document traité'
  const message  = rejected
    ? `<strong>${esc(p.firmName)}</strong> a rejeté le document suivant. Veuillez en déposer une nouvelle version.`
    : `<strong>${esc(p.firmName)}</strong> a traité le document suivant.`
  const ctaColor = rejected ? '#DC2626' : '#059669'
  const cta      = rejected ? 'Déposer un nouveau document' : 'Voir mes documents'

  await sg.send({
    from:    'Fluxia <noreply@advences.io>',
    to:      emails,
    subject: rejected
      ? `${esc(p.firmName)} a rejeté un de vos documents`
      : `${esc(p.firmName)} a traité un de vos documents`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff;">
        <div style="margin-bottom:24px;">
          <span style="font-size:16px;font-weight:700;color:#0F172A;">Fluxia</span>
        </div>
        <h1 style="font-size:20px;font-weight:600;color:#0F172A;margin:0 0 8px;">${headline}</h1>
        <p style="font-size:14px;color:#64748B;margin:0 0 8px;">${message}</p>
        <p style="font-size:13px;color:#0F172A;background:#F8FAFC;padding:10px 14px;border-radius:6px;margin:0 0 24px;font-family:monospace;">
          ${esc(p.fileName)}
        </p>
        <a href="${appUrl()}/mes-documents" style="display:inline-block;padding:10px 24px;background:${ctaColor};color:#fff;font-size:13px;font-weight:500;border-radius:6px;text-decoration:none;">
          ${cta}
        </a>
        <p style="font-size:12px;color:#94A3B8;margin-top:24px;">
          Vous recevez cet email car vous disposez d&apos;un espace documentaire Fluxia.
        </p>
      </div>
    `,
  })
}

type NotifyMessageParams = {
  firmId:       string
  customerId:   string
  senderRole:   'firm' | 'customer'
  senderName:   string
  documentName: string | null
  messageBody:  string
}

export async function notifyMessage(p: NotifyMessageParams) {
  const sg = sendgrid()
  if (!sg) return

  const db = serviceClient()

  let emails: string[] = []

  if (p.senderRole === 'customer') {
    // Notifier les collaborateurs cab assignés à ce dossier + les admins
    const [{ data: assignedLinks }, { data: admins }] = await Promise.all([
      db.from('user_customer')
        .select('user:user_id(email, role)')
        .eq('customer_id', p.customerId),
      db.from('user_data')
        .select('email')
        .eq('firm_id', p.firmId)
        .eq('role', 'firm')
        .eq('admin', true),
    ])
    const assignedEmails = (assignedLinks ?? [])
      .map(l => (l.user as unknown as { email: string; role: string } | null))
      .filter(u => u?.role === 'firm')
      .map(u => u!.email)
    const adminEmails = (admins ?? []).map(u => u.email)
    emails = [...new Set([...assignedEmails, ...adminEmails])].filter(Boolean) as string[]
  } else {
    // Notifier les users client liés au customer
    const { data: links } = await db
      .from('user_customer')
      .select('user:user_id(email, role)')
      .eq('customer_id', p.customerId)
    emails = (links ?? [])
      .map(l => (l.user as unknown as { email: string; role: string } | null))
      .filter(u => u?.role === 'customer')
      .map(u => u!.email)
      .filter(Boolean) as string[]
  }

  if (emails.length === 0) return

  const docLabel = p.documentName ? `<strong>${esc(p.documentName)}</strong>` : 'un document'
  const ctaUrl   = p.senderRole === 'customer' ? `${appUrl()}/documents` : `${appUrl()}/mes-documents`

  await sg.send({
    from:    'Fluxia <noreply@advences.io>',
    to:      emails,
    subject: `Nouveau message de ${esc(p.senderName)} sur Fluxia`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff;">
        <div style="margin-bottom:24px;">
          <span style="font-size:16px;font-weight:700;color:#0F172A;">Fluxia</span>
        </div>
        <h1 style="font-size:20px;font-weight:600;color:#0F172A;margin:0 0 8px;">Nouveau message</h1>
        <p style="font-size:14px;color:#64748B;margin:0 0 16px;">
          <strong>${esc(p.senderName)}</strong> vous a envoyé un message concernant ${docLabel} :
        </p>
        <div style="background:#F8FAFC;border-left:3px solid #1D4ED8;padding:12px 16px;border-radius:0 6px 6px 0;font-size:13px;color:#0F172A;margin:0 0 24px;">
          ${esc(p.messageBody.slice(0, 300))}${p.messageBody.length > 300 ? '…' : ''}
        </div>
        <a href="${ctaUrl}" style="display:inline-block;padding:10px 24px;background:#1D4ED8;color:#fff;font-size:13px;font-weight:500;border-radius:6px;text-decoration:none;">
          Voir et répondre
        </a>
        <p style="font-size:12px;color:#94A3B8;margin-top:24px;">
          Vous recevez cet email car vous êtes lié à cet espace documentaire sur Fluxia.
        </p>
      </div>
    `,
  })
}

export async function notifyInvitation(p: NotifyInvitationParams) {
  const sg = sendgrid()
  if (!sg) return

  const inviteUrl  = `${appUrl()}/invite/${p.token}`
  const contextLine = p.customerName
    ? `Vous avez été invité à accéder au portail client de <strong>${esc(p.customerName)}</strong> géré par <strong>${esc(p.firmName)}</strong>.`
    : `Vous avez été invité à accéder à l&apos;espace documentaire de <strong>${esc(p.firmName)}</strong>.`

  await sg.send({
    from:    'Fluxia <noreply@advences.io>',
    to:      p.email,
    subject: `${esc(p.firmName)} vous invite sur Fluxia`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff;">
        <div style="margin-bottom:24px;">
          <span style="font-size:16px;font-weight:700;color:#0F172A;">Fluxia</span>
        </div>
        <h1 style="font-size:20px;font-weight:600;color:#0F172A;margin:0 0 8px;">Vous avez une invitation</h1>
        <p style="font-size:14px;color:#64748B;margin:0 0 24px;">${contextLine}</p>
        <a href="${inviteUrl}" style="display:inline-block;padding:10px 24px;background:#1D4ED8;color:#fff;font-size:13px;font-weight:500;border-radius:6px;text-decoration:none;">
          Créer mon accès
        </a>
        <p style="font-size:12px;color:#94A3B8;margin-top:24px;">
          Ce lien est valable 7 jours. Si vous n&apos;attendiez pas cette invitation, ignorez cet email.
        </p>
      </div>
    `,
  })
}
