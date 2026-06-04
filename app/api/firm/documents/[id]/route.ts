import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { notifyStatus } from '@/lib/email'

const ALLOWED_STATUSES = ['pending', 'processed', 'rejected'] as const
type AllowedStatus = typeof ALLOWED_STATUSES[number]

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: ud } = await service
    .from('user_data').select('firm_id, role').eq('id', user.id).single()
  if (!ud || ud.role !== 'firm') return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  let body: { status?: string; notes?: string; type_id?: string | null; year?: number; months?: number[] | null }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const { status, notes, type_id, year, months } = body

  if (status !== undefined && !ALLOWED_STATUSES.includes(status as AllowedStatus)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  // Fetch document and verify ownership
  const { data: doc } = await service
    .from('document')
    .select('id, firm_id, customer_id, filename, status, notes')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (doc.firm_id !== ud.firm_id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  if (doc.status === 'draft') return NextResponse.json({ error: 'Action non autorisée sur un brouillon' }, { status: 403 })

  const updates: Record<string, unknown> = {}
  if (status   !== undefined) updates.status  = status
  if (notes    !== undefined) updates.notes   = notes || null
  if (type_id  !== undefined) updates.type_id = type_id || null
  if (year     !== undefined) updates.year    = year
  if (months   !== undefined) updates.months  = months?.length ? months : null

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  const { error: updateError } = await service
    .from('document').update(updates).eq('id', id)

  if (updateError) { console.error('firm/documents PATCH:', updateError); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }

  if (status && status !== doc.status) {
    await service.from('document_event').insert({
      document_id: id,
      user_id:     user.id,
      event_type:  'status_changed',
      old_status:  doc.status,
      new_status:  status,
    })
  }

  // Notify client only on status change to processed/rejected (not pending)
  if (status && status !== 'pending' && ALLOWED_STATUSES.includes(status as AllowedStatus) && status !== doc.status) {
    const { data: firm } = await service
      .from('firm').select('name').eq('id', doc.firm_id).single()

    try {
      await notifyStatus({
        customerId: doc.customer_id,
        firmName:   firm?.name ?? '',
        fileName:   doc.filename ?? 'Document',
        status:     status as 'processed' | 'rejected',
      })
    } catch (err) {
      console.error('notifyStatus:', err)
    }
  }

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

  const { data: ud } = await service
    .from('user_data').select('firm_id, role').eq('id', user.id).single()
  if (!ud || ud.role !== 'firm') return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: doc } = await service
    .from('document').select('id, firm_id, storage_path').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (doc.firm_id !== ud.firm_id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  if (doc.storage_path) {
    await service.storage.from(doc.firm_id).remove([doc.storage_path])
  }

  const { error } = await service.from('document').delete().eq('id', id)
  if (error) { console.error('firm/documents DELETE:', error); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}
