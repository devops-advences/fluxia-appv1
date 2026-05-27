'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

const MONTHS_LONG = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'À faire',         color: '#64748B', bg: '#F8FAFC' },
  { value: 'done',      label: 'Fait',             color: '#059669', bg: '#F0FDF4' },
  { value: 'done_late', label: 'Fait (en retard)', color: '#059669', bg: '#F0FDF4' },
  { value: 'late',      label: 'En retard',        color: '#DC2626', bg: '#FEF2F2' },
]

type Props = {
  taskName: string
  customerName: string
  month: number
  year: number
  current: { status: string; comment: string | null } | undefined
  saving: boolean
  onSave: (status: string, comment: string) => void
  onClose: () => void
}

export default function StatusModal({ taskName, customerName, month, year, current, saving, onSave, onClose }: Props) {
  const [status, setStatus]   = useState(current?.status ?? 'pending')
  const [comment, setComment] = useState(current?.comment ?? '')

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl w-full max-w-[420px] p-6 shadow-xl">

        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-[#0F172A] mb-0.5">{taskName}</div>
            <div className="text-xs text-[#94A3B8]">{MONTHS_LONG[month - 1]} {year}</div>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {STATUS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setStatus(opt.value)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-left transition-all"
              style={{
                border: status === opt.value ? `2px solid ${opt.color}` : '2px solid #E2E8F0',
                background: status === opt.value ? opt.bg : '#fff',
                color: status === opt.value ? opt.color : '#64748B',
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Commentaire (optionnel)…" rows={3}
          className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg resize-y outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] text-[#0F172A] transition-colors" />

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors">
            Annuler
          </button>
          <button onClick={() => onSave(status, comment)} disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-[#1D4ED8] text-white rounded-lg hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
