import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'
import { notifyDeposit } from '@/lib/email'

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
  if (n.endsWith('.xls')) return 'application/vnd.ms-excel'
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (n.endsWith('.doc')) return 'application/msword'
  if (n.endsWith('.csv')) return 'text/csv'
  return 'application/octet-stream'
}

type MetaEntry = { type: string; year: string; month: string; note: string; originalName: string }

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const customerId = formData.get('customerId')
  const metaRaw    = formData.get('meta')
  const isRaw      = formData.get('raw') === 'true'

  if (!isUuid(customerId)) return NextResponse.json({ error: 'Client invalide' }, { status: 400 })

  let meta: MetaEntry[] = []
  if (!isRaw) {
    if (typeof metaRaw !== 'string') return NextResponse.json({ error: 'Métadonnées manquantes' }, { status: 400 })
    try {
      meta = JSON.parse(metaRaw) as MetaEntry[]
      if (!Array.isArray(meta) || meta.length === 0) throw new Error()
    } catch {
      return NextResponse.json({ error: 'Métadonnées invalides' }, { status: 400 })
    }
  }

  const rawFiles = formData.getAll('files')
  const files: File[] = []
  for (const f of rawFiles) {
    if (!(f instanceof File))   return NextResponse.json({ error: 'Fichier invalide' }, { status: 400 })
    if (!isAllowedExt(f))       return NextResponse.json({ error: `Format non supporté : ${f.name}` }, { status: 400 })
    if (f.size > MAX_FILE_SIZE) return NextResponse.json({ error: `Fichier trop volumineux : ${f.name}` }, { status: 400 })
    if (f.size === 0)           return NextResponse.json({ error: `Fichier vide : ${f.name}` }, { status: 400 })
    files.push(f)
  }

  if (files.length === 0) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  if (!isRaw && files.length !== meta.length) {
    return NextResponse.json({ error: 'Nombre de fichiers incohérent' }, { status: 400 })
  }

  // Verify the authenticated user is linked to this customer
  const { data: uc } = await service
    .from('user_customer')
    .select('customer_id')
    .eq('user_id', user.id)
    .eq('customer_id', customerId)
    .single()
  if (!uc) return NextResponse.json({ error: 'Client introuvable ou non autorisé' }, { status: 403 })

  const { data: customer } = await service
    .from('customer')
    .select('id, firm_id, country_code, name')
    .eq('id', customerId)
    .single()
  if (!customer) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const { data: firm } = await service
    .from('firm')
    .select('id, slug, name')
    .eq('id', customer.firm_id)
    .single()
  if (!firm) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 500 })

  // Build document type map (qualified only)
  const docTypeMap: Record<string, string> = {}
  if (!isRaw) {
    const typeNames = [...new Set(meta.map(m => m.type))]
    const { data: docTypeRows } = await service
      .from('document_type')
      .select('id, name, country_code')
      .eq('customer', true)
      .eq('active', true)
      .in('name', typeNames)
    for (const name of typeNames) {
      const rows = (docTypeRows ?? []).filter(r => r.name === name)
      const match = rows.find(r => r.country_code === customer.country_code) ?? rows[0]
      if (match) docTypeMap[name] = match.id
    }
  }

  const currentYear = new Date().getFullYear()
  const bucket = firm.slug
  const uploadedPaths: string[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const m    = isRaw ? null : meta[i]

    const safeName   = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 180)
    const uid        = crypto.randomUUID().slice(0, 8)
    const uniqueName = `${uid}_${safeName}`

    const path = isRaw
      ? `${customer.id}/tampon/${uniqueName}`
      : `${customer.id}/deposes/${m!.year}/${m!.month ? m!.month.padStart(2, '0') : '00'}/${uniqueName}`

    let { error: uploadError } = await service.storage
      .from(bucket)
      .upload(path, file, { contentType: getContentType(file), upsert: false })

    if (uploadError?.message.toLowerCase().includes('bucket not found')) {
      await service.storage.createBucket(bucket, { public: false })
      const retry = await service.storage
        .from(bucket)
        .upload(path, file, { contentType: getContentType(file), upsert: false })
      uploadError = retry.error
    }

    if (uploadError) {
      if (uploadedPaths.length > 0) await service.storage.from(bucket).remove(uploadedPaths)
      return NextResponse.json({ error: `Erreur lors du dépôt : ${file.name} — ${uploadError.message}` }, { status: 500 })
    }
    uploadedPaths.push(path)

    const year  = isRaw ? currentYear : parseInt(m!.year, 10)
    const month = (!isRaw && m!.month) ? parseInt(m!.month, 10) : null

    const { data: newDoc, error: insertError } = await service.from('document').insert({
      firm_id:      firm.id,
      customer_id:  customer.id,
      type_id:      isRaw ? null : (docTypeMap[m!.type] ?? null),
      filename:     isRaw ? file.name : m!.originalName,
      storage_path: path,
      mime_type:    getContentType(file),
      size_kb:      Math.round(file.size / 1024),
      year,
      months:       month ? [month] : null,
      status:       isRaw ? 'draft' : 'pending',
      notes:        isRaw ? null : (m!.note || null),
    }).select('id').single()

    if (insertError || !newDoc) {
      await service.storage.from(bucket).remove(uploadedPaths)
      return NextResponse.json({ error: `Erreur enregistrement : ${insertError?.message ?? 'inconnu'}` }, { status: 500 })
    }

    if (!isRaw) {
      await service.from('document_event').insert({
        document_id: newDoc.id,
        user_id:     user.id,
        event_type:  'uploaded',
      })
    }
  }

  try {
    await notifyDeposit({
      customerId:   customer.id,
      customerName: customer.name,
      firmId:       firm.id,
      firmName:     firm.name,
      fileNames:    files.map(f => f.name),
      firmUrl:      process.env.NEXT_PUBLIC_FIRM_URL ?? 'http://localhost:3000',
    })
  } catch (err) {
    console.error('notifyDeposit:', err)
  }

  return NextResponse.json({ ok: true, count: files.length, raw: isRaw }, { status: 201 })
}
