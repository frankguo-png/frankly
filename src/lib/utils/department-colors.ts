/**
 * Centralized department color system used across the dashboard.
 * Import from here instead of hardcoding colors per component.
 */

export interface DeptColorSet {
  /** Tailwind gradient classes for avatar backgrounds */
  gradient: string
  /** Tailwind class for dot indicator */
  dot: string
  /** Hex accent color for charts, text highlights */
  accent: string
  /** RGBA background for cards/badges */
  bg: string
  /** Simple hex color for bar charts */
  hex: string
}

export const DEPARTMENT_COLORS: Record<string, DeptColorSet> = {
  Engineering: {
    gradient: 'from-indigo-500 to-indigo-700',
    dot: 'bg-indigo-400',
    accent: '#818cf8',
    bg: 'rgba(99,102,241,0.12)',
    hex: '#3b82f6',
  },
  Product: {
    gradient: 'from-cyan-400 to-cyan-600',
    dot: 'bg-cyan-400',
    accent: '#22d3ee',
    bg: 'rgba(34,211,238,0.12)',
    hex: '#8b5cf6',
  },
  Sales: {
    gradient: 'from-emerald-400 to-emerald-600',
    dot: 'bg-emerald-400',
    accent: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    hex: '#22c55e',
  },
  Marketing: {
    gradient: 'from-pink-400 to-pink-600',
    dot: 'bg-pink-400',
    accent: '#f472b6',
    bg: 'rgba(244,114,182,0.12)',
    hex: '#f59e0b',
  },
  Operations: {
    gradient: 'from-amber-400 to-amber-600',
    dot: 'bg-amber-400',
    accent: '#fbbf24',
    bg: 'rgba(251,191,36,0.12)',
    hex: '#6366f1',
  },
  Executive: {
    gradient: 'from-blue-400 to-blue-600',
    dot: 'bg-blue-400',
    accent: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
    hex: '#60a5fa',
  },
  Admin: {
    gradient: 'from-rose-400 to-rose-600',
    dot: 'bg-rose-400',
    accent: '#ec4899',
    bg: 'rgba(236,72,153,0.12)',
    hex: '#ec4899',
  },
}

export const DEFAULT_DEPT_COLOR: DeptColorSet = {
  gradient: 'from-slate-400 to-slate-600',
  dot: 'bg-slate-400',
  accent: '#94a3b8',
  bg: 'rgba(148,163,184,0.12)',
  hex: '#64748b',
}

export function getDeptColor(department: string | null): DeptColorSet {
  if (!department) return DEFAULT_DEPT_COLOR
  return DEPARTMENT_COLORS[department] ?? DEFAULT_DEPT_COLOR
}

/** Simple hex color lookup (for charts like payroll) */
export function getDeptHex(department: string): string {
  return DEPARTMENT_COLORS[department]?.hex ?? DEFAULT_DEPT_COLOR.hex
}

/** Ordered accent palette for indexed usage */
export const DEPT_ACCENT_ORDER = [
  '#818cf8', '#22d3ee', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#fb923c',
]
