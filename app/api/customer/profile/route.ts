import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'

export async function PATCH(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: uc } = await service
    .from('user_customer').select('customer_id').eq('user_id', user.id).limit(1).single()
  if (!uc?.customer_id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  let body: Record<string, string | null>
  try {
    body = await req.json() as Record<string, string | null>
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const ALLOWED = ['name', 'email', 'phone', 'website', 'address', 'address_2', 'city', 'postal_code', 'tax_ref_main', 'tax_ref_vat']
  const updates: Record<string, string | null> = {}
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key] || null
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  const { error } = await service.from('customer').update(updates).eq('id', uc.customer_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
