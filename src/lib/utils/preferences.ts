/**
 * Lightweight localStorage helpers for persisting user preferences.
 * All reads/writes are wrapped in try/catch so they never throw
 * (e.g. when storage is full or unavailable in SSR).
 */

export function getPreference<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const val = localStorage.getItem(key)
    return val ? (JSON.parse(val) as T) : fallback
  } catch {
    return fallback
  }
}

export function setPreference(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Silently ignore — storage may be full or unavailable
  }
}

// Key constants
export const PREF_TIME_FILTER = 'frankly_time_filter'
export const PREF_TIME_FILTER_CUSTOM = 'frankly_time_filter_custom'
export const PREF_TX_SORT = 'frankly_tx_sort'
export const PREF_ENTITY_FILTER = 'frankly_entity_filter'
