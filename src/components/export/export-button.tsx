'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ExportButtonProps {
  /** Query params to append to the export API calls (e.g. filters, date range) */
  filters?: Record<string, string | undefined>
  /** Callback when report data is loaded; parent can open the report view */
  onReportData?: (data: ReportData) => void
}

export interface ReportData {
  generatedAt: string
  organization: string
  period: { start: string; end: string }
  summary: {
    cashIn: number
    cashOut: number
    netCashflow: number
    payrollTotal: number
    transactionCount: number
  }
  spendByCategory: { name: string; amount: number }[]
  spendByDepartment: { name: string; amount: number }[]
  spendByProject: { name: string; amount: number }[]
  topVendors: { name: string; amount: number }[]
  monthlyTotals: { month: string; cashIn: number; cashOut: number; net: number }[]
}

function buildQueryString(filters?: Record<string, string | undefined>): string {
  if (!filters) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  const str = params.toString()
  return str ? `?${str}` : ''
}

export function ExportButton({ filters, onReportData }: ExportButtonProps) {
  const [loading, setLoading] = useState<'csv' | 'report' | null>(null)

  const handleExportCsv = useCallback(async () => {
    setLoading('csv')
    try {
      const qs = buildQueryString(filters)
      const res = await fetch(`/api/export/transactions${qs}`)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to export CSV')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('CSV exported successfully')
    } catch {
      toast.error('Network error while exporting CSV')
    } finally {
      setLoading(null)
    }
  }, [filters])

  const handleExportReport = useCallback(async () => {
    setLoading('report')
    try {
      const qs = buildQueryString(filters)
      const res = await fetch(`/api/export/report${qs}`)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to generate report')
        return
      }

      const data: ReportData = await res.json()
      onReportData?.(data)
    } catch {
      toast.error('Network error while generating report')
    } finally {
      setLoading(null)
    }
  }, [filters, onReportData])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading !== null}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 h-8 text-sm font-medium transition-all glass border border-[rgba(255,255,255,0.06)] text-[#9baab8] hover:text-white hover:border-blue-500/30 hover:bg-blue-500/5 disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem onClick={handleExportCsv}>
          <FileSpreadsheet className="size-4" />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportReport}>
          <FileText className="size-4" />
          Export Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
