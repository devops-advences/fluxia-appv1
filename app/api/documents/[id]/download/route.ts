import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Fetch document
  const { data: doc } = await service
    .from('document')
    .select('id, storage_path, firm_id, customer_id, file')
    .eq('id', id)
    .single()

  if (!doc || !doc.storage_path) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  // Verify access: firm user or linked customer
  const { data: ud } = await service
    .from('user_data').select('firm_id, role').eq('id', user.id).single()

  if (!ud) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const isFirm     = ud.role === 'firm'     && ud.firm_id === doc.firm_id
  const isCustomer = ud.role === 'customer'

  if (!isFirm && !isCustomer) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  if (isCustomer) {
    const { data: uc } = await service
      .from('user_customer')
      .select('customer_id')
      .eq('user_id', user.id)
      .eq('customer_id', doc.customer_id)
      .single()
    if (!uc) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { data: signed } = await service.storage
    .from(doc.firm_id)
    .createSignedUrl(doc.storage_path, 60)

  if (!signed?.signedUrl) return NextResponse.json({ error: 'Impossible de générer le lien' }, { status: 500 })

  return NextResponse.json({ url: signed.signedUrl })
}
