@AGENTS.md

# FluxIA — Instructions projet

## Contexte
Plateforme B2B de pré-comptabilité. Deux types d'utilisateurs : **cabinet comptable** (admin) et **client** (dépose des documents). Solo developer + Claude.

## Stack
- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS v4
- Supabase (auth + DB + storage)
- Déployé sur Vercel

## Charte graphique — NE PAS DÉVIER
- Fond : `#FFFFFF`
- Fond doux : `#F8FAFC`
- Bordures : `#E2E8F0`
- Texte principal : `#0F172A`
- Texte secondaire : `#64748B`
- Texte faint : `#94A3B8`
- Accent (logo, nav active, CTA, pagination) : `#1D4ED8`
- Boutons secondaires : ghost blanc + bordure grise
- Statuts : couleur sémantique uniquement (vert `#059669` / ambre `#D97706` / rouge `#DC2626`)
- Font : Inter
- Référence maquette : `/Users/ridhabouasker/Desktop/fluxia-final.html`

## Structure des fichiers
```
app/
  (auth)/           → login, register
  (firm)/           → espace cabinet (route group, sans impact URL)
  (customer)/       → portail client (route group, sans impact URL)
components/
  firm/             → composants spécifiques cabinet
  customer/         → composants spécifiques client
  shared/           → composants partagés (DocumentCard, filtres…)
  Header.tsx        → à migrer dans shared/
  Sidebar.tsx       → à migrer dans firm/
lib/
  supabaseClient.ts
  utils.ts
```

## Règles de code
- TypeScript strict — pas de `any`
- Composants en arrow functions exportées
- Pas de commentaires sauf si la logique est non-évidente
- Pas de `console.log` en production
- RLS Supabase obligatoire sur chaque table
- ENUM `user_role` : `firm` / `customer` / `master`

## Règles de collaboration — PRIORITÉ ABSOLUE
- **UNE QUESTION ≠ UNE DEMANDE D'IMPLÉMENTATION.** Si l'utilisateur pose une question, répondre uniquement. Ne rien coder.
- Ne jamais éditer, commiter ou pousser sans un "Go", "Ok", "Lance" ou confirmation explicite
- Une feature à la fois
- Toujours lire un fichier avant de le modifier
- Ne jamais créer de fichiers inutiles (README, docs non demandés)

## Conventions de nommage SQL
- `id` → réservé aux clés primaires internes (UUID)
- `ref` → pour les identifiants externes (ex: `tax_ref_main`, `tax_ref_vat`)
- Ne jamais utiliser `_id` pour un identifiant externe

## Supabase — RLS obligatoire
- Toute nouvelle table = `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + policies dans la même migration
- Sans policy, PostgREST retourne `[]` (pas d'erreur) même si les données existent — identique à une table vide
- En cas de 406 ou `[]` inexpliqué : vérifier les policies RLS en premier, avant tout autre diagnostic
- Vérifier les policies avec curl + token JWT valide, pas juste via le dashboard Supabase

## Nomenclature — URLs
- URLs en anglais partout : `/login`, `/register`, `/dashboard`, `/clients`, `/taches`, etc.
- Le contenu affiché à l'écran reste en français

## UX — Formulaires
- Les formulaires de création et d'édition sont identiques (mêmes champs, même layout, mêmes sections)
- Pas de form "court" à la création suivi d'un form "long" en édition — une seule UX cohérente

## Ce qu'on ne fait PAS
- Pas de mock de la base de données pour les tests
- Pas de `any` TypeScript
- Pas de couleurs en dehors de la charte
- Pas de push GitHub sans demande explicite
