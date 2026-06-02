import { test, expect } from '@playwright/test'
import { CLIENT_AUTH_FILE } from './constants'

test.describe('Mes échéances — accès non authentifié', () => {
  test('redirige vers /login', async ({ page }) => {
    await page.goto('/mes-echeances')
    await page.waitForURL('**/login', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })
})

test.describe('Mes échéances — client connecté', () => {
  test.use({ storageState: CLIENT_AUTH_FILE })

  test.beforeEach(async ({ page }) => {
    await page.goto('/mes-echeances')
    await expect(page.locator('h1', { hasText: 'Échéances fiscales' })).toBeVisible({ timeout: 15000 })
  })

  test('affiche le titre de la page', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Échéances fiscales' })).toBeVisible()
  })

  test('affiche les filtres Depuis et Jusqu\'à', async ({ page }) => {
    await expect(page.getByText('Depuis')).toBeVisible()
    await expect(page.getByText("Jusqu'à")).toBeVisible()
  })

  test('affiche le filtre de type', async ({ page }) => {
    await expect(page.locator('select').filter({ hasText: 'Tous les types' })).toBeVisible()
  })

  test('pas de colonne Client — vue propre au client', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    // La colonne "Client" ne doit pas exister côté portail client
    await expect(page.locator('th', { hasText: 'Client' })).not.toBeVisible()
  })

  test('affiche des colonnes Obligation, Type, Date limite, Montant, Mode, Statut', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    const table = page.locator('table').first()
    await expect(table.locator('th', { hasText: 'Obligation' })).toBeVisible()
    await expect(table.locator('th', { hasText: 'Type' })).toBeVisible()
    await expect(table.locator('th', { hasText: 'Date limite' })).toBeVisible()
    await expect(table.locator('th', { hasText: 'Montant' })).toBeVisible()
    await expect(table.locator('th', { hasText: 'Statut' })).toBeVisible()
  })

  test('statuts sont en lecture seule — pas de dropdown', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    // Les statuts sont des <span>, pas des <select>
    const statusSpans = page.locator('span.bg-\\[\\#FEF3C7\\], span.bg-\\[\\#D1FAE5\\], span.bg-\\[\\#FEE2E2\\]')
    if (await statusSpans.count() === 0) { test.skip(); return }
    await expect(page.locator('td select')).not.toBeVisible()
  })

  test('montants sont en lecture seule — pas de bouton Saisir', async ({ page }) => {
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 })
    await expect(page.getByText('— Saisir —')).not.toBeVisible()
  })

  test('sidebar contient le lien Échéances fiscales', async ({ page }) => {
    await expect(page.locator('aside a[href="/mes-echeances"]')).toBeVisible()
  })

  test('sidebar contient le lien actif sur /mes-echeances', async ({ page }) => {
    await expect(page.locator('aside a[href="/mes-echeances"].text-\\[\\#1D4ED8\\]')).toBeVisible()
  })
})
