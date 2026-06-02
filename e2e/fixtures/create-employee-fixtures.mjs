/**
 * Génère les fichiers Excel de test pour les salariés
 * Usage : node e2e/fixtures/create-employee-fixtures.mjs
 */
import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function make(name, rows) {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Civilité','Nom','Prénom','Date naissance','N° Identité','N° Social','Contrat','Poste','Date entrée','Date sortie'],
    ...rows
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Salariés')
  writeFileSync(join(__dirname, name), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  console.log(`✓ ${name}`)
}

// Fichier valide — 3 salariés complets
make('employees_valid.xlsx', [
  ['M.', 'Dupont',   'Jean',    '1985-03-15', 'CIN001', 'CSS001', 'CDI',   'Comptable', '2020-01-01', ''],
  ['Mme','Martin',   'Sophie',  '1990-07-22', 'CIN002', 'CSS002', 'CDD',   'Assistante','2022-06-01', ''],
  ['M.', 'Bernard',  'Pierre',  '1978-11-30', 'CIN003', 'CSS003', 'CDI',   'Directeur', '2015-03-01', ''],
])

// Fichier avec lignes incomplètes (sans nom ou prénom)
make('employees_incomplete.xlsx', [
  ['M.', 'Valide',  'Paul',  '1990-01-01', '', '', 'CDI', 'Dev', '2023-01-01', ''],
  ['',   '',        '',      '',           '', '', '',    '',    '',            ''], // vide
  ['M.', '',        'Marie', '1995-05-05', '', '', 'CDD', '',    '',            ''], // sans nom
  ['Mme','Sansnom', '',      '',           '', '', '',    '',    '',            ''], // sans prénom
])

// Fichier avec doublons intra-batch (même CIN et même CNSS)
make('employees_duplicates.xlsx', [
  ['M.', 'Premier', 'Paul',  '1990-01-01', 'DUP001', 'SOC001', 'CDI', 'Dev',     '2023-01-01', ''],
  ['M.', 'Second',  'Luc',   '1985-06-15', 'DUP001', 'SOC002', 'CDI', 'Manager', '2022-01-01', ''], // même CIN
  ['Mme','Troisième','Anne', '1992-03-10', 'DUP002', 'SOC001', 'CDD', 'RH',      '2021-01-01', ''], // même CNSS
])

// Fichier avec dates mal formatées
make('employees_bad_dates.xlsx', [
  ['M.', 'DateOk',  'Jean',  '1985-03-15', '', '', 'CDI', 'Dev',  '2020-01-01', ''],
  ['M.', 'DateBad', 'Marc',  'pas-une-date','', '', 'CDD', 'Chef', 'invalide',   ''],
])

console.log('\nFixtures créées dans e2e/fixtures/')
