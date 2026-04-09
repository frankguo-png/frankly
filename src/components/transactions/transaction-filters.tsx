'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'

const CATEGORIES = [
  'Payroll',
  'Tools & Software',
  'Marketing',
  'Infrastructure',
  'Legal & Admin',
  'Opex',
  'Revenue',
  'Uncategorized',
]

const DEPARTMENTS = [
  'Product',
  'Engineering',
  'Marketing',
  'Sales',
  'Operations',
  'Admin',
]

const PROJECTS = ['LNER', 'PWC', 'IWAKI', 'Brookfield']

const SOURCES = ['plaid', 'qbo', 'rippling', 'manual']

export interface TransactionFilterValues {
  search?: string
  category?: string
  department?: string
  project?: string
  source?: string
}

export function TransactionFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const search = searchParams.get('search') ?? ''
  const category = searchParams.get('category') ?? ''
  const department = searchParams.get('department') ?? ''
  const project = searchParams.get('project') ?? ''
  const source = searchParams.get('source') ?? ''

  const hasFilters = search || category || department || project || source

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const clearFilters = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search description or vendor..."
          value={search}
          onChange={(e) => updateParam('search', e.target.value)}
          className="pl-8 h-8 text-sm bg-card border-border/50"
        />
      </div>

      <Select value={category} onValueChange={(val) => updateParam('category', val ?? '')}>
        <SelectTrigger size="sm" className="min-w-[140px] bg-card border-border/50">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Categories</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={department} onValueChange={(val) => updateParam('department', val ?? '')}>
        <SelectTrigger size="sm" className="min-w-[130px] bg-card border-border/50">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Departments</SelectItem>
          {DEPARTMENTS.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={project} onValueChange={(val) => updateParam('project', val ?? '')}>
        <SelectTrigger size="sm" className="min-w-[120px] bg-card border-border/50">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Projects</SelectItem>
          {PROJECTS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={source} onValueChange={(val) => updateParam('source', val ?? '')}>
        <SelectTrigger size="sm" className="min-w-[100px] bg-card border-border/50">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Sources</SelectItem>
          {SOURCES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
