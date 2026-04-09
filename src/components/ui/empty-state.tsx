import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface EmptyStateProps {
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyState({
  icon: Icon,
  iconColor = '#60a5fa',
  iconBg = 'rgba(96,165,250,0.08)',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
      <div
        className="flex items-center justify-center size-12 rounded-xl mb-4"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="size-6" style={{ color: iconColor }} />
      </div>
      <p className="text-sm font-medium text-[#c0cad8] mb-1">{title}</p>
      {description && (
        <p className="text-xs text-[#7b8fa3] max-w-[280px] mb-4">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
