'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

type Option = { id: string; name: string }

type Props = {
  options: Option[]
  value: string       // selected id or 'all'
  onChange: (id: string) => void
  placeholder?: string
}

export default function ClientAutosuggest({ options, value, onChange, placeholder = '— Client —' }: Props) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const containerRef        = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.id === value) ?? null

  const filtered = query.trim()
    ? options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const select = (opt: Option | null) => {
    onChange(opt ? opt.id : 'all')
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: '160px' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          border: '1px solid #E2E8F0', borderRadius: '8px',
          padding: '0 8px', height: '34px', background: '#fff',
          cursor: 'text',
        }}
        onClick={() => { setOpen(true); }}
      >
        {selected && !open ? (
          <>
            <span style={{ fontSize: '13px', color: '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.name}
            </span>
            <button
              onClick={e => { e.stopPropagation(); select(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px', display: 'flex', flexShrink: 0 }}
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <input
            autoFocus={open}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={selected ? selected.name : placeholder}
            style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#0F172A', background: 'transparent', flex: 1, minWidth: 0 }}
          />
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 50,
          maxHeight: '220px', overflowY: 'auto',
        }}>
          {value !== 'all' && (
            <button
              onClick={() => select(null)}
              style={{ width: '100%', padding: '7px 12px', textAlign: 'left', fontSize: '12px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
            >
              Tous les clients
            </button>
          )}
          {filtered.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: '12px', color: '#94A3B8' }}>Aucun résultat</div>
          )}
          {filtered.map(opt => (
            <button
              key={opt.id}
              onClick={() => select(opt)}
              style={{
                width: '100%', padding: '7px 12px', textAlign: 'left',
                fontSize: '13px', color: opt.id === value ? '#1D4ED8' : '#0F172A',
                fontWeight: opt.id === value ? 600 : 400,
                background: opt.id === value ? '#EFF6FF' : 'none',
                border: 'none', cursor: 'pointer', display: 'block',
              }}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
