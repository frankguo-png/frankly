const KNOWN_PROJECTS = ['LNER', 'PWC', 'IWAKI', 'Brookfield']

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  payroll: ['payroll', 'salary', 'wages', 'compensation', 'bonus', 'benefits'],
  software: ['software', 'saas', 'subscription', 'license', 'cloud', 'hosting', 'aws', 'azure', 'gcp'],
  marketing: ['marketing', 'advertising', 'ads', 'promotion', 'campaign', 'social media', 'seo'],
  travel: ['travel', 'airfare', 'flight', 'hotel', 'lodging', 'uber', 'lyft', 'taxi', 'mileage'],
  meals: ['meals', 'food', 'restaurant', 'catering', 'lunch', 'dinner', 'coffee'],
  office: ['office', 'supplies', 'furniture', 'equipment', 'rent', 'lease', 'utilities'],
  professional_services: ['consulting', 'legal', 'accounting', 'audit', 'advisory', 'professional'],
  insurance: ['insurance', 'liability', 'coverage', 'premium'],
  telecommunications: ['phone', 'internet', 'telecom', 'mobile', 'wireless'],
  training: ['training', 'education', 'conference', 'seminar', 'workshop', 'course'],
}

export function inferCategory(
  accountName: string,
  vendorName: string
): string | null {
  const searchText = `${accountName} ${vendorName}`.toLowerCase()

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return category
      }
    }
  }

  return null
}

function inferProject(customerName: string | undefined): string | null {
  if (!customerName) return null
  const upper = customerName.toUpperCase()
  for (const project of KNOWN_PROJECTS) {
    if (upper.includes(project.toUpperCase())) {
      return project
    }
  }
  return null
}

export function mapQboPurchase(purchase: any, orgId: string, entityId: string | null = null) {
  const accountName = purchase.AccountRef?.name || ''
  const vendorName = purchase.EntityRef?.name || 'Unknown'
  const description =
    purchase.Line?.[0]?.Description || purchase.PrivateNote || ''
  const departmentName =
    purchase.DepartmentRef?.name || purchase.ClassRef?.name || null
  const customerName = purchase.CustomerRef?.name || undefined

  return {
    org_id: orgId,
    entity_id: entityId,
    date: purchase.TxnDate,
    amount: -Math.abs(purchase.TotalAmt), // Expenses are negative in our schema
    currency: purchase.CurrencyRef?.value || 'USD',
    description,
    vendor: vendorName,
    category: inferCategory(accountName, vendorName),
    department: departmentName,
    project: inferProject(customerName),
    source: 'qbo' as const,
    source_transaction_id: `purchase_${purchase.Id}`,
    is_transfer: false,
    metadata: {
      qbo_type: 'Purchase',
      qbo_id: purchase.Id,
      account_ref: purchase.AccountRef,
      payment_type: purchase.PaymentType,
    },
  }
}

export function mapQboBill(bill: any, orgId: string, entityId: string | null = null) {
  const vendorName = bill.VendorRef?.name || 'Unknown'
  const description =
    bill.Line?.[0]?.Description || bill.PrivateNote || ''
  const accountName =
    bill.Line?.[0]?.AccountBasedExpenseLineDetail?.AccountRef?.name || ''
  const departmentName =
    bill.DepartmentRef?.name || bill.Line?.[0]?.AccountBasedExpenseLineDetail?.ClassRef?.name || null
  const customerName =
    bill.Line?.[0]?.AccountBasedExpenseLineDetail?.CustomerRef?.name || undefined

  return {
    org_id: orgId,
    entity_id: entityId,
    date: bill.TxnDate,
    amount: -Math.abs(bill.TotalAmt),
    currency: bill.CurrencyRef?.value || 'USD',
    description,
    vendor: vendorName,
    category: inferCategory(accountName, vendorName),
    department: departmentName,
    project: inferProject(customerName),
    source: 'qbo' as const,
    source_transaction_id: `bill_${bill.Id}`,
    is_transfer: false,
    metadata: {
      qbo_type: 'Bill',
      qbo_id: bill.Id,
      vendor_ref: bill.VendorRef,
    },
  }
}

export function mapQboDeposit(deposit: any, orgId: string, entityId: string | null = null) {
  const description =
    deposit.Line?.[0]?.Description || deposit.PrivateNote || ''
  const accountName = deposit.DepositToAccountRef?.name || ''
  const vendorName =
    deposit.Line?.[0]?.DepositLineDetail?.Entity?.name || 'Unknown'
  const departmentName =
    deposit.DepartmentRef?.name || deposit.ClassRef?.name || null
  const customerName =
    deposit.Line?.[0]?.DepositLineDetail?.Entity?.name || undefined

  return {
    org_id: orgId,
    entity_id: entityId,
    date: deposit.TxnDate,
    amount: Math.abs(deposit.TotalAmt), // Revenue is positive
    currency: deposit.CurrencyRef?.value || 'USD',
    description,
    vendor: vendorName,
    category: inferCategory(accountName, vendorName),
    department: departmentName,
    project: inferProject(customerName),
    source: 'qbo' as const,
    source_transaction_id: `deposit_${deposit.Id}`,
    is_transfer: false,
    metadata: {
      qbo_type: 'Deposit',
      qbo_id: deposit.Id,
      deposit_to_account: deposit.DepositToAccountRef,
    },
  }
}
