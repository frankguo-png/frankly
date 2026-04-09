'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Printer, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ReportData {
  generatedAt: string
  reportMonth: string
  periodStart: string
  periodEnd: string
  executiveSummary: {
    cashPosition: number
    monthlyBurnRate: number
    runwayMonths: number
    revenue: number
    netCashflow: number
  }
  bankAccounts: { name: string; balance: number; currency: string }[]
  cashFlow: {
    historicalAggregates: { month: string; cashIn: number; cashOut: number; net: number }[]
    categoryBreakdown: { category: string; cashIn: number; cashOut: number; net: number }[]
  }
  pipeline: {
    totalPipeline: number
    weightedPipeline: number
    topDeals: {
      name: string
      company: string | null
      amount: number
      probability: number
      stage: string
      expectedClose: string | null
    }[]
  }
  outstandingPayments: {
    totalPending: number
    overdueCount: number
    topOverdue: {
      vendor: string
      amount: number
      dueDate: string
      priority: string
    }[]
  }
  teamAndPayroll: {
    headcount: number
    monthlyPayroll: number
    payrollPctOfSpend: number
    departmentBreakdown: {
      department: string
      monthlyCost: number
      headcount: number
    }[]
  }
  budgetPerformance: {
    name: string
    budget: number
    actual: number
    variance: number
    variancePct: number
    status: 'under' | 'over' | 'on_track'
  }[]
  recentTransactions: {
    date: string
    description: string
    amount: number
    category: string | null
    department: string | null
  }[]
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function monthLabel(monthStr: string): string {
  const [year, mon] = monthStr.split('-')
  const d = new Date(Number(year), Number(mon) - 1, 1)
  return format(d, 'MMM yyyy')
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    pitched: 'Pitched',
    negotiating: 'Negotiating',
    verbal: 'Verbal',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
  }
  return map[stage] ?? stage
}

function priorityLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1)
}

