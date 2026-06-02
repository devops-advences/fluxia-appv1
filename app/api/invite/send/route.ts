import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { notifyInvitation } from '@/lib/email'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: ud } = await service
    .from('user_data').select('firm_id, role').eq('id', user.id).single()
  if (!ud) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { invitationId } = await req.json() as { invitationId: string }
  if (!invitationId) return NextResponse.json({ error: 'invitationId manquant' }, { status: 400 })

  let inv: { email: string; token: string; firm_id: string; customer_id: string | null } | null = null

  if (ud.role === 'firm') {
    const { data } = await service
      .from('user_invitation')
      .select('email, token, firm_id, customer_id')
      .eq('id', invitationId)
      .eq('firm_id', ud.firm_id)
      .eq('status', 'pending')
      .single()
    inv = data
  } else if (ud.role === 'customer') {
    // Admin client : vérifier qu'il est admin sur le customer lié à l'invitation
    const { data: uc } = await service
      .from('user_customer').select('customer_id, admin').eq('user_id', user.id).limit(1).single()
    if (uc?.admin) {
      const { data } = await service
        .from('user_invitation')
        .select('email, token, firm_id, customer_id')
        .eq('id', invitationId)
        .eq('customer_id', uc.customer_id)
        .eq('status', 'pending')
        .single()
      inv = data
    }
  }

  if (!inv) return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 })

  const { data: firm } = await service
    .from('firm').select('name').eq('id', inv.firm_id).single()

  let customerName: string | null = null
  if (inv.customer_id) {
    const { data: cust } = await service
      .from('customer').select('name').eq('id', inv.customer_id).single()
    customerName = cust?.name ?? null
  }

  try {
    await notifyInvitation({
      email:        inv.email,
      firmName:     firm?.name ?? '',
      customerName,
      token:        inv.token,
    })
  } catch (err) {
    console.error('notifyInvitation:', err)
    return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
