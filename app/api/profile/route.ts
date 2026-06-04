import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'

async function getUser(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return null
  const service = createServiceClient()
  const { data: { user } } = await service.auth.getUser(token)
  return user ?? null
}

// PATCH /api/profile  { firstName, lastName, phone }
export async function PATCH(req: Request) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let body: { firstName?: string; lastName?: string; phone?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  const { firstName, lastName, phone } = body
  const service = createServiceClient()

  const updates: Record<string, string | null> = {}
  if (firstName !== undefined) updates.first_name = firstName.trim() || null
  if (lastName  !== undefined) updates.last_name  = lastName.trim()  || null
  if (phone     !== undefined) updates.phone      = phone.trim()     || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
  }

  const { error } = await service.from('user_data').update(updates).eq('id', user.id)
  if (error) { console.error('profile PATCH:', error); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}

// GET /api/profile  — tous les champs user_data + auth.users
export async function GET(req: Request) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()

  const [{ data: ud }, { data: { user: authUser } }] = await Promise.all([
    service.from('user_data')
      .select('id, first_name, last_name, phone, email, role, admin, active, created_at, updated_at, avatar_url')
      .eq('id', user.id).single(),
    service.auth.admin.getUserById(user.id),
  ])

  if (!ud) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  let signedAvatarUrl: string | null = null
  if (ud.avatar_url) {
    const { data: signed } = await service.storage
      .from('avatars').createSignedUrl(ud.avatar_url, 3600)
    signedAvatarUrl = signed?.signedUrl ?? null
  }

  return NextResponse.json({
    id:                   ud.id,
    first_name:           ud.first_name,
    last_name:            ud.last_name,
    phone:                ud.phone,
    email:                ud.email,
    role:                 ud.role,
    admin:                ud.admin,
    active:               ud.active,
    created_at:           ud.created_at,
    updated_at:           ud.updated_at,
    avatar_url:           signedAvatarUrl,
    last_sign_in_at:      authUser?.last_sign_in_at      ?? null,
    email_confirmed_at:   authUser?.email_confirmed_at   ?? null,
  })
}

// POST /api/profile  (multipart: avatar file)
// Stocke le chemin dans user_data.avatar_url, bucket PRIVÉ
export async function POST(req: Request) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let formData: FormData
  try { formData = await req.formData() }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  const file = formData.get('avatar')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Photo trop volumineuse (max 5 Mo)' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Seules les images sont acceptées' }, { status: 400 })

  const service = createServiceClient()
  const ext     = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path    = `${user.id}.${ext}`

  let { error: uploadError } = await service.storage.from('avatars').upload(path, file, {
    contentType: file.type, upsert: true,
  })

  if (uploadError?.message.toLowerCase().includes('bucket not found')) {
    // Bucket privé — public: false
    await service.storage.createBucket('avatars', { public: false })
    const retry = await service.storage.from('avatars').upload(path, file, {
      contentType: file.type, upsert: true,
    })
    uploadError = retry.error
  }

  if (uploadError) { console.error('profile POST upload:', uploadError); return NextResponse.json({ error: 'Erreur lors du téléchargement' }, { status: 500 }) }

  // Stocker le chemin (pas l'URL) dans la DB
  const { error: dbErr } = await service.from('user_data').update({ avatar_url: path }).eq('id', user.id)
  if (dbErr) { console.error('profile POST db:', dbErr); return NextResponse.json({ error: 'Erreur interne' }, { status: 500 }) }

  // Retourner une URL signée pour affichage immédiat
  const { data: signed } = await service.storage.from('avatars').createSignedUrl(path, 3600)
  return NextResponse.json({ ok: true, avatar_url: signed?.signedUrl ?? null })
}
