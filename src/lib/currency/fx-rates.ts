export type SupportedCurrency = 'USD' | 'GBP' | 'CAD' | 'EUR'

export interface FxRates {
  base: 'USD'
  rates: Record<SupportedCurrency, number>
  timestamp: number
}

const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  USD: 1,
  GBP: 0.79,
  CAD: 1.36,
  EUR: 0.92,
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

let cachedRates: FxRates | null = null
let cachedAt = 0

export async function fetchLatestRates(): Promise<FxRates> {
  const now = Date.now()

  // Return cached if still fresh
  if (cachedRates && now - cachedAt < CACHE_TTL_MS) {
    return cachedRates
  }

  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID
  if (!appId) {
    const fallback: FxRates = {
      base: 'USD',
      rates: { ...FALLBACK_RATES },
      timestamp: now,
    }
    cachedRates = fallback
    cachedAt = now
    return fallback
  }

  try {
    const res = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=USD,GBP,CAD,EUR`,
      { next: { revalidate: 3600 } }
    )

    if (!res.ok) {
      throw new Error(`OXR API responded with ${res.status}`)
    }

    const data = await res.json()
    const result: FxRates = {
      base: 'USD',
      rates: {
        USD: 1,
        GBP: data.rates?.GBP ?? FALLBACK_RATES.GBP,
        CAD: data.rates?.CAD ?? FALLBACK_RATES.CAD,
        EUR: data.rates?.EUR ?? FALLBACK_RATES.EUR,
      },
      timestamp: (data.timestamp ?? Math.floor(now / 1000)) * 1000,
    }

    cachedRates = result
    cachedAt = now
    return result
  } catch (err) {
    console.error('Failed to fetch FX rates, using fallback:', err)
    const fallback: FxRates = {
      base: 'USD',
      rates: { ...FALLBACK_RATES },
      timestamp: now,
    }
    cachedRates = fallback
    cachedAt = now
    return fallback
  }
}

/** Convert an amount in the given currency to USD */
export function convertToUSD(
  amount: number,
  currency: SupportedCurrency,
  rates: FxRates
): number {
  if (currency === 'USD') return amount
  const rate = rates.rates[currency]
  if (!rate || rate === 0) return amount
  return amount / rate
}

/** Convert a USD amount to the target currency */
export function convertFromUSD(
  amount: number,
  targetCurrency: SupportedCurrency,
  rates: FxRates
): number {
  if (targetCurrency === 'USD') return amount
  const rate = rates.rates[targetCurrency]
  if (!rate) return amount
  return amount * rate
}
