'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useEntityFilter } from '@/hooks/use-entity-filter'
import { ChevronDown, Building2 } from 'lucide-react'

export function EntityFilter() {
  const { entityId, setEntity, entities } = useEntityFilter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Don't render if org has 0 or 1 entities
  if (entities.length <= 1) return null

  const selected = entities.find(e => e.id === entityId)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium tracking-wide transition-all duration-200',
          entityId
            ? 'bg-blue-600/90 text-white shadow-[0_0_16px_-3px_rgba(59,130,246,0.5)]'
            : 'text-[#7b8fa3] hover:text-[#9baab8] hover:bg-white/[0.03]',
        )}
      >
        <Building2 className="h-3.5 w-3.5" />
        {selected ? selected.name : 'All Entities'}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0d1a2d]/95 backdrop-blur-xl p-1 shadow-xl">
          <button
            onClick={() => { setEntity(null); setOpen(false) }}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              !entityId
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-[#7b8fa3] hover:text-[#e8edf4] hover:bg-white/[0.04]',
            )}
          >
            All Entities
          </button>

          {entities.map(entity => (
            <button
              key={entity.id}
              onClick={() => { setEntity(entity.id); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                entityId === entity.id
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-[#7b8fa3] hover:text-[#e8edf4] hover:bg-white/[0.04]',
              )}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: entity.color || '#6b7280' }}
              />
              {entity.name}
              {entity.short_code && (
                <span className="ml-auto text-[10px] text-[#566a7f]">{entity.short_code}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
