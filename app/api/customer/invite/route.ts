import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Must be admin on this customer
  const { data: uc } = await service
    .from('user_customer').select('customer_id, admin').eq('user_id', user.id).limit(1).single()
  if (!uc?.customer_id || !uc.admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: cust } = await service
    .from('customer').select('firm_id').eq('id', uc.customer_id).single()
  if (!cust) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  let body: { email: string }
  try {
    body = await req.json() as { email: string }
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  if (!body.email?.trim()) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

  const { data, error } = await service.from('user_invitation').insert({
    firm_id:     cust.firm_id,
    customer_id: uc.customer_id,
    email:       body.email.trim().toLowerCase(),
    role:        'customer',
    token:       crypto.randomUUID(),
    invited_by:  user.id,
    status:      'pending',
    expires_at:  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }).select('id, email, status, expires_at, created_at').single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Invitation déjà en attente pour cet email.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, invite: data })
}
