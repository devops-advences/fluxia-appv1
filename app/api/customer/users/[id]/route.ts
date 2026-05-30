import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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

  let body: { admin: boolean }
  try {
    body = await req.json() as { admin: boolean }
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const { error } = await service
    .from('user_customer')
    .update({ admin: body.admin })
    .eq('user_id', id)
    .eq('customer_id', uc.customer_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
