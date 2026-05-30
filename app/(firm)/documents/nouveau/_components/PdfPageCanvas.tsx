'use client'

import { useEffect, useRef } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

type Props = {
  pdfProxy: PDFDocumentProxy
  pageNumber: number
  scale?: number
  className?: string
}

export default function PdfPageCanvas({ pdfProxy, pageNumber, scale = 1, className }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const renderTask = useRef<{ cancel: () => void } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function render() {
      const canvas = canvasRef.current
      if (!canvas) return
      const page     = await pdfProxy.getPage(pageNumber)
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      canvas.width   = viewport.width
      canvas.height  = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (renderTask.current) renderTask.current.cancel()
      const task = page.render({ canvas, canvasContext: ctx, viewport })
      renderTask.current = task
      try { await task.promise } catch { /* cancelled */ }
    }

    render()
    return () => { cancelled = true }
  }, [pdfProxy, pageNumber, scale])

  return <canvas ref={canvasRef} className={className} style={{ display: 'block', maxWidth: '100%' }} />
}
