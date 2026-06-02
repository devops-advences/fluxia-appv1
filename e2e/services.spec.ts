import { test, expect } from '@playwright/test'
import { CAB_AUTH_FILE, CLIENT_AUTH_FILE } from './constants'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function goToClientServices(page: import('@playwright/test').Page) {
  await page.goto('/clients')
  await page.locator('tbody tr').first().waitFor({ timeout: 10000 })
  await page.locator('tbody tr').first().click()
  await page.waitForURL('**/clients/**', { timeout: 8000 })
  await page.getByRole('button', { name: 'Services' }).click()
  await expect(page.locator('body')).not.toContainText('Internal Server Error')
}

// ─── Accès non authentifié ───────────────────────────────────────────────────

test.describe('Services — accès non authentifié', () => {
  test('fiche client redirige vers /login', async ({ page }) => {
    await page.goto('/clients')
    await page.waitForURL('**/login', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })

  test('ma-société redirige vers /login', async ({ page }) => {
    await page.goto('/ma-societe')
    await page.waitForURL('**/login', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })
})

// ─── Côté cabinet ───────────────────────────────────────────────────────────

test.describe('Services — cabinet connecté (fiche client)', () => {
  test.use({ storageState: CAB_AUTH_FILE })

  test('onglet Services visible dans la fiche client', async ({ page }) => {
    await page.goto('/clients')
    await page.locator('tbody tr').first().waitFor({ timeout: 10000 })
    await page.locator('tbody tr').first().click()
    await page.waitForURL('**/clients/**', { timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Services' })).toBeVisible({ timeout: 8000 })
  })

  test('onglet Services — charge sans erreur serveur', async ({ page }) => {
    await goToClientServices(page)
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('onglet Services — bouton "+ Ajouter un service" présent', async ({ page }) => {
    await goToClientServices(page)
    await expect(page.getByRole('button', { name: /Ajouter un service/i })).toBeVisible({ timeout: 8000 })
  })

  // ── Formulaire ajout ──────────────────────────────────────────────────────

  test('formulaire ajout — s\'ouvre au clic', async ({ page }) => {
    await goToClientServices(page)
    await page.getByRole('button', { name: /Ajouter un service/i }).click()
    await expect(page.getByText('Ajouter un service').last()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('select').first()).toBeVisible()
  })

  test('formulaire ajout — select service groupé par catégorie', async ({ page }) => {
    await goToClientServices(page)
    await page.getByRole('button', { name: /Ajouter un service/i }).click()
    const optgroups = page.locator('optgroup')
    // optgroup est natif browser → pas "visible" au sens Playwright, on vérifie l'existence et le label
    await expect(optgroups).not.toHaveCount(0, { timeout: 5000 })
    const groupLabel = await optgroups.first().getAttribute('label')
    expect(['Comptabilité','Fiscal','Social & Paie','Juridique','Audit','Conseil']).toContain(groupLabel)
  })

  test('formulaire ajout — Annuler referme le formulaire', async ({ page }) => {
    await goToClientServices(page)
    await page.getByRole('button', { name: /Ajouter un service/i }).click()
    // Le formulaire est ouvert : le select est présent
    await expect(page.locator('select').first()).toBeVisible()
    await page.getByRole('button', { name: 'Annuler' }).first().click()
    // Le formulaire est fermé : le select disparaît
    await expect(page.locator('select').first()).not.toBeVisible()
  })

  test('formulaire ajout — bouton Ajouter actif dès qu\'un service est sélectionné', async ({ page }) => {
    await goToClientServices(page)
    await page.getByRole('button', { name: /Ajouter un service/i }).click()
    // Le select est auto-peuplé → bouton Ajouter doit être actif
    const addBtn = page.getByRole('button', { name: /^Ajouter$/ })
    await expect(addBtn).toBeEnabled({ timeout: 5000 })
  })

  // ── Affichage services existants ──────────────────────────────────────────

  test('services existants — affichage par groupe', async ({ page }) => {
    await goToClientServices(page)
    const hasServices = await page.locator('table').count() > 0
    if (hasServices) {
      // Headers des groupes (texte en uppercase)
      const groupHeaders = page.locator('p.text-xs.font-bold')
      await expect(groupHeaders.first()).toBeVisible({ timeout: 5000 })
    } else {
      await expect(page.getByText(/Aucun service/i)).toBeVisible()
    }
  })

  test('services existants — badge fréquence visible', async ({ page }) => {
    await goToClientServices(page)
    const tables = page.locator('table')
    if (await tables.count() > 0) {
      const freqBadge = page.locator('span').filter({ hasText: /Mensuel|Trimestriel|Annuel|Ponctuel/ }).first()
      await expect(freqBadge).toBeVisible({ timeout: 5000 })
    }
  })

  // ── Désactiver / Réactiver ────────────────────────────────────────────────

  test('services existants — bouton Désactiver ou Réactiver visible', async ({ page }) => {
    await goToClientServices(page)
    const tables = page.locator('table')
    if (await tables.count() > 0) {
      const toggleBtn = page.getByRole('button', { name: /Désactiver|Réactiver/ }).first()
      await expect(toggleBtn).toBeVisible({ timeout: 5000 })
    }
  })

  // ── Suppression ───────────────────────────────────────────────────────────

  test('suppression — clic Trash2 affiche confirmation inline', async ({ page }) => {
    await goToClientServices(page)
    const tables = page.locator('table')
    if (await tables.count() > 0) {
      const rows = page.locator('tbody tr')
      if (await rows.count() > 0) {
        // Dernier bouton de la ligne = poubelle
        await rows.first().locator('button').last().click()
        await expect(page.getByText('Supprimer ?')).toBeVisible({ timeout: 3000 })
        await expect(page.getByRole('button', { name: 'Annuler' }).first()).toBeVisible()
      }
    }
  })

  test('suppression — Annuler cache la confirmation', async ({ page }) => {
    await goToClientServices(page)
    const tables = page.locator('table')
    if (await tables.count() > 0) {
      const rows = page.locator('tbody tr')
      if (await rows.count() > 0) {
        await rows.first().locator('button').last().click()
        await expect(page.getByText('Supprimer ?')).toBeVisible()
        await page.getByRole('button', { name: 'Annuler' }).first().click()
        await expect(page.getByText('Supprimer ?')).not.toBeVisible()
      }
    }
  })

  // ── Pas d'erreur serveur ─────────────────────────────────────────────────

  test('pas d\'erreur serveur dans l\'onglet Services', async ({ page }) => {
    await goToClientServices(page)
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('NaN')
    await expect(page.locator('body')).not.toContainText('undefined')
  })
})

// ─── Côté portail client ─────────────────────────────────────────────────────

test.describe('Services — portail client (Ma société)', () => {
  test.use({ storageState: CLIENT_AUTH_FILE })

  test.beforeEach(async ({ page }) => {
    await page.goto('/ma-societe')
    await expect(page.locator('h1', { hasText: 'Ma société' })).toBeVisible({ timeout: 10000 })
  })

  test('onglet "Nos services" visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Nos services' })).toBeVisible()
  })

  test('onglet "Nos services" — charge sans erreur', async ({ page }) => {
    await page.getByRole('button', { name: 'Nos services' }).click()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('onglet "Nos services" — lecture seule, pas de bouton Ajouter', async ({ page }) => {
    await page.getByRole('button', { name: 'Nos services' }).click()
    await expect(page.getByRole('button', { name: /Ajouter/i })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Désactiver|Réactiver/i })).not.toBeVisible()
  })

  test('onglet "Nos services" — état vide ou liste sans action de modification', async ({ page }) => {
    await page.getByRole('button', { name: 'Nos services' }).click()
    // Soit message vide, soit liste — dans les 2 cas pas d'input ni form
    const hasEmpty = await page.getByText(/Aucun service souscrit/i).isVisible().catch(() => false)
    const hasServices = await page.locator('table').count() > 0 || await page.locator('[class*="divide"]').count() > 0
    expect(hasEmpty || hasServices).toBeTruthy()
    // Aucun formulaire d'ajout
    await expect(page.locator('form')).not.toBeVisible()
  })

  test('onglet "Nos services" — badge fréquence visible si services présents', async ({ page }) => {
    await page.getByRole('button', { name: 'Nos services' }).click()
    const hasEmpty = await page.getByText(/Aucun service souscrit/i).isVisible().catch(() => false)
    if (!hasEmpty) {
      await expect(page.locator('span').filter({ hasText: /Mensuel|Trimestriel|Annuel|Ponctuel/ }).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('switch onglets — pas de plantage', async ({ page }) => {
    await page.getByRole('button', { name: 'Nos services' }).click()
    await page.getByRole('button', { name: 'Données générales' }).click()
    await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Nos services' }).click()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})
