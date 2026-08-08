"use client"

import { useEffect, useRef } from "react"

import { playContainedChime, playIncidentAlarm } from "./alarm"
import type { Event, Incident } from "./types"

/**
 * Sounds the alarm when a `use` event arrives.
 *
 * Two things this has to get right, both of which are about the poll loop:
 *
 * The first tick must be silent. It returns every event already in the store,
 * and announcing history as though it were live would fire a burst of alarms
 * the moment anyone opens the dashboard.
 *
 * Every later tick must fire only for events not seen before. The poll returns
 * the same rows repeatedly, so a naive "did the list change" check would
 * re-alarm on every cycle. Ids are tracked in a ref rather than state because
 * this must not trigger a re-render.
 */
export function useAlerts(events: Event[] | undefined, incidents: Incident[] | undefined) {
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!events) return

    // First observation: record what already exists, announce none of it.
    if (seen.current === null) {
      seen.current = new Set(events.map((e) => e.id))
      return
    }

    const fresh = events.filter((e) => !seen.current!.has(e.id))
    for (const e of fresh) seen.current.add(e.id)
    if (fresh.length === 0) return

    // `access` is deliberately silent — see lib/alarm.ts. Reading a decoy is
    // the event a backup job also produces, and it does not escalate.
    const uses = fresh.filter((e) => e.event_type === "use")
    if (uses.length === 0) return

    // Severity comes from the incident the newest use belongs to, so the tone
    // matches what the board is showing rather than assuming a level.
    const newest = uses[0]!
    const incident = incidents?.find(
      (i) => i.source_ip === newest.source_ip && i.status !== "closed"
    )
    playIncidentAlarm(incident?.severity ?? "medium")

    if (incident?.status === "contained") playContainedChime()
  }, [events, incidents])
}
