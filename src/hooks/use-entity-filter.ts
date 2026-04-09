'use client'
import { useCallback, useState } from 'react'
import useSWR from 'swr'

export interface Entity {
  id: string
  org_id: string
  name: string
  short_code: string | null
  currency: string
  color: string | null
  created_at: string
}

interface EntitiesResponse {
  entities: Entity[]
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) return { entities: [] }
  return r.json()
}).catch(() => ({ entities: [] }))

function getSavedEntity(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem('frankly_entity_filter') } catch { return null }
}

function saveEntity(id: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (id) localStorage.setItem('frankly_entity_filter', id)
    else localStorage.removeItem('frankly_entity_filter')
  } catch {}
}

export function useEntityFilter() {
  const [entityId, setEntityId] = useState<string | null>(getSavedEntity)

  const { data } = useSWR<EntitiesResponse>('/api/entities', fetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    fallbackData: { entities: [] },
  })

  const entities = data?.entities ?? []

  const setEntity = useCallback((id: string | null) => {
    saveEntity(id)
    setEntityId(id)
  }, [])

  return { entityId, setEntity, entities }
}
