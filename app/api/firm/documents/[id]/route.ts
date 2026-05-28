import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { notifyStatus } from '@/lib/email'

const ALLOWED_STATUSES = ['processed', 'rejected'] as const
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

  let body: { status?: string; notes?: string }
  try {
    body = await req.json() as { status?: string; notes?: string }
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const { status, notes } = body

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

  const updates: Record<string, string | null> = {}
  if (status !== undefined) updates.status = status
  if (notes  !== undefined) updates.notes  = notes || null

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  const { error: updateError } = await service
    .from('document').update(updates).eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Notify client only on status change to processed/rejected
  if (status && ALLOWED_STATUSES.includes(status as AllowedStatus) && status !== doc.status) {
    const { data: firm } = await service
      .from('firm').select('name').eq('id', doc.firm_id).single()

    try {
      await notifyStatus({
        customerId: doc.customer_id,
        firmName:   firm?.name ?? '',
        fileName:   doc.filename ?? 'Document',
        status:     status as 'processed' | 'rejected',
        clientUrl:  process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3001',
      })
    } catch (err) {
      console.error('notifyStatus:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
