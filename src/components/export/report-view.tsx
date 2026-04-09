'use client'

import { useCallback } from 'react'
import { X, Printer } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { ReportData } from './export-button'

interface ReportViewProps {
  data: ReportData
  onClose: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ReportView({ data, onClose }: ReportViewProps) {
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const totalSpend = data.summary.cashOut

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          body > *:not(.report-overlay) {
            display: none !important;
          }
          .report-overlay {
            position: static !important;
            background: white !important;
          }
          .report-overlay .report-toolbar {
            display: none !important;
          }
          .report-overlay .report-content {
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
          }
          .report-overlay .report-page {
            box-shadow: none !important;
            margin: 0 !important;
            max-width: none !important;
          }
          @page {
            margin: 0.75in;
          }
        }
      `}</style>

      <div className="report-overlay fixed inset-0 z-50 bg-gray-100 flex flex-col">
        {/* Toolbar */}
        <div className="report-toolbar flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Financial Report
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Printer className="size-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Scrollable report content */}
        <div className="report-content flex-1 overflow-y-auto px-6 py-8">
          <div className="report-page max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8 space-y-8 text-gray-900">
            {/* Header */}
            <div className="border-b border-gray-200 pb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {data.organization}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Financial Report: {formatDate(data.period.start)} &mdash;{' '}
                {formatDate(data.period.end)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Generated{' '}
                <time
                  dateTime={data.generatedAt}
                  title={new Date(data.generatedAt).toLocaleString()}
                >
                  {formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true })}
                </time>
              </p>
            </div>

            {/* KPI Summary Cards */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Cash In" value={formatCurrency(data.summary.cashIn)} positive />
                <SummaryCard label="Cash Out" value={formatCurrency(data.summary.cashOut)} />
                <SummaryCard
                  label="Net Cashflow"
                  value={formatCurrency(data.summary.netCashflow)}
                  positive={data.summary.netCashflow >= 0}
                  negative={data.summary.netCashflow < 0}
                />
                <SummaryCard label="Transactions" value={data.summary.transactionCount.toLocaleString()} />
              </div>
            </div>

            {/* Spend by Category */}
            {data.spendByCategory.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Spend by Category
                </h2>
                <BreakdownTable
                  items={data.spendByCategory}
                  total={totalSpend}
                />
              </div>
            )}

            {/* Spend by Department */}
            {data.spendByDepartment.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Spend by Department
                </h2>
                <BreakdownTable
                  items={data.spendByDepartment}
                  total={totalSpend}
                />
              </div>
            )}

            {/* Spend by Project */}
            {data.spendByProject.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Spend by Project
                </h2>
                <BreakdownTable
                  items={data.spendByProject}
                  total={totalSpend}
                />
              </div>
            )}

            {/* Top Vendors */}
            {data.topVendors.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Top 10 Vendors by Spend
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-500">
                        #
                      </th>
                      <th className="text-left py-2 font-medium text-gray-500">
                        Vendor
                      </th>
                      <th className="text-right py-2 font-medium text-gray-500">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topVendors.map((vendor, i) => (
                      <tr
                        key={vendor.name}
                        className="border-b border-gray-100"
                      >
                        <td className="py-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 text-gray-900">{vendor.name}</td>
                        <td className="py-2 text-right font-mono text-gray-900">
                          {formatCurrency(vendor.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Monthly Totals */}
            {data.monthlyTotals.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Monthly Totals
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-500">
                        Month
                      </th>
                      <th className="text-right py-2 font-medium text-gray-500">
                        Cash In
                      </th>
                      <th className="text-right py-2 font-medium text-gray-500">
                        Cash Out
                      </th>
                      <th className="text-right py-2 font-medium text-gray-500">
                        Net
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyTotals.map((m) => (
                      <tr key={m.month} className="border-b border-gray-100">
                        <td className="py-2 text-gray-900">
                          {formatMonth(m.month)}
                        </td>
                        <td className="py-2 text-right font-mono text-emerald-600">
                          {formatCurrency(m.cashIn)}
                        </td>
                        <td className="py-2 text-right font-mono text-red-600">
                          {formatCurrency(m.cashOut)}
                        </td>
                        <td
                          className={`py-2 text-right font-mono ${
                            m.net >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(m.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function SummaryCard({
  label,
  value,
  positive,
  negative,
}: {
  label: string
  value: string
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`text-xl font-semibold mt-1 ${
          positive
            ? 'text-emerald-600'
            : negative
              ? 'text-red-600'
              : 'text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function BreakdownTable({
  items,
  total,
}: {
  items: { name: string; amount: number }[]
  total: number
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="text-left py-2 font-medium text-gray-500">Name</th>
          <th className="text-right py-2 font-medium text-gray-500">Amount</th>
          <th className="text-right py-2 font-medium text-gray-500 w-24">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const pct = total > 0 ? (item.amount / total) * 100 : 0
          return (
            <tr key={item.name} className="border-b border-gray-100">
              <td className="py-2 text-gray-900">{item.name}</td>
              <td className="py-2 text-right font-mono text-gray-900">
                {formatCurrency(item.amount)}
              </td>
              <td className="py-2 text-right text-gray-500">
                {pct.toFixed(1)}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
