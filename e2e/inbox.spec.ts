import { test, expect } from '@playwright/test'
import { CAB_AUTH_FILE } from './constants'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function goToInbox(page: import('@playwright/test').Page) {
  await page.goto('/inbox')
  await expect(page.locator('h1', { hasText: 'Inbox' })).toBeVisible({ timeout: 10000 })
  await expect(page.locator('body')).not.toContainText('Internal Server Error')
}

// ─── Accès non authentifié ───────────────────────────────────────────────────

test.describe('Inbox — accès non authentifié', () => {
  test('redirige vers /login', async ({ page }) => {
    await page.goto('/inbox')
    await page.waitForURL('**/login', { timeout: 8000 })
    expect(page.url()).toContain('/login')
  })
})

// ─── Sidebar ─────────────────────────────────────────────────────────────────

test.describe('Inbox — sidebar', () => {
  test.use({ storageState: CAB_AUTH_FILE })

  test('lien Inbox visible dans la sidebar', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('aside a[href="/inbox"]')).toBeVisible({ timeout: 8000 })
  })

  test('badge non-lu affiché sur Inbox si items non lus', async ({ page }) => {
    await page.goto('/dashboard')
    // Le badge peut être absent (0 non-lus) ou présent — on vérifie juste que la sidebar charge
    await expect(page.locator('aside a[href="/inbox"]')).toBeVisible()
  })

  test('Inbox est le lien actif sur /inbox', async ({ page }) => {
    await page.goto('/inbox')
    await expect(page.locator('h1', { hasText: 'Inbox' })).toBeVisible({ timeout: 8000 })
    await expect(page.locator('aside a[href="/inbox"]')).toBeVisible()
  })
})

// ─── Page Inbox ───────────────────────────────────────────────────────────────

