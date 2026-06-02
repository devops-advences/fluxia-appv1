'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Check, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useCustomer } from '@/lib/CustomerContext'
import StatusModal from './_components/StatusModal'

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

const STATUS_CFG = {
  pending:   { bg: '#fff',    border: '#E2E8F0', dot: '#CBD5E1', icon: null },
  late:      { bg: '#FEF2F2', border: '#FCA5A5', dot: '#DC2626', icon: null },
  done:      { bg: '#F0FDF4', border: '#86EFAC', dot: '#16A34A', icon: 'check' as const },
  done_late: { bg: '#F0FDF4', border: '#86EFAC', dot: '#16A34A', icon: 'clock' as const },
}

type Task      = { id: string; name: string; customer_task: boolean; due_months: number[]; country_code: string | null }
type StatusRow = { recurring_task_id: string; customer_id: string; year: number; month: number; status: string; comment: string | null }
type ModalCtx  = { task: Task; month: number }

function isFuture(year: number, month: number): boolean {
  const now = new Date()
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)
}

export default function MesTachesPage() {
  const { activeCustomer } = useCustomer()
  const [firmId, setFirmId]           = useState<string | null>(null)
  const [userId, setUserId]           = useState<string | null>(null)
  const [tasks, setTasks]             = useState<Task[]>([])
  const [statuses, setStatuses]       = useState<StatusRow[]>([])
  const [year, setYear]               = useState(new Date().getFullYear())
  const [loading, setLoading]         = useState(true)
  const [loadingYear, setLoadingYear] = useState(false)
  const [modal, setModal]             = useState<ModalCtx | null>(null)
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    if (!activeCustomer) return
    const customer = activeCustomer
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)

      const { data: ud } = await supabase
        .from('user_data').select('firm_id').eq('id', session.user.id).single()
      if (!ud?.firm_id) { setLoading(false); return }
      setFirmId(ud.firm_id)

      const currentYear = new Date().getFullYear()
      const [{ data: taskData }, { data: statusData }] = await Promise.all([
        supabase.from('recurring_task').select('id, name, customer_task, due_months, country_code').eq('active', true).order('rank'),
        supabase.from('recurring_task_status')
          .select('recurring_task_id, customer_id, year, month, status, comment')
          .eq('firm_id', ud.firm_id)
          .eq('customer_id', activeCustomer.id)
          .eq('year', currentYear),
      ])

      const filtered = ((taskData ?? []) as Task[]).filter(t =>
        !t.country_code || t.country_code === customer.country_code
      )
      setTasks(filtered)
      if (statusData) setStatuses(statusData as StatusRow[])
      setLoading(false)
    }
    load()
  }, [activeCustomer])

  async function changeYear(delta: number) {
    if (!firmId || !customer.id) return
    const newYear = year + delta
    setYear(newYear)
    setLoadingYear(true)
    const { data } = await supabase
      .from('recurring_task_status')
      .select('recurring_task_id, customer_id, year, month, status, comment')
      .eq('firm_id', firmId)
      .eq('customer_id', customer.id)
      .eq('year', newYear)
    if (data) setStatuses(data as StatusRow[])
    setLoadingYear(false)
  }

  const getStatus = useCallback((taskId: string, month: number) =>
    statuses.find(s => s.recurring_task_id === taskId && s.customer_id === customer.id && s.year === year && s.month === month),
  [statuses, customer.id, year])

  function effectiveStatus(stored: StatusRow | undefined, month: number): keyof typeof STATUS_CFG {
    const s = stored?.status
    if (!s || s === 'pending') {
      const now  = new Date()
      const past = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)
      return past ? 'late' : 'pending'
    }
    return s as keyof typeof STATUS_CFG
  }

  async function handleSave(status: string, comment: string) {
    if (!modal || !firmId || !customer.id || !userId) return
    setSaving(true)
    const { error } = await supabase.from('recurring_task_status').upsert({
      recurring_task_id: modal.task.id,
      firm_id:           firmId,
      customer_id:       customer.id,
      year,
      month:             modal.month,
      status,
      comment:           comment || null,
      updated_by:        userId,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'recurring_task_id,firm_id,customer_id,year,month' })

    if (!error) {
      setStatuses(prev => [
        ...prev.filter(s => !(s.recurring_task_id === modal.task.id && s.year === year && s.month === modal.month)),
        { recurring_task_id: modal.task.id, customer_id: customer.id, year, month: modal.month, status, comment: comment || null },
      ])
      setModal(null)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const cabTasks    = tasks.filter(t => !t.customer_task)
  const clientTasks = tasks.filter(t =>  t.customer_task)

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Mes tâches</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Suivi des obligations comptables de votre dossier.</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => changeYear(-1)} disabled={loadingYear}
            className="w-7 h-7 flex items-center justify-center border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold text-[#0F172A] min-w-[44px] text-center">{year}</span>
          <button onClick={() => changeYear(1)} disabled={loadingYear}
            className="w-7 h-7 flex items-center justify-center border border-[#E2E8F0] rounded-lg bg-white text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-5 flex-wrap">
        {([['pending','À faire'],['done','Fait'],['done_late','Fait (retard)'],['late','En retard']] as const).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
            {STATUS_CFG[k].icon === 'check' ? <Check size={10} strokeWidth={2.5} color={STATUS_CFG[k].dot} /> :
             STATUS_CFG[k].icon === 'clock' ? <Clock size={10} strokeWidth={2.5} color={STATUS_CFG[k].dot} /> :
             <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_CFG[k].dot }} />}
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#F1F5F9]" />
          Non concerné
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-16 text-center text-sm text-[#94A3B8]">
          Aucune tâche configurée pour votre dossier.
        </div>
      ) : loadingYear ? (
        <p className="text-sm text-[#94A3B8]">Chargement…</p>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '200px' }} />
                {MONTHS.map((_, i) => <col key={i} style={{ width: '52px' }} />)}
              </colgroup>
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider" />
                  {MONTHS.map(m => (
                    <th key={m} className="py-3 text-center text-[10px] font-medium text-[#94A3B8]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cabTasks.length > 0 && (
                  <ReadGroup label="Tâches cabinet" tasks={cabTasks} getStatus={getStatus} effectiveStatus={effectiveStatus} />
                )}
                {clientTasks.length > 0 && (
                  <EditGroup label="Mes documents" tasks={clientTasks} year={year}
                    getStatus={getStatus} effectiveStatus={effectiveStatus}
                    onCellClick={(t, m) => setModal({ task: t, month: m })} />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && customer.id && (
        <StatusModal
          taskName={modal.task.name}
          customerName=""
          month={modal.month}
          year={year}
          current={getStatus(modal.task.id, modal.month)}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function ReadGroup({ label, tasks, getStatus, effectiveStatus }: {
  label: string
  tasks: Task[]
  getStatus: (taskId: string, month: number) => StatusRow | undefined
  effectiveStatus: (stored: StatusRow | undefined, month: number) => keyof typeof STATUS_CFG
}) {
  return (
    <>
      <tr>
        <td colSpan={13} className="px-4 pt-4 pb-1.5 text-xs font-bold text-[#0F172A] tracking-wide">{label}</td>
      </tr>
      {tasks.map(task => (
        <tr key={task.id} className="border-b border-[#F1F5F9] last:border-0">
          <td className="px-4 py-1 text-xs text-[#0F172A] truncate">{task.name}</td>
          {MONTHS.map((_, i) => {
            const month = i + 1
            if (!task.due_months.includes(month)) {
              return <td key={month} className="p-0.5"><div className="h-7 rounded bg-[#F1F5F9]" /></td>
            }
            const stored = getStatus(task.id, month)
            const eff    = effectiveStatus(stored, month)
            const cfg    = STATUS_CFG[eff]
            return (
              <td key={month} className="p-0.5">
                <div title={stored?.comment ?? undefined}
                  className="h-7 rounded flex items-center justify-center"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  {cfg.icon === 'check' ? <Check size={12} strokeWidth={2.5} color={cfg.dot} /> :
                   cfg.icon === 'clock' ? <Clock size={12} strokeWidth={2.5} color={cfg.dot} /> :
                   <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />}
                </div>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

function EditGroup({ label, tasks, year, getStatus, effectiveStatus, onCellClick }: {
  label: string
  tasks: Task[]
  year: number
  getStatus: (taskId: string, month: number) => StatusRow | undefined
  effectiveStatus: (stored: StatusRow | undefined, month: number) => keyof typeof STATUS_CFG
  onCellClick: (task: Task, month: number) => void
}) {
  return (
    <>
      <tr>
        <td colSpan={13} className="px-4 pt-4 pb-1.5 text-xs font-bold text-[#0F172A] tracking-wide">{label}</td>
      </tr>
      {tasks.map(task => (
        <tr key={task.id} className="border-b border-[#F1F5F9] last:border-0">
          <td className="px-4 py-1 text-xs text-[#0F172A] truncate">{task.name}</td>
          {MONTHS.map((_, i) => {
            const month  = i + 1
            const future = isFuture(year, month)
            if (!task.due_months.includes(month)) {
              return <td key={month} className="p-0.5"><div className="h-7 rounded bg-[#F1F5F9]" /></td>
            }
            const stored = getStatus(task.id, month)
            const eff    = effectiveStatus(stored, month)
            const cfg    = STATUS_CFG[eff]
            return (
              <td key={month} className="p-0.5">
                <div
                  onClick={future ? undefined : () => onCellClick(task, month)}
                  title={stored?.comment ?? undefined}
                  className={`h-7 rounded flex items-center justify-center transition-opacity ${future ? 'opacity-30 cursor-default' : 'cursor-pointer hover:opacity-75'}`}
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  {cfg.icon === 'check' ? <Check size={12} strokeWidth={2.5} color={cfg.dot} /> :
                   cfg.icon === 'clock' ? <Clock size={12} strokeWidth={2.5} color={cfg.dot} /> :
                   <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />}
                </div>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
