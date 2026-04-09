import { getWorkers, getPayrollRuns, type RipplingWorker } from './client'
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
  const raw = (
    worker.employment_type ??
    worker.employmentType ??
    ''
  ).toUpperCase()

  switch (raw) {
    case 'EMPLOYEE':
    case 'FULL_TIME':
    case 'FULL-TIME':
      return 'full_time'
    case 'PART_TIME':
    case 'PART-TIME':
      return 'part_time'
    case 'CONTRACTOR':
    case 'CONTRACT':
      return 'contractor'
    case 'HOURLY':
      return 'hourly'
    case 'INTERN':
      return 'intern'
    default:
      return null
  }
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
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

    // Upsert each worker
    for (const worker of workers) {
      activeWorkerIds.add(worker.id)

      const fullName = `${worker.firstName} ${worker.lastName}`.trim()
      const dept = worker.department?.name ?? null

      const { error } = await supabase
        .from('payroll_allocations')
        .upsert(
          {
            org_id: orgId,
            employee_id: worker.id,
            employee_name: fullName,
            employment_type: mapEmploymentType(worker),
            annual_salary: worker.compensation?.amount ?? null,
            department: dept,
            project_allocations: [],
            effective_date: todayISO(),
            end_date: null,
          },
          { onConflict: 'org_id,employee_id' }
        )

      if (error) {
        console.error(
          `Failed to upsert worker ${worker.id}:`,
          error.message
        )
      } else {
        synced++
      }

      // Also upsert into employees table (for org chart, reviews, bonuses)
      const isActive = !worker.endDate || worker.endDate > todayISO()
      const { error: empError } = await supabase
        .from('employees')
        .upsert(
          {
            id: worker.id,
            org_id: orgId,
            name: fullName,
            title: null,
            department: dept,
            email: null,
            status: isActive ? 'active' : 'inactive',
            start_date: worker.startDate ?? null,
            salary: worker.compensation?.amount ?? null,
          },
          { onConflict: 'id' }
        )

      if (empError) {
        console.error(
          `Failed to upsert employee ${worker.id}:`,
          empError.message
        )
      }
    }

    // Deactivate employees no longer in Rippling
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

          // Also mark as inactive in employees table
          await supabase
            .from('employees')
            .update({ status: 'inactive' })
            .eq('id', emp.employee_id)
            .eq('org_id', orgId)
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

// ---------------------------------------------------------------------------
// syncRipplingPayroll
// ---------------------------------------------------------------------------

export async function syncRipplingPayroll(orgId: string) {
  const supabase = createServiceClient()

  // Create sync log
  const { data: syncLog, error: syncLogError } = await supabase
    .from('sync_log')
    .insert({
      org_id: orgId,
      source: 'rippling',
      sync_type: 'payroll',
      status: 'running',
    })
    .select('id')
    .single()

  if (syncLogError) {
    throw new Error(`Failed to create sync log: ${syncLogError.message}`)
  }

  let runsSynced = 0
  let transactionsCreated = 0

  try {
    const endDate = todayISO()
    const startDate = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split('T')[0]

    const payrollRuns = await getPayrollRuns(startDate, endDate)

    for (const run of payrollRuns) {
      const { error } = await supabase.from('transactions').upsert(
        {
          org_id: orgId,
          date: run.runDate || run.payDate || endDate,
          amount: -Math.abs(run.totalAmount),
          vendor: 'Rippling Payroll',
          category: 'Payroll',
          description: `Payroll run ${run.id}${run.periodStart && run.periodEnd ? ` (${run.periodStart} - ${run.periodEnd})` : ''}`,
          source: 'rippling' as const,
          source_transaction_id: `payroll_run_${run.id}`,
        },
        { onConflict: 'org_id,source,source_transaction_id' }
      )

      if (error) {
        console.error(
          `Failed to upsert payroll run ${run.id}:`,
          error.message
        )
      } else {
        runsSynced++
        transactionsCreated++
      }
    }

    // Complete sync log
    await supabase
      .from('sync_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        records_fetched: payrollRuns.length,
        records_created: transactionsCreated,
        records_updated: 0,
      })
      .eq('id', syncLog.id)

    return { runs_synced: runsSynced, transactions_created: transactionsCreated }
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
