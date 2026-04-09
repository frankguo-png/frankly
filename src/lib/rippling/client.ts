const RIPPLING_API_URL =
  process.env.RIPPLING_API_URL || 'https://rest.ripplingapis.com'
const RIPPLING_API_KEY = process.env.RIPPLING_API_KEY

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RipplingWorker {
  id: string
  firstName: string
  lastName: string
  department?: { name: string } | null
  employment_type?: string | null
  employmentType?: string | null
  compensation?: { amount: number; currency?: string } | null
  startDate?: string | null
  endDate?: string | null
  status?: string | null
}

export interface RipplingPayrollRun {
  id: string
  runDate: string
  payDate?: string | null
  totalAmount: number
  status?: string | null
  periodStart?: string | null
  periodEnd?: string | null
}

interface RipplingPaginatedResponse<T> {
  data: T[]
  next?: string | null
  hasMore?: boolean
}

// ---------------------------------------------------------------------------
// Base request wrapper
// ---------------------------------------------------------------------------

export async function ripplingSafeRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!RIPPLING_API_KEY) {
    throw new Error('RIPPLING_API_KEY is not configured')
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${RIPPLING_API_URL}${endpoint}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${RIPPLING_API_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  let attempt = 0
  const maxRetries = 3

  while (attempt <= maxRetries) {
    const response = await fetch(url, { ...options, headers })

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const waitMs = retryAfter
        ? Number(retryAfter) * 1000
        : Math.pow(2, attempt) * 1000
      console.warn(
        `Rippling rate-limited (429). Retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`
      )
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      attempt++
      continue
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(
        `Rippling API error ${response.status}: ${response.statusText} — ${body}`
      )
    }

    return response
  }

  throw new Error('Rippling API rate limit exceeded after max retries')
}

// ---------------------------------------------------------------------------
// Paginated fetch helper
// ---------------------------------------------------------------------------

async function fetchAllPages<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T[]> {
  const results: T[] = []
  let url = endpoint

  if (params) {
    const qs = new URLSearchParams(params).toString()
    url = `${endpoint}?${qs}`
  }

  let page = 1
  const perPage = 100
  let hasMore = true

  while (hasMore) {
    const separator = url.includes('?') ? '&' : '?'
    const pagedUrl = `${url}${separator}limit=${perPage}&offset=${(page - 1) * perPage}`

    const response = await ripplingSafeRequest(pagedUrl)
    const json = (await response.json()) as
      | RipplingPaginatedResponse<T>
      | T[]

    if (Array.isArray(json)) {
      results.push(...json)
      hasMore = json.length === perPage
    } else {
      results.push(...json.data)
      hasMore = json.hasMore === true || (json.next != null && json.next !== '')
    }

    page++
  }

  return results
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

export async function getWorkers(): Promise<RipplingWorker[]> {
  return fetchAllPages<RipplingWorker>('/workers', {
    expand: 'department,employment_type',
  })
}

export async function getPayrollRuns(
  startDate: string,
  endDate: string
): Promise<RipplingPayrollRun[]> {
  return fetchAllPages<RipplingPayrollRun>('/payroll_runs', {
    start_date: startDate,
    end_date: endDate,
  })
}
