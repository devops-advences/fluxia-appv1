import { test, expect } from '@playwright/test'
import path from 'path'
import { CAB_AUTH_FILE } from './constants'

const FIXTURE = (name: string) => path.join(__dirname, 'fixtures', name)

// ─── Navigation vers un client ──────────────────────────────────────────────

test.describe('Salariés — accès non authentifié', () => {
  test('redirige vers /login', async ({ page }) => {
    await page.goto('/clients')
    await page.waitForURL('**/login', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })
})

test.describe('Salariés — cabinet connecté', () => {
  test.use({ storageState: CAB_AUTH_FILE })

  async function goToSalaries(page: import('@playwright/test').Page) {
    await page.goto('/clients')
    await page.locator('tbody tr').first().waitFor({ timeout: 10000 })
    await page.locator('tbody tr').first().click()
    await page.waitForURL('**/clients/**', { timeout: 8000 })
    await page.getByRole('button', { name: 'Salariés' }).click()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  test('onglet Salariés visible dans la fiche client', async ({ page }) => {
    await page.goto('/clients')
    await page.locator('tbody tr').first().waitFor({ timeout: 10000 })
    await page.locator('tbody tr').first().click()
    await page.waitForURL('**/clients/**', { timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Salariés' })).toBeVisible({ timeout: 8000 })
  })

  test('onglet Salariés — contenu charge sans erreur', async ({ page }) => {
    await goToSalaries(page)
    await expect(page.getByRole('button', { name: /Ajouter un salarié/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Modèle/i })).toBeVisible()
  })

  // ── Formulaire ajout ────────────────────────────────────────────────────

  test('bouton "Ajouter un salarié" ouvre le formulaire', async ({ page }) => {
    await goToSalaries(page)
    await page.getByRole('button', { name: /Ajouter un salarié/i }).click()
    await expect(page.getByText('Nouveau salarié')).toBeVisible()
    await expect(page.getByText(/Nom \*/i).first()).toBeVisible()
    await expect(page.getByText(/Prénom \*/i).first()).toBeVisible()
  })

  test('bouton Ajouter désactivé sans Nom et Prénom', async ({ page }) => {
    await goToSalaries(page)
    await page.getByRole('button', { name: /Ajouter un salarié/i }).click()
    const addBtn = page.getByRole('button', { name: /^Ajouter$/ })
    await expect(addBtn).toBeDisabled()
  })

  test('bouton Ajouter activé quand Nom et Prénom renseignés', async ({ page }) => {
    await goToSalaries(page)
    await page.getByRole('button', { name: /Ajouter un salarié/i }).click()
    // Remplir Nom (2e input) et Prénom (3e input) en excluant file inputs
    const inputs = page.locator('input:not([type=file]):not([type=date])')
    await inputs.nth(0).fill('TestNom')
    await inputs.nth(1).fill('TestPrenom')
    await expect(page.getByRole('button', { name: /^Ajouter$/ })).toBeEnabled()
  })

  test('Annuler referme le formulaire', async ({ page }) => {
    await goToSalaries(page)
    await page.getByRole('button', { name: /Ajouter un salarié/i }).click()
    await expect(page.getByText('Nouveau salarié')).toBeVisible()
    await page.getByRole('button', { name: 'Annuler' }).first().click()
    await expect(page.getByText('Nouveau salarié')).not.toBeVisible()
  })

  // ── Suppression ─────────────────────────────────────────────────────────

  test('suppression — clic poubelle affiche confirmation inline', async ({ page }) => {
    await goToSalaries(page)
    const rows = page.locator('tbody tr')
    if (await rows.count() > 0) {
      await rows.first().locator('button').last().click()
      await expect(page.getByText('Supprimer ?')).toBeVisible({ timeout: 3000 })
      await expect(page.getByRole('button', { name: 'Annuler' }).first()).toBeVisible()
    }
  })

  test('suppression — Annuler referme la confirmation', async ({ page }) => {
    await goToSalaries(page)
    const rows = page.locator('tbody tr')
    if (await rows.count() > 0) {
      await rows.first().locator('button').last().click()
      await expect(page.getByText('Supprimer ?')).toBeVisible()
      await page.getByRole('button', { name: 'Annuler' }).first().click()
      await expect(page.getByText('Supprimer ?')).not.toBeVisible()
    }
  })

  // ── Import Excel — valide ───────────────────────────────────────────────

  test('import valide — preview affiché avec 3 salariés', async ({ page }) => {
    await goToSalaries(page)
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Importer Excel').click(),
    ])
    await fileChooser.setFiles(FIXTURE('employees_valid.xlsx'))
    await expect(page.getByText(/3 salarié\(s\) à importer/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Confirmer l'import/i })).toBeVisible()
  })

  test('import valide — Annuler vide la preview', async ({ page }) => {
    await goToSalaries(page)
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Importer Excel').click(),
    ])
    await fileChooser.setFiles(FIXTURE('employees_valid.xlsx'))
    await expect(page.getByText(/salarié\(s\) à importer/i)).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Annuler' }).first().click()
    await expect(page.getByText(/salarié\(s\) à importer/i)).not.toBeVisible()
  })

  // ── Import — lignes incomplètes ─────────────────────────────────────────

  test('import incomplet — lignes sans nom/prénom signalées', async ({ page }) => {
    await goToSalaries(page)
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Importer Excel').click(),
    ])
    await fileChooser.setFiles(FIXTURE('employees_incomplete.xlsx'))
    await expect(page.getByText(/ignorée\(s\)/i)).toBeVisible({ timeout: 5000 })
    // Seule la ligne valide doit apparaître
    await expect(page.getByText(/1 salarié\(s\) à importer/i)).toBeVisible()
  })

  // ── Import — doublons intra-batch ───────────────────────────────────────

  test('import doublons — avertissements affichés, doublons exclus', async ({ page }) => {
    await goToSalaries(page)
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Importer Excel').click(),
    ])
    await fileChooser.setFiles(FIXTURE('employees_duplicates.xlsx'))
    await expect(page.getByText(/Doublon/i).first()).toBeVisible({ timeout: 5000 })
    // Le fichier a 3 lignes, 2 doublons → 1 seul à importer
    await expect(page.getByText(/1 salarié\(s\) à importer/i)).toBeVisible()
  })

  // ── Import — dates invalides ────────────────────────────────────────────

  test('import dates invalides — preview affiché sans plantage', async ({ page }) => {
    await goToSalaries(page)
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByText('Importer Excel').click(),
    ])
    await fileChooser.setFiles(FIXTURE('employees_bad_dates.xlsx'))
    // 2 lignes valides (nom + prénom présents), pas d'erreur JS
    await expect(page.getByText(/salarié\(s\) à importer/i)).toBeVisible({ timeout: 5000 })
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  // ── Téléchargement modèle ───────────────────────────────────────────────

  test('bouton Modèle déclenche un téléchargement', async ({ page }) => {
    await goToSalaries(page)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Modèle/i }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/salaries.*\.xlsx$/i)
  })
})
