import type { HoneytokenType } from "@/lib/types"

export interface DecoyContent {
  /** Human-facing label shown in the dashboard. */
  name: string
  /** The decoy payload — fake password, key, or document body. */
  content: string
  /** Where the decoy is planted. */
  location: string
  /** One-line explanation of why this bait is plausible here. */
  rationale: string
}

/**
 * Pre-written decoys used when no API key is configured, and as the safety net
 * when a live call fails or is slow.
 *
 * These exist because a hackathon demo cannot afford a spinner that never
 * resolves: the console always produces a decoy, and the UI states plainly
 * which path produced it. Content is department-flavoured rather than generic —
 * a fallback that reads as a template would undercut the same claim the live
 * call is meant to demonstrate.
 */
const FALLBACKS: Record<HoneytokenType, DecoyContent[]> = {
  credential: [
    {
      name: "CAD Licence Server Account",
      content: "cad_licence_svc / S0lidW0rks#Lic24",
      location: "\\\\fileserver\\{dept}\\cad\\licence-server-notes.txt",
      rationale:
        "Named after the licence daemon a CAD lab actually runs, and stored where an engineer would jot it down.",
    },
    {
      name: "Backup Service Account",
      content: "svc_backup_nightly / N1ghtly!Bkp2024",
      location: "\\\\fileserver\\{dept}\\runbooks\\restore-procedure.docx",
      rationale:
        "Backup accounts are high value and routinely over-privileged, so they are the first thing an intruder looks for.",
    },
    {
      name: "Records Portal Read-Only Login",
      content: "registrar_ro / Enr0lment@2024",
      location: "\\\\fileserver\\{dept}\\records\\portal-access.xlsx",
      rationale:
        "A read-only label lowers an attacker's guard while still proving intent when it is used.",
    },
  ],
  document: [
    {
      name: "Assembly Tolerances (Confidential)",
      content:
        "CONFIDENTIAL — Assembly tolerances and supplier schedule for the Mk-IV housing. Distribution limited to project leads.",
      location: "\\\\fileserver\\{dept}\\drawings\\",
      rationale:
        "Marked confidential and dated recently, so it looks worth stealing without naming anything real.",
    },
    {
      name: "Payroll Reconciliation Q3.xlsx",
      content:
        "INTERNAL — Quarterly payroll reconciliation. Contains staff IDs, banded salaries and vendor payment references.",
      location: "\\\\fileserver\\{dept}\\finance\\",
      rationale:
        "Payroll files are a standard target for both external intruders and curious insiders.",
    },
  ],
  api_key: [
    {
      name: "Payment Gateway Test Key",
      content: "pk_live_4Xq9mReA1nOff1ceT3stKey",
      location: "\\\\fileserver\\{dept}\\finance\\gateway-config.env",
      rationale:
        "A live-prefixed key in a config file is exactly the pattern secret scanners and attackers both grep for.",
    },
    {
      name: "Records Export API Token",
      content: "rec_exp_9f41c0be7a2d4e18",
      location: "\\\\fileserver\\{dept}\\integrations\\export-service.env",
      rationale:
        "Export tokens imply bulk data access, which is the capability an intruder is hunting for.",
    },
  ],
  source_code_secret: [
    {
      name: ".env — DATABASE_URL",
      content:
        "DATABASE_URL=postgresql://app_rw:Pr0d!Db_2024@db-int.northfield.local:5432/records",
      location: "\\\\fileserver\\{dept}\\repos\\portal\\.env",
      rationale:
        "A committed .env with a full connection string is one of the most common real-world leaks.",
    },
    {
      name: "config.py — SECRET_KEY",
      content: 'SECRET_KEY = "django-insecure-8f2c41abd90e7b16c4a9"',
      location: "\\\\fileserver\\{dept}\\repos\\portal\\config.py",
      rationale:
        "Framework secret keys are recognisable on sight and imply session-forging capability.",
    },
  ],
}

/**
 * Picks a fallback decoy for a token type, rotating by index so repeated
 * generations during a demo don't return the same bait twice.
 */
export function fallbackDecoy(
  type: HoneytokenType,
  departmentName: string,
  seed: number
): DecoyContent {
  const options = FALLBACKS[type]
  const chosen = options[seed % options.length]!
  const slug = departmentName.split(" ")[0]!.toLowerCase()
  return { ...chosen, location: chosen.location.replace("{dept}", slug) }
}
