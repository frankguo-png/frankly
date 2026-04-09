/**
 * Basic reconciliation engine: matches bank (Plaid) transactions
 * to accounting (QBO) transactions by amount + date proximity.
 */

export interface TransactionRecord {
  id: string
  date: string
  amount: number
  vendor: string | null
  description: string | null
  category: string | null
  source: string
}

export interface MatchCandidate {
  bankTx: TransactionRecord
  accountingTx: TransactionRecord
  confidence: number
}

export interface ReconciliationResult {
  matches: MatchCandidate[]
  unmatchedBank: TransactionRecord[]
  unmatchedAccounting: TransactionRecord[]
  summary: {
    matchedCount: number
    unmatchedBankCount: number
    unmatchedAccountingCount: number
    matchRate: number
  }
}

/** Simple string similarity: checks if one contains the other (case-insensitive) */
function vendorSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  const al = a.toLowerCase().trim()
  const bl = b.toLowerCase().trim()
  if (al === bl) return 1.0
  if (al.includes(bl) || bl.includes(al)) return 0.6
  // Check if first word matches (common: "Amazon" vs "Amazon Web Services")
  const aFirst = al.split(/\s+/)[0]
  const bFirst = bl.split(/\s+/)[0]
  if (aFirst.length > 2 && aFirst === bFirst) return 0.4
  return 0
}

/** Score a potential match between two transactions */
export function scoreMatch(bankTx: TransactionRecord, accountingTx: TransactionRecord): number {
  // Amount must match exactly (required)
  if (Math.abs(Math.abs(bankTx.amount) - Math.abs(accountingTx.amount)) > 0.01) {
    return 0
  }

  // Both must be same sign direction
  if ((bankTx.amount > 0) !== (accountingTx.amount > 0)) {
    return 0
  }

  // Date proximity scoring
  const bankDate = new Date(bankTx.date).getTime()
  const acctDate = new Date(accountingTx.date).getTime()
  const daysDiff = Math.abs(bankDate - acctDate) / (1000 * 60 * 60 * 24)

  if (daysDiff > 5) return 0 // Too far apart

  let score = 0
  if (daysDiff === 0) score = 0.85
  else if (daysDiff <= 1) score = 0.75
  else if (daysDiff <= 2) score = 0.65
  else if (daysDiff <= 3) score = 0.55
  else if (daysDiff <= 5) score = 0.45

  // Vendor name bonus
  const vendorScore = vendorSimilarity(bankTx.vendor ?? bankTx.description, accountingTx.vendor ?? accountingTx.description)
  score += vendorScore * 0.15

  return Math.min(score, 1.0)
}

/** Find best matches between bank and accounting transactions */
export function findMatches(
  bankTransactions: TransactionRecord[],
  accountingTransactions: TransactionRecord[]
): ReconciliationResult {
  const matches: MatchCandidate[] = []
  const matchedBankIds = new Set<string>()
  const matchedAcctIds = new Set<string>()

  // Build all possible match candidates with scores
  const candidates: Array<{ bankIdx: number; acctIdx: number; confidence: number }> = []

  for (let bi = 0; bi < bankTransactions.length; bi++) {
    for (let ai = 0; ai < accountingTransactions.length; ai++) {
      const confidence = scoreMatch(bankTransactions[bi], accountingTransactions[ai])
      if (confidence > 0.4) {
        candidates.push({ bankIdx: bi, acctIdx: ai, confidence })
      }
    }
  }

  // Greedy matching: pick highest confidence first, avoid double-matching
  candidates.sort((a, b) => b.confidence - a.confidence)

  for (const candidate of candidates) {
    const bankTx = bankTransactions[candidate.bankIdx]
    const acctTx = accountingTransactions[candidate.acctIdx]

    if (matchedBankIds.has(bankTx.id) || matchedAcctIds.has(acctTx.id)) continue

    matches.push({
      bankTx,
      accountingTx: acctTx,
      confidence: Math.round(candidate.confidence * 100) / 100,
    })
    matchedBankIds.add(bankTx.id)
    matchedAcctIds.add(acctTx.id)
  }

  const unmatchedBank = bankTransactions.filter(tx => !matchedBankIds.has(tx.id))
  const unmatchedAccounting = accountingTransactions.filter(tx => !matchedAcctIds.has(tx.id))
  const total = bankTransactions.length + accountingTransactions.length

  return {
    matches,
    unmatchedBank,
    unmatchedAccounting,
    summary: {
      matchedCount: matches.length,
      unmatchedBankCount: unmatchedBank.length,
      unmatchedAccountingCount: unmatchedAccounting.length,
      matchRate: total > 0 ? Math.round((matches.length * 2 / total) * 100) : 0,
    },
  }
}
