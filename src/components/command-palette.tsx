'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  ArrowRightLeft,
  DollarSign,
  PiggyBank,
  Cpu,
  Settings,
  RefreshCw,
  Download,
  PlusCircle,
  Landmark,
  Search,
  Clock,
  Filter,
  CreditCard,
  Handshake,
  CalendarDays,
  FileText,
} from 'lucide-react'

// ---- types ----------------------------------------------------------------

type CommandCategory = 'Navigation' | 'Actions' | 'Quick Filters'

interface Command {
  id: string
  label: string
  category: CommandCategory
  icon: React.ReactNode
  /** executed when the command is selected */
  action: () => void
  /** additional keywords for matching */
  keywords?: string[]
}

// ---- helpers ---------------------------------------------------------------

/** Highlight matching substring spans inside `text` for a given `query`. */
function highlightMatch(text: string, query: string) {
  if (!query) return <>{text}</>
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-blue-400">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

// ---- component -------------------------------------------------------------

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // ------ command definitions ------------------------------------------------

  const allCommands = useMemo<Command[]>(() => {
    const nav = (label: string, href: string, icon: React.ReactNode, keywords?: string[]): Command => ({
      id: `nav-${href}`,
      label,
      category: 'Navigation',
      icon,
      action: () => router.push(href),
      keywords,
    })

    const act = (id: string, label: string, icon: React.ReactNode, action: () => void, keywords?: string[]): Command => ({
      id: `action-${id}`,
      label,
      category: 'Actions',
      icon,
      action,
      keywords,
    })

    const qf = (id: string, label: string, href: string, keywords?: string[]): Command => ({
      id: `qf-${id}`,
      label,
      category: 'Quick Filters',
      icon: <Filter size={16} />,
      action: () => router.push(href),
      keywords,
    })

    return [
      // Navigation
      nav('Dashboard', '/dashboard', <LayoutDashboard size={16} />),
      nav('Transactions', '/dashboard/transactions', <ArrowRightLeft size={16} />),
      nav('Daily View', '/dashboard/daily', <CalendarDays size={16} />, ['activity', 'daily']),
      nav('Budgets', '/dashboard/budgets', <PiggyBank size={16} />),
      nav('Payments', '/dashboard/payments', <CreditCard size={16} />, ['pay', 'bills']),
      nav('Deals', '/dashboard/deals', <Handshake size={16} />, ['deals', 'contracts']),
      nav('Payroll', '/dashboard/payroll', <DollarSign size={16} />),
      nav('Agents', '/dashboard/agents', <Cpu size={16} />),
      nav('Chat', '/dashboard/chat', <MessageSquare size={16} />),
      nav('Reports', '/dashboard/report', <FileText size={16} />, ['report', 'board', 'financial summary']),
      nav('Settings', '/dashboard/settings', <Settings size={16} />),

      // Actions
      act('sync', 'Sync all accounts', <RefreshCw size={16} />, async () => {
        router.push('/dashboard')
        try {
          await fetch('/api/sync', { method: 'POST' })
        } catch {}
      }, ['refresh', 'sync']),
      act('export', 'Export transactions', <Download size={16} />, () => {
        router.push('/dashboard/transactions?export=true')
      }, ['download', 'csv']),
      act('add-budget', 'Add budget', <PlusCircle size={16} />, () => {
        router.push('/dashboard/budgets')
      }, ['create', 'new', 'budget']),
      act('connect-bank', 'Connect bank account', <Landmark size={16} />, () => {
        router.push('/dashboard/settings')
      }, ['bank', 'plaid', 'link']),
      act('add-payment', 'Add payment', <CreditCard size={16} />, () => {
        router.push('/dashboard/payments?add=true')
      }, ['create', 'new', 'payment', 'bill', 'pay']),
      act('add-deal', 'Add deal', <Handshake size={16} />, () => {
        router.push('/dashboard/deals?add=true')
      }, ['create', 'new', 'deal', 'pipeline', 'contract']),
      act('generate-report', 'Generate board report', <FileText size={16} />, () => {
        router.push('/dashboard/report')
      }, ['report', 'board', 'pdf', 'print', 'financial summary']),

      // Quick filters
      qf('txn-engineering', 'Transactions: Engineering', '/dashboard/transactions?department=Engineering', ['transactions', 'engineering']),
      qf('txn-payroll', 'Transactions: Payroll', '/dashboard/transactions?category=Payroll', ['transactions', 'payroll']),
    ]
  }, [router])

  // ------ filtering ----------------------------------------------------------

  const filtered = useMemo(() => {
    if (!query) return allCommands
    const q = query.toLowerCase()
    return allCommands.filter((cmd) => {
      if (cmd.label.toLowerCase().includes(q)) return true
      if (cmd.keywords?.some((kw) => kw.toLowerCase().includes(q))) return true
      return false
    })
  }, [query, allCommands])

  // Build display list: recent first (if no query), then grouped by category
  const displayList = useMemo(() => {
    const recentCommands: Command[] = []
    if (!query && recentIds.length > 0) {
      for (const id of recentIds) {
        const cmd = allCommands.find((c) => c.id === id)
        if (cmd) recentCommands.push(cmd)
      }
    }

    // Group filtered commands by category
    const grouped: { category: string; items: Command[] }[] = []

    if (recentCommands.length > 0) {
      grouped.push({ category: 'Recent', items: recentCommands })
    }

    const categoryOrder: CommandCategory[] = ['Navigation', 'Actions', 'Quick Filters']
    for (const cat of categoryOrder) {
      const items = filtered.filter((c) => c.category === cat)
      if (items.length > 0) {
        grouped.push({ category: cat, items })
      }
    }

    return grouped
  }, [filtered, query, recentIds, allCommands])

  // Flat list for keyboard navigation
  const flatList = useMemo(() => displayList.flatMap((g) => g.items), [displayList])

  // ------ open / close -------------------------------------------------------

  const openPalette = useCallback(() => {
    setOpen(true)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  // ------ execute command ----------------------------------------------------

  const executeCommand = useCallback(
    (cmd: Command) => {
      // Track recent (max 3, no duplicates)
      setRecentIds((prev) => {
        const next = [cmd.id, ...prev.filter((id) => id !== cmd.id)].slice(0, 3)
        return next
      })
      closePalette()
      cmd.action()
    },
    [closePalette],
  )

  // ------ global keyboard shortcut -------------------------------------------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) {
          closePalette()
        } else {
          openPalette()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, openPalette, closePalette])

  // ------ auto-focus input ---------------------------------------------------

  useEffect(() => {
    if (open) {
      // Small delay so the modal is rendered before we focus
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // ------ keep selected index in bounds --------------------------------------

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // ------ scroll active item into view ---------------------------------------

  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.querySelector('[data-active="true"]')
    if (active) {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // ------ keyboard navigation inside palette ---------------------------------

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatList[selectedIndex]) {
        executeCommand(flatList[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closePalette()
    }
  }

  // ------ render -------------------------------------------------------------

  if (!open) return null

  let runningIndex = -1

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closePalette}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[560px] mx-4 bg-[#111d2e] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[400px]">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <Search size={16} className="shrink-0 text-[#5a6d82]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#5a6d82] outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[10px] font-medium text-[#7b8fa3]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {flatList.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[#5a6d82]">
              No results found.
            </div>
          )}

          {displayList.map((group) => (
            <div key={group.category}>
              {/* Section header */}
              <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#7b8fa3]">
                {group.category === 'Recent' && <Clock size={10} className="inline mr-1 -mt-px" />}
                {group.category}
              </div>

              {group.items.map((cmd) => {
                runningIndex++
                const idx = runningIndex
                const isActive = idx === selectedIndex

                return (
                  <button
                    key={`${group.category}-${cmd.id}`}
                    data-active={isActive}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors duration-75 text-left ${
                      isActive
                        ? 'bg-white/[0.06] text-white'
                        : 'text-[#9baab8] hover:bg-white/[0.04] hover:text-white'
                    }`}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className={isActive ? 'text-blue-400' : 'text-[#5a6d82]'}>
                      {cmd.icon}
                    </span>
                    <span className="flex-1 truncate">
                      {highlightMatch(cmd.label, query)}
                    </span>
                    {isActive && (
                      <kbd className="text-[10px] text-[#7b8fa3]">
                        ↵
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-[rgba(255,255,255,0.06)] px-4 py-2 text-[10px] text-[#7b8fa3]">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-[rgba(255,255,255,0.06)] px-1 py-0.5">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-[rgba(255,255,255,0.06)] px-1 py-0.5">↵</kbd> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-[rgba(255,255,255,0.06)] px-1 py-0.5">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
