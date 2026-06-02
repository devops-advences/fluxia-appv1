import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseService'

export async function POST(req: NextRequest) {
  const { token, firstName, lastName, password } = await req.json()

  if (!token || !firstName || !lastName || !password) {
    return NextResponse.json({ error: 'Champs manquants.' }, { status: 400 })
  }

  const service = createServiceClient()

  // 1. Valider le token et récupérer l'email
  const { data: inv, error: invError } = await service.rpc('get_invitation_by_token', { p_token: token })
  if (invError || !inv) {
    return NextResponse.json({ error: 'Invitation invalide ou expirée.' }, { status: 400 })
  }

  // 2. Créer le compte auth (email pré-confirmé)
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: inv.email,
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    const msg = createError?.message?.includes('already registered')
      ? 'Un compte existe déjà avec cet email.'
      : (createError?.message ?? 'Erreur lors de la création du compte.')
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // 3. Créer user_data + user_customer + clôturer l'invitation
  const { error: acceptError } = await service.rpc('accept_invitation', {
    p_token:      token,
    p_user_id:    created.user.id,
    p_first_name: firstName.trim(),
    p_last_name:  lastName.trim(),
  })

  if (acceptError) {
    // Rollback : supprimer le compte auth créé pour éviter un utilisateur orphelin
    await service.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: 'Erreur lors de l\'activation du compte.' }, { status: 500 })
  }

  // Mettre à jour le score onboarding du client si c'est un user customer
  if (inv.customer_id) {
    await service.rpc('refresh_onboarding_score', { p_customer_id: inv.customer_id })
  }

  return NextResponse.json({ ok: true })
}
