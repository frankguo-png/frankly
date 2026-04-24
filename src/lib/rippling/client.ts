const RIPPLING_API_URL =
  process.env.RIPPLING_API_URL || 'https://rest.ripplingapis.com'
const RIPPLING_API_KEY = process.env.RIPPLING_API_KEY

// ---------------------------------------------------------------------------
// Types (matching Rippling Platform API spec)
// ---------------------------------------------------------------------------

export interface RipplingWorker {
  id: string
  user_id?: string
  user?: {
    id: string
    name?: { first_name?: string; last_name?: string; preferred_first_name?: string }
    display_name?: string
    active?: boolean
  }
  manager_id?: string | null
  status?: string // INIT, HIRED, ACCEPTED, ACTIVE, TERMINATED
  start_date?: string | null
  end_date?: string | null
  work_email?: string | null
  personal_email?: string | null
  title?: string | null
  country?: string | null
  is_manager?: boolean
  location?: {
    type?: string // WORK | REMOTE
    work_location_id?: string | null
  } | null
  employment_type_id?: string | null
  employment_type?: {
    id: string
    name?: string          // SALARIED_FT, SALARIED_PT, HOURLY, CONTRACTOR, INTERN
    label?: string         // Human-readable (e.g. "Salaried, full-time")
    type?: string          // EMPLOYEE, CONTRACTOR, INTERN
    amount_worked?: string // FULL-TIME, PART-TIME
  } | null
  department_id?: string | null
  department?: {
    id: string
    name?: string
  } | null
  compensation?: {
    id: string
    annual_compensation?: { currency_type?: string; value?: number } | null
    monthly_compensation?: { currency_type?: string; value?: number } | null
    weekly_compensation?: { currency_type?: string; value?: number } | null
    hourly_wage?: { currency_type?: string; value?: number } | null
    salary_effective_date?: string | null
  } | null
  // Legacy field names (some Rippling API versions use these)
  firstName?: string
  lastName?: string
  employment_type_legacy?: string | null
  employmentType?: string | null
}

interface RipplingPaginatedResponse<T> {
  results?: T[]
  data?: T[]
  next_link?: string | null
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
// Paginated fetch helper (supports both old and new response formats)
// ---------------------------------------------------------------------------

async function fetchAllPages<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T[]> {
  const results: T[] = []
  let url = endpoint

  // Ensure trailing slash (Rippling Platform API requires it)
  if (!url.endsWith('/')) url += '/'

  if (params) {
    const qs = new URLSearchParams(params).toString()
    url = `${url}?${qs}`
  }

  let hasMore = true
  let nextLink: string | null = null

  while (hasMore) {
    const fetchUrl = nextLink || url
    const response = await ripplingSafeRequest(fetchUrl)
    const json = (await response.json()) as RipplingPaginatedResponse<T> | T[]

    if (Array.isArray(json)) {
      // Old API format: returns array directly
      results.push(...json)
      hasMore = json.length >= 100
    } else {
      // New Platform API format: { results: [...], next_link: "..." }
      const items = json.results ?? json.data ?? []
      results.push(...items)
      nextLink = json.next_link ?? json.next ?? null
      hasMore = nextLink != null && nextLink !== ''
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Helper: extract name from worker (handles both API formats)
// ---------------------------------------------------------------------------

export function getWorkerName(worker: RipplingWorker): string {
  // Platform API: user.name or user.display_name
  if (worker.user?.display_name) return worker.user.display_name
  if (worker.user?.name) {
    const first = worker.user.name.preferred_first_name || worker.user.name.first_name || ''
    const last = worker.user.name.last_name || ''
    const name = `${first} ${last}`.trim()
    if (name) return name
  }
  // Legacy API fields
  if (worker.firstName || worker.lastName) {
    return `${worker.firstName ?? ''} ${worker.lastName ?? ''}`.trim()
  }
  return 'Unknown'
}

export function getWorkerDepartment(worker: RipplingWorker): string | null {
  return worker.department?.name ?? null
}

export function getWorkerCompensation(worker: RipplingWorker): number | null {
  const annual = worker.compensation?.annual_compensation?.value
  if (typeof annual === 'number') return annual
  // Fall back to hourly × 40 × 52 if no annual figure
  const hourly = worker.compensation?.hourly_wage?.value
  if (typeof hourly === 'number') return hourly * 40 * 52
  return null
}

export function getWorkerAnnualSalary(worker: RipplingWorker): number | null {
  return worker.compensation?.annual_compensation?.value ?? null
}

export function getWorkerHourlyRate(worker: RipplingWorker): number | null {
  return worker.compensation?.hourly_wage?.value ?? null
}

export function getWorkerEmploymentType(worker: RipplingWorker): string | null {
  const et = worker.employment_type
  if (!et) return worker.employmentType ?? worker.employment_type_legacy ?? null
  // Prefer the structured `type` + `amount_worked` fields over the raw `name`
  if (et.type === 'CONTRACTOR') return 'CONTRACTOR'
  if (et.type === 'INTERN') return 'INTERN'
  if (et.type === 'EMPLOYEE') {
    if (et.amount_worked === 'PART-TIME') return 'PART-TIME'
    return 'FULL-TIME'
  }
  return et.name ?? worker.employmentType ?? worker.employment_type_legacy ?? null
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

export async function getWorkers(): Promise<RipplingWorker[]> {
  // Try Platform API first (/workers/), fall back to Base API (/employees)
  try {
    return await fetchAllPages<RipplingWorker>('/workers/', {
      expand: 'user,department,employment_type,compensation',
    })
  } catch (err) {
    console.warn('Platform API /workers/ failed, trying Base API /employees/:', err)
    // Base API uses a different host and returns different shape
    const BASE_API_URL = 'https://api.rippling.com/platform/api'
    const response = await ripplingSafeRequest(`${BASE_API_URL}/employees`)
    const employees = await response.json() as any[]
    return employees.map((emp: any) => ({
      id: emp.id ?? emp._id,
      firstName: emp.firstName ?? emp.first_name,
      lastName: emp.lastName ?? emp.last_name,
      work_email: emp.workEmail ?? emp.work_email ?? emp.personalEmail,
      status: emp.status ?? (emp.endDate ? 'TERMINATED' : 'ACTIVE'),
      start_date: emp.startDate ?? emp.start_date,
      end_date: emp.endDate ?? emp.end_date ?? emp.terminationDate,
      department: emp.department ? { id: emp.department, name: emp.departmentName ?? emp.department } : null,
      employment_type: emp.employmentType ? { id: '', name: emp.employmentType } : null,
      compensation: emp.compensation ?? (emp.salary ? { amount: emp.salary } : null),
    }))
  }
}

