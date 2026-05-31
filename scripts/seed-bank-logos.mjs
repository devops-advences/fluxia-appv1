/**
 * One-shot : télécharge les logos des banques et les upload dans logos/bank/{id}.png
 * Usage : node --env-file=.env.local scripts/seed-bank-logos.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Domaine officiel pour chaque banque (utilisé pour télécharger le logo via Google favicon)
const BANK_DOMAINS = {
  // France
  'BNP Paribas':             'bnpparibas.com',
  'Société Générale':        'societegenerale.com',
  'Crédit Agricole':         'credit-agricole.com',
  'LCL':                     'lcl.fr',
  "Caisse d'Épargne":        'bpce.fr',
  'Banque Populaire':        'banquepopulaire.fr',
  'CIC':                     'cic.fr',
  'Crédit Mutuel':           'creditmutuel.fr',
  'La Banque Postale':       'labanquepostale.fr',
  'HSBC France':             'hsbc.fr',
  'Natixis':                 'natixis.fr',
  'Bred':                    'bred.fr',
  'Boursorama':              'boursorama.com',
  'Hello Bank':              'hellobank.fr',
  'Fortuneo':                'fortuneo.fr',
  'BforBank':                'bforbank.com',
  'Monabanq':                'monabanq.com',
  'ING France':              'ing.fr',
  'AXA Banque':              'axabanque.fr',
  'Orange Bank':             'orangebank.fr',
  'Milleis Banque':          'milleis.fr',
  'Nickel':                  'nickel.eu',
  'Qonto':                   'qonto.com',
  'Shine':                   'shine.fr',
  'N26':                     'n26.com',
  'Revolut Business':        'revolut.com',
  'Memo Bank':               'memo.bank',
  'Blank':                   'blank.app',
  'Anytime':                 'anytime.fr',
  'Banque Transatlantique':  'ca-transatlantique.com',

  // Tunisie
  'BIAT':                    'biat.tn',
  'STB':                     'stb.com.tn',
  'BNA':                     'bna.com.tn',
  'BH Bank':                 'bh.com.tn',
  'UIB':                     'uib.tn',
  'Amen Bank':               'amenbank.com',
  'Attijari Bank':           'attijari.tn',
  'UBCI':                    'ubci.tn',
  'ATB':                     'atb.com.tn',
  'BTK':                     'btk.tn',
  'BT':                      'banquedetunisie.com',
  'BTE':                     'bte.com.tn',
  'BFT':                     'bft.tn',
  'BTS':                     'bts.com.tn',
  'BTL':                     'btl.com.tn',
  'TSB':                     'tsb.com.tn',
  'TIB':                     'tib.tn',
  'NAIB':                    'naib.com.tn',
  'ABC Tunisie':             'bank-abc.com',
  'Citibank Tunisie':        'citibank.com',
  'QNB Tunisia':             'qnb.com',
  'Zitouna Bank':            'banquezitouna.com',
  'Wifak International Bank':'wifakbank.com',
  'Al Baraka Bank':          'albaraka.com',

  // Maroc
  'Attijariwafa Bank':       'attijariwafabank.com',
  'Banque Centrale Populaire':'bcp.ma',
  'Bank of Africa (BMCE)':   'bankofafrica.ma',
  'CIH Bank':                'cihbank.com',
  'Société Générale Maroc':  'sgmaroc.com',
  'BMCI':                    'bmci.ma',
  'Al Barid Bank':           'albaridbank.com',
  'Crédit du Maroc':         'creditdumaroc.ma',
  'CFG Bank':                'cfgbank.com',
  'Crédit Agricole du Maroc':'creditagricole.ma',
  'Arab Bank Maroc':         'arabbank.ma',
  'Citibank Maroc':          'citibank.com',
  'Bank Al-Amal':            'bankalmal.ma',
  'Umnia Bank':              'umnia.ma',
  'Al Akhdar Bank':          'alakhdarbank.ma',
  'Bank Al Yousr':           'bankalyousr.ma',
  'BTI Bank':                'btibank.ma',
  'Bank Assafa':             'bankassafa.ma',
}

async function downloadLogo(domain) {
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  return Buffer.from(buf)
}

async function run() {
  const { data: banks, error } = await supabase.from('bank').select('id, name')
  if (error) { console.error('Erreur lecture banques:', error.message); process.exit(1) }

  let ok = 0, skipped = 0, failed = 0

  for (const bank of banks) {
    const domain = BANK_DOMAINS[bank.name]
    if (!domain) {
      console.log(`  ⚠  ${bank.name} — domaine inconnu, ignoré`)
      skipped++
      continue
    }

    const storagePath = `bank/${bank.id}.png`
    const publicUrl   = `${SUPABASE_URL}/storage/v1/object/public/logos/${storagePath}`

    try {
      const buf = await downloadLogo(domain)

      const { error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(storagePath, buf, { contentType: 'image/png', upsert: true })

      if (uploadErr) throw new Error(uploadErr.message)

      const { error: dbErr } = await supabase
        .from('bank')
        .update({ logo_url: publicUrl })
        .eq('id', bank.id)

      if (dbErr) throw new Error(dbErr.message)

      console.log(`  ✓  ${bank.name}`)
      ok++
    } catch (err) {
      console.log(`  ✗  ${bank.name} (${domain}) — ${err.message}`)
      failed++
    }

    // Pause légère pour ne pas saturer Google
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nTerminé : ${ok} ✓  ${skipped} ignorés  ${failed} ✗`)
}

run()
