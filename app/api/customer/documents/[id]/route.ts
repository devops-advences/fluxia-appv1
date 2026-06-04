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

  const { data: ud } = await service
    .from('user_data').select('role').eq('id', user.id).single()
  if (!ud || ud.role !== 'customer') return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  // Verify the customer owns this document
  const { data: uc } = await service
    .from('user_customer').select('customer_id').eq('user_id', user.id).limit(1).single()
  if (!uc) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: doc } = await service
    .from('document').select('id, customer_id, status').eq('id', id).single()
  if (!doc || doc.customer_id !== uc.customer_id)
    return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  let body: { type_id?: string | null; year?: number; months?: number[] | null }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const { type_id, year, months } = body
  const updates: Record<string, unknown> = {}
  if (type_id  !== undefined) updates.type_id = type_id || null
  if (year     !== undefined) updates.year    = year
  if (months   !== undefined) updates.months  = months?.length ? months : null

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  const { error } = await service.from('document').update(updates).eq('id', id)
  if (error) { console.error('customer/documents PATCH/DELETE:', error); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: uc } = await service
    .from('user_customer').select('customer_id').eq('user_id', user.id).limit(1).single()
  if (!uc) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: doc } = await service
    .from('document').select('id, firm_id, customer_id, storage_path, status').eq('id', id).single()
  if (!doc || doc.customer_id !== uc.customer_id)
    return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  if (doc.status !== 'pending' && doc.status !== 'draft')
    return NextResponse.json({ error: 'Impossible de supprimer un document déjà traité' }, { status: 403 })

  if (doc.storage_path) {
    await service.storage.from(doc.firm_id).remove([doc.storage_path])
  }

  const { error } = await service.from('document').delete().eq('id', id)
  if (error) { console.error('customer/documents PATCH/DELETE:', error); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}
