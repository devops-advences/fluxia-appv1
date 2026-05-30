'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import Step1SourceUpload    from './Step1SourceUpload'
import Step2QualifyClient   from './Step2QualifyClient'
import Step2QualifyLivrable from './Step2QualifyLivrable'
import Step3Confirm         from './Step3Confirm'
import {
  type LoadedFile, type CabQualification, type CabSource, type CabWizardContext,
  qualKey, getAllDocs,
} from './types'

export default function CabUploadWizard({ firmName, customers, accessToken }: CabWizardContext) {
  const router = useRouter()

  const [step,               setStep]               = useState<1 | 2 | 3>(1)
  const [source,             setSource]             = useState<CabSource | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [files,              setFiles]              = useState<LoadedFile[]>([])
  const [cuts,               setCuts]               = useState<Set<number>[]>([])
  const [skips,              setSkips]              = useState<Set<number>[]>([])
  const [quals,              setQuals]              = useState<Record<string, CabQualification>>({})
  const [curFi,              setCurFi]              = useState(0)
  const [curDi,              setCurDi]              = useState(0)
  const [previewP,           setPreviewP]           = useState(1)
  const [submitting,         setSubmitting]         = useState(false)
  const [submittingRaw,      setSubmittingRaw]      = useState(false)
  const [submitError,        setSubmitError]        = useState<string | null>(null)
  const [done,               setDone]               = useState(false)
  const [footerError,        setFooterError]        = useState<string | null>(null)

  const allDocs = useMemo(() => getAllDocs(files, cuts), [files, cuts])

  const qualifiedCount = useMemo(() =>
    allDocs.filter(d => !!quals[qualKey(d.fi, d.di)]?.committed).length,
  [allDocs, quals])

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId],
  )
  const clientCountry = selectedCustomer?.country_code ?? 'FR'

  const handleFilesLoaded = useCallback((loaded: LoadedFile[]) => {
    setFiles(loaded)
    setCuts(loaded.map(() => new Set<number>()))
    setSkips(loaded.map(() => new Set<number>()))
  }, [])

  const handleSourceChange = useCallback((s: CabSource) => {
    setSource(s)
    setFiles([])
    setCuts([])
    setSkips([])
    setQuals({})
  }, [])

  const handleCustomerChange = useCallback((id: string) => {
    setSelectedCustomerId(id)
    setQuals({})
  }, [])

  const handleCutToggle = useCallback((fi: number, afterPage: number) => {
    setCuts(prev => {
      const next = prev.map((s, i) => i === fi ? new Set(s) : s)
      if (next[fi].has(afterPage)) next[fi].delete(afterPage)
      else next[fi].add(afterPage)
      return next
    })
  }, [])

  const handleSkipToggle = useCallback((fi: number, page: number) => {
    setSkips(prev => {
      const next = prev.map((s, i) => i === fi ? new Set(s) : s)
      if (next[fi].has(page)) next[fi].delete(page)
      else next[fi].add(page)
      return next
    })
  }, [])

  const handleSelectPage = useCallback((fi: number, di: number, page: number) => {
    setCurFi(fi); setCurDi(di); setPreviewP(page)
  }, [])

  const handleQualChange = useCallback((key: string, q: CabQualification) => {
    setQuals(prev => ({ ...prev, [key]: q }))
  }, [])

  const goNext = useCallback(() => {
    setFooterError(null)
    if (step === 1) {
      if (!source)             { setFooterError('Choisissez une source.'); return }
      if (!selectedCustomerId) { setFooterError('Sélectionnez un client.'); return }
      if (files.length === 0)  { setFooterError('Ajoutez au moins un fichier.'); return }
      setStep(2); setCurFi(0); setCurDi(0); setPreviewP(1)
    } else if (step === 2) {
      if (qualifiedCount < allDocs.length) {
        setFooterError(`${allDocs.length - qualifiedCount} document(s) non qualifié(s).`)
        return
      }
      setStep(3)
    } else {
      handleSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, source, selectedCustomerId, files, qualifiedCount, allDocs.length])

  const goBack = useCallback(() => {
    setFooterError(null)
    if (step === 2) setStep(1)
    else if (step === 3) { setStep(2); setCurFi(0); setCurDi(0); setPreviewP(1) }
  }, [step])

  const handleEdit = useCallback((fi: number, di: number) => {
    setCurFi(fi); setCurDi(di)
    setStep(2)
  }, [])

  const uploadFile = useCallback(async (file: File, typeId: string | null, year: number, month: string | null) => {
    const fd = new FormData()
    fd.append('customerId', selectedCustomerId)
    if (typeId) fd.append('typeId', typeId)
    fd.append('year',   String(year))
    if (month) fd.append('month', String(parseInt(month, 10)))
    fd.append('source', source ?? 'customer')
    fd.append('file', file)
    const res = await fetch('/api/firm/documents/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: fd,
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new Error(data.error ?? `Erreur dépôt ${file.name}`)
    }
  }, [selectedCustomerId, source, accessToken])

  const handleSubmitRaw = useCallback(async () => {
    if (!source || !selectedCustomerId || files.length === 0) return
    setSubmittingRaw(true)
    setSubmitError(null)
    try {
      const year = new Date().getFullYear()
      for (const file of files) {
        await uploadFile(file.file, null, year, null)
      }
      setDone(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inattendue.')
    } finally {
      setSubmittingRaw(false)
    }
  }, [source, selectedCustomerId, files, uploadFile])

  const handleSubmit = useCallback(async () => {
    if (!source) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      for (const doc of allDocs) {
        const q    = quals[qualKey(doc.fi, doc.di)]
        const file = files[doc.fi]
        let   fileToUpload: File

        if (file.fileKind === 'pdf') {
          const { PDFDocument } = await import('pdf-lib')
          const srcPdf  = await PDFDocument.load(file.pdfBytes!)
          const newPdf  = await PDFDocument.create()
          const indices = Array.from({ length: doc.end - doc.start + 1 }, (_, i) => doc.start - 1 + i)
            .filter(i => !(skips[doc.fi] ?? new Set()).has(i + 1))
          const pages   = await newPdf.copyPages(srcPdf, indices)
          pages.forEach((p: import('pdf-lib').PDFPage) => newPdf.addPage(p))
          const bytes    = await newPdf.save()
          const safeName = file.name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 80)
          const partName = `${safeName}_p${doc.start}${doc.start !== doc.end ? `-${doc.end}` : ''}.pdf`
          fileToUpload   = new File([new Uint8Array(bytes)], partName, { type: 'application/pdf' })
        } else {
          fileToUpload = file.file
        }

        await uploadFile(fileToUpload, q.typeId || null, parseInt(q.year, 10), q.month || null)
      }
      setDone(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inattendue.')
    } finally {
      setSubmitting(false)
    }
  }, [source, allDocs, files, quals, skips, uploadFile])

  if (done) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '48px' }}>
        <CheckCircle size={48} color="#059669" strokeWidth={1.5} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>
            {allDocs.length || files.length} document{(allDocs.length || files.length) > 1 ? 's' : ''} déposé{(allDocs.length || files.length) > 1 ? 's' : ''} avec succès
          </div>
          <div style={{ fontSize: '13px', color: '#64748B' }}>
            {selectedCustomer?.name} · {firmName}
          </div>
        </div>
        <button type="button" onClick={() => router.push('/documents')}
          style={{ marginTop: '8px', padding: '9px 24px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          Voir les documents
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* ── Stepper ── */}
      <div style={{ padding: '0 16px', borderBottom: '1px solid #E2E8F0', flexShrink: 0, display: 'flex', alignItems: 'stretch', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: '90px' }}>
          {step > 1 && (
            <button type="button" onClick={goBack} disabled={submitting} style={btnSecondary}>← Retour</button>
          )}
          {step === 1 && (
            <button type="button" onClick={() => router.push('/documents')} style={{ ...btnSecondary, color: '#9ca3af' }}>✕ Annuler</button>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <StepIndicator num={1} label="Déposer"   active={step === 1} done={step > 1} />
            <StepLine />
            <StepIndicator num={2} label="Qualifier" active={step === 2} done={step > 2} />
            <StepLine />
            <StepIndicator num={3} label="Confirmer" active={step === 3} done={false} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '90px', justifyContent: 'flex-end' }}>
          {step === 2 && (
            <span style={{ fontSize: '12px', color: qualifiedCount === allDocs.length ? '#059669' : '#9ca3af', whiteSpace: 'nowrap' }}>
              {qualifiedCount}/{allDocs.length} qualifié{qualifiedCount > 1 ? 's' : ''}
            </span>
          )}
          {step === 2 && (
            <button type="button" onClick={goNext} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.5 : 1 }}>
              Suivant →
            </button>
          )}
        </div>
      </div>

      {/* Client banner — visible à toutes les étapes une fois sélectionné */}
      {selectedCustomer && (
        <div style={{ padding: '8px 20px', borderBottom: '1px solid #E2E8F0', background: '#EFF6FF', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#1D4ED8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
            {selectedCustomer.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1D4ED8' }}>{selectedCustomer.name}</span>
          {step === 1 && (
            <span style={{ fontSize: '11px', color: '#93C5FD', marginLeft: '4px' }}>· cliquer pour changer</span>
          )}
        </div>
      )}

      {footerError && (
        <div style={{ padding: '6px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: '#ef4444' }}>{footerError}</span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {step === 1 && (
          <Step1SourceUpload
            source={source}
            selectedCustomerId={selectedCustomerId}
            files={files}
            customers={customers}
            submittingRaw={submittingRaw}
            onSourceChange={handleSourceChange}
            onCustomerChange={handleCustomerChange}
            onFilesLoaded={handleFilesLoaded}
            onNext={goNext}
            onSubmitRaw={handleSubmitRaw}
          />
        )}
        {step === 2 && source === 'customer' && (
          <Step2QualifyClient
            files={files} cuts={cuts} skips={skips} quals={quals} clientCountry={clientCountry}
            curFi={curFi} curDi={curDi} previewP={previewP}
            onCutToggle={handleCutToggle} onSkipToggle={handleSkipToggle}
            onSelectPage={handleSelectPage} onQualChange={handleQualChange}
            onAllDone={() => setStep(3)}
          />
        )}
        {step === 2 && source === 'firm' && (
          <Step2QualifyLivrable
            files={files} cuts={cuts} skips={skips} quals={quals} clientCountry={clientCountry}
            curFi={curFi} curDi={curDi} previewP={previewP}
            onCutToggle={handleCutToggle} onSkipToggle={handleSkipToggle}
            onSelectPage={handleSelectPage} onQualChange={handleQualChange}
            onAllDone={() => setStep(3)}
          />
        )}
        {step === 3 && source && (
          <Step3Confirm
            source={source}
            customerName={selectedCustomer?.name ?? ''}
            files={files} cuts={cuts} quals={quals}
            submitting={submitting} submitError={submitError}
            onEdit={handleEdit} onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  )
}

function StepIndicator({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      paddingTop: '10px', paddingBottom: '10px',
      borderBottom: `2px solid ${active ? '#1D4ED8' : done ? '#93C5FD' : 'transparent'}`,
      transition: 'border-color 0.2s',
    }}>
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: 700, flexShrink: 0,
        background: active ? '#1D4ED8' : done ? '#DBEAFE' : '#f3f4f6',
        color:      active ? '#fff'    : done ? '#1D4ED8' : '#9ca3af',
        transition: 'all 0.2s',
      }}>
        {done ? '✓' : num}
      </div>
      <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', color: active ? '#0F172A' : done ? '#64748B' : '#9ca3af' }}>
        {label}
      </span>
    </div>
  )
}

function StepLine() {
  return <div style={{ flex: 1, height: '1px', background: '#E2E8F0', margin: '0 12px', alignSelf: 'center' }} />
}

const btnBase:      React.CSSProperties = { padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit', lineHeight: 1.4, transition: 'all 0.12s' }
const btnPrimary:   React.CSSProperties = { ...btnBase, background: '#1D4ED8', color: '#fff' }
const btnSecondary: React.CSSProperties = { ...btnBase, background: '#fff', color: '#374151', border: '1px solid #d1d5db' }
