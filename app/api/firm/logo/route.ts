import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2 Mo

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/svg+xml': 'svg', 'image/webp': 'webp',
  }
  return map[mime] ?? 'png'
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: ud } = await service
    .from('user_data').select('firm_id, role, admin').eq('id', user.id).single()
  if (!ud || ud.role !== 'firm' || !ud.admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  let form: FormData
  try { form = await req.formData() } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const file = form.get('logo')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Format non supporté (PNG, JPG, SVG, WEBP)' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fichier trop volumineux (max 2 Mo)' }, { status: 400 })

  const ext  = extFromMime(file.type)
  const path = `firm/${ud.firm_id}.${ext}`

  const { error: uploadErr } = await service.storage
    .from('logos')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: pub } = service.storage.from('logos').getPublicUrl(path)
  const logoUrl = pub.publicUrl

  const { error: dbErr } = await service.from('firm').update({ logo_url: logoUrl }).eq('id', ud.firm_id)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, logo_url: logoUrl })
}

export async function DELETE(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: ud } = await service
    .from('user_data').select('firm_id, role, admin').eq('id', user.id).single()
  if (!ud || ud.role !== 'firm' || !ud.admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: firm } = await service.from('firm').select('logo_url').eq('id', ud.firm_id).single()
  if (firm?.logo_url) {
    const path = firm.logo_url.split('/logos/')[1]
    if (path) await service.storage.from('logos').remove([path])
  }

  await service.from('firm').update({ logo_url: null }).eq('id', ud.firm_id)
  return NextResponse.json({ ok: true })
}
