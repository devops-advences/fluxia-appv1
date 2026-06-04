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
  shared/Header.tsx → header partagé firm+customer
  firm/Sidebar.tsx  → sidebar cabinet
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
- Toute nouvelle table = `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + policies + **GRANT** dans la même migration
- Sans GRANT, PostgREST retourne `permission denied` silencieusement traité comme `[]` par le client JS
- Template obligatoire pour chaque nouvelle table :
  ```sql
  ALTER TABLE x ENABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT, UPDATE, DELETE ON x TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON x TO service_role;
  -- puis les policies
  ```
- Sans policy, PostgREST retourne `[]` (pas d'erreur) même si les données existent — identique à une table vide
- En cas de 406 ou `[]` inexpliqué : vérifier d'abord les GRANTs, puis les policies RLS
- Vérifier avec curl + service_role key : si `permission denied` → GRANT manquant ; si `[]` → policy manquante
- **Toujours utiliser `my_firm_id()` dans les policies**, jamais un subquery direct sur `user_data`. Le subquery plain est soumis à la RLS de `user_data` et peut retourner `NULL` silencieusement. `my_firm_id()` est `SECURITY DEFINER` et contourne ce risque.

## Nomenclature — URLs
- URLs en anglais partout : `/login`, `/register`, `/dashboard`, `/clients`, `/taches`, etc.
- Le contenu affiché à l'écran reste en français

## UX — Formulaires
- Les formulaires de création et d'édition sont identiques (mêmes champs, même layout, mêmes sections)
- Pas de form "court" à la création suivi d'un form "long" en édition — une seule UX cohérente

## UX — Suppressions
- Toute action destructive doit avoir un mécanisme de confirmation visible — jamais de suppression directe au premier clic
- **Dans un tableau** : icône `Trash2` (gris → rouge au hover) → clic → confirmation inline sur la ligne : `"Supprimer ?"` + bouton `"Confirmer"` (rouge) + `"Annuler"`
- **Pour fichiers / documents** : modal dédiée (`DeleteConfirmModal`)
- Jamais de `window.confirm()` — UX native non contrôlable

## DevOps — Commandes courantes

### Démarrer le serveur local
```bash
pkill -f "next dev" 2>/dev/null; npm run dev
```
Toujours couper le process existant avant de relancer pour éviter le port 3001.

### Migrations Supabase
```bash
supabase migration list          # voir ce qui est appliqué vs en attente
supabase db push                 # pousser les nouvelles migrations vers le projet distant
```
Le projet Supabase est lié (`supabase/.temp/project-ref` = `uevxsikiwiruaqgtconz`).

### Variables d'environnement `.env.local`
| Variable | Dev local | Vercel prod |
|---|---|---|
| `APP_URL` | `http://localhost:3000` | `https://fluxia-appv1.vercel.app` |
| `RESEND_API_KEY` | clé Resend | idem (à configurer dans Vercel) |

**Important** : `APP_URL` doit correspondre à l'environnement d'exécution — les liens d'invitation dans les emails pointent vers cette URL. En dev local, mettre `http://localhost:3000` sinon les liens redirigent vers Vercel et le token ne peut pas être validé.

### Email — Resend
- Domaine expéditeur vérifié : `advences.io` → `noreply@advences.io`
- `advences.com` n'est PAS vérifié sur Resend — ne pas l'utiliser
- La clé API est en mode "send only" (pas de consultation des logs via API)

### Déploiement Vercel
- Push sur `main` → déploiement automatique
- Vérifier que `APP_URL` est bien `https://fluxia-appv1.vercel.app` dans les env vars Vercel

## Sécurité — Routes API

- **Ne jamais retourner `error.message` au client** — toujours un message générique (`'Erreur interne'`), logger côté serveur avec `console.error`
- **Valider les params dynamiques en UUID** avant tout accès DB :
  ```typescript
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  ```
- **Paths extraits d'URLs** : valider avec regex avant usage Storage (`!path.includes('..')`)

## Performance — Imports

- **Librairies lourdes** (xlsx, pdfjs, pdf-lib) : toujours en import dynamique `await import('...')` à l'intérieur de la fonction qui en a besoin, jamais en import statique top-level
- **Modales / drawers** : utiliser `next/dynamic` — ils ne sont pas visibles au premier rendu
  ```typescript
  const MyModal = dynamic(() => import('./_components/MyModal'))
  ```

## Ce qu'on ne fait PAS
- Pas de mock de la base de données pour les tests
- Pas de `any` TypeScript
- Pas de couleurs en dehors de la charte
- Pas de push GitHub sans demande explicite
