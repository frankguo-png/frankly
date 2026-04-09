'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface KpiData {
  summary?: {
    cashIn: number
    cashOut: number
    netCashflow: number
    netBurn: number
    bankBalance: number
    payrollTotal: number
    payrollPercentOfSpend: number
  }
  timeSeries?: Array<{ date: string; cashIn: number; cashOut: number; net: number }>
  spendByDepartment?: Array<{ name: string; amount: number; color: string; percentage: number }>
  spendByProject?: Array<{ name: string; amount: number; color: string; percentage: number }>
}

function fmt(v: number | undefined | null): string {
  const n = v ?? 0
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function SnapshotTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0d1a2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
      <p style={{ color: '#7b8fa3', fontSize: 11, margin: 0 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: '#e8edf4', fontSize: 12, fontWeight: 600, margin: 0 }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  )
}

export function DashboardSnapshot() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<KpiData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (data) return // already loaded
    setLoading(true)
    try {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const end = now.toISOString().split('T')[0]
      const res = await fetch(`/api/kpi?start=${start}&end=${end}&granularity=day`)
      if (res.ok) {
        const kpi = await res.json()
        setData(kpi)
      }
    } catch (err) {
      console.error('Failed to fetch dashboard snapshot:', err)
    } finally {
      setLoading(false)
    }
  }, [data])

  const handleOpen = () => {
    setIsOpen(true)
    fetchData()
  }

  // Only show on chat page — must be after all hooks
  if (!pathname?.includes('/dashboard/chat')) return null

  return (
    <>
      {/* Dashboard button - fixed top right of chat area */}
      <button
        onClick={handleOpen}
        className="fixed top-16 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
        style={{
          background: '#111d2e',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#e8edf4',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
        Dashboard
      </button>

      {/* Overlay panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end" onClick={() => setIsOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Panel */}
          <div
            className="relative w-full max-w-md h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0a1628',
              animation: 'slideInRight 0.3s ease-out',
            }}
          >
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}} />

            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4" style={{ background: '#0d1525', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#e8edf4' }}>Dashboard Insights</h2>
                <p className="text-xs" style={{ color: '#7b8fa3' }}>Updated just now</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7a8ba3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : data?.summary ? (
              <div className="px-6 py-4 space-y-4">
                {/* Top 3 KPI cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Available Cash', value: data.summary.bankBalance, icon: '$', accent: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                    { label: 'Total In', value: data.summary.cashIn, icon: '\u2193', accent: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                    { label: 'Total Out', value: data.summary.cashOut, icon: '\u2191', accent: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl p-3"
                      style={{ background: '#111d2e', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold mb-2" style={{ background: kpi.bg, color: kpi.accent }}>
                        {kpi.icon}
                      </div>
                      <p className="text-[11px] font-medium" style={{ color: '#7b8fa3' }}>{kpi.label}</p>
                      <p className="text-lg font-bold tracking-tight" style={{ color: '#e8edf4' }}>{fmt(kpi.value)}</p>
                    </div>
                  ))}
                </div>

                {/* Secondary KPIs */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Net Cashflow', value: data.summary.netCashflow, desc: 'Income minus expenses' },
                    { label: 'Payroll', value: data.summary.payrollTotal, desc: 'Total payroll this month' },
                    { label: 'Net Burn', value: data.summary.netBurn, desc: 'Cash out minus cash in' },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl p-3"
                      style={{ background: '#111d2e', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <p className="text-[11px] font-medium mb-1" style={{ color: '#7b8fa3' }}>{kpi.label}</p>
                      <p className="text-lg font-bold tracking-tight" style={{ color: '#e8edf4' }}>{fmt(kpi.value)}</p>
                      <p className="text-[10px] mt-1" style={{ color: '#3d4f63' }}>{kpi.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Cashflow Chart */}
                {data.timeSeries && data.timeSeries.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: '#111d2e', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#e8edf4' }}>Cashflow Chart</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data.timeSeries.slice(-14)} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: '#7b8fa3', fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                        <YAxis tick={{ fill: '#7b8fa3', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                        <Tooltip content={<SnapshotTooltip />} />
                        <Bar dataKey="cashIn" name="Cash In" fill="#10b981" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="cashOut" name="Cash Out" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Spend by Department */}
                {data.spendByDepartment && data.spendByDepartment.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: '#111d2e', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#e8edf4' }}>Spend by Department</h3>
                    <div className="space-y-2.5">
                      {data.spendByDepartment.slice(0, 6).map((cat) => {
                        const maxVal = Math.max(...data.spendByDepartment!.map((c) => c.amount))
                        const pct = maxVal > 0 ? (cat.amount / maxVal) * 100 : 0
                        return (
                          <div key={cat.name} className="flex items-center gap-3">
                            <span className="text-[11px] font-medium w-24 truncate" style={{ color: '#7a8ba3' }}>{cat.name}</span>
                            <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cat.color || '#3b82f6' }} />
                            </div>
                            <span className="text-[11px] font-semibold w-16 text-right" style={{ color: '#e8edf4' }}>{fmt(cat.amount)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-sm" style={{ color: '#5a6d82' }}>
                No data available
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
