"use client"

import { useEffect, useState } from "react"

import {
  clockTimeLocal,
  clockTimeMsLocal,
  clockTimeMsUtc,
  clockTimeUtc,
  zoneLabel,
} from "@/lib/time"

/**
 * Hydration-safe local-time formatters.
 *
 * The server has no way to know the viewer's timezone, so the first render
 * must match what the server produced or React reports a hydration mismatch
 * and discards the tree. This returns UTC formatters until the effect runs,
 * then swaps to local — the visible result is a one-frame flip on load, which
 * is the cost of showing the operator their own clock.
 *
 * Every clock string in a client component goes through here.
 */
export function useClock() {
  const [local, setLocal] = useState(false)

  useEffect(() => {
    setLocal(true)
  }, [])

  return {
    /** HH:MM:SS */
    time: local ? clockTimeLocal : clockTimeUtc,
    /** HH:MM:SS.mmm — used where ordering within a second matters. */
    timeMs: local ? clockTimeMsLocal : clockTimeMsUtc,
    /** "IST", "GMT+5:30", … — "UTC" until mounted. */
    zone: local ? zoneLabel() : "UTC",
    /** True once the local clock is in use. */
    ready: local,
  }
}
