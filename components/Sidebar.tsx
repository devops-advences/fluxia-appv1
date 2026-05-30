'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  FolderOutput,
  Users,
  Building2,
  LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const COUNTRY_FLAGS: Record<string, string> = {
  FR: '🇫🇷',
  TN: '🇹🇳',
  MA: '🇲🇦',
}

const NAV = [
  {
    section: 'GESTION',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Tâches récurrentes', href: '/taches', icon: CheckSquare },
    ],
  },
  {
    section: 'DOCUMENTS',
    items: [
      { label: 'Documents clients', href: '/documents', icon: FileText },
      { label: 'Livrables cabinet', href: '/livrables', icon: FolderOutput },
    ],
  },
  {
    section: 'ADMINISTRATION',
    items: [
      { label: 'Clients', href: '/clients', icon: Users },
      { label: 'Mon cabinet', href: '/mon-cabinet', icon: Building2 },
    ],
  },
]

type Props = {
  firmName: string
  countryCode: string
  userName: string
  logoUrl?: string | null
}

export default function Sidebar({ firmName, countryCode, userName, logoUrl }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 h-screen flex flex-col bg-white border-r border-[#E2E8F0] fixed left-0 top-0">
      {/* Firm identity */}
      <div className="px-4 py-3 border-b border-[#E2E8F0] flex flex-col items-center gap-1.5">
        {logoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logoUrl} alt={firmName} className="max-h-8 max-w-[160px] object-contain" />
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-[#0F172A] truncate">{firmName}</span>
          <span className="text-sm">{COUNTRY_FLAGS[countryCode] ?? ''}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider px-2 mb-1">
              {section}
            </p>
            <ul className="space-y-0.5">
              {items.map(({ label, href, icon: Icon }) => {
                const active = pathname === href
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-[#EFF6FF] text-[#1D4ED8] font-medium'
                          : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                      }`}
                    >
                      <Icon size={15} strokeWidth={1.8} />
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-3 border-t border-[#E2E8F0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-[#64748B] truncate">{userName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#94A3B8] hover:text-[#DC2626] transition-colors"
            title="Se déconnecter"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
