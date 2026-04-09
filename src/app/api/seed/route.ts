import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function randomDate(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo))
  return date.toISOString().split('T')[0]
}

function specificDate(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]
}

// Generate a date for a given month index (0 = Jan 2025, 15 = Apr 2026)
function monthDate(monthsAgo: number, dayOfMonth: number) {
  const date = new Date()
  date.setMonth(date.getMonth() - monthsAgo)
  date.setDate(Math.min(dayOfMonth, 28)) // avoid month overflow
  return date.toISOString().split('T')[0]
}

export async function POST() {
  // Auth check
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get org
  const { data: orgData, error: orgError } = await supabase
    .from('user_organizations')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (orgError || !orgData) {
    return NextResponse.json(
      { error: 'No organization found' },
      { status: 400 }
    )
  }

  const orgId = orgData.org_id
  const service = createServiceClient()

  // Clean up existing seed data for this org
  await service.from('transactions').delete().eq('org_id', orgId)
  await service.from('bank_accounts').delete().eq('org_id', orgId)
  try { await service.from('employees').delete().eq('org_id', orgId) } catch (e) { console.warn('employees table may not exist yet:', e) }
  try { await service.from('pending_payments').delete().eq('org_id', orgId) } catch (e) { console.warn('pending_payments table may not exist yet:', e) }
  try { await service.from('deals').delete().eq('org_id', orgId) } catch (e) { console.warn('deals table may not exist yet:', e) }

  // Seed bank accounts
  const { data: checkingAccount } = await service
    .from('bank_accounts')
    .insert({
      org_id: orgId,
      bank_name: 'Bank of America',
      account_name: 'Business Checking',
      account_type: 'checking',
      currency: 'USD',
      current_balance: 485340.78,
      available_balance: 481200.0,
      connection_status: 'active',
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const { data: savingsAccount } = await service
    .from('bank_accounts')
    .insert({
      org_id: orgId,
      bank_name: 'Bank of America',
      account_name: 'Business Savings',
      account_type: 'savings',
      currency: 'USD',
      current_balance: 201500.0,
      available_balance: 201500.0,
      connection_status: 'active',
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const { data: gbpAccount } = await service
    .from('bank_accounts')
    .insert({
      org_id: orgId,
      bank_name: 'Wise',
      account_name: 'Wise UK Account',
      account_type: 'checking',
      currency: 'GBP',
      current_balance: 85000.0,
      available_balance: 85000.0,
      connection_status: 'active',
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const { data: cadAccount } = await service
    .from('bank_accounts')
    .insert({
      org_id: orgId,
      bank_name: 'JP Morgan',
      account_name: 'JP Morgan Canada',
      account_type: 'checking',
      currency: 'CAD',
      current_balance: 120000.0,
      available_balance: 120000.0,
      connection_status: 'active',
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const checkingId = checkingAccount?.id ?? null
  const savingsId = savingsAccount?.id ?? null
  const gbpId = gbpAccount?.id ?? null
  const cadId = cadAccount?.id ?? null

  // Build transactions
  const transactions: Array<{
    org_id: string
    bank_account_id: string | null
    date: string
    amount: number
    currency: string
    description: string
    vendor: string
    category: string
    department: string
    project: string | null
    source: 'plaid' | 'qbo' | 'rippling' | 'manual'
    is_duplicate: boolean
    is_transfer: boolean
    categorization_status: 'rule_matched'
    metadata: Record<string, string> | Record<string, never>
  }> = []

  // --- REVENUE: Client payments ---
  // Revenue growth story across 16 months (month 0 = Jan 2025, month 15 = Apr 2026)
  // LNER: Present from month 0. Ramps from $30-45K early to $55-75K later
  for (let month = 0; month < 16; month++) {
    let minRev: number, maxRev: number
    if (month < 3) { minRev = 30000; maxRev = 45000 }        // Jan-Mar 2025
    else if (month < 6) { minRev = 35000; maxRev = 50000 }   // Apr-Jun 2025
    else if (month < 9) { minRev = 40000; maxRev = 55000 }   // Jul-Sep 2025
    else if (month < 12) { minRev = 45000; maxRev = 60000 }  // Oct-Dec 2025
    else if (month < 15) { minRev = 50000; maxRev = 65000 }  // Jan-Mar 2026
    else { minRev = 55000; maxRev = 75000 }                   // Apr 2026

    const amt = randomBetween(minRev, maxRev)
    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - month, 5),
      amount: amt,
      currency: 'USD',
      description: `LNER Project - Invoice #INV-${1200 + month}`,
      vendor: 'LNER',
      category: 'Revenue',
      department: 'Sales',
      project: 'LNER',
      source: 'plaid',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
    // Additional milestone payment (more likely in later months)
    if (Math.random() > (month < 6 ? 0.5 : 0.2)) {
      transactions.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: monthDate(15 - month, 18),
        amount: randomBetween(10000 + month * 500, 20000 + month * 500),
        currency: 'USD',
        description: `LNER - Milestone Payment ${month + 1}`,
        vendor: 'LNER',
        category: 'Revenue',
        department: 'Sales',
        project: 'LNER',
        source: 'plaid',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched',
        metadata: {},
      })
    }
  }

  // PWC: Comes on in month 3 (Apr 2025). Ramps from $25-35K to $55K+
  for (let month = 3; month < 16; month++) {
    let minRev: number, maxRev: number
    if (month < 6) { minRev = 25000; maxRev = 35000 }        // Apr-Jun 2025
    else if (month < 9) { minRev = 30000; maxRev = 45000 }   // Jul-Sep 2025
    else if (month < 12) { minRev = 35000; maxRev = 50000 }  // Oct-Dec 2025
    else if (month < 15) { minRev = 40000; maxRev = 55000 }  // Jan-Mar 2026
    else { minRev = 45000; maxRev = 60000 }                   // Apr 2026

    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - month, 8),
      amount: randomBetween(minRev, maxRev),
      currency: 'USD',
      description: `PricewaterhouseCoopers - Consulting Fee #PW-${300 + month}`,
      vendor: 'PricewaterhouseCoopers',
      category: 'Revenue',
      department: 'Sales',
      project: 'PWC',
      source: 'plaid',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
  }

  // IWAKI: Comes on in month 6 (Jul 2025). Ramps from $15-25K to $35K
  for (let month = 6; month < 16; month++) {
    let minRev: number, maxRev: number
    if (month < 9) { minRev = 15000; maxRev = 25000 }        // Jul-Sep 2025
    else if (month < 12) { minRev = 20000; maxRev = 30000 }  // Oct-Dec 2025
    else if (month < 15) { minRev = 25000; maxRev = 35000 }  // Jan-Mar 2026
    else { minRev = 28000; maxRev = 38000 }                   // Apr 2026

    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - month, 12),
      amount: randomBetween(minRev, maxRev),
      currency: 'USD',
      description: `IWAKI Corp - Monthly Retainer #IW-${100 + month}`,
      vendor: 'IWAKI Corp',
      category: 'Revenue',
      department: 'Sales',
      project: 'IWAKI',
      source: 'qbo',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
  }

  // Brookfield: Comes on in month 9 (Oct 2025). Ramps from $15-25K to $30K
  for (let month = 9; month < 16; month++) {
    let minRev: number, maxRev: number
    if (month < 12) { minRev = 15000; maxRev = 25000 }       // Oct-Dec 2025
    else if (month < 15) { minRev = 20000; maxRev = 30000 }  // Jan-Mar 2026
    else { minRev = 25000; maxRev = 35000 }                   // Apr 2026

    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - month, 15),
      amount: randomBetween(minRev, maxRev),
      currency: 'USD',
      description: `Brookfield Asset Management - Project Fees #BF-${50 + month}`,
      vendor: 'Brookfield Asset Management',
      category: 'Revenue',
      department: 'Sales',
      project: 'Brookfield',
      source: 'qbo',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
  }

  // --- PAYROLL: Bi-weekly, growing with team size ---
  // Team grows: 5 people early -> 13 by end
  for (let month = 0; month < 16; month++) {
    // Payroll per period scales with team size
    let payMin: number, payMax: number, taxMin: number, taxMax: number, periods: number
    if (month < 3) {
      // Jan-Mar 2025: 5 employees, smaller team, 1 big payroll per month
      payMin = 28000; payMax = 32000; taxMin = 4000; taxMax = 5500; periods = 2
    } else if (month < 6) {
      // Apr-Jun 2025: 7 employees
      payMin = 35000; payMax = 42000; taxMin = 5000; taxMax = 7000; periods = 2
    } else if (month < 9) {
      // Jul-Sep 2025: 9 employees
      payMin = 42000; payMax = 50000; taxMin = 6000; taxMax = 8500; periods = 2
    } else if (month < 12) {
      // Oct-Dec 2025: 10 employees
      payMin = 48000; payMax = 56000; taxMin = 7000; taxMax = 10000; periods = 2
    } else if (month < 14) {
      // Jan-Feb 2026: 11 employees
      payMin = 50000; payMax = 60000; taxMin = 7500; taxMax = 10500; periods = 2
    } else {
      // Mar-Apr 2026: 13 employees (interns added)
      payMin = 55000; payMax = 65000; taxMin = 8000; taxMax = 12000; periods = 2
    }

    for (let period = 0; period < periods; period++) {
      const dayOfMonth = period === 0 ? 1 : 15
      // Main payroll
      transactions.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: monthDate(15 - month, dayOfMonth),
        amount: -randomBetween(payMin, payMax),
        currency: 'USD',
        description: `Rippling Payroll - Period ${month * 2 + period + 1}`,
        vendor: 'Rippling',
        category: 'Payroll',
        department: 'Operations',
        project: null,
        source: 'rippling',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched',
        metadata: {},
      })
      // Payroll taxes
      transactions.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: monthDate(15 - month, dayOfMonth + 1),
        amount: -randomBetween(taxMin, taxMax),
        currency: 'USD',
        description: `Rippling - Payroll Taxes & Benefits`,
        vendor: 'Rippling',
        category: 'Payroll',
        department: 'Operations',
        project: null,
        source: 'rippling',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched',
        metadata: {},
      })
    }
  }

  // --- TOOLS & SOFTWARE: Monthly subscriptions (gradually added) ---
  // Core tools from day 1
  const coreSoftware: Array<{ vendor: string; desc: string; min: number; max: number; growTo: [number, number]; dept: string; proj: string | null }> = [
    { vendor: 'Amazon Web Services', desc: 'AWS Monthly Usage', min: 2000, max: 3000, growTo: [3000, 5000], dept: 'Engineering', proj: null },
    { vendor: 'Vercel Inc', desc: 'Vercel Pro Plan', min: 120, max: 160, growTo: [180, 220], dept: 'Engineering', proj: null },
    { vendor: 'Slack Technologies', desc: 'Slack Business+ Plan', min: 400, max: 500, growTo: [750, 850], dept: 'Operations', proj: null },
    { vendor: 'GitHub Inc', desc: 'GitHub Enterprise', min: 200, max: 280, growTo: [350, 450], dept: 'Engineering', proj: null },
    { vendor: 'Notion Labs', desc: 'Notion Team Plan', min: 150, max: 200, growTo: [250, 350], dept: 'Product', proj: null },
  ]
  // Added month 3+ (Apr 2025)
  const wave2Software: typeof coreSoftware = [
    { vendor: 'Figma Inc', desc: 'Figma Organization Plan', min: 250, max: 350, growTo: [450, 550], dept: 'Product', proj: null },
    { vendor: 'Zoom Video Communications', desc: 'Zoom Business Plan', min: 120, max: 160, growTo: [180, 220], dept: 'Operations', proj: null },
    { vendor: 'Linear', desc: 'Linear Standard Plan', min: 50, max: 80, growTo: [80, 120], dept: 'Engineering', proj: null },
  ]
  // Added month 6+ (Jul 2025)
  const wave3Software: typeof coreSoftware = [
    { vendor: 'HubSpot Inc', desc: 'HubSpot Marketing Hub', min: 400, max: 550, growTo: [750, 850], dept: 'Marketing', proj: null },
    { vendor: 'Datadog Inc', desc: 'Datadog Infrastructure Monitoring', min: 350, max: 500, growTo: [600, 900], dept: 'Engineering', proj: null },
    { vendor: '1Password', desc: '1Password Business', min: 60, max: 90, growTo: [100, 150], dept: 'Operations', proj: null },
  ]
  // Added month 9+ (Oct 2025)
  const wave4Software: typeof coreSoftware = [
    { vendor: 'Loom Inc', desc: 'Loom Business Plan', min: 60, max: 90, growTo: [90, 130], dept: 'Product', proj: null },
  ]

  function softwareCostForMonth(sw: { min: number; max: number; growTo: [number, number] }, month: number) {
    // Linearly interpolate between initial and final cost
    const progress = Math.min(month / 15, 1)
    const currentMin = sw.min + (sw.growTo[0] - sw.min) * progress
    const currentMax = sw.max + (sw.growTo[1] - sw.max) * progress
    return -randomBetween(currentMin, currentMax)
  }

  for (let month = 0; month < 16; month++) {
    for (const sw of coreSoftware) {
      transactions.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: monthDate(15 - month, Math.floor(Math.random() * 5) + 1),
        amount: softwareCostForMonth(sw, month),
        currency: 'USD',
        description: sw.desc,
        vendor: sw.vendor,
        category: 'Tools & Software',
        department: sw.dept,
        project: sw.proj,
        source: 'plaid',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched',
        metadata: {},
      })
    }
    if (month >= 3) {
      for (const sw of wave2Software) {
        transactions.push({
          org_id: orgId,
          bank_account_id: checkingId,
          date: monthDate(15 - month, Math.floor(Math.random() * 5) + 1),
          amount: softwareCostForMonth(sw, month),
          currency: 'USD',
          description: sw.desc,
          vendor: sw.vendor,
          category: 'Tools & Software',
          department: sw.dept,
          project: sw.proj,
          source: 'plaid',
          is_duplicate: false,
          is_transfer: false,
          categorization_status: 'rule_matched',
          metadata: {},
        })
      }
    }
    if (month >= 6) {
      for (const sw of wave3Software) {
        transactions.push({
          org_id: orgId,
          bank_account_id: checkingId,
          date: monthDate(15 - month, Math.floor(Math.random() * 5) + 1),
          amount: softwareCostForMonth(sw, month),
          currency: 'USD',
          description: sw.desc,
          vendor: sw.vendor,
          category: 'Tools & Software',
          department: sw.dept,
          project: sw.proj,
          source: 'plaid',
          is_duplicate: false,
          is_transfer: false,
          categorization_status: 'rule_matched',
          metadata: {},
        })
      }
    }
    if (month >= 9) {
      for (const sw of wave4Software) {
        transactions.push({
          org_id: orgId,
          bank_account_id: checkingId,
          date: monthDate(15 - month, Math.floor(Math.random() * 5) + 1),
          amount: softwareCostForMonth(sw, month),
          currency: 'USD',
          description: sw.desc,
          vendor: sw.vendor,
          category: 'Tools & Software',
          department: sw.dept,
          project: sw.proj,
          source: 'plaid',
          is_duplicate: false,
          is_transfer: false,
          categorization_status: 'rule_matched',
          metadata: {},
        })
      }
    }
  }

  // --- MARKETING: Ad spend (grows over time) ---
  for (let month = 0; month < 16; month++) {
    // Google Ads: present from start, grows
    const googleMin = month < 6 ? 1000 : month < 12 ? 2000 : 3000
    const googleMax = month < 6 ? 2500 : month < 12 ? 4000 : 5000
    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - month, 3),
      amount: -randomBetween(googleMin, googleMax),
      currency: 'USD',
      description: 'Google Ads - Monthly Campaign Spend',
      vendor: 'Google Ads',
      category: 'Marketing',
      department: 'Marketing',
      project: null,
      source: 'plaid',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
    // LinkedIn Ads: starts month 3
    if (month >= 3) {
      const liMin = month < 9 ? 800 : 1500
      const liMax = month < 9 ? 2000 : 3000
      transactions.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: monthDate(15 - month, 7),
        amount: -randomBetween(liMin, liMax),
        currency: 'USD',
        description: 'LinkedIn Ads - Sponsored Content',
        vendor: 'LinkedIn',
        category: 'Marketing',
        department: 'Marketing',
        project: null,
        source: 'plaid',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched',
        metadata: {},
      })
    }
  }

  // --- INFRASTRUCTURE (grows with office size) ---
  for (let month = 0; month < 16; month++) {
    // WeWork: starts at $5K, grows to $8.5K
    const weworkCost = month < 6 ? 5000 : month < 12 ? 6500 : 8500
    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - month, 1),
      amount: -weworkCost,
      currency: 'USD',
      description: 'WeWork - Monthly Office Lease',
      vendor: 'WeWork',
      category: 'Infrastructure',
      department: 'Operations',
      project: null,
      source: 'plaid',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
    // Internet
    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - month, 2),
      amount: -500,
      currency: 'USD',
      description: 'Comcast Business - Internet Service',
      vendor: 'Comcast',
      category: 'Infrastructure',
      department: 'Operations',
      project: null,
      source: 'plaid',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
    // Office supplies (random)
    if (Math.random() > 0.3) {
      transactions.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: monthDate(15 - month, Math.floor(Math.random() * 20) + 5),
        amount: -randomBetween(200, 800),
        currency: 'USD',
        description: 'Amazon Business - Office Supplies',
        vendor: 'Amazon',
        category: 'Infrastructure',
        department: 'Operations',
        project: null,
        source: 'plaid',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched',
        metadata: {},
      })
    }
  }

  // --- LEGAL & ADMIN ---
  for (let month = 0; month < 16; month++) {
    // Legal retainer
    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - month, 10),
      amount: -2000,
      currency: 'USD',
      description: 'Wilson Sonsini - Legal Retainer',
      vendor: 'Wilson Sonsini Goodrich & Rosati',
      category: 'Legal & Admin',
      department: 'Admin',
      project: null,
      source: 'plaid',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
    // Accounting
    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - month, 11),
      amount: -1000,
      currency: 'USD',
      description: 'Pilot.com - Monthly Bookkeeping',
      vendor: 'Pilot',
      category: 'Legal & Admin',
      department: 'Admin',
      project: null,
      source: 'qbo',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
    // Insurance (quarterly - months 0, 3, 6, 9, 12, 15)
    if (month % 3 === 0) {
      transactions.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: monthDate(15 - month, 15),
        amount: -randomBetween(1500, 2500),
        currency: 'USD',
        description: 'Hartford Insurance - Business Liability',
        vendor: 'Hartford Insurance',
        category: 'Legal & Admin',
        department: 'Admin',
        project: null,
        source: 'plaid',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched',
        metadata: {},
      })
    }
  }

  // --- OPEX: Misc operational expenses ---
  const opexItems = [
    { vendor: 'DoorDash', desc: 'DoorDash for Work - Team Meals', min: 300, max: 700 },
    { vendor: 'Uber', desc: 'Uber Business - Travel', min: 150, max: 400 },
    { vendor: 'Delta Air Lines', desc: 'Delta - Client Travel', min: 400, max: 1200 },
    { vendor: 'Marriott Hotels', desc: 'Marriott - Client Visit Accommodation', min: 300, max: 900 },
  ]

  for (const item of opexItems) {
    // Spread across 16 months with more frequency as company grows
    for (let month = 0; month < 16; month++) {
      const occurrences = month < 6 ? (Math.random() > 0.5 ? 1 : 0) : (Math.floor(Math.random() * 2) + 1)
      for (let i = 0; i < occurrences; i++) {
        transactions.push({
          org_id: orgId,
          bank_account_id: checkingId,
          date: monthDate(15 - month, Math.floor(Math.random() * 25) + 1),
          amount: -randomBetween(item.min, item.max),
          currency: 'USD',
          description: item.desc,
          vendor: item.vendor,
          category: 'Opex',
          department: 'Operations',
          project: null,
          source: 'plaid',
          is_duplicate: false,
          is_transfer: false,
          categorization_status: 'rule_matched',
          metadata: {},
        })
      }
    }
  }

  // --- Project-specific expenses (only when project is active) ---
  const projectExpenses = [
    { project: 'LNER', vendor: 'AWS', desc: 'AWS - LNER Dedicated Infrastructure', min: 800, max: 1500, dept: 'Engineering', startMonth: 0 },
    { project: 'PWC', vendor: 'Tableau', desc: 'Tableau - PWC Analytics License', min: 200, max: 400, dept: 'Product', startMonth: 3 },
    { project: 'IWAKI', vendor: 'Stripe', desc: 'Stripe Fees - IWAKI Payment Processing', min: 500, max: 1200, dept: 'Engineering', startMonth: 6 },
    { project: 'Brookfield', vendor: 'Snowflake', desc: 'Snowflake - Brookfield Data Warehouse', min: 600, max: 1000, dept: 'Engineering', startMonth: 9 },
  ]

  for (const pe of projectExpenses) {
    for (let month = pe.startMonth; month < 16; month++) {
      transactions.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: monthDate(15 - month, Math.floor(Math.random() * 10) + 5),
        amount: -randomBetween(pe.min, pe.max),
        currency: 'USD',
        description: pe.desc,
        vendor: pe.vendor,
        category: 'Tools & Software',
        department: pe.dept,
        project: pe.project,
        source: 'plaid',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched',
        metadata: {},
      })
    }
  }

  // --- KEY ONE-OFF EVENTS ---
  const keyEvents = [
    // Mar 2025 (month 2): Equipment purchase
    { month: 2, day: 20, amount: -15000, desc: 'Equipment Purchase - Laptops for new hires (x5)', vendor: 'Apple Store', category: 'Infrastructure', dept: 'Operations' },
    // Jun 2025 (month 5): Conference sponsorship
    { month: 5, day: 15, amount: -8000, desc: 'SaaStr Annual - Conference Sponsorship', vendor: 'SaaStr', category: 'Marketing', dept: 'Marketing' },
    // Sep 2025 (month 8): Fundraising legal fees
    { month: 8, day: 10, amount: -25000, desc: 'Wilson Sonsini - Fundraising Legal Fees (Series Seed)', vendor: 'Wilson Sonsini Goodrich & Rosati', category: 'Legal & Admin', dept: 'Admin' },
    // Oct 2025 (month 9): Seed funding received!
    { month: 9, day: 5, amount: 500000, desc: 'Seed Funding - Series Seed Investment', vendor: 'Sequoia Capital', category: 'Revenue', dept: 'Admin' },
    // Dec 2025 (month 11): Year-end bonus
    { month: 11, day: 22, amount: -30000, desc: 'Year-End Bonus Payroll - All Employees', vendor: 'Rippling', category: 'Payroll', dept: 'Operations' },
    // Feb 2026 (month 13): Office renovation
    { month: 13, day: 8, amount: -12000, desc: 'Office Renovation - WeWork Buildout', vendor: 'WeWork', category: 'Infrastructure', dept: 'Operations' },
  ]

  for (const event of keyEvents) {
    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: monthDate(15 - event.month, event.day),
      amount: event.amount,
      currency: 'USD',
      description: event.desc,
      vendor: event.vendor,
      category: event.category,
      department: event.dept,
      project: null,
      source: event.amount > 0 ? 'plaid' : 'manual',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
  }

  // --- Manual entries ---
  const manualEntries = [
    { desc: 'Team offsite dinner - Q4 planning', vendor: 'The Capital Grille', amount: -2340.50, category: 'Opex', dept: 'Operations', daysAgo: 12 },
    { desc: 'Equipment purchase - Standing desks (x4)', vendor: 'Herman Miller', amount: -5200.00, category: 'Infrastructure', dept: 'Operations', daysAgo: 25 },
    { desc: 'Training - AWS Certification Bootcamp', vendor: 'A Cloud Guru', amount: -890.00, category: 'Tools & Software', dept: 'Engineering', daysAgo: 40 },
    { desc: 'Client refund - IWAKI overcharge adjustment', vendor: 'IWAKI Corp', amount: -4500.00, category: 'Revenue', dept: 'Sales', daysAgo: 55 },
    { desc: 'Contractor payment - Design sprint', vendor: 'Sarah Chen Design', amount: -7500.00, category: 'Payroll', dept: 'Product', daysAgo: 20 },
    { desc: 'Contractor payment - Security audit', vendor: 'CrowdStrike', amount: -12000.00, category: 'Tools & Software', dept: 'Engineering', daysAgo: 35 },
  ]

  for (const entry of manualEntries) {
    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: specificDate(entry.daysAgo),
      amount: entry.amount,
      currency: 'USD',
      description: entry.desc,
      vendor: entry.vendor,
      category: entry.category,
      department: entry.dept,
      project: null,
      source: 'manual',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: {},
    })
  }

  // --- Agent-specific expenses ---
  const agentExpenses = [
    { agent: 'Oslo Ramirez', desc: 'Oslo Ramirez - AWS Training Certification', amount: -1200, vendor: 'AWS Training', category: 'Tools & Software', dept: 'Engineering', project: 'LNER' as string | null, daysAgo: 15 },
    { agent: 'Oslo Ramirez', desc: 'Oslo Ramirez - Mechanical Keyboard', amount: -350, vendor: 'Keychron', category: 'Infrastructure', dept: 'Engineering', project: null as string | null, daysAgo: 45 },
    { agent: 'Emma Chen', desc: 'Emma Chen - UX Conference Registration', amount: -850, vendor: 'UX Conference', category: 'Marketing', dept: 'Product', project: null as string | null, daysAgo: 22 },
    { agent: 'Emma Chen', desc: 'Emma Chen - Figma Plugins Bundle', amount: -199, vendor: 'Figma Marketplace', category: 'Tools & Software', dept: 'Product', project: 'Brookfield' as string | null, daysAgo: 8 },
    { agent: 'Rafa Santos', desc: 'Rafa Santos - GPU Cloud Credits', amount: -2400, vendor: 'Lambda Labs', category: 'Tools & Software', dept: 'Engineering', project: 'PWC' as string | null, daysAgo: 18 },
    { agent: 'Rafa Santos', desc: 'Rafa Santos - ML Conference Travel', amount: -1800, vendor: 'NeurIPS', category: 'Opex', dept: 'Engineering', project: null as string | null, daysAgo: 50 },
    { agent: 'Yuki Tanaka', desc: 'Yuki Tanaka - Monitor Purchase', amount: -900, vendor: 'Apple Store', category: 'Infrastructure', dept: 'Engineering', project: null as string | null, daysAgo: 30 },
    { agent: 'Maya Patel', desc: 'Maya Patel - DataCamp Subscription', amount: -399, vendor: 'DataCamp', category: 'Tools & Software', dept: 'Engineering', project: 'IWAKI' as string | null, daysAgo: 10 },
    { agent: 'Maya Patel', desc: 'Maya Patel - Statistics Textbooks', amount: -275, vendor: 'Amazon', category: 'Tools & Software', dept: 'Engineering', project: null as string | null, daysAgo: 60 },
    { agent: 'James O\'Brien', desc: 'James O\'Brien - HubSpot Certification', amount: -500, vendor: 'HubSpot Academy', category: 'Marketing', dept: 'Marketing', project: null as string | null, daysAgo: 35 },
    { agent: 'Sofia Martinez', desc: 'Sofia Martinez - Client Dinner', amount: -680, vendor: 'Nobu Restaurant', category: 'Opex', dept: 'Sales', project: 'LNER' as string | null, daysAgo: 14 },
    { agent: 'Sofia Martinez', desc: 'Sofia Martinez - Salesforce Training', amount: -450, vendor: 'Salesforce', category: 'Tools & Software', dept: 'Sales', project: null as string | null, daysAgo: 42 },
    { agent: 'Alex Kim', desc: 'Alex Kim - DevOps Conference', amount: -1100, vendor: 'KubeCon', category: 'Opex', dept: 'Engineering', project: null as string | null, daysAgo: 28 },
    { agent: 'Alex Kim', desc: 'Alex Kim - Terraform Certification', amount: -350, vendor: 'HashiCorp', category: 'Tools & Software', dept: 'Engineering', project: 'PWC' as string | null, daysAgo: 55 },
    { agent: 'Priya Sharma', desc: 'Priya Sharma - Adobe Creative Cloud', amount: -660, vendor: 'Adobe', category: 'Tools & Software', dept: 'Product', project: 'PWC' as string | null, daysAgo: 5 },
    { agent: 'Tom Wilson', desc: 'Tom Wilson - Penetration Testing Tools', amount: -3500, vendor: 'Offensive Security', category: 'Tools & Software', dept: 'Engineering', project: 'LNER' as string | null, daysAgo: 20 },
    { agent: 'Tom Wilson', desc: 'Tom Wilson - Security Conference Badge', amount: -2200, vendor: 'Black Hat', category: 'Opex', dept: 'Engineering', project: null as string | null, daysAgo: 38 },
    { agent: 'Li Wei', desc: 'Li Wei - Python Course', amount: -199, vendor: 'Coursera', category: 'Tools & Software', dept: 'Engineering', project: 'IWAKI' as string | null, daysAgo: 12 },
    { agent: 'Nour El-Amin', desc: 'Nour El-Amin - Office Supplies Order', amount: -420, vendor: 'Staples', category: 'Infrastructure', dept: 'Operations', project: null as string | null, daysAgo: 25 },
  ]

  for (const exp of agentExpenses) {
    transactions.push({
      org_id: orgId,
      bank_account_id: checkingId,
      date: specificDate(exp.daysAgo),
      amount: exp.amount,
      currency: 'USD',
      description: exp.desc,
      vendor: exp.vendor,
      category: exp.category,
      department: exp.dept,
      project: exp.project,
      source: 'manual',
      is_duplicate: false,
      is_transfer: false,
      categorization_status: 'rule_matched',
      metadata: { agent: exp.agent },
    })
  }

  // --- AI Agent Costs (real AI agents deployed on projects) ---
  // Costs grow over 16 months as agents mature and usage scales
  const aiAgents = [
    // LNER agents (from month 0)
    { name: 'Delay-Repay', project: 'LNER', status: 'active', desc: 'Delay-Repay - LLM inference + claim processing', vendor: 'Anthropic', startMonth: 0, baseCost: 3000, growthRate: 300 },
    { name: 'TIVA', project: 'LNER', status: 'active', desc: 'TIVA - Ticket validation agent API costs', vendor: 'OpenAI', startMonth: 0, baseCost: 1800, growthRate: 160 },
    { name: 'AVID', project: 'LNER', status: 'active', desc: 'AVID - Audio/visual inspection agent compute', vendor: 'AWS SageMaker', startMonth: 2, baseCost: 2500, growthRate: 200 },
    { name: 'SAM', project: 'LNER', status: 'development', desc: 'SAM - Station assistant model training', vendor: 'Lambda Labs', startMonth: 6, baseCost: 2200, growthRate: 100 },
    { name: 'LUMA', project: 'LNER', status: 'development', desc: 'LUMA - Journey analytics agent', vendor: 'Anthropic', startMonth: 9, baseCost: 1500, growthRate: 100 },
    // Brookfield agents (from month 9)
    { name: 'OSLO', project: 'Brookfield', status: 'active', desc: 'OSLO - Property intelligence agent API costs', vendor: 'Anthropic', startMonth: 9, baseCost: 3500, growthRate: 500 },
    { name: 'EMMA', project: 'Brookfield', status: 'active', desc: 'EMMA - Environmental monitoring agent compute', vendor: 'AWS', startMonth: 9, baseCost: 2200, growthRate: 250 },
    // PWC agents (from month 3)
    { name: 'Tax Data', project: 'PWC', status: 'active', desc: 'Tax Data - Tax document extraction + analysis', vendor: 'OpenAI', startMonth: 3, baseCost: 2800, growthRate: 250 },
    // Internal agents
    { name: 'Agent Portal', project: 'Internal', status: 'active', desc: 'Agent Portal - Internal agent management platform', vendor: 'Vercel', startMonth: 3, baseCost: 800, growthRate: 60 },
    { name: 'Amp-Extract', project: 'Internal', status: 'active', desc: 'Amp-Extract - Document extraction service', vendor: 'Anthropic', startMonth: 6, baseCost: 1500, growthRate: 200 },
    { name: 'Amp-Explore', project: 'Internal', status: 'development', desc: 'Amp-Explore - Knowledge discovery agent', vendor: 'OpenAI', startMonth: 9, baseCost: 1800, growthRate: 130 },
  ]

  for (const agent of aiAgents) {
    for (let month = agent.startMonth; month < 16; month++) {
      const monthsSinceStart = month - agent.startMonth
      const cost = agent.baseCost + agent.growthRate * monthsSinceStart + randomBetween(-200, 200)
      transactions.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: monthDate(15 - month, Math.floor(Math.random() * 5) + 2),
        amount: -Math.max(cost, agent.baseCost * 0.8), // floor at 80% of base
        currency: 'USD',
        description: agent.desc,
        vendor: agent.vendor,
        category: 'Tools & Software',
        department: 'Engineering',
        project: agent.project,
        source: 'plaid',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched',
        metadata: { ai_agent: agent.name, agent_status: agent.status },
      })
    }
  }

  // --- Savings transfer ---
  for (let month = 0; month < 16; month++) {
    transactions.push({
      org_id: orgId,
      bank_account_id: savingsId,
      date: monthDate(15 - month, 25),
      amount: -randomBetween(10000, 25000),
      currency: 'USD',
      description: 'Transfer to Business Checking',
      vendor: 'Bank of America',
      category: 'Uncategorized',
      department: 'Admin',
      project: null,
      source: 'plaid',
      is_duplicate: false,
      is_transfer: true,
      categorization_status: 'rule_matched',
      metadata: {},
    })
  }

  // Insert all transactions (batch if large)
  const BATCH_SIZE = 200
  if (transactions.length <= BATCH_SIZE) {
    const { error: insertError } = await service
      .from('transactions')
      .insert(transactions)

    if (insertError) {
      console.error('Seed error:', insertError)
      return NextResponse.json(
        { error: 'Failed to seed transactions', details: insertError.message },
        { status: 500 }
      )
    }
  } else {
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await service
        .from('transactions')
        .insert(batch)

      if (insertError) {
        console.error(`Seed error (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, insertError)
        return NextResponse.json(
          { error: 'Failed to seed transactions', details: insertError.message },
          { status: 500 }
        )
      }
    }
  }

  // --- Seed QBO mirror transactions + reconciliation matches ---
  // Create QBO duplicates for most transactions so the reconciliation tab has real data
  try {
    await service.from('reconciliation_matches').delete().eq('org_id', orgId)

    // Fetch all recently inserted plaid transactions (last 3 months for reconciliation)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0]

    const { data: plaidTxs } = await service
      .from('transactions')
      .select('id, date, amount, vendor, description, category, department, project, currency, bank_account_id')
      .eq('org_id', orgId)
      .in('source', ['plaid', 'rippling'])
      .eq('is_duplicate', false)
      .eq('is_transfer', false)
      .gte('date', threeMonthsAgoStr)
      .order('date', { ascending: false })

    if (plaidTxs && plaidTxs.length > 0) {
      // Create QBO mirrors for ~90% of transactions (leave some unmatched on bank side)
      const qboMirrors: typeof transactions = []
      // Skip first 5 = unmatched bank (no QBO mirror at all)
      // Next 8 = suggested matches (QBO mirror created but NOT pre-matched — algorithm will suggest them)
      // Rest = auto-matched (QBO mirror + reconciliation_match record)
      const unmatchedBankOnly = plaidTxs.slice(0, 5)
      const suggestedPool = plaidTxs.slice(5, 13) // 8 transactions for the algorithm to find
      const toMatch = plaidTxs.slice(13) // rest get auto-matched
      const unmatchedQboOnly: typeof transactions = []

      // Create QBO mirrors for suggested pool (these will NOT be pre-matched)
      for (const tx of suggestedPool) {
        const dateObj = new Date(tx.date)
        dateObj.setDate(dateObj.getDate() + (Math.random() > 0.5 ? 1 : 3)) // slightly wider offset for suggested
        const qboDate = dateObj.toISOString().split('T')[0]

        qboMirrors.push({
          org_id: orgId,
          bank_account_id: tx.bank_account_id,
          date: qboDate,
          amount: tx.amount,
          currency: tx.currency ?? 'USD',
          description: tx.description ?? '',
          vendor: tx.vendor ?? '',
          category: tx.category ?? 'Uncategorized',
          department: tx.department ?? '',
          project: tx.project,
          source: 'qbo',
          is_duplicate: false,
          is_transfer: false,
          categorization_status: 'rule_matched' as const,
          metadata: {},
        })
      }

      // Create QBO mirrors for auto-matched transactions
      for (const tx of toMatch) {
        // QBO records same transaction 1-2 days later
        const dateObj = new Date(tx.date)
        dateObj.setDate(dateObj.getDate() + (Math.random() > 0.5 ? 1 : 2))
        const qboDate = dateObj.toISOString().split('T')[0]

        qboMirrors.push({
          org_id: orgId,
          bank_account_id: tx.bank_account_id,
          date: qboDate,
          amount: tx.amount,
          currency: tx.currency ?? 'USD',
          description: tx.description ?? '',
          vendor: tx.vendor ?? '',
          category: tx.category ?? 'Uncategorized',
          department: tx.department ?? '',
          project: tx.project,
          source: 'qbo',
          is_duplicate: false,
          is_transfer: false,
          categorization_status: 'rule_matched' as const,
          metadata: {},
        })
      }

      // Add a few QBO-only entries (recorded in books but not yet in bank — pending payments)
      unmatchedQboOnly.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: specificDate(2),
        amount: -3200,
        currency: 'USD',
        description: 'Annual Security Audit - Pending Wire',
        vendor: 'CrowdStrike',
        category: 'Tools & Software',
        department: 'Engineering',
        project: null,
        source: 'qbo',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched' as const,
        metadata: {},
      })
      unmatchedQboOnly.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: specificDate(1),
        amount: -1800,
        currency: 'USD',
        description: 'Q2 Insurance Premium - Pending ACH',
        vendor: 'Hartford Insurance',
        category: 'Legal & Admin',
        department: 'Admin',
        project: null,
        source: 'qbo',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched' as const,
        metadata: {},
      })
      unmatchedQboOnly.push({
        org_id: orgId,
        bank_account_id: checkingId,
        date: specificDate(3),
        amount: -4500,
        currency: 'USD',
        description: 'Office Equipment Order - Pending Shipment',
        vendor: 'CDW Corporation',
        category: 'Infrastructure',
        department: 'Operations',
        project: null,
        source: 'qbo',
        is_duplicate: false,
        is_transfer: false,
        categorization_status: 'rule_matched' as const,
        metadata: {},
      })

      // Insert QBO mirrors
      const allQbo = [...qboMirrors, ...unmatchedQboOnly]
      for (let i = 0; i < allQbo.length; i += BATCH_SIZE) {
        await service.from('transactions').insert(allQbo.slice(i, i + BATCH_SIZE))
      }

      // Now fetch the QBO transactions back to get their IDs for reconciliation_matches
      const { data: insertedQbo } = await service
        .from('transactions')
        .select('id, date, amount, vendor')
        .eq('org_id', orgId)
        .eq('source', 'qbo')
        .eq('is_duplicate', false)
        .gte('date', threeMonthsAgoStr)
        .order('date', { ascending: false })

      // Auto-match: pair plaid tx with qbo tx by amount + closest date
      if (insertedQbo && insertedQbo.length > 0) {
        const matchInserts: Array<Record<string, unknown>> = []
        const usedQboIds = new Set<string>()

        for (const plaidTx of toMatch) {
          // Find best QBO match (same amount, closest date)
          let bestMatch: typeof insertedQbo[0] | null = null
          let bestDaysDiff = 999

          for (const qboTx of insertedQbo) {
            if (usedQboIds.has(qboTx.id)) continue
            if (Math.abs(plaidTx.amount - qboTx.amount) > 0.01) continue

            const daysDiff = Math.abs(
              (new Date(plaidTx.date).getTime() - new Date(qboTx.date).getTime()) / (1000 * 60 * 60 * 24)
            )
            if (daysDiff <= 5 && daysDiff < bestDaysDiff) {
              bestMatch = qboTx
              bestDaysDiff = daysDiff
            }
          }

          if (bestMatch) {
            usedQboIds.add(bestMatch.id)
            matchInserts.push({
              org_id: orgId,
              bank_tx_id: plaidTx.id,
              accounting_tx_id: bestMatch.id,
              match_type: 'auto',
              match_confidence: bestDaysDiff <= 1 ? 0.95 : bestDaysDiff <= 2 ? 0.85 : 0.75,
              status: 'matched',
            })
          }
        }

        // Insert reconciliation matches
        if (matchInserts.length > 0) {
          for (let i = 0; i < matchInserts.length; i += BATCH_SIZE) {
            await service.from('reconciliation_matches').insert(matchInserts.slice(i, i + BATCH_SIZE) as any)
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to seed reconciliation data:', e)
  }

  // --- Seed employees / payroll allocations ---
  await service.from('payroll_allocations').delete().eq('org_id', orgId)

  const today = new Date().toISOString().split('T')[0]
  const employees = [
    { employee_id: 'emp-001', employee_name: 'Oslo Ramirez', employment_type: 'full_time' as const, annual_salary: 185000, hours_per_week: 55, department: 'Engineering', project_allocations: { LNER: 40, PWC: 30, IWAKI: 30 }, ai_agents: ['Delay-Repay', 'TIVA', 'Tax Data'] },
    { employee_id: 'emp-002', employee_name: 'Emma Chen', employment_type: 'full_time' as const, annual_salary: 165000, hours_per_week: 45, department: 'Product', project_allocations: { LNER: 50, Brookfield: 50 }, ai_agents: ['AVID', 'OSLO', 'EMMA'] },
    { employee_id: 'emp-003', employee_name: 'Rafa Santos', employment_type: 'full_time' as const, annual_salary: 155000, hours_per_week: 50, department: 'Engineering', project_allocations: { PWC: 60, IWAKI: 40 }, ai_agents: ['Tax Data', 'Amp-Extract'] },
    { employee_id: 'emp-004', employee_name: 'Yuki Tanaka', employment_type: 'full_time' as const, annual_salary: 140000, hours_per_week: 42, department: 'Engineering', project_allocations: { LNER: 30, PWC: 30, Brookfield: 40 }, ai_agents: ['SAM', 'LUMA', 'EMMA'] },
    { employee_id: 'emp-005', employee_name: 'Maya Patel', employment_type: 'full_time' as const, annual_salary: 150000, hours_per_week: 48, department: 'Engineering', project_allocations: { IWAKI: 70, Brookfield: 30 }, ai_agents: ['OSLO'] },
    { employee_id: 'emp-006', employee_name: 'James O\'Brien', employment_type: 'full_time' as const, annual_salary: 130000, hours_per_week: 40, department: 'Marketing', project_allocations: {}, ai_agents: [] },
    { employee_id: 'emp-007', employee_name: 'Sofia Martinez', employment_type: 'full_time' as const, annual_salary: 145000, hours_per_week: 50, department: 'Sales', project_allocations: { LNER: 25, PWC: 25, IWAKI: 25, Brookfield: 25 }, ai_agents: ['Delay-Repay'] },
    { employee_id: 'emp-008', employee_name: 'Alex Kim', employment_type: 'full_time' as const, annual_salary: 148000, hours_per_week: 55, department: 'Engineering', project_allocations: { LNER: 30, PWC: 30, IWAKI: 20, Brookfield: 20 }, ai_agents: ['AVID', 'Tax Data', 'Agent Portal'] },
    { employee_id: 'emp-009', employee_name: 'Priya Sharma', employment_type: 'full_time' as const, annual_salary: 135000, hours_per_week: 40, department: 'Product', project_allocations: { PWC: 50, Brookfield: 50 }, ai_agents: ['OSLO', 'EMMA'] },
    { employee_id: 'emp-010', employee_name: 'Tom Wilson', employment_type: 'contractor' as const, annual_salary: 180000, hours_per_week: 35, department: 'Engineering', project_allocations: { LNER: 100 }, ai_agents: ['Delay-Repay', 'TIVA', 'AVID', 'SAM', 'LUMA'] },
    { employee_id: 'emp-011', employee_name: 'Li Wei', employment_type: 'intern' as const, annual_salary: null, hourly_rate: 32, hours_per_week: 25, department: 'Engineering', project_allocations: { IWAKI: 100 }, ai_agents: [] },
    { employee_id: 'emp-012', employee_name: 'Nour El-Amin', employment_type: 'full_time' as const, annual_salary: 125000, hours_per_week: 40, department: 'Operations', project_allocations: {}, ai_agents: ['Agent Portal'] },
    { employee_id: 'emp-013', employee_name: 'Frank Guo', employment_type: 'intern' as const, annual_salary: null, hourly_rate: 100, hours_per_week: 60, department: 'Engineering', project_allocations: { Brookfield: 50, Internal: 50 }, ai_agents: ['OSLO', 'EMMA', 'Agent Portal', 'Amp-Extract', 'Amp-Explore'] },
  ]

  // Historical payroll records showing team growth
  // Each record has an effective_date and optional end_date
  const payrollRows: Array<any> = []

  // Jan 2025: Original 5 employees (Oslo, Emma, Rafa, Nour, Sofia)
  const jan2025 = monthDate(15, 1) // 15 months ago = Jan 2025
  const apr2025 = monthDate(12, 1)
  const jul2025 = monthDate(9, 1)
  const oct2025 = monthDate(6, 1)
  const jan2026 = monthDate(3, 1)
  const mar2026 = monthDate(1, 1)

  // Original team - Jan 2025
  const originalTeam = [
    { employee_id: 'emp-001', employee_name: 'Oslo Ramirez', employment_type: 'full_time' as const, annual_salary: 175000, hourly_rate: null, hours_per_week: 50, department: 'Engineering', project_allocations: { LNER: 100 }, ai_agents: ['Delay-Repay'], effective_date: jan2025 },
    { employee_id: 'emp-002', employee_name: 'Emma Chen', employment_type: 'full_time' as const, annual_salary: 155000, hourly_rate: null, hours_per_week: 45, department: 'Product', project_allocations: { LNER: 100 }, ai_agents: ['AVID'], effective_date: jan2025 },
    { employee_id: 'emp-003', employee_name: 'Rafa Santos', employment_type: 'full_time' as const, annual_salary: 145000, hourly_rate: null, hours_per_week: 45, department: 'Engineering', project_allocations: { LNER: 100 }, ai_agents: [], effective_date: jan2025 },
    { employee_id: 'emp-012', employee_name: 'Nour El-Amin', employment_type: 'full_time' as const, annual_salary: 115000, hourly_rate: null, hours_per_week: 40, department: 'Operations', project_allocations: {}, ai_agents: [], effective_date: jan2025 },
    { employee_id: 'emp-007', employee_name: 'Sofia Martinez', employment_type: 'full_time' as const, annual_salary: 135000, hourly_rate: null, hours_per_week: 45, department: 'Sales', project_allocations: { LNER: 100 }, ai_agents: [], effective_date: jan2025 },
  ]

  for (const emp of originalTeam) {
    payrollRows.push({
      org_id: orgId,
      employee_id: emp.employee_id,
      employee_name: emp.employee_name,
      employment_type: emp.employment_type,
      annual_salary: emp.annual_salary,
      hourly_rate: emp.hourly_rate,
      hours_per_week: emp.hours_per_week,
      department: emp.department,
      project_allocations: emp.project_allocations,
      ai_agents: emp.ai_agents,
      effective_date: emp.effective_date,
      end_date: apr2025, // superseded by next record
    })
  }

  // Apr 2025: +Yuki, +Maya (7 employees), existing team gets updated allocations
  const apr2025Team = [
    { employee_id: 'emp-001', employee_name: 'Oslo Ramirez', employment_type: 'full_time' as const, annual_salary: 180000, hourly_rate: null, hours_per_week: 52, department: 'Engineering', project_allocations: { LNER: 60, PWC: 40 }, ai_agents: ['Delay-Repay', 'TIVA'], effective_date: apr2025 },
    { employee_id: 'emp-002', employee_name: 'Emma Chen', employment_type: 'full_time' as const, annual_salary: 160000, hourly_rate: null, hours_per_week: 45, department: 'Product', project_allocations: { LNER: 70, PWC: 30 }, ai_agents: ['AVID'], effective_date: apr2025 },
    { employee_id: 'emp-003', employee_name: 'Rafa Santos', employment_type: 'full_time' as const, annual_salary: 150000, hourly_rate: null, hours_per_week: 48, department: 'Engineering', project_allocations: { PWC: 70, LNER: 30 }, ai_agents: ['Tax Data'], effective_date: apr2025 },
    { employee_id: 'emp-012', employee_name: 'Nour El-Amin', employment_type: 'full_time' as const, annual_salary: 120000, hourly_rate: null, hours_per_week: 40, department: 'Operations', project_allocations: {}, ai_agents: [], effective_date: apr2025 },
    { employee_id: 'emp-007', employee_name: 'Sofia Martinez', employment_type: 'full_time' as const, annual_salary: 140000, hourly_rate: null, hours_per_week: 48, department: 'Sales', project_allocations: { LNER: 50, PWC: 50 }, ai_agents: ['Delay-Repay'], effective_date: apr2025 },
    // New hires
    { employee_id: 'emp-004', employee_name: 'Yuki Tanaka', employment_type: 'full_time' as const, annual_salary: 135000, hourly_rate: null, hours_per_week: 42, department: 'Engineering', project_allocations: { LNER: 50, PWC: 50 }, ai_agents: [], effective_date: apr2025 },
    { employee_id: 'emp-005', employee_name: 'Maya Patel', employment_type: 'full_time' as const, annual_salary: 145000, hourly_rate: null, hours_per_week: 45, department: 'Engineering', project_allocations: { PWC: 100 }, ai_agents: [], effective_date: apr2025 },
  ]

  for (const emp of apr2025Team) {
    payrollRows.push({
      org_id: orgId,
      employee_id: emp.employee_id,
      employee_name: emp.employee_name,
      employment_type: emp.employment_type,
      annual_salary: emp.annual_salary,
      hourly_rate: emp.hourly_rate,
      hours_per_week: emp.hours_per_week,
      department: emp.department,
      project_allocations: emp.project_allocations,
      ai_agents: emp.ai_agents,
      effective_date: emp.effective_date,
      end_date: jul2025,
    })
  }

  // Jul 2025: +Alex, +Priya (9 employees)
  const jul2025Team = [
    { employee_id: 'emp-008', employee_name: 'Alex Kim', employment_type: 'full_time' as const, annual_salary: 142000, hourly_rate: null, hours_per_week: 50, department: 'Engineering', project_allocations: { LNER: 40, PWC: 30, IWAKI: 30 }, ai_agents: ['Agent Portal'], effective_date: jul2025 },
    { employee_id: 'emp-009', employee_name: 'Priya Sharma', employment_type: 'full_time' as const, annual_salary: 130000, hourly_rate: null, hours_per_week: 40, department: 'Product', project_allocations: { PWC: 60, IWAKI: 40 }, ai_agents: [], effective_date: jul2025 },
  ]

  for (const emp of jul2025Team) {
    payrollRows.push({
      org_id: orgId,
      employee_id: emp.employee_id,
      employee_name: emp.employee_name,
      employment_type: emp.employment_type,
      annual_salary: emp.annual_salary,
      hourly_rate: emp.hourly_rate,
      hours_per_week: emp.hours_per_week,
      department: emp.department,
      project_allocations: emp.project_allocations,
      ai_agents: emp.ai_agents,
      effective_date: emp.effective_date,
      end_date: oct2025,
    })
  }

  // Oct 2025: +James (10 employees)
  const oct2025Hires = [
    { employee_id: 'emp-006', employee_name: 'James O\'Brien', employment_type: 'full_time' as const, annual_salary: 125000, hourly_rate: null, hours_per_week: 40, department: 'Marketing', project_allocations: {}, ai_agents: [], effective_date: oct2025 },
  ]

  for (const emp of oct2025Hires) {
    payrollRows.push({
      org_id: orgId,
      employee_id: emp.employee_id,
      employee_name: emp.employee_name,
      employment_type: emp.employment_type,
      annual_salary: emp.annual_salary,
      hourly_rate: emp.hourly_rate,
      hours_per_week: emp.hours_per_week,
      department: emp.department,
      project_allocations: emp.project_allocations,
      ai_agents: emp.ai_agents,
      effective_date: emp.effective_date,
      end_date: jan2026,
    })
  }

  // Jan 2026: +Tom Wilson as contractor (11 people)
  const jan2026Hires = [
    { employee_id: 'emp-010', employee_name: 'Tom Wilson', employment_type: 'contractor' as const, annual_salary: 180000, hourly_rate: null, hours_per_week: 35, department: 'Engineering', project_allocations: { LNER: 100 }, ai_agents: ['Delay-Repay', 'TIVA', 'AVID', 'SAM', 'LUMA'], effective_date: jan2026 },
  ]

  for (const emp of jan2026Hires) {
    payrollRows.push({
      org_id: orgId,
      employee_id: emp.employee_id,
      employee_name: emp.employee_name,
      employment_type: emp.employment_type,
      annual_salary: emp.annual_salary,
      hourly_rate: emp.hourly_rate,
      hours_per_week: emp.hours_per_week,
      department: emp.department,
      project_allocations: emp.project_allocations,
      ai_agents: emp.ai_agents,
      effective_date: emp.effective_date,
      end_date: mar2026,
    })
  }

  // Mar 2026: +Frank, +Li Wei as interns (13 people) — current state
  // Insert current state for ALL employees (no end_date)
  const currentPayroll = employees.map((emp: any) => ({
    org_id: orgId,
    employee_id: emp.employee_id,
    employee_name: emp.employee_name,
    employment_type: emp.employment_type,
    annual_salary: emp.annual_salary ?? (emp.hourly_rate ? emp.hourly_rate * (emp.hours_per_week ?? 40) * 52 : null),
    hourly_rate: emp.hourly_rate ?? null,
    hours_per_week: emp.hours_per_week ?? (emp.employment_type === 'intern' ? 25 : 40),
    department: emp.department,
    project_allocations: emp.project_allocations,
    ai_agents: emp.ai_agents ?? [],
    effective_date: mar2026,
    end_date: null,
  }))

  payrollRows.push(...currentPayroll)

  const { error: payrollError } = await service
    .from('payroll_allocations')
    .insert(payrollRows)

  if (payrollError) {
    console.error('Payroll seed error:', payrollError)
    return NextResponse.json(
      { error: 'Failed to seed payroll allocations', details: payrollError.message },
      { status: 500 }
    )
  }

  // --- Seed employees (org chart) ---
  // Wrapped in try/catch so seeding continues even if the employees table doesn't exist yet
  let employeesSeeded = 0
  try {
    // Clean up existing data that references employees (FK constraints)
    await service.from('review_goals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('performance_reviews').delete().eq('org_id', orgId)
    await service.from('review_cycles').delete().eq('org_id', orgId)
    await service.from('bonus_approvals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await service.from('bonuses').delete().eq('org_id', orgId)
    // Now safe to delete employees
    await service.from('employees').delete().eq('org_id', orgId)

    // Insert CEO first to get the ID for manager references
    const { data: ceoRow } = await service.from('employees').insert({
      org_id: orgId,
      name: 'Daniel Carter',
      title: 'CEO & Co-Founder',
      department: 'Executive',
      manager_id: null,
      email: 'daniel@ampliwork.com',
      status: 'active',
      start_date: '2023-01-15',
      salary: 185000,
    }).select('id').single()
    const ceoId = ceoRow?.id

    // VP / Director level (report to CEO)
    const { data: vpEngRow } = await service.from('employees').insert({
      org_id: orgId,
      name: 'Anika Patel',
      title: 'VP of Product',
      department: 'Product',
      manager_id: ceoId,
      email: 'anika@ampliwork.com',
      status: 'active',
      start_date: '2023-02-01',
      salary: 165000,
    }).select('id').single()
    const vpProductId = vpEngRow?.id

    const { data: engLeadRow } = await service.from('employees').insert({
      org_id: orgId,
      name: 'Rafa Santos',
      title: 'Head of Engineering',
      department: 'Engineering',
      manager_id: ceoId,
      email: 'rafa@ampliwork.com',
      status: 'active',
      start_date: '2023-03-01',
      salary: 155000,
    }).select('id').single()
    const engLeadId = engLeadRow?.id

    const { data: salesLeadRow } = await service.from('employees').insert({
      org_id: orgId,
      name: 'Sofia Martinez',
      title: 'Head of Sales',
      department: 'Sales',
      manager_id: ceoId,
      email: 'sofia@ampliwork.com',
      status: 'active',
      start_date: '2023-04-01',
      salary: 145000,
    }).select('id').single()
    const salesLeadId = salesLeadRow?.id

    const { data: opsLeadRow } = await service.from('employees').insert({
      org_id: orgId,
      name: 'Nour El-Amin',
      title: 'Head of Operations',
      department: 'Operations',
      manager_id: ceoId,
      email: 'nour@ampliwork.com',
      status: 'active',
      start_date: '2023-05-01',
      salary: 125000,
    }).select('id').single()
    const opsLeadId = opsLeadRow?.id

    // Engineers (report to Head of Engineering)
    const { data: seniorEng1Row } = await service.from('employees').insert({
      org_id: orgId,
      name: 'Yuki Tanaka',
      title: 'Senior Engineer',
      department: 'Engineering',
      manager_id: engLeadId,
      email: 'yuki@ampliwork.com',
      status: 'active',
      start_date: '2023-06-01',
      salary: 140000,
    }).select('id').single()
    const seniorEng1Id = seniorEng1Row?.id

    await service.from('employees').insert({
      org_id: orgId,
      name: 'Maya Patel',
      title: 'Senior Engineer',
      department: 'Engineering',
      manager_id: engLeadId,
      email: 'maya@ampliwork.com',
      status: 'active',
      start_date: '2023-07-01',
      salary: 150000,
    })

    await service.from('employees').insert({
      org_id: orgId,
      name: 'Alex Kim',
      title: 'Software Engineer',
      department: 'Engineering',
      manager_id: engLeadId,
      email: 'alex@ampliwork.com',
      status: 'active',
      start_date: '2024-01-15',
      salary: 148000,
    })

    await service.from('employees').insert({
      org_id: orgId,
      name: 'Tom Wilson',
      title: 'Contract Engineer',
      department: 'Engineering',
      manager_id: engLeadId,
      email: 'tom@ampliwork.com',
      status: 'active',
      start_date: '2024-06-01',
      salary: 180000,
    })

    // Interns (report to a senior engineer)
    await service.from('employees').insert({
      org_id: orgId,
      name: 'Frank Guo',
      title: 'Engineering Intern',
      department: 'Engineering',
      manager_id: seniorEng1Id,
      email: 'frank@ampliwork.com',
      status: 'active',
      start_date: '2026-03-01',
      salary: null,
    })

    await service.from('employees').insert({
      org_id: orgId,
      name: 'Li Wei',
      title: 'Engineering Intern',
      department: 'Engineering',
      manager_id: seniorEng1Id,
      email: 'li@ampliwork.com',
      status: 'active',
      start_date: '2026-02-01',
      salary: null,
    })

    // Product team (reports to VP Product)
    await service.from('employees').insert({
      org_id: orgId,
      name: 'Priya Sharma',
      title: 'Product Manager',
      department: 'Product',
      manager_id: vpProductId,
      email: 'priya@ampliwork.com',
      status: 'active',
      start_date: '2024-03-01',
      salary: 135000,
    })

    // Sales (reports to Head of Sales)
    await service.from('employees').insert({
      org_id: orgId,
      name: "James O'Brien",
      title: 'Marketing Lead',
      department: 'Marketing',
      manager_id: salesLeadId,
      email: 'james@ampliwork.com',
      status: 'active',
      start_date: '2024-04-01',
      salary: 130000,
    })

    employeesSeeded = 13
  } catch (e) {
    console.warn('Failed to seed employees (table may not exist yet):', e)
  }

  // --- Seed pending payments ---
  const pendingPayments: Array<{
    vendor: string
    description: string
    amount: number
    due_date: string
    priority: 'critical' | 'high' | 'normal' | 'low'
    status: 'pending' | 'overdue' | 'paid' | 'scheduled'
    category: string
  }> = [
    { vendor: 'Amazon Web Services', description: 'AWS March Invoice', amount: 4200, due_date: specificDate(-3), priority: 'critical', status: 'overdue', category: 'Tools & Software' },
    { vendor: 'WeWork', description: 'Office Space - April', amount: 8500, due_date: specificDate(-1), priority: 'high', status: 'overdue', category: 'Infrastructure' },
    { vendor: 'Wilson Sonsini', description: 'Legal Retainer - Q2', amount: 6000, due_date: specificDate(3), priority: 'high', status: 'pending', category: 'Legal & Admin' },
    { vendor: 'Vercel Inc', description: 'Vercel Pro - April', amount: 200, due_date: specificDate(5), priority: 'normal', status: 'pending', category: 'Tools & Software' },
    { vendor: 'GitHub Inc', description: 'GitHub Enterprise - April', amount: 400, due_date: specificDate(7), priority: 'normal', status: 'pending', category: 'Tools & Software' },
    { vendor: 'Datadog Inc', description: 'Infrastructure Monitoring', amount: 780, due_date: specificDate(10), priority: 'normal', status: 'pending', category: 'Tools & Software' },
    { vendor: 'HubSpot Inc', description: 'Marketing Hub - April', amount: 800, due_date: specificDate(12), priority: 'low', status: 'pending', category: 'Tools & Software' },
    { vendor: 'Figma Inc', description: 'Organization Plan - April', amount: 500, due_date: specificDate(15), priority: 'low', status: 'pending', category: 'Tools & Software' },
    { vendor: 'Slack Technologies', description: 'Business+ - April', amount: 800, due_date: specificDate(18), priority: 'low', status: 'pending', category: 'Tools & Software' },
    { vendor: '1Password', description: 'Business Plan - Q2', amount: 120, due_date: specificDate(25), priority: 'low', status: 'pending', category: 'Tools & Software' },
  ]

  let paymentsSeeded = 0
  try {
    const { error: paymentsError } = await service.from('pending_payments').insert(
      pendingPayments.map(p => ({ org_id: orgId, ...p }))
    )
    if (paymentsError) {
      console.error('Pending payments seed error:', paymentsError)
    } else {
      paymentsSeeded = pendingPayments.length
    }
  } catch (e) {
    console.warn('Failed to seed pending_payments (table may not exist yet):', e)
  }

  // --- Seed deals / receivables pipeline ---
  const deals: Array<{
    name: string
    company: string
    amount: number
    probability: number
    stage: 'pitched' | 'negotiating' | 'verbal' | 'closed_won' | 'closed_lost'
    expected_close_date: string
  }> = [
    { name: 'LNER Delay Repay Platform', company: 'LNER', amount: 450000, probability: 85, stage: 'verbal', expected_close_date: specificDate(14) },
    { name: 'PWC Tax Automation Suite', company: 'PricewaterhouseCoopers', amount: 320000, probability: 60, stage: 'negotiating', expected_close_date: specificDate(30) },
    { name: 'Brookfield Asset Analytics', company: 'Brookfield', amount: 280000, probability: 70, stage: 'negotiating', expected_close_date: specificDate(21) },
    { name: 'IWAKI Data Pipeline', company: 'IWAKI Corp', amount: 180000, probability: 40, stage: 'pitched', expected_close_date: specificDate(60) },
    { name: 'Barclays Compliance Tool', company: 'Barclays', amount: 520000, probability: 25, stage: 'pitched', expected_close_date: specificDate(90) },
    { name: 'Stripe Revenue Reconciliation', company: 'Stripe', amount: 150000, probability: 90, stage: 'verbal', expected_close_date: specificDate(7) },
    { name: 'Revolut FX Optimization', company: 'Revolut', amount: 200000, probability: 15, stage: 'pitched', expected_close_date: specificDate(120) },
    { name: 'NatWest Portfolio Tracker', company: 'NatWest', amount: 380000, probability: 50, stage: 'negotiating', expected_close_date: specificDate(45) },
  ]

  let dealsSeeded = 0
  try {
    const { error: dealsError } = await service.from('deals').insert(
      deals.map(d => ({ org_id: orgId, ...d }))
    )
    if (dealsError) {
      console.error('Deals seed error:', dealsError)
    } else {
      dealsSeeded = deals.length
    }
  } catch (e) {
    console.warn('Failed to seed deals (table may not exist yet):', e)
  }

  // --- Seed budgets (16 months with growing amounts) ---
  await service.from('budgets').delete().eq('org_id', orgId)

  const budgetRows: Array<{
    org_id: string
    category: string
    department: null
    project: null
    monthly_amount: number
    effective_month: string
  }> = []

  // Budget amounts grow over the 16 months to match expense growth
  for (let month = 0; month < 16; month++) {
    // Calculate the actual year/month for this month index
    // month 0 = Jan 2025, month 15 = Apr 2026
    const d = new Date()
    d.setMonth(d.getMonth() - (15 - month))
    d.setDate(1)
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    let payrollBudget: number, softwareBudget: number, marketingBudget: number, infraBudget: number, legalBudget: number
    if (month < 3) {
      // Jan-Mar 2025: small team
      payrollBudget = 75000; softwareBudget = 5000; marketingBudget = 3000; infraBudget = 6000; legalBudget = 3000
    } else if (month < 6) {
      // Apr-Jun 2025
      payrollBudget = 95000; softwareBudget = 7000; marketingBudget = 5000; infraBudget = 6500; legalBudget = 3000
    } else if (month < 9) {
      // Jul-Sep 2025
      payrollBudget = 115000; softwareBudget = 10000; marketingBudget = 7000; infraBudget = 7000; legalBudget = 3000
    } else if (month < 12) {
      // Oct-Dec 2025
      payrollBudget = 135000; softwareBudget = 12000; marketingBudget = 8000; infraBudget = 7500; legalBudget = 3500
    } else if (month < 15) {
      // Jan-Mar 2026
      payrollBudget = 150000; softwareBudget = 14000; marketingBudget = 9000; infraBudget = 9000; legalBudget = 3500
    } else {
      // Apr 2026
      payrollBudget = 160000; softwareBudget = 15000; marketingBudget = 10000; infraBudget = 9500; legalBudget = 3500
    }

    const budgetLines = [
      { category: 'Payroll', monthly_amount: payrollBudget },
      { category: 'Tools & Software', monthly_amount: softwareBudget },
      { category: 'Marketing', monthly_amount: marketingBudget },
      { category: 'Infrastructure', monthly_amount: infraBudget },
      { category: 'Legal & Admin', monthly_amount: legalBudget },
    ]

    for (const line of budgetLines) {
      budgetRows.push({
        org_id: orgId,
        category: line.category,
        department: null,
        project: null,
        monthly_amount: line.monthly_amount,
        effective_month: monthStr,
      })
    }
  }

  const { error: budgetError } = await service
    .from('budgets')
    .insert(budgetRows)

  if (budgetError) {
    console.error('Budget seed error:', budgetError)
    return NextResponse.json(
      { error: 'Failed to seed budgets', details: budgetError.message },
      { status: 500 }
    )
  }

  // --- Seed performance reviews & bonuses ---
  let reviewsSeeded = 0
  let bonusesSeeded = 0
  try {
    // Fetch all employees to get their IDs
    const { data: allEmps } = await service
      .from('employees')
      .select('id, name, title, department, salary, manager_id')
      .eq('org_id', orgId)
      .eq('status', 'active')

    if (allEmps && allEmps.length > 0) {
      const empByName = new Map(allEmps.map(e => [e.name, e]))

      // --- REVIEW CYCLE: H2 2025 (completed) ---
      const { data: h2Cycle } = await service.from('review_cycles').insert({
        org_id: orgId,
        name: 'H2 2025',
        period_start: '2025-07-01',
        period_end: '2025-12-31',
        self_review_deadline: '2026-01-10',
        manager_review_deadline: '2026-01-20',
        calibration_deadline: '2026-01-31',
        status: 'closed',
      }).select('id').single()

      // --- REVIEW CYCLE: H1 2026 (active) ---
      const { data: h1Cycle } = await service.from('review_cycles').insert({
        org_id: orgId,
        name: 'H1 2026',
        period_start: '2026-01-01',
        period_end: '2026-06-30',
        self_review_deadline: '2026-04-15',
        manager_review_deadline: '2026-04-30',
        calibration_deadline: '2026-05-15',
        status: 'active',
      }).select('id').single()

      if (h2Cycle && h1Cycle) {
        // --- H2 2025 reviews (all finalized/acknowledged) ---
        const h2Reviews: Array<Record<string, unknown>> = []

        const h2ReviewData: Array<{
          name: string; rating: number; selfRating: number; status: 'finalized' | 'acknowledged'
          strengths: string; improvement: string; devPlan: string; managerComment: string
        }> = [
          { name: 'Rafa Santos', rating: 5, selfRating: 4, status: 'acknowledged', strengths: 'Exceptional technical leadership. Drove LNER and PWC architecture to production. Mentors junior engineers effectively.', improvement: 'Could delegate more to avoid bottlenecks on critical path decisions.', devPlan: 'Prepare for VP Engineering track. Lead architecture guild.', managerComment: 'Outstanding half. Rafa is the backbone of our engineering org.' },
          { name: 'Anika Patel', rating: 4, selfRating: 4, status: 'acknowledged', strengths: 'Strong product vision. Shipped AVID and OSLO agents on time. Cross-functional collaboration is excellent.', improvement: 'Needs to push back on scope creep earlier in the cycle.', devPlan: 'Lead H1 2026 product strategy. Develop data-driven prioritization framework.', managerComment: 'Anika continues to grow into the VP role. Solid performance.' },
          { name: 'Yuki Tanaka', rating: 4, selfRating: 3, status: 'acknowledged', strengths: 'Reliable senior engineer. Delivered Brookfield integration ahead of schedule. Code quality is consistently high.', improvement: 'Should take more initiative on architectural decisions rather than waiting for direction.', devPlan: 'Own a major feature end-to-end in H1. Start mentoring interns.', managerComment: 'Yuki exceeded expectations this half, especially on Brookfield.' },
          { name: 'Maya Patel', rating: 4, selfRating: 4, status: 'finalized', strengths: 'Deep expertise in distributed systems. IWAKI performance improvements reduced latency by 40%.', improvement: 'Documentation could be more thorough for complex systems.', devPlan: 'Lead IWAKI v2 architecture. Write engineering blog posts.', managerComment: 'Maya is a force multiplier on the team.' },
          { name: 'Alex Kim', rating: 3, selfRating: 3, status: 'acknowledged', strengths: 'Good breadth across projects. Reliable on delivery commitments.', improvement: 'Needs to deepen expertise in one area rather than spreading thin across all projects.', devPlan: 'Choose primary project focus. Complete AWS solutions architect cert.', managerComment: 'Solid meets expectations. Alex has potential to exceed with more focus.' },
          { name: 'Sofia Martinez', rating: 4, selfRating: 5, status: 'acknowledged', strengths: 'Closed 3 major enterprise deals in H2. Pipeline building is exceptional.', improvement: 'Post-sale handoff documentation needs improvement for ops team.', devPlan: 'Develop partner channel strategy. Improve CRM discipline.', managerComment: 'Sofia overdelivered on revenue targets. Key contributor.' },
          { name: 'Nour El-Amin', rating: 3, selfRating: 3, status: 'acknowledged', strengths: 'Keeps operations running smoothly. Vendor management and cost optimization are strong.', improvement: 'Should automate more manual processes. Agent Portal adoption is low.', devPlan: 'Implement operations automation roadmap. Reduce manual process time by 30%.', managerComment: 'Nour is dependable and consistent. Good meets expectations.' },
          { name: "James O'Brien", rating: 3, selfRating: 4, status: 'finalized', strengths: 'Creative campaign ideas. Social media engagement up 65%.', improvement: 'Lead generation metrics need improvement. Need to tie marketing spend to pipeline more directly.', devPlan: 'Build attribution model. Launch 2 targeted ABM campaigns.', managerComment: 'James shows creativity but needs to connect efforts to revenue impact.' },
          { name: 'Priya Sharma', rating: 4, selfRating: 3, status: 'acknowledged', strengths: 'Excellent stakeholder management. PWC and Brookfield PMs love working with her. User research skills are strong.', improvement: 'Should develop more quantitative analysis skills for prioritization.', devPlan: 'Own PWC product roadmap. Take analytics course.', managerComment: 'Priya has grown significantly since joining. Exceeds expectations.' },
          { name: 'Tom Wilson', rating: 3, selfRating: 3, status: 'acknowledged', strengths: 'Rapid delivery velocity. Can context-switch across multiple agent codebases effectively.', improvement: 'Test coverage on delivered code is below team standards. Should write more tests.', devPlan: 'Improve test coverage to >80% on all assigned codebases. Consider full-time conversion.', managerComment: 'Tom delivers fast but quality needs attention. Meets expectations for a contractor.' },
        ]

        for (const rd of h2ReviewData) {
          const emp = empByName.get(rd.name)
          if (!emp) continue
          h2Reviews.push({
            org_id: orgId,
            cycle_id: h2Cycle.id,
            employee_id: emp.id,
            reviewer_id: emp.manager_id,
            status: rd.status,
            overall_rating: rd.rating,
            self_rating: rd.selfRating,
            strengths: rd.strengths,
            areas_for_improvement: rd.improvement,
            development_plan: rd.devPlan,
            manager_comments: rd.managerComment,
            finalized_at: '2026-02-01T00:00:00Z',
            acknowledged_at: rd.status === 'acknowledged' ? '2026-02-05T00:00:00Z' : null,
          })
        }

        if (h2Reviews.length > 0) {
          await service.from('performance_reviews').insert(h2Reviews as any)
          reviewsSeeded += h2Reviews.length
        }

        // --- H1 2026 reviews (in progress — various stages) ---
        const h1ReviewData: Array<{
          name: string; status: string; selfRating: number | null; overallRating: number | null
          strengths: string | null; improvement: string | null; managerComment: string | null
        }> = [
          { name: 'Rafa Santos', status: 'manager_review', selfRating: 4, overallRating: null, strengths: 'Continuing strong technical leadership. IWAKI v2 architecture is well-received.', improvement: 'Working on delegation — still sometimes a bottleneck.', managerComment: null },
          { name: 'Anika Patel', status: 'manager_review', selfRating: 4, overallRating: null, strengths: 'Product strategy for H1 is clear and well-communicated. Stakeholder alignment is strong.', improvement: 'Scope management still a challenge on LNER roadmap.', managerComment: null },
          { name: 'Yuki Tanaka', status: 'calibration', selfRating: 4, overallRating: 5, strengths: 'Took full ownership of EMMA agent. Mentoring interns has been excellent.', improvement: null, managerComment: 'Yuki has stepped up significantly. Recommend promotion consideration.' },
          { name: 'Maya Patel', status: 'self_review', selfRating: null, overallRating: null, strengths: null, improvement: null, managerComment: null },
          { name: 'Alex Kim', status: 'self_review', selfRating: null, overallRating: null, strengths: null, improvement: null, managerComment: null },
          { name: 'Sofia Martinez', status: 'manager_review', selfRating: 5, overallRating: null, strengths: 'Q1 revenue target exceeded by 20%. Partner channel strategy launched successfully.', improvement: 'CRM data quality still inconsistent.', managerComment: null },
          { name: 'Nour El-Amin', status: 'self_review', selfRating: 3, overallRating: null, strengths: 'Automated 3 manual processes. Vendor renegotiations saved $12K/yr.', improvement: null, managerComment: null },
          { name: "James O'Brien", status: 'not_started', selfRating: null, overallRating: null, strengths: null, improvement: null, managerComment: null },
          { name: 'Priya Sharma', status: 'manager_review', selfRating: 4, overallRating: null, strengths: 'PWC roadmap execution is on track. User research led to 2 major feature pivots that improved retention.', improvement: 'Should present more at all-hands to build visibility.', managerComment: null },
          { name: 'Tom Wilson', status: 'self_review', selfRating: null, overallRating: null, strengths: null, improvement: null, managerComment: null },
          { name: 'Frank Guo', status: 'self_review', selfRating: null, overallRating: null, strengths: null, improvement: null, managerComment: null },
          { name: 'Li Wei', status: 'self_review', selfRating: null, overallRating: null, strengths: null, improvement: null, managerComment: null },
        ]

        const h1Reviews: Array<Record<string, unknown>> = []
        for (const rd of h1ReviewData) {
          const emp = empByName.get(rd.name)
          if (!emp) continue
          h1Reviews.push({
            org_id: orgId,
            cycle_id: h1Cycle.id,
            employee_id: emp.id,
            reviewer_id: emp.manager_id,
            status: rd.status,
            overall_rating: rd.overallRating,
            self_rating: rd.selfRating,
            strengths: rd.strengths,
            areas_for_improvement: rd.improvement,
            manager_comments: rd.managerComment,
            employee_comments: null,
            development_plan: null,
          })
        }

        if (h1Reviews.length > 0) {
          await service.from('performance_reviews').insert(h1Reviews as any)
          reviewsSeeded += h1Reviews.length
        }
      }

      // --- BONUSES: Contractual / criteria-based ---
      const bonusData: Array<{
        employeeName: string; type: string; amount: number; status: string
        reason: string; pctSalary: number | null; perfRating: number | null
        effectiveDate: string; payoutDate: string | null; fiscalYear: number; fiscalQuarter: number
        approvedAt: string | null; paidAt: string | null
      }> = [
        // Annual performance bonuses tied to H2 2025 ratings
        {
          employeeName: 'Rafa Santos', type: 'annual_performance', amount: 23250, status: 'paid',
          reason: 'H2 2025 performance bonus. Criteria: rating >= 4 (achieved 5/5). Per employment contract: 15% of base salary at Outstanding rating. Led LNER + PWC architecture delivery.',
          pctSalary: 15, perfRating: 5, effectiveDate: '2026-01-01', payoutDate: '2026-02-15', fiscalYear: 2026, fiscalQuarter: 1, approvedAt: '2026-02-01T00:00:00Z', paidAt: '2026-02-15T00:00:00Z',
        },
        {
          employeeName: 'Sofia Martinez', type: 'annual_performance', amount: 18125, status: 'paid',
          reason: 'H2 2025 performance bonus. Criteria: rating >= 4 AND revenue target met (achieved both). Per contract: 12.5% of base at Exceeds. Closed 3 enterprise deals totaling $180K ARR.',
          pctSalary: 12.5, perfRating: 4, effectiveDate: '2026-01-01', payoutDate: '2026-02-15', fiscalYear: 2026, fiscalQuarter: 1, approvedAt: '2026-02-01T00:00:00Z', paidAt: '2026-02-15T00:00:00Z',
        },
        {
          employeeName: 'Yuki Tanaka', type: 'annual_performance', amount: 14000, status: 'paid',
          reason: 'H2 2025 performance bonus. Criteria: rating >= 3 (achieved 4/5). Per contract: 10% of base at Exceeds. Delivered Brookfield integration ahead of schedule.',
          pctSalary: 10, perfRating: 4, effectiveDate: '2026-01-01', payoutDate: '2026-02-15', fiscalYear: 2026, fiscalQuarter: 1, approvedAt: '2026-02-01T00:00:00Z', paidAt: '2026-02-15T00:00:00Z',
        },
        {
          employeeName: 'Anika Patel', type: 'annual_performance', amount: 16500, status: 'paid',
          reason: 'H2 2025 performance bonus. Criteria: rating >= 4 (achieved 4/5). Per contract: 10% of base at Exceeds. Shipped AVID and OSLO agents on schedule.',
          pctSalary: 10, perfRating: 4, effectiveDate: '2026-01-01', payoutDate: '2026-02-15', fiscalYear: 2026, fiscalQuarter: 1, approvedAt: '2026-02-01T00:00:00Z', paidAt: '2026-02-15T00:00:00Z',
        },
        {
          employeeName: 'Priya Sharma', type: 'annual_performance', amount: 13500, status: 'paid',
          reason: 'H2 2025 performance bonus. Criteria: rating >= 4 (achieved 4/5). Per contract: 10% of base at Exceeds. PWC stakeholder satisfaction score 9.2/10.',
          pctSalary: 10, perfRating: 4, effectiveDate: '2026-01-01', payoutDate: '2026-02-15', fiscalYear: 2026, fiscalQuarter: 1, approvedAt: '2026-02-01T00:00:00Z', paidAt: '2026-02-15T00:00:00Z',
        },

        // Retention bonuses — contractual, vesting conditions
        {
          employeeName: 'Rafa Santos', type: 'retention', amount: 30000, status: 'approved',
          reason: 'Retention bonus per 2025 retention agreement. Criteria: must remain employed through June 30, 2026. Vests on that date. Critical to IWAKI v2 delivery — losing Rafa would delay launch by 3+ months.',
          pctSalary: null, perfRating: null, effectiveDate: '2026-06-30', payoutDate: '2026-07-15', fiscalYear: 2026, fiscalQuarter: 3, approvedAt: '2025-12-15T00:00:00Z', paidAt: null,
        },
        {
          employeeName: 'Maya Patel', type: 'retention', amount: 22500, status: 'approved',
          reason: 'Retention bonus per counter-offer agreement (Dec 2025). Criteria: must remain employed through September 30, 2026 AND maintain performance rating >= 3. Received competing offer from Stripe.',
          pctSalary: 15, perfRating: null, effectiveDate: '2026-09-30', payoutDate: '2026-10-15', fiscalYear: 2026, fiscalQuarter: 4, approvedAt: '2025-12-20T00:00:00Z', paidAt: null,
        },

        // Project completion bonuses — tied to specific deliverables
        {
          employeeName: 'Yuki Tanaka', type: 'project_completion', amount: 8000, status: 'pending_approval',
          reason: 'EMMA agent launch bonus. Criteria: (1) EMMA agent deployed to production by April 30, 2026, (2) 95%+ uptime in first 30 days, (3) positive client feedback from at least 2 pilot customers. Currently on track — agent in staging.',
          pctSalary: null, perfRating: null, effectiveDate: '2026-05-31', payoutDate: null, fiscalYear: 2026, fiscalQuarter: 2, approvedAt: null, paidAt: null,
        },
        {
          employeeName: 'Alex Kim', type: 'project_completion', amount: 6000, status: 'pending_approval',
          reason: 'Agent Portal v2 launch bonus. Criteria: (1) v2 shipped with SSO integration by May 15, 2026, (2) zero P0 bugs in first 2 weeks, (3) successful migration of all existing portal users. In development — SSO integration 60% complete.',
          pctSalary: null, perfRating: null, effectiveDate: '2026-05-31', payoutDate: null, fiscalYear: 2026, fiscalQuarter: 2, approvedAt: null, paidAt: null,
        },

        // Tom Wilson contractor completion bonus
        {
          employeeName: 'Tom Wilson', type: 'project_completion', amount: 15000, status: 'approved',
          reason: 'Contract completion bonus per SOW amendment #3. Criteria: (1) all 5 agent codebases (Delay-Repay, TIVA, AVID, SAM, LUMA) transitioned to internal team with documentation, (2) test coverage >= 80% on each, (3) knowledge transfer sessions completed. Currently at 3/5 transitions done, test coverage averaging 72%.',
          pctSalary: null, perfRating: null, effectiveDate: '2026-06-30', payoutDate: '2026-07-15', fiscalYear: 2026, fiscalQuarter: 3, approvedAt: '2026-01-15T00:00:00Z', paidAt: null,
        },

        // Spot bonuses
        {
          employeeName: 'Nour El-Amin', type: 'spot', amount: 3000, status: 'paid',
          reason: 'Spot bonus for vendor renegotiation savings. Criteria: achieved >$10K annual savings through vendor renegotiations (achieved $12K). Per ops incentive program.',
          pctSalary: null, perfRating: null, effectiveDate: '2026-03-01', payoutDate: '2026-03-15', fiscalYear: 2026, fiscalQuarter: 1, approvedAt: '2026-03-01T00:00:00Z', paidAt: '2026-03-15T00:00:00Z',
        },
        {
          employeeName: 'Sofia Martinez', type: 'spot', amount: 5000, status: 'paid',
          reason: 'Spot bonus for Q1 2026 overachievement. Criteria: exceeded quarterly revenue target by 20%+ (achieved 22%). Per sales compensation plan accelerator clause.',
          pctSalary: null, perfRating: null, effectiveDate: '2026-03-31', payoutDate: '2026-04-01', fiscalYear: 2026, fiscalQuarter: 1, approvedAt: '2026-03-28T00:00:00Z', paidAt: '2026-04-01T00:00:00Z',
        },

        // H1 2026 performance bonuses — pending (cycle still active)
        {
          employeeName: 'Yuki Tanaka', type: 'annual_performance', amount: 17500, status: 'draft',
          reason: 'H1 2026 performance bonus (projected). Criteria: rating >= 4 required. Currently in calibration with proposed 5/5 rating. Per contract: 12.5% of base at Outstanding. Pending cycle finalization.',
          pctSalary: 12.5, perfRating: null, effectiveDate: '2026-07-01', payoutDate: null, fiscalYear: 2026, fiscalQuarter: 3, approvedAt: null, paidAt: null,
        },

        // Referral bonus
        {
          employeeName: 'Yuki Tanaka', type: 'referral', amount: 2500, status: 'scheduled',
          reason: 'Employee referral bonus for Li Wei hire. Criteria: referred candidate must pass 90-day probation (Li Wei started Feb 1, probation ends May 1, 2026). Scheduled for payout after probation clears.',
          pctSalary: null, perfRating: null, effectiveDate: '2026-05-01', payoutDate: '2026-05-15', fiscalYear: 2026, fiscalQuarter: 2, approvedAt: '2026-02-15T00:00:00Z', paidAt: null,
        },
      ]

      const bonusInserts: Array<Record<string, unknown>> = []
      for (const b of bonusData) {
        const emp = empByName.get(b.employeeName)
        if (!emp) continue
        bonusInserts.push({
          org_id: orgId,
          employee_id: emp.id,
          proposed_by: emp.manager_id,
          bonus_type: b.type,
          amount: b.amount,
          percentage_of_salary: b.pctSalary,
          base_salary_at_time: emp.salary ? Number(emp.salary) : null,
          performance_rating_at_time: b.perfRating,
          reason: b.reason,
          status: b.status,
          fiscal_year: b.fiscalYear,
          fiscal_quarter: b.fiscalQuarter,
          effective_date: b.effectiveDate,
          payout_date: b.payoutDate,
          approved_at: b.approvedAt,
          paid_at: b.paidAt,
        })
      }

      if (bonusInserts.length > 0) {
        await service.from('bonuses').insert(bonusInserts as any)
        bonusesSeeded = bonusInserts.length
      }
    }
  } catch (e) {
    console.warn('Failed to seed performance reviews / bonuses:', e)
  }

  return NextResponse.json({
    success: true,
    count: transactions.length,
    employees: employees.length,
    budgets: budgetRows.length,
    payments: paymentsSeeded,
    deals: dealsSeeded,
    orgChartEmployees: employeesSeeded,
    payrollRecords: payrollRows.length,
    reviewsSeeded,
    bonusesSeeded,
    message: `Seeded ${transactions.length} transactions, ${payrollRows.length} payroll records, ${employeesSeeded} org chart employees, ${paymentsSeeded} pending payments, ${dealsSeeded} deals, ${budgetRows.length} budget lines, ${reviewsSeeded} performance reviews, and ${bonusesSeeded} bonuses`,
  })
}