export default function BoardReportPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/report/generate')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Failed to load report')
        }
        return res.json()
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm text-[#7b8fa3]">Generating board report...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-red-400 text-sm">{error ?? 'Failed to load report'}</p>
          <Link href="/dashboard" className="text-sm text-blue-400 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const es = data.executiveSummary

  return (
    <div className="report-page animate-fade-in">
      {/* Action bar - hidden in print */}
      <div className="print-hide mb-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[#7b8fa3] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* Report content */}
      <div className="report-content space-y-8">
        {/* === HEADER === */}
        <header className="report-section border-b border-[#1e3050] pb-6 print-border-gray">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-[#e8edf4] print-text-black">
                Financial Report
              </h1>
              <h2 className="mt-1 text-lg lg:text-xl font-semibold text-[#7b8fa3] print-text-gray">
                Financial Summary
              </h2>
            </div>
            <div className="text-right text-sm text-[#7b8fa3] print-text-gray">
              <p>Report Period: {monthLabel(data.reportMonth)}</p>
              <p>Generated: {format(new Date(data.generatedAt), 'dd MMM yyyy, HH:mm')}</p>
            </div>
          </div>
        </header>

        {/* === EXECUTIVE SUMMARY === */}
        <section className="report-section">
          <h3 className="report-section-title">Executive Summary</h3>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <SummaryCard
              label="Cash Position"
              value={fmt(es.cashPosition)}
              sublabel="Total bank balance"
            />
            <SummaryCard
              label="Monthly Burn Rate"
              value={fmt(es.monthlyBurnRate)}
              sublabel="Avg last 3 months"
            />
            <SummaryCard
              label="Runway"
              value={`${es.runwayMonths} months`}
              sublabel={es.runwayMonths > 12 ? 'Healthy' : es.runwayMonths > 6 ? 'Monitor' : 'Critical'}
              alert={es.runwayMonths <= 6}
            />
            <SummaryCard
              label="Revenue"
              value={fmt(es.revenue)}
              sublabel="Current month cash in"
            />
          </div>
        </section>

        {/* === KEY TAKEAWAYS === */}
        <section className="report-section">
          <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-[#111d2e] to-[#0d1a2d] p-6 print-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-6 w-1 rounded-full bg-blue-500" />
              <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider print-text-blue">
                Key Takeaways
              </h3>
            </div>
            <ul className="space-y-2.5">
              {(() => {
                const takeaways: string[] = []

                // Revenue MoM change
                const cashFlowHistory = data.cashFlow.historicalAggregates
                if (cashFlowHistory.length >= 2) {
                  const current = cashFlowHistory[cashFlowHistory.length - 1]
                  const previous = cashFlowHistory[cashFlowHistory.length - 2]
                  if (previous.cashIn > 0) {
                    const revChange = ((current.cashIn - previous.cashIn) / previous.cashIn) * 100
                    takeaways.push(
                      revChange >= 0
                        ? `Revenue grew ${revChange.toFixed(1)}% month-over-month`
                        : `Revenue declined ${Math.abs(revChange).toFixed(1)}% month-over-month`
                    )
                  }
                }

                // Runway
                const runwayLabel = es.runwayMonths > 12 ? 'Healthy' : es.runwayMonths > 6 ? 'Monitor' : 'Critical'
                takeaways.push(`Runway is ${es.runwayMonths} months \u2014 ${runwayLabel}`)

                // Overdue payments
                if (data.outstandingPayments.overdueCount > 0) {
                  const overdueTotal = data.outstandingPayments.topOverdue.reduce((sum, p) => sum + p.amount, 0)
                  takeaways.push(
                    `${data.outstandingPayments.overdueCount} overdue payment${data.outstandingPayments.overdueCount !== 1 ? 's' : ''} totaling ${fmt(overdueTotal)} need attention`
                  )
                }

                // Top deal
                if (data.pipeline.topDeals.length > 0) {
                  const top = data.pipeline.topDeals[0]
                  takeaways.push(
                    `Top deal: ${top.name} at ${top.probability}% probability, worth ${fmt(top.amount)}`
                  )
                }

                // Payroll percentage
                if (data.teamAndPayroll.payrollPctOfSpend > 0) {
                  takeaways.push(
                    `Payroll is ${data.teamAndPayroll.payrollPctOfSpend.toFixed(0)}% of total spend`
                  )
                }

                return takeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[#c8d6e5] print-text-black">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))
              })()}
            </ul>
          </div>
        </section>

        {/* === CASH FLOW === */}
        <section className="report-section">
          <h3 className="report-section-title">Cash Flow</h3>

          {/* 3-month trend */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-[#9baab8] mb-3 print-text-gray">
              3-Month Trend
            </h4>
            <div className="overflow-x-auto">
              <table className="report-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Month</th>
                    <th className="text-right">Cash In</th>
                    <th className="text-right">Cash Out</th>
                    <th className="text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cashFlow.historicalAggregates.map((m) => (
                    <tr key={m.month}>
                      <td>{monthLabel(m.month)}</td>
                      <td className="text-right tabular-nums">{fmt(m.cashIn)}</td>
                      <td className="text-right tabular-nums">{fmt(m.cashOut)}</td>
                      <td className={`text-right tabular-nums font-medium ${m.net >= 0 ? 'text-emerald-400 print-text-green' : 'text-red-400 print-text-red'}`}>
                        {fmt(m.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category breakdown */}
          {data.cashFlow.categoryBreakdown.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[#9baab8] mb-3 print-text-gray">
                Current Month by Category
              </h4>
              <div className="overflow-x-auto">
                <table className="report-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Category</th>
                      <th className="text-right">Cash In</th>
                      <th className="text-right">Cash Out</th>
                      <th className="text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cashFlow.categoryBreakdown.slice(0, 10).map((c) => (
                      <tr key={c.category}>
                        <td>{c.category}</td>
                        <td className="text-right tabular-nums">{c.cashIn > 0 ? fmt(c.cashIn) : '-'}</td>
                        <td className="text-right tabular-nums">{c.cashOut > 0 ? fmt(c.cashOut) : '-'}</td>
                        <td className={`text-right tabular-nums font-medium ${c.net >= 0 ? 'text-emerald-400 print-text-green' : 'text-red-400 print-text-red'}`}>
                          {fmt(c.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* === PIPELINE & RECEIVABLES === */}
        <section className="report-section">
          <h3 className="report-section-title">Pipeline & Receivables</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="report-stat-card">
              <span className="text-xs text-[#7b8fa3] print-text-gray">Total Pipeline</span>
              <span className="text-lg font-semibold text-[#e8edf4] print-text-black tabular-nums">{fmt(data.pipeline.totalPipeline)}</span>
            </div>
            <div className="report-stat-card">
              <span className="text-xs text-[#7b8fa3] print-text-gray">Weighted Pipeline</span>
              <span className="text-lg font-semibold text-[#e8edf4] print-text-black tabular-nums">{fmt(data.pipeline.weightedPipeline)}</span>
            </div>
          </div>

          {data.pipeline.topDeals.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-[#9baab8] mb-3 print-text-gray">Top Deals</h4>
              <div className="overflow-x-auto">
                <table className="report-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Deal</th>
                      <th className="text-left">Stage</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Probability</th>
                      <th className="text-left">Expected Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pipeline.topDeals.map((d) => (
                      <tr key={d.name}>
                        <td>
                          <div className="font-medium text-[#e8edf4] print-text-black">{d.name}</div>
                          {d.company && <div className="text-xs text-[#7b8fa3] print-text-gray">{d.company}</div>}
                        </td>
                        <td>
                          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 print-badge">
                            {stageLabel(d.stage)}
                          </span>
                        </td>
                        <td className="text-right tabular-nums">{fmt(d.amount)}</td>
                        <td className="text-right tabular-nums">{d.probability}%</td>
                        <td>{d.expectedClose ? format(new Date(d.expectedClose), 'dd MMM yyyy') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* === OUTSTANDING PAYMENTS === */}
        <section className="report-section">
          <h3 className="report-section-title">Outstanding Payments</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="report-stat-card">
              <span className="text-xs text-[#7b8fa3] print-text-gray">Total Pending</span>
              <span className="text-lg font-semibold text-[#e8edf4] print-text-black tabular-nums">{fmt(data.outstandingPayments.totalPending)}</span>
            </div>
            <div className="report-stat-card">
              <span className="text-xs text-[#7b8fa3] print-text-gray">Overdue Items</span>
              <span className={`text-lg font-semibold tabular-nums ${data.outstandingPayments.overdueCount > 0 ? 'text-red-400 print-text-red' : 'text-emerald-400 print-text-green'}`}>
                {data.outstandingPayments.overdueCount}
              </span>
            </div>
          </div>

          {data.outstandingPayments.topOverdue.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-[#9baab8] mb-3 print-text-gray">Overdue Items</h4>
              <div className="overflow-x-auto">
                <table className="report-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Vendor</th>
                      <th className="text-right">Amount</th>
                      <th className="text-left">Due Date</th>
                      <th className="text-left">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outstandingPayments.topOverdue.map((p, i) => (
                      <tr key={i}>
                        <td className="font-medium text-[#e8edf4] print-text-black">{p.vendor}</td>
                        <td className="text-right tabular-nums text-red-400 print-text-red">{fmt(p.amount)}</td>
                        <td>{format(new Date(p.dueDate), 'dd MMM yyyy')}</td>
                        <td>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium print-badge ${
                            p.priority === 'critical' ? 'bg-red-500/10 text-red-400' :
                            p.priority === 'high' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-blue-500/10 text-blue-400'
                          }`}>
                            {priorityLabel(p.priority)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* === TEAM & PAYROLL === */}
        <section className="report-section">
          <h3 className="report-section-title">Team & Payroll</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="report-stat-card">
              <span className="text-xs text-[#7b8fa3] print-text-gray">Headcount</span>
              <span className="text-lg font-semibold text-[#e8edf4] print-text-black tabular-nums">{data.teamAndPayroll.headcount}</span>
            </div>
            <div className="report-stat-card">
              <span className="text-xs text-[#7b8fa3] print-text-gray">Monthly Payroll</span>
              <span className="text-lg font-semibold text-[#e8edf4] print-text-black tabular-nums">{fmt(data.teamAndPayroll.monthlyPayroll)}</span>
            </div>
            <div className="report-stat-card">
              <span className="text-xs text-[#7b8fa3] print-text-gray">Payroll % of Spend</span>
              <span className="text-lg font-semibold text-[#e8edf4] print-text-black tabular-nums">{data.teamAndPayroll.payrollPctOfSpend.toFixed(1)}%</span>
            </div>
          </div>

          {data.teamAndPayroll.departmentBreakdown.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-[#9baab8] mb-3 print-text-gray">Department Breakdown</h4>
              <div className="overflow-x-auto">
                <table className="report-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Department</th>
                      <th className="text-right">Headcount</th>
                      <th className="text-right">Monthly Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.teamAndPayroll.departmentBreakdown.map((d) => (
                      <tr key={d.department}>
                        <td className="font-medium text-[#e8edf4] print-text-black">{d.department}</td>
                        <td className="text-right tabular-nums">{d.headcount}</td>
                        <td className="text-right tabular-nums">{fmt(d.monthlyCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* === BUDGET PERFORMANCE === */}
        {data.budgetPerformance.length > 0 && (
          <section className="report-section">
            <h3 className="report-section-title">Budget Performance</h3>
            <div className="overflow-x-auto">
              <table className="report-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Category</th>
                    <th className="text-right">Budget</th>
                    <th className="text-right">Actual</th>
                    <th className="text-right">Variance</th>
                    <th className="text-right">Variance %</th>
                    <th className="text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.budgetPerformance.map((b) => (
                    <tr key={b.name}>
                      <td className="font-medium text-[#e8edf4] print-text-black">{b.name}</td>
                      <td className="text-right tabular-nums">{fmt(b.budget)}</td>
                      <td className="text-right tabular-nums">{fmt(b.actual)}</td>
                      <td className={`text-right tabular-nums font-medium ${b.variance > 0 ? 'text-red-400 print-text-red' : 'text-emerald-400 print-text-green'}`}>
                        {fmt(b.variance)}
                      </td>
                      <td className={`text-right tabular-nums ${b.variancePct > 0 ? 'text-red-400 print-text-red' : 'text-emerald-400 print-text-green'}`}>
                        {fmtPct(b.variancePct)}
                      </td>
                      <td>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium print-badge ${
                          b.status === 'over' ? 'bg-red-500/10 text-red-400' :
                          b.status === 'on_track' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {b.status === 'over' ? 'Over Budget' : b.status === 'on_track' ? 'On Track' : 'Under Budget'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* === FOOTER === */}
        <footer className="report-section border-t border-[#1e3050] pt-6 print-border-gray">
          <p className="text-center text-xs text-[#5a6d82] print-text-gray">
            Generated by Frankly, AI CFO &mdash; Confidential
          </p>
        </footer>
      </div>
    </div>
  )
}

// --- Sub-components ---

function SummaryCard({
  label,
  value,
  sublabel,
  alert,
}: {
  label: string
  value: string
  sublabel: string
  alert?: boolean
}) {
  return (
    <div className={`report-card rounded-xl border p-5 ${
      alert
        ? 'border-red-500/30 bg-red-500/5 print-card-alert'
        : 'border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 print-card'
    }`}>
      <p className="text-xs font-medium text-[#7b8fa3] print-text-gray">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#e8edf4] print-text-black tabular-nums">{value}</p>
      <p className={`mt-1 text-xs ${alert ? 'text-red-400 print-text-red font-medium' : 'text-[#5a6d82] print-text-gray'}`}>
        {sublabel}
      </p>
    </div>
  )
}