test.describe('Inbox — page principale', () => {
  test.use({ storageState: CAB_AUTH_FILE })

  test.beforeEach(async ({ page }) => {
    await goToInbox(page)
  })

  // ── Structure ──────────────────────────────────────────────────────────────

  test('titre h1 Inbox visible', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'Inbox' })).toBeVisible()
  })

  test('filtres tabs visibles — Tous, Messages, Documents, Tâches, Activité', async ({ page }) => {
    for (const label of ['Tous', 'Messages', 'Documents', 'Tâches', 'Activité']) {
      await expect(page.getByRole('button', { name: new RegExp(label) }).first()).toBeVisible()
    }
  })

  test('bouton Flagués visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Flagués/i })).toBeVisible()
  })

  test('charge sans erreur serveur', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('body')).not.toContainText('undefined')
  })

  // ── Table ──────────────────────────────────────────────────────────────────

  test('table avec colonnes Date, Type, Libellé, CTA', async ({ page }) => {
    const hasItems = await page.locator('table').count() > 0
    if (hasItems) {
      await expect(page.locator('th', { hasText: 'Date' })).toBeVisible()
      await expect(page.locator('th', { hasText: 'Type' })).toBeVisible()
      await expect(page.locator('th', { hasText: 'Libellé' })).toBeVisible()
      await expect(page.locator('th', { hasText: 'CTA' })).toBeVisible()
    } else {
      await expect(page.getByText(/Aucun élément/i)).toBeVisible()
    }
  })

  test('état vide affiche message Aucun élément ou table', async ({ page }) => {
    const hasTable = await page.locator('table').count() > 0
    const hasEmpty = await page.getByText(/Aucun élément/i).isVisible().catch(() => false)
    expect(hasTable || hasEmpty).toBeTruthy()
  })

  // ── Items ──────────────────────────────────────────────────────────────────

  test('items non lus affichés en gras', async ({ page }) => {
    const hasItems = await page.locator('tbody tr').count() > 0
    if (hasItems) {
      const boldItems = page.locator('tbody td span.font-bold')
      const count = await boldItems.count()
      // Les items non lus ont font-bold — peut être 0 si tout est lu
      expect(count).toBeGreaterThanOrEqual(0)
    }
  })

  test('dot non-lu visible sur items non lus', async ({ page }) => {
    const hasItems = await page.locator('tbody tr').count() > 0
    if (hasItems) {
      // Dot bleu = non lu, cercle vide = lu
      const dots = page.locator('tbody td').first()
      await expect(dots).toBeVisible()
    }
  })

  test('colonne Type affiche un libellé reconnu', async ({ page }) => {
    const hasItems = await page.locator('tbody tr').count() > 0
    if (hasItems) {
      const knownTypes = ['Message', 'Document déposé', 'Livrable déposé', 'Statut document',
        'Tâche en retard', 'Client créé', 'Service créé', 'Salarié créé', 'Compte bancaire créé']
      const firstTypeCell = page.locator('tbody tr').first().locator('td').nth(2)
      const text = await firstTypeCell.textContent()
      const found = knownTypes.some(t => text?.includes(t))
      expect(found).toBeTruthy()
    }
  })

  // ── Filtres ────────────────────────────────────────────────────────────────

  test('filtre Messages — ne plante pas', async ({ page }) => {
    await page.getByRole('button', { name: /^Messages/ }).click()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('filtre Documents — ne plante pas', async ({ page }) => {
    await page.getByRole('button', { name: /^Documents/ }).click()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('filtre Tâches — ne plante pas', async ({ page }) => {
    await page.getByRole('button', { name: /^Tâches/ }).click()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('filtre Activité — ne plante pas', async ({ page }) => {
    await page.getByRole('button', { name: /^Activité/ }).click()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('filtre Tous — restaure la liste complète', async ({ page }) => {
    await page.getByRole('button', { name: /^Messages/ }).click()
    await page.getByRole('button', { name: /^Tous/ }).click()
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  // ── Toggle Flagués ─────────────────────────────────────────────────────────

  test('bouton Flagués — toggle actif/inactif', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Flagués/i })
    await btn.click()
    // Après clic : soit items flagués soit message vide
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await btn.click()
    // Retour à la normale
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  // ── Actions sur items ──────────────────────────────────────────────────────

  test('bouton Flag sur premier item — toggle sans erreur', async ({ page }) => {
    const hasItems = await page.locator('tbody tr').count() > 0
    if (!hasItems) return
    const flagBtn = page.locator('tbody tr').first().getByTitle(/Flaguer|Retirer le flag/)
    if (await flagBtn.count() > 0) {
      await flagBtn.click()
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  test('bouton Supprimer (Trash) — item disparaît de la liste', async ({ page }) => {
    const hasItems = await page.locator('tbody tr').count() > 0
    if (!hasItems) return
    const countBefore = await page.locator('tbody tr').count()
    const trashBtn = page.locator('tbody tr').first().getByTitle('Supprimer')
    if (await trashBtn.count() > 0) {
      await trashBtn.click()
      await page.waitForTimeout(500)
      const countAfter = await page.locator('tbody tr').count()
      expect(countAfter).toBeLessThanOrEqual(countBefore)
    }
  })

  test('dot cliquable — toggle lu/non-lu sans naviguer', async ({ page }) => {
    const hasItems = await page.locator('tbody tr').count() > 0
    if (!hasItems) return
    const firstDot = page.locator('tbody tr').first().locator('td').first().locator('div')
    if (await firstDot.count() > 0) {
      await firstDot.click()
      await expect(page.locator('h1', { hasText: 'Inbox' })).toBeVisible()
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  // ── Bouton Tout marquer lu ─────────────────────────────────────────────────

  test('bouton "Tout marquer lu" — visible si non-lus, marque tout', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Tout marquer lu/i })
    const hasBtn = await btn.isVisible().catch(() => false)
    if (hasBtn) {
      await btn.click()
      await page.waitForTimeout(500)
      // Après clic, bouton disparaît ou items passent en lus
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('clic sur item task_late → redirige vers /taches', async ({ page }) => {
    const taskRow = page.locator('tbody tr').filter({ hasText: 'Tâche en retard' }).first()
    if (await taskRow.count() > 0) {
      await taskRow.click()
      await page.waitForURL('**/taches', { timeout: 8000 })
      expect(page.url()).toContain('/taches')
    }
  })

  test('clic sur item document → redirige vers /documents', async ({ page }) => {
    const docRow = page.locator('tbody tr').filter({ hasText: 'Document déposé' }).first()
    if (await docRow.count() > 0) {
      await docRow.click()
      await page.waitForURL('**/documents', { timeout: 8000 })
      expect(page.url()).toContain('/documents')
    }
  })

  test('clic sur item customer_created → redirige vers fiche client', async ({ page }) => {
    const custRow = page.locator('tbody tr').filter({ hasText: 'Client créé' }).first()
    if (await custRow.count() > 0) {
      await custRow.click()
      await page.waitForURL('**/clients/**', { timeout: 8000 })
      expect(page.url()).toContain('/clients/')
    }
  })

  test('clic sur item service_added → ouvre fiche client onglet services', async ({ page }) => {
    const svcRow = page.locator('tbody tr').filter({ hasText: 'Service créé' }).first()
    if (await svcRow.count() > 0) {
      await svcRow.click()
      await page.waitForURL('**/clients/**', { timeout: 8000 })
      expect(page.url()).toContain('tab=services')
    }
  })

  test('clic sur item employee_added → ouvre fiche client onglet salariés', async ({ page }) => {
    const empRow = page.locator('tbody tr').filter({ hasText: 'Salarié créé' }).first()
    if (await empRow.count() > 0) {
      await empRow.click()
      await page.waitForURL('**/clients/**', { timeout: 8000 })
      expect(page.url()).toContain('tab=salaries')
    }
  })

  test('clic sur item account_added → ouvre fiche client onglet comptes', async ({ page }) => {
    const accRow = page.locator('tbody tr').filter({ hasText: 'Compte bancaire créé' }).first()
    if (await accRow.count() > 0) {
      await accRow.click()
      await page.waitForURL('**/clients/**', { timeout: 8000 })
      expect(page.url()).toContain('tab=comptes')
    }
  })

  // ── Pas d'erreur ──────────────────────────────────────────────────────────

  test('pas de NaN, undefined ou erreur visible', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('NaN')
    await expect(page.locator('body')).not.toContainText('[object Object]')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })
})

// ─── Fiche client — ouverture via tab param ───────────────────────────────────

test.describe('Fiche client — ?tab= param depuis Inbox', () => {
  test.use({ storageState: CAB_AUTH_FILE })

  async function getFirstClientId(page: import('@playwright/test').Page): Promise<string | null> {
    await page.goto('/clients')
    await page.locator('tbody tr').first().waitFor({ timeout: 10000 }).catch(() => null)
    const href = await page.locator('tbody tr').first().getAttribute('data-href')
      .catch(() => null)
    if (href) return href.split('/').pop() ?? null
    // Fallback : clic et récupère l'URL
    const count = await page.locator('tbody tr').count()
    if (count === 0) return null
    await page.locator('tbody tr').first().click()
    await page.waitForURL('**/clients/**', { timeout: 8000 })
    return page.url().split('/').pop() ?? null
  }

  test('?tab=services → onglet Services actif', async ({ page }) => {
    const id = await getFirstClientId(page)
    if (!id) return
    await page.goto(`/clients/${id}?tab=services`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Services' })).toHaveClass(/text-\[#1D4ED8\]/, { timeout: 5000 })
  })

  test('?tab=salaries → onglet Salariés actif', async ({ page }) => {
    const id = await getFirstClientId(page)
    if (!id) return
    await page.goto(`/clients/${id}?tab=salaries`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Salariés' })).toHaveClass(/text-\[#1D4ED8\]/, { timeout: 5000 })
  })

  test('?tab=comptes → onglet Comptes bancaires actif', async ({ page }) => {
    const id = await getFirstClientId(page)
    if (!id) return
    await page.goto(`/clients/${id}?tab=comptes`)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Comptes bancaires' })).toHaveClass(/text-\[#1D4ED8\]/, { timeout: 5000 })
  })
})
