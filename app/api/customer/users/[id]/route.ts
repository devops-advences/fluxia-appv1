import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

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

  let body: { admin?: boolean; active?: boolean }
  try {
    body = await req.json() as { admin?: boolean; active?: boolean }
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  if (typeof body.admin === 'boolean') {
    const { error } = await service
      .from('user_customer')
      .update({ admin: body.admin })
      .eq('user_id', id)
      .eq('customer_id', uc.customer_id)
    if (error) { console.error('customer/users PATCH:', error); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }
  }

  if (typeof body.active === 'boolean') {
    // Vérifier que la cible n'est pas admin client (seul admin cab peut désactiver un admin client)
    const { data: targetUc } = await service
      .from('user_customer').select('admin').eq('user_id', id).eq('customer_id', uc.customer_id).single()
    if (targetUc?.admin) return NextResponse.json({ error: 'Impossible de désactiver un admin.' }, { status: 403 })

    const { error } = await service.from('user_data').update({ active: body.active }).eq('id', id)
    if (error) { console.error('customer/users PATCH:', error); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }
  }

  return NextResponse.json({ ok: true })
}
