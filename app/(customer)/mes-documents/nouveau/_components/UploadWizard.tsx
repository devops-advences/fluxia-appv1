'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import Step1Upload  from './Step1Upload'
import Step2Qualify from './Step2Qualify'
import Step3Confirm from './Step3Confirm'
import { type LoadedFile, type Qualification, type WizardContext, qualKey, getAllDocs } from './types'

type Props = WizardContext

export default function UploadWizard({ firmSlug, customerId, customerName, cabinetName, existingFilenames, accessToken }: Props) {
  const router = useRouter()

  const [step,         setStep]         = useState<1 | 2 | 3>(1)
  const [files,        setFiles]        = useState<LoadedFile[]>([])
  const [cuts,         setCuts]         = useState<Set<number>[]>([])
  const [skips,        setSkips]        = useState<Set<number>[]>([])
  const [quals,        setQuals]        = useState<Record<string, Qualification>>({})
  const [curFi,        setCurFi]        = useState(0)
  const [curDi,        setCurDi]        = useState(0)
  const [previewP,     setPreviewP]     = useState(1)
  const [submitting,   setSubmitting]   = useState(false)
  const [submittingRaw,setSubmittingRaw]= useState(false)
  const [submitError,  setSubmitError]  = useState<string | null>(null)
  const [done,         setDone]         = useState(false)
  const [footerError,  setFooterError]  = useState<string | null>(null)

  const allDocs = useMemo(() => getAllDocs(files, cuts), [files, cuts])

  const qualifiedCount = useMemo(() =>
    allDocs.filter(d => !!quals[qualKey(d.fi, d.di)]?.committed).length,
  [allDocs, quals])

  const handleFilesLoaded = useCallback((loaded: LoadedFile[]) => {
    setFiles(loaded)
    setCuts(loaded.map(() => new Set<number>()))
    setSkips(loaded.map(() => new Set<number>()))
  }, [])

  const handleSkipToggle = useCallback((fi: number, page: number) => {
    setSkips(prev => {
      const next = prev.map((s, i) => i === fi ? new Set(s) : s)
      if (next[fi].has(page)) next[fi].delete(page)
      else next[fi].add(page)
      return next
    })
  }, [])

  const handleCutToggle = useCallback((fi: number, afterPage: number) => {
    setCuts(prev => {
      const next = prev.map((s, i) => i === fi ? new Set(s) : s)
      if (next[fi].has(afterPage)) next[fi].delete(afterPage)
      else next[fi].add(afterPage)
      return next
    })
  }, [])

  const handleSelectPage = useCallback((fi: number, di: number, page: number) => {
    setCurFi(fi); setCurDi(di); setPreviewP(page)
  }, [])

  const handleQualChange = useCallback((key: string, q: Qualification) => {
    setQuals(prev => ({ ...prev, [key]: q }))
  }, [])

  const gi = useMemo(() => allDocs.findIndex(d => d.fi === curFi && d.di === curDi), [allDocs, curFi, curDi])

  const handlePrevDoc = useCallback(() => {
    if (gi <= 0) return
    const d = allDocs[gi - 1]
    setCurFi(d.fi); setCurDi(d.di); setPreviewP(d.start)
  }, [gi, allDocs])

  const handleNextDoc = useCallback(() => {
    if (gi < allDocs.length - 1) {
      const d = allDocs[gi + 1]
      setCurFi(d.fi); setCurDi(d.di); setPreviewP(d.start)
    } else {
      goNext()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gi, allDocs, qualifiedCount])

  const goNext = useCallback(() => {
    setFooterError(null)
    if (step === 1) {
      if (files.length === 0) { setFooterError('Ajoutez au moins un fichier.'); return }
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
  }, [step, files, qualifiedCount, allDocs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const goBack = useCallback(() => {
    setFooterError(null)
    if (step === 2) setStep(1)
    else if (step === 3) { setStep(2); setCurFi(0); setCurDi(0); setPreviewP(1) }
  }, [step])

  const handleEdit = useCallback((fi: number, di: number) => {
    setCurFi(fi); setCurDi(di)
    setPreviewP(getAllDocs(files, cuts)[allDocs.findIndex(d => d.fi === fi && d.di === di)]?.start ?? 1)
    setStep(2)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, cuts, allDocs])

  const handleSubmitRaw = useCallback(async () => {
    if (files.length === 0 || submittingRaw) return
    setSubmittingRaw(true)
    setSubmitError(null)
    try {
      const formData = new FormData()
      formData.append('customerId', customerId)
      formData.append('firmSlug', firmSlug)
      formData.append('raw', 'true')
      for (const f of files) formData.append('files', f.file)
      const res = await fetch('/api/customer/documents/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Erreur lors de l\'envoi.')
      }
      setDone(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inattendue.')
    } finally {
      setSubmittingRaw(false)
    }
  }, [files, customerId, firmSlug, submittingRaw, accessToken])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const formData = new FormData()
      formData.append('customerId', customerId)
      formData.append('firmSlug', firmSlug)

      const metaArray: { type: string; year: string; month: string; note: string; originalName: string }[] = []

      for (const doc of allDocs) {
        const file = files[doc.fi]
        const q    = quals[qualKey(doc.fi, doc.di)]

        if (file.fileKind !== 'pdf') {
          formData.append('files', file.file)
          metaArray.push({ type: q.type, year: q.year, month: q.month, note: q.note, originalName: file.name })
          continue
        }

        const { PDFDocument } = await import('pdf-lib')
        const srcPdf  = await PDFDocument.load(file.pdfBytes!)
        const newPdf  = await PDFDocument.create()
        const indices = Array.from({ length: doc.end - doc.start + 1 }, (_, i) => doc.start - 1 + i)
          .filter(i => !skips[doc.fi]?.has(i + 1))
        const pages   = await newPdf.copyPages(srcPdf, indices)
        pages.forEach((p: import('pdf-lib').PDFPage) => newPdf.addPage(p))
        const bytes = await newPdf.save()

        const safeName = file.name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 80)
        const partName = `${safeName}_p${doc.start}${doc.start !== doc.end ? `-${doc.end}` : ''}.pdf`

        formData.append('files', new File([new Uint8Array(bytes)], partName, { type: 'application/pdf' }))
        metaArray.push({ type: q.type, year: q.year, month: q.month, note: q.note, originalName: partName })
      }

      formData.append('meta', JSON.stringify(metaArray))

      const res = await fetch('/api/customer/documents/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Erreur lors de l\'envoi.')
      }
      setDone(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inattendue.')
    } finally {
      setSubmitting(false)
    }
  }, [allDocs, files, quals, customerId, firmSlug, accessToken])

  if (done) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '48px' }}>
        <CheckCircle size={48} color="#059669" strokeWidth={1.5} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>Documents envoyés avec succès</div>
          <div style={{ fontSize: '13px', color: '#64748B' }}>{cabinetName} a été notifié par email.</div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/mes-documents')}
          style={{ marginTop: '8px', padding: '9px 24px', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Retour à mes documents
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Barre navigation + stepper */}
      <div style={{ padding: '0 16px', borderBottom: '1px solid #E2E8F0', flexShrink: 0, display: 'flex', alignItems: 'stretch', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: '90px' }}>
          {step > 1 && (
            <button type="button" onClick={goBack} disabled={submitting} style={btnSecondary}>← Retour</button>
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
            <button type="button" onClick={goNext} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              Suivant →
            </button>
          )}
        </div>
      </div>

      {(footerError || submitError) && (
        <div style={{ padding: '6px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: '#ef4444' }}>{footerError ?? submitError}</span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {step === 1 && (
          <Step1Upload files={files} onFilesLoaded={handleFilesLoaded} onNext={goNext} onSubmitRaw={handleSubmitRaw} submittingRaw={submittingRaw} existingFilenames={existingFilenames} />
        )}
        {step === 2 && (
          <Step2Qualify
            files={files} cuts={cuts} skips={skips} quals={quals}
            curFi={curFi} curDi={curDi} previewP={previewP}
            onCutToggle={handleCutToggle} onSkipToggle={handleSkipToggle}
            onSelectPage={handleSelectPage} onQualChange={handleQualChange}
            onAllDone={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3Confirm
            files={files} cuts={cuts} quals={quals}
            cabinetName={cabinetName} submitting={submitting} submitError={submitError}
            onEdit={handleEdit} onSubmit={handleSubmit}
          />
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

const btnBase: React.CSSProperties = {
  padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
  cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center',
  gap: '6px', fontFamily: 'inherit', lineHeight: 1.4, transition: 'all 0.12s',
}
const btnPrimary:   React.CSSProperties = { ...btnBase, background: '#1D4ED8', color: '#fff' }
const btnSecondary: React.CSSProperties = { ...btnBase, background: '#fff', color: '#374151', border: '1px solid #d1d5db' }
