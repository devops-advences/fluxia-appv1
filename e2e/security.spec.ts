import { test, expect } from '@playwright/test'
import { CAB_AUTH_FILE, CLIENT_AUTH_FILE } from './constants'

// ─── /api/invite/validate ────────────────────────────────────────────────────

test.describe('/api/invite/validate — validation de token', () => {
  test('token inexistant → { valid: false }', async ({ request }) => {
    const res = await request.post('/api/invite/validate', {
      data: { token: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(false)
  })

  test('body vide → 400', async ({ request }) => {
    const res = await request.post('/api/invite/validate', { data: {} })
    expect(res.status()).toBe(400)
  })

  test('token absent (null) → 400', async ({ request }) => {
    const res = await request.post('/api/invite/validate', {
      data: { token: null },
    })
    expect(res.status()).toBe(400)
  })

  test('corps invalide (non-JSON) → 400', async ({ request }) => {
    const res = await request.post('/api/invite/validate', {
      headers: { 'Content-Type': 'text/plain' },
      data: 'not json',
    })
    expect([400, 415, 500]).toContain(res.status())
  })
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

test.describe('Rate limiting — upload routes', () => {
  // IP fictive réservée (RFC 5737) → isolée des autres tests
  const FAKE_IP = '192.0.2.99'

  test('50 requêtes passent, la 51e → 429', async ({ request }) => {
    const headers = {
      'x-forwarded-for': FAKE_IP,
      'Content-Type': 'application/json',
    }

    for (let i = 0; i < 50; i++) {
      // Corps invalide → 401/400 de la route, mais le middleware laisse passer
      await request.post('/api/customer/documents/submit', { headers })
    }

    const blocked = await request.post('/api/customer/documents/submit', { headers })
    expect(blocked.status()).toBe(429)
    const body = await blocked.json()
    expect(body.error).toMatch(/Trop de requêtes/)
  })
})

// ─── MIME validation — API customer submit ────────────────────────────────────

test.describe('MIME validation — route customer submit', () => {
  test.use({ storageState: CLIENT_AUTH_FILE })

  test('fichier non-PDF avec extension .pdf → 400 MIME', async ({ page, request }) => {
    await page.goto('/mes-documents')
    await page.waitForURL('**/mes-documents', { timeout: 10000 })

    const token = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
      if (!key) return null
      try { return JSON.parse(localStorage.getItem(key) ?? '').access_token }
      catch { return null }
    })

    if (!token) { test.skip(); return }

    const res = await request.post('/api/customer/documents/submit', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        customerId: '00000000-0000-0000-0000-000000000000',
        meta: JSON.stringify([{ type: 'Autre', year: '2026', month: '', note: '', originalName: 'fake.pdf' }]),
        files: {
          name: 'fake.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('This is plain text, not a PDF'),
        },
      },
    })

    if (res.status() === 401) { test.skip(); return }
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/corrompu|type invalide/)
  })

  test('fichier non-PDF avec extension .jpg → 400 MIME', async ({ page, request }) => {
    await page.goto('/mes-documents')
    await page.waitForURL('**/mes-documents', { timeout: 10000 })

    const token = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
      if (!key) return null
      try { return JSON.parse(localStorage.getItem(key) ?? '').access_token }
      catch { return null }
    })

    if (!token) { test.skip(); return }

    const res = await request.post('/api/customer/documents/submit', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        customerId: '00000000-0000-0000-0000-000000000000',
        meta: JSON.stringify([{ type: 'Autre', year: '2026', month: '', note: '', originalName: 'fake.jpg' }]),
        files: {
          name: 'fake.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('Not a JPEG'),
        },
      },
    })

    if (res.status() === 401) { test.skip(); return }
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/corrompu|type invalide/)
  })
})

// ─── MIME validation — route firm upload ─────────────────────────────────────

import fs from 'fs'
import path from 'path'

function getCabToken(): string | null {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.auth/cab.json'), 'utf8')
    const state = JSON.parse(raw) as { origins: Array<{ localStorage: Array<{ name: string; value: string }> }> }
    const ls = state.origins[0]?.localStorage ?? []
    const entry = ls.find((e) => e.name.includes('auth-token'))
    if (!entry) return null
    return JSON.parse(entry.value).access_token ?? null
  } catch { return null }
}

test.describe('MIME validation — route firm upload', () => {
  test('fichier non-PDF avec extension .pdf → 400 MIME', async ({ request }) => {
    const token = getCabToken()
    if (!token) { test.skip(); return }

    const res = await request.post('/api/firm/documents/upload', {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        customerId: '00000000-0000-0000-0000-000000000000',
        year: '2026',
        source: 'firm',
        file: {
          name: 'fake.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('This is plain text, not a PDF'),
        },
      },
    })

    // 401 = token expiré entre auth.setup et ce test (lecture fichier statique) → skip gracieux
    if (res.status() === 401) { test.skip(); return }
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/corrompu|type invalide/)
  })
})

// ─── Quota storage — protection API ──────────────────────────────────────────

test.describe('Quota storage — routes upload', () => {
  test('route customer — requête non auth → 401 avant quota', async ({ request }) => {
    const res = await request.post('/api/customer/documents/submit')
    expect(res.status()).toBe(401)
  })

  test('route firm — requête non auth → 401 avant quota', async ({ request }) => {
    const res = await request.post('/api/firm/documents/upload')
    expect(res.status()).toBe(401)
  })
})
