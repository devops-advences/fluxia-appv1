import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { sendAuditReport } from '@/lib/email'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: ud } = await service
    .from('user_data').select('firm_id, role').eq('id', user.id).single()
  if (!ud || ud.role !== 'firm') return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { customerId } = await req.json() as { customerId: string }
  if (!customerId) return NextResponse.json({ error: 'customerId manquant' }, { status: 400 })

  const { data: customer } = await service
    .from('customer').select('name, email').eq('id', customerId).eq('firm_id', ud.firm_id).single()
  if (!customer) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  if (!customer.email) return NextResponse.json({ error: 'Aucun email renseigné dans la fiche client' }, { status: 400 })

  const { data: firm } = await service
    .from('firm').select('name, logo_url, email').eq('id', ud.firm_id).single()
  if (!firm) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 404 })

  // Reply-To : le collaborateur qui envoie réellement, pas un email générique du cabinet
  const replyTo = user.email ?? firm.email

  const { data: run } = await service
    .from('audit_run').select('period_start, period_end')
    .eq('customer_id', customerId).eq('firm_id', ud.firm_id)
    .order('created_at', { ascending: false }).limit(1).single()
  if (!run) return NextResponse.json({ error: 'Aucun audit pour ce dossier' }, { status: 404 })

  const { data: findings } = await service
    .from('audit_finding')
    .select('object_name, object_ref, message, message_override, severity')
    .eq('customer_id', customerId).eq('firm_id', ud.firm_id).eq('status', 'open')
  if (!findings || findings.length === 0) return NextResponse.json({ error: 'Aucun point ouvert à envoyer' }, { status: 400 })

  try {
    await sendAuditReport({
      firmName:      firm.name,
      firmLogoUrl:   firm.logo_url,
      firmReplyTo:   replyTo,
      customerName:  customer.name,
      customerEmail: customer.email,
      periodStart:   run.period_start,
      periodEnd:     run.period_end,
      findings: findings.map(f => ({
        objectName: f.object_name ?? f.object_ref,
        message:    f.message_override ?? f.message,
        severity:   f.severity,
      })),
    })
  } catch (err) {
    console.error('sendAuditReport:', err)
    return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
