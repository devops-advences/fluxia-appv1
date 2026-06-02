'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideProps } from 'lucide-react'
import {
  MessageSquare, Upload, FolderOutput, FileCheck, FileX,
  AlertTriangle, UserPlus, Briefcase, UserCheck,
  CreditCard, Flag, CheckCheck, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

type Payload = Record<string, string | number | null>
type LucideIcon = React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>>

type InboxItem = {
  id:          string
  event_type:  string
  customer_id: string | null
  document_id: string | null
  payload:     Payload
  event_at:    string
  read:        boolean
  flagged:     boolean
}

type Filter = 'all' | 'message' | 'document' | 'task' | 'activity'

type EventMeta = {
  icon:      LucideIcon
  color:     string
  typeLabel: string
  label:     (p: Payload) => string
  preview:   (p: Payload) => string | null
  filter:    Filter
}

function getIcon(eventType: string, payload: Payload): LucideIcon {
  if (eventType === 'document_status') return payload.new_status === 'processed' ? FileCheck : FileX
  const map: Record<string, LucideIcon> = {
    message:            MessageSquare,
    document_uploaded:  Upload,
    livrable_uploaded:  FolderOutput,
    task_late:          AlertTriangle,
    customer_created:   UserPlus,
    service_added:      Briefcase,
    employee_added:     UserCheck,
    account_added:      CreditCard,
  }
  return map[eventType] ?? MessageSquare
}

const EVENT_META: Record<string, Omit<EventMeta, 'icon'>> = {
  message:           { color: '#1D4ED8', typeLabel: 'Message',             label: p => String(p.customer_name),               preview: p => p.body_preview ? String(p.body_preview) : null,          filter: 'message'  },
  document_uploaded: { color: '#059669', typeLabel: 'Document déposé',     label: p => `${p.customer_name} — ${p.filename}`,  preview: p => p.doc_type ? String(p.doc_type) : null,                  filter: 'document' },
  livrable_uploaded: { color: '#7C3AED', typeLabel: 'Livrable déposé',     label: p => `${p.customer_name} — ${p.filename}`,  preview: p => p.doc_type ? String(p.doc_type) : null,                  filter: 'document' },
  document_status:   { color: '#D97706', typeLabel: 'Statut document',     label: p => `${p.customer_name} — ${p.filename}`,  preview: p => p.new_status === 'processed' ? 'Traité' : 'Rejeté',     filter: 'document' },
  task_late:         { color: '#DC2626', typeLabel: 'Tâche en retard',     label: p => `${p.customer_name} — ${p.task_name}`, preview: p => `${p.month}/${p.year}`,                                  filter: 'task'     },
  customer_created:  { color: '#1D4ED8', typeLabel: 'Client créé',         label: p => String(p.customer_name),               preview: () => null,                                                   filter: 'activity' },
  service_added:     { color: '#64748B', typeLabel: 'Service créé',        label: p => `${p.customer_name} — ${p.service_name}`,  preview: () => null,                                               filter: 'activity' },
  employee_added:    { color: '#64748B', typeLabel: 'Salarié créé',        label: p => `${p.customer_name} — ${p.employee_name}`, preview: () => null,                                               filter: 'activity' },
  account_added:     { color: '#64748B', typeLabel: 'Compte bancaire créé', label: p => `${p.customer_name} — ${p.bank_name}`,   preview: () => null,                                               filter: 'activity' },
}

const TYPE_COLORS: Record<string, string> = {
  message:            '#1D4ED8',
  document_uploaded:  '#059669',
  livrable_uploaded:  '#7C3AED',
  document_status:    '#D97706',
  task_late:          '#DC2626',
  customer_created:   '#1D4ED8',
  service_added:      '#64748B',
  employee_added:     '#64748B',
  account_added:      '#64748B',
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'Tous' },
  { key: 'message',  label: 'Messages' },
  { key: 'document', label: 'Documents' },
  { key: 'task',     label: 'Tâches' },
  { key: 'activity', label: 'Activité' },
]

