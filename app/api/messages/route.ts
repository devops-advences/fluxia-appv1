import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { notifyMessage } from '@/lib/email'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: unknown): v is string { return typeof v === 'string' && UUID_RE.test(v) }

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return null
  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return null
  const { data: ud } = await service
    .from('user_data').select('id, firm_id, role, first_name, last_name').eq('id', user.id).single()
  return ud ? { ...ud, authId: user.id } : null
}

// GET /api/messages?objectType=document&objectId=xxx
export async function GET(req: Request) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const objectId = searchParams.get('objectId')
  if (!isUuid(objectId)) return NextResponse.json({ error: 'objectId invalide' }, { status: 400 })

  const service = createServiceClient()

  const { data: msgs, error } = await service
    .from('message')
    .select('id, body, created_at, sender_id')
    .eq('object_type', 'document')
    .eq('object_id', objectId)
    .order('created_at', { ascending: true })

  if (error) { console.error('messages GET:', error); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }

  const senderIds = [...new Set((msgs ?? []).map(m => m.sender_id))]
  const { data: users } = senderIds.length
    ? await service.from('user_data').select('id, first_name, last_name, role').in('id', senderIds)
    : { data: [] }

  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]))

  const enriched = (msgs ?? []).map(m => ({
    id:         m.id,
    body:       m.body,
    created_at: m.created_at,
    sender_id:  m.sender_id,
    sender:     userMap[m.sender_id] ?? null,
  }))

  return NextResponse.json({ messages: enriched })
}

// POST /api/messages
export async function POST(req: Request) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let body: { objectId?: string; body?: string; firmId?: string; customerId?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  const { objectId, body: msgBody, firmId, customerId } = body
  if (!isUuid(objectId))    return NextResponse.json({ error: 'objectId invalide' }, { status: 400 })
  if (!isUuid(firmId))      return NextResponse.json({ error: 'firmId invalide' }, { status: 400 })
  if (!isUuid(customerId))  return NextResponse.json({ error: 'customerId invalide' }, { status: 400 })
  if (!msgBody?.trim())     return NextResponse.json({ error: 'Message vide' }, { status: 400 })
  if (msgBody.length > 2000) return NextResponse.json({ error: 'Message trop long (max 2000 car.)' }, { status: 400 })

  const service = createServiceClient()

  // Vérifier que l'utilisateur a accès à ce document
  if (user.role === 'firm') {
    if (user.firm_id !== firmId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  } else {
    const { data: uc } = await service
      .from('user_customer').select('customer_id').eq('user_id', user.authId).eq('customer_id', customerId).single()
    if (!uc) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { data: msg, error } = await service.from('message').insert({
    firm_id:     firmId,
    customer_id: customerId,
    object_type: 'document',
    object_id:   objectId,
    sender_id:   user.authId,
    body:        msgBody.trim(),
  }).select('id, body, created_at, sender_id').single()

  if (error || !msg) { console.error('messages POST:', error); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }

  // Récupérer le nom du document pour l'email
  const { data: doc } = await service
    .from('document').select('filename').eq('id', objectId).single()

  try {
    await notifyMessage({
      firmId,
      customerId,
      senderRole:   user.role as 'firm' | 'customer',
      senderName:   `${user.first_name} ${user.last_name}`,
      documentName: doc?.filename ?? null,
      messageBody:  msg.body,
    })
  } catch (err) {
    console.error('notifyMessage:', err)
  }

  return NextResponse.json({
    message: {
      ...msg,
      sender: { id: user.id, first_name: user.first_name, last_name: user.last_name, role: user.role },
    }
  }, { status: 201 })
}
