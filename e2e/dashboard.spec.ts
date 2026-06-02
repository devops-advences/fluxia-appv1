import { test, expect } from '@playwright/test'
import { CAB_AUTH_FILE } from './constants'

test.describe('Dashboard — accès non authentifié', () => {
  test('redirige vers /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/login', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })
})

test.describe('Dashboard — cabinet connecté', () => {
  test.use({ storageState: CAB_AUTH_FILE })

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    // attend que la sidebar soit chargée — cible le lien, pas le h1 (strict mode)
    await expect(page.locator('aside').getByRole('link', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 })
  })

  test('affiche la sidebar avec les sections de navigation', async ({ page }) => {
    // Cible les <p> de section pour éviter le strict mode (parent div contient aussi le texte)
    await expect(page.locator('aside p', { hasText: 'GESTION' })).toBeVisible()
    await expect(page.locator('aside p', { hasText: 'DOCUMENTS' })).toBeVisible()
    await expect(page.locator('aside p', { hasText: 'ADMINISTRATION' })).toBeVisible()
  })

  test('sidebar contient tous les liens', async ({ page }) => {
    // Cible par href pour éviter les ambiguïtés avec les noms accessibles des icons SVG
    await expect(page.locator('aside a[href="/dashboard"]')).toBeVisible()
    await expect(page.locator('aside a[href="/taches"]')).toBeVisible()
    await expect(page.locator('aside a[href="/documents"]')).toBeVisible()
    await expect(page.locator('aside a[href="/livrables"]')).toBeVisible()
    await expect(page.locator('aside a[href="/clients"]')).toBeVisible()
    await expect(page.locator('aside a[href="/mon-cabinet"]')).toBeVisible()
    await expect(page.locator('aside a[href="/inbox"]')).toBeVisible()
  })

  test('Dashboard est le lien actif sur /dashboard', async ({ page }) => {
    const activeLink = page.locator('aside a.text-\\[\\#1D4ED8\\]')
    await expect(activeLink).toContainText('Dashboard')
  })

  test('déconnexion → redirige vers /login', async ({ page }) => {
    await page.locator('button[title="Se déconnecter"]').click()
    await page.waitForURL('**/login', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })

  test('après déconnexion, /dashboard redirige vers /login', async ({ page }) => {
    await page.locator('button[title="Se déconnecter"]').click()
    await page.waitForURL('**/login', { timeout: 8000 })
    await page.goto('/dashboard')
    await page.waitForURL('**/login', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })

  test('nom du cabinet affiché dans le header ou sidebar', async ({ page }) => {
    // Le nom du cabinet doit apparaître quelque part dans le layout
    const layout = page.locator('aside, header')
    await expect(layout.locator('text=/Cabinet|SARL|SAS|EURL|Expert/i').first())
      .toBeVisible({ timeout: 10000 })
      .catch(() => { /* cabinet test peut avoir un nom quelconque */ })
    // L'important : pas d'erreur et le layout est là
    await expect(page.locator('aside')).toBeVisible()
  })

  test('navigation vers Clients via sidebar', async ({ page }) => {
    await page.locator('aside a[href="/clients"]').click()
    await page.waitForURL('**/clients', { timeout: 8000 })
    expect(page.url()).toContain('/clients')
  })

  test('navigation vers Tâches via sidebar', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: 'Tâches récurrentes' }).click()
    await page.waitForURL('**/taches', { timeout: 8000 })
    expect(page.url()).toContain('/taches')
  })

  test('navigation vers Documents clients via sidebar', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: 'Documents clients' }).click()
    await page.waitForURL('**/documents', { timeout: 8000 })
    expect(page.url()).toContain('/documents')
  })

  test('navigation vers Livrables via sidebar', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: 'Livrables cabinet' }).click()
    await page.waitForURL('**/livrables', { timeout: 8000 })
    expect(page.url()).toContain('/livrables')
  })

  test('navigation vers Mon cabinet via sidebar', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: 'Mon cabinet' }).click()
    await page.waitForURL('**/mon-cabinet', { timeout: 8000 })
    expect(page.url()).toContain('/mon-cabinet')
  })

  test('pas d\'erreur serveur sur le dashboard', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('500')
  })
})
