import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(v: unknown): v is string { return typeof v === 'string' && UUID_RE.test(v) }

const ALLOWED_EXTS = ['.pdf','.jpg','.jpeg','.png','.webp','.tiff','.tif','.heic','.heif','.xlsx','.xls','.csv','.docx','.doc']
function isAllowedExt(f: File) { const n = f.name.toLowerCase(); return ALLOWED_EXTS.some(e => n.endsWith(e)) }

function getContentType(f: File): string {
  if (f.type) return f.type
  const n = f.name.toLowerCase()
  if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic'
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (n.endsWith('.xls'))  return 'application/vnd.ms-excel'
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (n.endsWith('.doc'))  return 'application/msword'
  if (n.endsWith('.csv'))  return 'text/csv'
  return 'application/octet-stream'
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: ud } = await service
    .from('user_data').select('firm_id, role').eq('id', user.id).single()
  if (!ud || ud.role !== 'firm') return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  const customerId = formData.get('customerId')
  const typeId     = formData.get('typeId')
  const yearRaw    = formData.get('year')
  const monthRaw   = formData.get('month')
  const sourceRaw  = formData.get('source')
  const file       = formData.get('file')

  if (!isUuid(customerId)) return NextResponse.json({ error: 'Client invalide' }, { status: 400 })
  if (typeId && !isUuid(typeId)) return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  if (sourceRaw !== 'customer' && sourceRaw !== 'firm') return NextResponse.json({ error: 'Source invalide' }, { status: 400 })

  const year = parseInt(String(yearRaw ?? ''), 10)
  if (isNaN(year) || year < 2000 || year > 2099) return NextResponse.json({ error: 'Année invalide' }, { status: 400 })

  const month = monthRaw ? parseInt(String(monthRaw), 10) : null
  if (month !== null && (isNaN(month) || month < 1 || month > 12)) {
    return NextResponse.json({ error: 'Mois invalide' }, { status: 400 })
  }

  if (!(file instanceof File))  return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (!isAllowedExt(file))      return NextResponse.json({ error: `Format non supporté : ${file.name}` }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 400 })
  if (file.size === 0)           return NextResponse.json({ error: 'Fichier vide' }, { status: 400 })

  const { data: customer } = await service
    .from('customer').select('id, firm_id').eq('id', customerId).eq('firm_id', ud.firm_id).single()
  if (!customer) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const { data: firm } = await service
    .from('firm').select('id').eq('id', ud.firm_id).single()
  if (!firm) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 500 })

  const safeName   = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 180)
  const uid        = crypto.randomUUID().slice(0, 8)
  const storagePath = `${customer.id}/firm/${uid}_${safeName}`

  let { error: uploadError } = await service.storage
    .from(firm.id)
    .upload(storagePath, file, { contentType: getContentType(file), upsert: false })

  if (uploadError?.message.toLowerCase().includes('bucket not found')) {
    await service.storage.createBucket(firm.id, { public: false })
    const retry = await service.storage
      .from(firm.id)
      .upload(storagePath, file, { contentType: getContentType(file), upsert: false })
    uploadError = retry.error
  }

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: doc, error: insertError } = await service.from('document').insert({
    firm_id:      firm.id,
    customer_id:  customer.id,
    type_id:      typeId || null,
    filename:     file.name,
    storage_path: storagePath,
    mime_type:    getContentType(file),
    size_kb:      Math.round(file.size / 1024),
    year,
    months:       month ? [month] : null,
    status:       'pending',
    source:       sourceRaw,
  }).select('id').single()

  if (insertError || !doc) {
    await service.storage.from(firm.id).remove([storagePath])
    return NextResponse.json({ error: insertError?.message ?? 'Erreur insertion' }, { status: 500 })
  }

  await service.from('document_event').insert({
    document_id: doc.id,
    user_id:     user.id,
    event_type:  'uploaded',
  })

  return NextResponse.json({ ok: true, id: doc.id }, { status: 201 })
}
