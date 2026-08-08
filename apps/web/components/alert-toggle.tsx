"use client"

import { useState } from "react"

import { playIncidentAlarm, unlockAudio } from "@/lib/alarm"

/**
 * Enables incident audio.
 *
 * Opt-in by necessity: browsers refuse to start an AudioContext until the user
 * has interacted with the page, so there is no way to have this on by default
 * that does not fail silently. A click both unlocks the context and confirms
 * it works by playing the alarm once — a toggle that claims to be on but makes
 * no sound in a live demo is worse than no toggle.
 */
export function AlertToggle() {
  const [on, setOn] = useState(false)
  const [failed, setFailed] = useState(false)

  async function toggle() {
    if (on) {
      setOn(false)
      return
    }
    const ok = await unlockAudio()
    if (!ok) {
      setFailed(true)
      return
    }
    setOn(true)
    setFailed(false)
    // Confirms audibly that it is working, at the moment the operator asked.
    playIncidentAlarm("medium")
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        on
          ? "Incident audio on — use events sound an alarm, access events stay silent"
          : "Enable incident audio"
      }
      className="wt-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        border: "1px solid var(--color-divider)",
        color: on ? "var(--ok-text)" : "var(--color-faint)",
        fontSize: 10,
        letterSpacing: ".1em",
        padding: "3px 8px",
        cursor: "pointer",
      }}
    >
      <span aria-hidden>{on ? "▮▮▮" : "▮▯▯"}</span>
      {failed ? "AUDIO BLOCKED" : on ? "AUDIO ON" : "AUDIO OFF"}
    </button>
  )
}
