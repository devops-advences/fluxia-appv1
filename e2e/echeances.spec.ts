import { test, expect } from '@playwright/test'
import { CAB_AUTH_FILE } from './constants'

test.describe('Échéances fiscales — accès non authentifié', () => {
  test('redirige vers /login', async ({ page }) => {
    await page.goto('/echeances')
    await page.waitForURL('**/login', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })
})

test.describe('Échéances fiscales — cabinet connecté', () => {
  test.use({ storageState: CAB_AUTH_FILE })

  test.beforeEach(async ({ page }) => {
    await page.goto('/echeances')
    await expect(page.locator('h1', { hasText: 'Échéances fiscales' })).toBeVisible({ timeout: 15000 })
  })

  test('affiche le titre de la page', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Échéances fiscales' })).toBeVisible()
  })

  test('affiche les filtres Depuis et Jusqu\'à', async ({ page }) => {
    await expect(page.getByText('Depuis')).toBeVisible()
    await expect(page.getByText("Jusqu'à")).toBeVisible()
  })

  test('affiche le filtre Tous les clients', async ({ page }) => {
    await expect(page.locator('select').filter({ hasText: 'Tous les clients' })).toBeVisible()
  })

  test('affiche le filtre Tous les types', async ({ page }) => {
    await expect(page.locator('select').filter({ hasText: 'Tous les types' })).toBeVisible()
  })

  test('affiche des obligations groupées par mois', async ({ page }) => {
    // Attend que les données chargent (spinner disparu)
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    // Au moins un bloc mois doit être visible
    const monthBlocks = page.locator('.rounded-xl').filter({ has: page.locator('span.font-semibold') })
    await expect(monthBlocks.first()).toBeVisible({ timeout: 10000 })
  })

  test('chaque ligne affiche label, type, date, montant, mode, statut', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    const table = page.locator('table').first()
    await expect(table.locator('th', { hasText: 'Client' })).toBeVisible()
    await expect(table.locator('th', { hasText: 'Obligation' })).toBeVisible()
    await expect(table.locator('th', { hasText: 'Type' })).toBeVisible()
    await expect(table.locator('th', { hasText: 'Montant' })).toBeVisible()
    await expect(table.locator('th', { hasText: 'Mode' })).toBeVisible()
    await expect(table.locator('th', { hasText: 'Statut' })).toBeVisible()
  })

  test('filtre par client réduit les résultats', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    const clientSelect = page.locator('select').filter({ hasText: 'Tous les clients' })
    const options = await clientSelect.locator('option').count()
    if (options <= 1) { test.skip(); return }
    // Sélectionne le premier client
    await clientSelect.selectOption({ index: 1 })
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 5000 })
    // La colonne "Client" ne devrait montrer qu'un seul nom
    const clientCells = page.locator('td').filter({ hasText: /Client Demo/ })
    const firstText = await clientCells.first().textContent()
    const allTexts = await clientCells.allTextContents()
    expect(allTexts.every(t => t === firstText)).toBeTruthy()
  })

  test('filtre par type TVA ne montre que des lignes TVA', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    await page.locator('select').filter({ hasText: 'Tous les types' }).selectOption('value_added_tax')
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 5000 })
    const typeBadges = page.locator('span.bg-\\[\\#F1F5F9\\]')
    const count = await typeBadges.count()
    if (count === 0) { test.skip(); return }
    for (let i = 0; i < count; i++) {
      await expect(typeBadges.nth(i)).toHaveText('TVA')
    }
  })

  test('statut dropdown change le statut', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    const statusSelect = page.locator('select').filter({ hasText: 'En attente' }).first()
    if (!await statusSelect.isVisible()) { test.skip(); return }
    await statusSelect.selectOption('paid')
    await expect(statusSelect).toHaveValue('paid')
    // Revenir au statut initial
    await statusSelect.selectOption('pending')
  })

  test('clic sur Saisir ouvre un input montant', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    const saisirBtn = page.getByText('— Saisir —').first()
    if (!await saisirBtn.isVisible()) { test.skip(); return }
    await saisirBtn.click()
    await expect(page.locator('input[type="number"]')).toBeVisible()
    // Echap annule
    await page.keyboard.press('Escape')
  })

  test('sidebar contient le lien Échéances fiscales actif', async ({ page }) => {
    await expect(page.locator('aside a[href="/echeances"]')).toBeVisible()
    await expect(page.locator('aside a[href="/echeances"].text-\\[\\#1D4ED8\\]')).toBeVisible()
  })
})