function fmtDate(iso: string): string {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = now.getTime() - d.getTime()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay)               return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (diff < 7 * 86400_000) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function InboxPage() {
  const router = useRouter()
  const [items, setItems]       = useState<InboxItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<Filter>('all')
  const [flagOnly, setFlagOnly] = useState(false)
  const [userId, setUserId]     = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const uid = session.user.id
    setUserId(uid)

    const [{ data: events }, { data: userStates }] = await Promise.all([
      supabase.from('firm_inbox').select('id, event_type, customer_id, document_id, payload, event_at')
        .order('event_at', { ascending: false }).limit(200),
      supabase.from('user_inbox').select('inbox_event_id, read_at, flagged, deleted_at').eq('user_id', uid),
    ])

    const stateMap = new Map((userStates ?? []).map(s => [s.inbox_event_id, s]))
    const mapped: InboxItem[] = (events ?? [])
      .filter(e => !stateMap.get(e.id)?.deleted_at)
      .map(e => {
        const s = stateMap.get(e.id)
        return { ...e, read: !!s?.read_at, flagged: !!s?.flagged }
      })
    setItems(mapped)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  function navigate(item: InboxItem) {
    switch (item.event_type) {
      case 'document_uploaded':
      case 'document_status':
      case 'livrable_uploaded':
        router.push('/documents')
        break
      case 'message':
        router.push('/documents')
        break
      case 'task_late':
        router.push('/taches')
        break
      case 'customer_created':
        if (item.customer_id) router.push(`/clients/${item.customer_id}`)
        break
      case 'service_added':
        if (item.customer_id) router.push(`/clients/${item.customer_id}?tab=services`)
        break
      case 'employee_added':
        if (item.customer_id) router.push(`/clients/${item.customer_id}?tab=salaries`)
        break
      case 'account_added':
        if (item.customer_id) router.push(`/clients/${item.customer_id}?tab=comptes`)
        break
    }
  }

  async function markAsRead(item: InboxItem) {
    if (item.read || !userId) return
    await supabase.from('user_inbox').upsert(
      { inbox_event_id: item.id, user_id: userId, read_at: new Date().toISOString() },
      { onConflict: 'inbox_event_id,user_id' }
    )
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, read: true } : i))
  }

  async function toggleUnread(item: InboxItem) {
    if (!userId) return
    await supabase.from('user_inbox').upsert(
      { inbox_event_id: item.id, user_id: userId, read_at: null },
      { onConflict: 'inbox_event_id,user_id' }
    )
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, read: false } : i))
  }

  async function markAllAsRead() {
    if (!userId) return
    const now    = new Date().toISOString()
    const unread = items.filter(i => !i.read)
    if (unread.length === 0) return
    await supabase.from('user_inbox').upsert(
      unread.map(i => ({ inbox_event_id: i.id, user_id: userId, read_at: now })),
      { onConflict: 'inbox_event_id,user_id' }
    )
    setItems(prev => prev.map(i => ({ ...i, read: true })))
  }

  async function toggleFlag(e: React.MouseEvent, item: InboxItem) {
    e.stopPropagation()
    if (!userId) return
    await supabase.from('user_inbox').upsert(
      { inbox_event_id: item.id, user_id: userId, flagged: !item.flagged },
      { onConflict: 'inbox_event_id,user_id' }
    )
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, flagged: !i.flagged } : i))
  }

  async function deleteItem(e: React.MouseEvent, item: InboxItem) {
    e.stopPropagation()
    if (!userId) return
    await supabase.from('user_inbox').upsert(
      { inbox_event_id: item.id, user_id: userId, deleted_at: new Date().toISOString() },
      { onConflict: 'inbox_event_id,user_id' }
    )
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  const unreadCount = items.filter(i => !i.read).length

  const filtered = items.filter(i => {
    const meta = EVENT_META[i.event_type]
    if (!meta) return false
    if (filter !== 'all' && meta.filter !== filter) return false
    if (flagOnly && !i.flagged) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[#0F172A]">Inbox</h1>
          {unreadCount > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">
              {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors">
              <CheckCheck size={13} />
              Tout marquer lu
            </button>
          )}
          <button onClick={() => setFlagOnly(f => !f)}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            flagOnly ? 'border-[#FCD34D] bg-[#FFFBEB] text-[#D97706]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
          }`}>
          <Flag size={13} fill={flagOnly ? '#D97706' : 'none'} strokeWidth={flagOnly ? 0 : 1.75} />
          Flagués
        </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex border-b border-[#E2E8F0] mb-0">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === f.key ? 'border-[#1D4ED8] text-[#1D4ED8]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}>
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                {items.filter(i => EVENT_META[i.event_type]?.filter === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-b-xl px-5 py-16 text-center border-t-0">
          <CheckCheck size={24} className="text-[#CBD5E1] mx-auto mb-3" />
          <p className="text-sm text-[#94A3B8]">Aucun élément{flagOnly ? ' flagué' : ''}</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-b-xl overflow-hidden border-t-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="w-6" />
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider w-24">Date</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider w-48">Type</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider max-w-xs">Libellé</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider w-20">CTA</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const meta  = EVENT_META[item.event_type]
                if (!meta) return null
                const Icon  = getIcon(item.event_type, item.payload)
                const color = item.event_type === 'document_status'
                  ? (item.payload.new_status === 'processed' ? '#059669' : '#DC2626')
                  : (TYPE_COLORS[item.event_type] ?? '#64748B')
                const preview = meta.preview(item.payload)

                return (
                  <tr key={item.id}
                    className={`transition-colors ${i < filtered.length - 1 ? 'border-b border-[#F1F5F9]' : ''} ${item.customer_id ? 'cursor-pointer hover:bg-[#F8FAFC]' : ''} ${!item.read ? 'bg-[#F8FAFC]' : ''}`}
                    onClick={() => { markAsRead(item); navigate(item) }}>

                    {/* Dot lu/non-lu cliquable */}
                    <td className="pl-3 w-6" onClick={e => { e.stopPropagation(); item.read ? toggleUnread(item) : markAsRead(item) }}>
                      <div className="cursor-pointer p-0.5 rounded hover:bg-[#EFF6FF] transition-colors inline-flex">
                        {!item.read
                          ? <span className="block w-2 h-2 rounded-full bg-[#1D4ED8]" title="Marquer comme lu" />
                          : item.flagged
                            ? <Flag size={11} fill="#D97706" color="#D97706" strokeWidth={0} />
                            : <span className="block w-2 h-2 rounded-full bg-transparent border border-[#CBD5E1]" title="Marquer comme non lu" />
                        }
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-2 w-24">
                      <span className={`text-xs tabular-nums ${item.read ? 'text-[#94A3B8]' : 'text-[#64748B] font-semibold'}`}>
                        {fmtDate(item.event_at)}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-2 w-48">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                          style={{ backgroundColor: color + '18' }}>
                          <Icon size={11} color={color} />
                        </div>
                        <span className={`text-xs whitespace-nowrap ${item.read ? 'text-[#94A3B8]' : 'text-[#64748B] font-semibold'}`}>
                          {meta.typeLabel}
                        </span>
                      </div>
                    </td>

                    {/* Libellé */}
                    <td className="px-4 py-2 max-w-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`text-sm truncate ${item.read ? 'text-[#64748B]' : 'text-[#0F172A] font-bold'}`}>
                          {meta.label(item.payload)}
                        </span>
                        {preview && (
                          <span className="text-xs text-[#94A3B8] truncate shrink-0">— {preview}</span>
                        )}
                      </div>
                    </td>

                    {/* CTA */}
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={e => toggleFlag(e, item)}
                          title={item.flagged ? 'Retirer le flag' : 'Flaguer'}
                          className="p-1 rounded transition-colors hover:bg-[#FFFBEB]">
                          <Flag size={13} strokeWidth={item.flagged ? 0 : 1.75}
                            fill={item.flagged ? '#D97706' : 'none'}
                            color={item.flagged ? '#D97706' : '#CBD5E1'} />
                        </button>
                        <button onClick={e => deleteItem(e, item)}
                          title="Supprimer"
                          className="p-1 rounded transition-colors text-[#CBD5E1] hover:text-[#DC2626] hover:bg-[#FEF2F2]">
                          <Trash2 size={13} strokeWidth={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
