'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

type Props = {
  href?: string
  label?: string
  align?: 'center' | 'end'
}

export default function Header({ href = '/documents/nouveau', label = 'Déposer un document', align = 'end' }: Props) {
  const router = useRouter()

  return (
    <header className={`h-14 bg-white border-b border-[#E2E8F0] flex items-center px-6 ${align === 'center' ? 'justify-center' : 'justify-end'}`}>
      <button
        onClick={() => router.push(href)}
        className="flex items-center gap-2 px-5 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-lg hover:bg-[#1e40af] transition-colors shadow-sm"
      >
        <Plus size={15} /> {label}
      </button>
    </header>
  )
}
