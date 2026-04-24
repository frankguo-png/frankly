import { getWorkers, getWorkerName, getWorkerDepartment, getWorkerCompensation, getWorkerAnnualSalary, getWorkerHourlyRate, getWorkerEmploymentType, type RipplingWorker } from './client'
import { createServiceClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contractor'
  | 'hourly'
  | 'intern'

function mapEmploymentType(
  worker: RipplingWorker
): EmploymentType | null {
  const rawType = getWorkerEmploymentType(worker)
  const raw = (rawType ?? '').toUpperCase()
  // Onboarding flow in Rippling sometimes lands interns as FULL_TIME.
  // Title is the authoritative signal in that case.
  const titleSaysIntern = !!worker.title && /\bintern\b/i.test(worker.title)

  switch (raw) {
    case 'EMPLOYEE':
    case 'FULL_TIME':
    case 'FULL-TIME':
      return titleSaysIntern ? 'intern' : 'full_time'
    case 'PART_TIME':
    case 'PART-TIME':
      return titleSaysIntern ? 'intern' : 'part_time'
    case 'CONTRACTOR':
    case 'CONTRACT':
      return 'contractor'
    case 'HOURLY':
      return titleSaysIntern ? 'intern' : 'hourly'
    case 'INTERN':
      return 'intern'
    default:
      return titleSaysIntern ? 'intern' : null
  }
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// A worker is active only if status is ACTIVE and they aren't past their end_date.
// Rippling pre-active states (INIT, HIRED, ACCEPTED) are not yet on payroll.
function isWorkerActive(worker: RipplingWorker): boolean {
  if (worker.status === 'TERMINATED') return false
  if (worker.status === 'INIT' || worker.status === 'HIRED' || worker.status === 'ACCEPTED') return false
  if (worker.end_date) {
    const endDate = new Date(worker.end_date)
    if (!Number.isNaN(endDate.getTime()) && endDate <= new Date()) return false
  }
  return true
}

// end_date for payroll_allocations: respect Rippling's end_date; if a worker is
// TERMINATED with no end_date (data quality issue), stamp today so downstream
// "active" queries don't silently include them.
function getAllocationEndDate(worker: RipplingWorker): string | null {
  if (worker.end_date) return worker.end_date
  if (worker.status === 'TERMINATED') return todayISO()
  return null
}

// Populate `annual_salary` for salaried workers and `hourly_rate` for hourly/intern
// workers. The payroll UI shows "$X/hr" when hourly_rate is set, otherwise annual.
// Setting the wrong field (e.g. annual on an intern) causes the roster to show a
// meaningless year-equivalent figure.
interface CompensationFields {
  annual_salary: number | null
  hourly_rate: number | null
  hours_per_week: number | null
}
function getCompensationFields(
  worker: RipplingWorker,
  mapped: EmploymentType | null
): CompensationFields {
  const annual = getWorkerAnnualSalary(worker)
  const hourly = getWorkerHourlyRate(worker)

  if (mapped === 'hourly' || mapped === 'intern') {
    // When Rippling only has an annual figure (common for interns mis-tagged as
    // full-time), derive an hourly rate from it so monthly-cost calcs are still
    // meaningful. 2080 = 40 h/wk × 52 wk.
    const derivedHourly = hourly ?? (annual != null ? annual / 2080 : null)
    return { annual_salary: null, hourly_rate: derivedHourly, hours_per_week: 40 }
  }
  if (mapped === 'part_time') {
    return { annual_salary: annual, hourly_rate: null, hours_per_week: 20 }
  }
  // full_time, contractor, or unknown → treat as salaried
  return { annual_salary: annual, hourly_rate: null, hours_per_week: null }
}

// ---------------------------------------------------------------------------
// syncRipplingEmployees
// ---------------------------------------------------------------------------

export async function syncRipplingEmployees(orgId: string) {
  const supabase = createServiceClient()

  // Create sync log
  const { data: syncLog, error: syncLogError } = await supabase
    .from('sync_log')
    .insert({
      org_id: orgId,
      source: 'rippling',
      sync_type: 'employees',
      status: 'running',
    })
    .select('id')
    .single()

  if (syncLogError) {
    throw new Error(`Failed to create sync log: ${syncLogError.message}`)
  }

  let synced = 0
  let deactivated = 0

  try {
    const workers = await getWorkers()

    const activeWorkerIds = new Set<string>()

    // Auto-tag entity from Rippling worker.country. Match on:
    //  1. entity.short_code (ISO-2 code — primary)
    //  2. entity.currency (USD→US, CAD→CA, GBP→GB) as fallback
    // Unmatched workers land with entity_id = null.
    const { data: entities } = await supabase
      .from('entities')
      .select('id, short_code, currency')
      .eq('org_id', orgId)

    const countryToCurrency: Record<string, string> = {
      US: 'USD',
      CA: 'CAD',
      GB: 'GBP',
      EU: 'EUR',
    }

    function resolveEntityIdForCountry(country: string | null | undefined): string | null {
      if (!country) return null
      const code = country.toUpperCase()
      // 1. exact short_code match
      const byCode = entities?.find(e => (e.short_code ?? '').toUpperCase() === code)
      if (byCode) return byCode.id
      // 2. currency fallback
      const expectedCurrency = countryToCurrency[code]
      if (expectedCurrency) {
        const byCurrency = entities?.find(e => (e.currency ?? '').toUpperCase() === expectedCurrency)
        if (byCurrency) return byCurrency.id
      }
      return null
    }

    // Pass 1: upsert payroll_allocations and employees (manager_id resolved in pass 2)
    for (const worker of workers) {
      activeWorkerIds.add(worker.id)

      const fullName = getWorkerName(worker)
      const dept = getWorkerDepartment(worker)
      const mapped = mapEmploymentType(worker)
      const { annual_salary, hourly_rate, hours_per_week } = getCompensationFields(worker, mapped)
      const salary = getWorkerCompensation(worker) // annualized number for employees.salary
      const active = isWorkerActive(worker)
      const allocEndDate = getAllocationEndDate(worker)
      const effectiveDate = worker.start_date ?? todayISO()
      const entityId = resolveEntityIdForCountry(worker.country)

      const { error: allocError } = await supabase
        .from('payroll_allocations')
        .upsert(
          {
            org_id: orgId,
            employee_id: worker.id,
            employee_name: fullName,
            employment_type: mapped,
            annual_salary,
            hourly_rate,
            hours_per_week,
            department: dept,
            project_allocations: [],
            effective_date: effectiveDate,
            end_date: allocEndDate,
            entity_id: entityId,
          },
          { onConflict: 'org_id,employee_id,effective_date' }
        )

      if (allocError) {
        console.error(
          `Failed to upsert payroll_allocation for ${worker.id}:`,
          allocError.message
        )
      } else {
        synced++
      }

      // Close out any *other* payroll_allocations rows for this worker that still
      // have end_date=null — those are orphans from earlier sync attempts that
      // used a different effective_date (e.g. today() before we switched to start_date).
      await supabase
        .from('payroll_allocations')
        .update({ end_date: allocEndDate ?? todayISO() })
        .eq('org_id', orgId)
        .eq('employee_id', worker.id)
        .neq('effective_date', effectiveDate)
        .is('end_date', null)

      // Upsert employees row keyed by Rippling ID (not the internal UUID)
      // is_manager is finalized in pass 2 once we know who has direct reports
      const { error: empError } = await supabase
        .from('employees')
        .upsert(
          {
            org_id: orgId,
            rippling_id: worker.id,
            rippling_manager_id: worker.manager_id ?? null,
            name: fullName,
            title: worker.title ?? null,
            department: dept,
            email: worker.work_email ?? worker.personal_email ?? null,
            status: active ? 'active' : 'inactive',
            start_date: worker.start_date ?? null,
            salary,
            country: worker.country ?? null,
            location_type: worker.location?.type ?? null,
            is_manager: worker.is_manager === true,
            salary_effective_date: worker.compensation?.salary_effective_date ?? null,
            entity_id: entityId,
          },
          { onConflict: 'org_id,rippling_id' }
        )

      if (empError) {
        console.error(
          `Failed to upsert employee ${worker.id}:`,
          empError.message
        )
      }
    }

    // Pass 2: resolve rippling_manager_id → manager_id (internal UUID)
    // and flip is_manager=true for anyone who has direct reports, as a fallback
    // for workers where Rippling's own is_manager flag is wrong or missing.
    const { data: allEmployees } = await supabase
      .from('employees')
      .select('id, rippling_id, rippling_manager_id, is_manager')
      .eq('org_id', orgId)
      .not('rippling_id', 'is', null)

    if (allEmployees) {
      const ripplingIdToUuid = new Map<string, string>()
      for (const e of allEmployees) {
        if (e.rippling_id) ripplingIdToUuid.set(e.rippling_id, e.id)
      }

      // Everyone appearing in someone else's rippling_manager_id is a manager.
      const derivedManagerRipplingIds = new Set<string>()
      for (const e of allEmployees) {
        if (e.rippling_manager_id) derivedManagerRipplingIds.add(e.rippling_manager_id)
      }

      for (const e of allEmployees) {
        const updates: { manager_id?: string; is_manager?: boolean } = {}

        if (e.rippling_manager_id) {
          const managerUuid = ripplingIdToUuid.get(e.rippling_manager_id)
          if (managerUuid) updates.manager_id = managerUuid
        }

        if (e.rippling_id && !e.is_manager && derivedManagerRipplingIds.has(e.rippling_id)) {
          updates.is_manager = true
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('employees').update(updates).eq('id', e.id)
        }
      }
    }

    // Deactivate employees no longer in Rippling (both tables)
    const { data: existingEmployees } = await supabase
      .from('payroll_allocations')
      .select('id, employee_id')
      .eq('org_id', orgId)
      .is('end_date', null)

    if (existingEmployees) {
      for (const emp of existingEmployees) {
        if (!activeWorkerIds.has(emp.employee_id)) {
          const { error } = await supabase
            .from('payroll_allocations')
            .update({ end_date: todayISO() })
            .eq('id', emp.id)

          if (!error) deactivated++

          await supabase
            .from('employees')
            .update({ status: 'inactive' })
            .eq('org_id', orgId)
            .eq('rippling_id', emp.employee_id)
        }
      }
    }

    // Complete sync log
    await supabase
      .from('sync_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_fetched: workers.length,
        records_created: synced,
        records_updated: deactivated,
      })
      .eq('id', syncLog.id)

    return { synced, deactivated }
  } catch (error) {
    await supabase
      .from('sync_log')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message:
          error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', syncLog.id)

    throw error
  }
}

