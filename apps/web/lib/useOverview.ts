"use client"

import { useEffect, useRef, useState } from "react"

import type {
  ContainmentActionRecord,
  Department,
  Event,
  Honeytoken,
  Incident,
  SecurityLevel,
} from "./types"

export interface DepartmentView extends Department {
  security_level: SecurityLevel
  honeytoken_count: number
  open_incidents: number
  contained_incidents: number
}

export interface Overview {
  departments: DepartmentView[]
  events: Event[]
  incidents: Incident[]
  honeytokens: Honeytoken[]
  containment_actions: ContainmentActionRecord[]
  generated_at: string
}

/**
 * Polls the aggregate overview endpoint.
 *
 * Polling rather than Supabase realtime on purpose: realtime needs per-table
 * publication and RLS that permits the anon key, and it fails *silently* when
 * either is missing — the dashboard simply never updates. A 2s poll is
 * indistinguishable in a live demo and cannot fail that way. Realtime can be
 * layered on top of this later without touching any screen.
 */
export function useOverview(intervalMs = 2000) {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Held in a ref so a slow response can never overwrite a newer one, and so
  // the effect doesn't re-subscribe on every tick.
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    let timer: ReturnType<typeof setTimeout>

    const tick = async () => {
      try {
        const res = await fetch("/api/overview", { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as Overview
        if (alive.current) {
          setData(json)
          setError(null)
        }
      } catch (err) {
        if (alive.current) {
          setError(err instanceof Error ? err.message : "fetch failed")
        }
      } finally {
        if (alive.current) timer = setTimeout(tick, intervalMs)
      }
    }

    void tick()
    return () => {
      alive.current = false
      clearTimeout(timer)
    }
  }, [intervalMs])

  return { data, error }
}
