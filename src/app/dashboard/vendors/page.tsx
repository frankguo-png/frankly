'use client'

import { useState, Suspense, Fragment } from 'react'
import { useVendorData, type Vendor } from '@/hooks/use-vendor-data'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'

type SortField = 'totalSpend' | 'avgMonthly' | 'transactionCount' | 'lastSeen' | 'name'
type SortDir = 'asc' | 'desc'

function VendorsContent() {
  const { data, error, isLoading, mutate } = useVendorData()
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('totalSpend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null)

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-block w-3">
      {sortField === field ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
    </span>
  )

  const vendors = data?.vendors ?? []
  const summary = data?.summary

  // Filter by search
  const filtered = search.trim()
    ? vendors.filter((v) =>
        v.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : vendors

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortField === 'totalSpend') cmp = a.totalSpend - b.totalSpend
    else if (sortField === 'avgMonthly') cmp = a.avgMonthly - b.avgMonthly
    else if (sortField === 'transactionCount')
      cmp = a.transactionCount - b.transactionCount
    else if (sortField === 'lastSeen')
      cmp =
        new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime()
    else if (sortField === 'name') cmp = a.name.localeCompare(b.name)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const TrendIndicator = ({ trend }: { trend: 'up' | 'down' | 'flat' }) => {
    if (trend === 'up')
      return (
        <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
          Up
        </span>
      )
    if (trend === 'down')
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Down
        </span>
      )
    return (
      <span className="inline-flex items-center gap-1 text-[#7b8fa3] text-xs font-medium">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Flat
      </span>
    )
  }

  const MiniBarChart = ({ vendor }: { vendor: Vendor }) => {
    const maxSpend = Math.max(...vendor.monthlySpend.map((m) => m.spend), 1)
    return (
      <div className="px-6 py-4 bg-[#0a1422]/60 border-t border-[rgba(255,255,255,0.04)]">
        <p className="text-[10px] font-medium text-[#6b7f94] uppercase tracking-wider mb-3">
          Monthly Spend (Last 6 Months)
        </p>
        <div className="flex items-end gap-2 h-24">
          {vendor.monthlySpend.map((m) => {
            const height = maxSpend > 0 ? (m.spend / maxSpend) * 100 : 0
            const monthLabel = new Date(m.month + '-01').toLocaleDateString(
              'en-US',
              { month: 'short' }
            )
            return (
              <div
                key={m.month}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className="text-[9px] text-[#7b8fa3] tabular-nums">
                  {m.spend > 0 ? formatCompactCurrency(m.spend) : '-'}
                </span>
                <div className="w-full flex justify-center">
                  <div
                    className="w-8 rounded-t bg-blue-500/60 transition-all"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>
                <span className="text-[9px] text-[#5a6d82]">{monthLabel}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#e8edf4]">Vendors</h1>
        <p className="text-sm text-[#5a6d82] mt-1">
          Analyze spending patterns across all your vendors
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-red-400 text-sm mb-3">Failed to load vendor data</p>
          <button
            onClick={() => mutate()}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Vendors',
              value: summary.totalVendors.toLocaleString(),
              color: 'text-[#e8edf4]',
            },
            {
              label: 'Total Spend',
              value: formatCompactCurrency(summary.totalSpend),
              color: 'text-blue-400',
            },
            {
              label: 'Avg per Vendor',
              value: formatCompactCurrency(summary.avgPerVendor),
              color: 'text-amber-400',
            },
            {
              label: 'Top Vendor',
              value: summary.topVendor || '-',
              color: 'text-emerald-400',
              isText: true,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm p-4"
            >
              <p className="text-[10px] font-medium text-[#6b7f94] uppercase tracking-wider mb-1">
                {card.label}
              </p>
              <p
                className={`${
                  'isText' in card && card.isText
                    ? 'text-lg truncate'
                    : 'text-2xl tabular-nums tracking-tight'
                } font-bold ${card.color}`}
              >
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111d2e]/80 backdrop-blur-sm overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#5a6d82] uppercase tracking-wider">
            All Vendors
          </h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5a6d82]"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0d1a2d] pl-8 pr-3 py-1.5 text-xs text-[#e8edf4] placeholder:text-[#6b7f94] focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="px-6 pb-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : !sorted.length ? (
          <div className="px-6 pb-8 text-center">
            <p className="text-sm text-[#6b7f94]">
              {search ? 'No vendors match your search' : 'No vendor data available'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-[rgba(255,255,255,0.06)]">
                  <th className="px-6 py-3 text-left">
                    <button
                      onClick={() => toggleSort('name')}
                      className="text-[10px] font-semibold text-[#6b7f94] uppercase tracking-wider hover:text-[#9baab8] transition-colors cursor-pointer"
                    >
                      Vendor
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleSort('totalSpend')}
                      className="text-[10px] font-semibold text-[#6b7f94] uppercase tracking-wider hover:text-[#9baab8] transition-colors cursor-pointer"
                    >
                      Total Spend
                      <SortIcon field="totalSpend" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleSort('avgMonthly')}
                      className="text-[10px] font-semibold text-[#6b7f94] uppercase tracking-wider hover:text-[#9baab8] transition-colors cursor-pointer"
                    >
                      Avg Monthly
                      <SortIcon field="avgMonthly" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center">
                    <span className="text-[10px] font-semibold text-[#6b7f94] uppercase tracking-wider">
                      Trend
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleSort('transactionCount')}
                      className="text-[10px] font-semibold text-[#6b7f94] uppercase tracking-wider hover:text-[#9baab8] transition-colors cursor-pointer"
                    >
                      Transactions
                      <SortIcon field="transactionCount" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleSort('lastSeen')}
                      className="text-[10px] font-semibold text-[#6b7f94] uppercase tracking-wider hover:text-[#9baab8] transition-colors cursor-pointer"
                    >
                      Last Seen
                      <SortIcon field="lastSeen" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-[10px] font-semibold text-[#6b7f94] uppercase tracking-wider">
                      Top Category
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((vendor) => {
                  const isExpanded = expandedVendor === vendor.name
                  return (
                    <Fragment key={vendor.name}>
                      <tr
                        onClick={() =>
                          setExpandedVendor(isExpanded ? null : vendor.name)
                        }
                        className="border-t border-[rgba(255,255,255,0.04)] hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-3">
                          <span className="text-sm text-[#e8edf4] font-medium">
                            {vendor.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-[#e8edf4] tabular-nums">
                            {formatCurrency(vendor.totalSpend)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-[#7b8fa3] tabular-nums">
                            {formatCurrency(vendor.avgMonthly)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <TrendIndicator trend={vendor.trend} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-[#7b8fa3] tabular-nums">
                            {vendor.transactionCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-[#7b8fa3]">
                            {new Date(vendor.lastSeen).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[rgba(59,130,246,0.15)] text-blue-400">
                            {vendor.topCategory}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7}>
                            <MiniBarChart vendor={vendor} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VendorsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <div className="h-8 w-40 rounded-lg animate-shimmer" />
            <div className="h-4 w-64 rounded-lg animate-shimmer mt-2" />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl border border-[rgba(255,255,255,0.06)] animate-shimmer"
              />
            ))}
          </div>
        </div>
      }
    >
      <VendorsContent />
    </Suspense>
  )
}
