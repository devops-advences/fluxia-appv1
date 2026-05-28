import type { PDFDocumentProxy } from 'pdfjs-dist'

export type FileKind = 'pdf' | 'image' | 'table' | 'doc'

export function getFileKind(file: File): FileKind {
  const n = file.name.toLowerCase()
  if (n.endsWith('.pdf')) return 'pdf'
  if (/\.(jpe?g|png|webp|tiff?|heic)$/.test(n) || file.type.startsWith('image/')) return 'image'
  if (/\.(xlsx?|csv)$/.test(n)) return 'table'
  return 'doc'
}

export const FILE_KIND_META: Record<FileKind, { label: string; bg: string; color: string }> = {
  pdf:   { label: 'PDF',     bg: '#f3f4f6', color: '#6b7280' },
  image: { label: 'Image',   bg: '#f3f4f6', color: '#6b7280' },
  table: { label: 'Tableur', bg: '#f3f4f6', color: '#6b7280' },
  doc:   { label: 'Word',    bg: '#f3f4f6', color: '#6b7280' },
}

export type LoadedFile = {
  id: string
  file: File
  name: string
  fileKind: FileKind
  pageCount: number
  pdfProxy?: PDFDocumentProxy
  pdfBytes?: ArrayBuffer
  previewUrl?: string
}

export type Qualification = {
  type: string
  year: string
  month: string
  note: string
  committed?: boolean
}

export type WizardContext = {
  firmSlug:          string
  customerId:        string
  customerName:      string
  cabinetName:       string
  existingFilenames: string[]
  accessToken:       string
}

// Valeurs slug → label (pour auto-détection + affichage)
export const CUSTOMER_DOC_TYPES: { value: string; label: string }[] = [
  { value: 'Facture vente',       label: 'Facture vente' },
  { value: 'Facture achat',       label: 'Facture achat' },
  { value: 'Relevé bancaire',     label: 'Relevé bancaire' },
  { value: 'Note de frais',       label: 'Note de frais' },
  { value: 'Absence / congé',     label: 'Absence / congé' },
  { value: "Contrat d'embauche",  label: "Contrat d'embauche" },
  { value: 'Contrat fournisseur', label: 'Contrat fournisseur' },
  { value: 'Contrat vente',       label: 'Contrat vente' },
  { value: 'Autre contrat',       label: 'Autre contrat' },
  { value: 'Autre',               label: 'Autre' },
]

export const MONTHS: Record<string, string> = {
  '01': 'Janvier',   '02': 'Février',   '03': 'Mars',      '04': 'Avril',
  '05': 'Mai',       '06': 'Juin',      '07': 'Juillet',   '08': 'Août',
  '09': 'Septembre', '10': 'Octobre',   '11': 'Novembre',  '12': 'Décembre',
}

export const DOC_COLORS = [
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#ede9fe', text: '#5b21b6' },
]

export function qualKey(fi: number, di: number) { return `${fi}-${di}` }

export function getDocs(pageCount: number, cuts: Set<number>): { start: number; end: number }[] {
  const docs: { start: number; end: number }[] = []
  let start = 1
  for (let p = 1; p <= pageCount; p++) {
    if (cuts.has(p)) { docs.push({ start, end: p }); start = p + 1 }
  }
  docs.push({ start, end: pageCount })
  return docs
}

export function getAllDocs(files: LoadedFile[], cuts: Set<number>[]) {
  const out: { fi: number; di: number; start: number; end: number; name: string }[] = []
  files.forEach((f, fi) => {
    getDocs(f.pageCount, cuts[fi]).forEach((d, di) => {
      out.push({ fi, di, ...d, name: f.name })
    })
  })
  return out
}
