import {
  createDepartment,
  createHoneytoken,
  db,
  listDepartments,
} from "./store"
import type { HoneytokenType } from "./types"

/**
 * Demo fixtures: three departments, each with a `credential` decoy (the `use`
 * path) and a `document` decoy (the `access` path). Content is deliberately
 * department-specific — a generic "admin/password123" reads as a template and
 * undercuts the pitch. AI generation later produces content in this same shape.
 */
interface SeedToken {
  type: HoneytokenType
  name: string
  content: string
  location: string
}

const SEED: Array<{ name: string; token: string; tokens: SeedToken[] }> = [
  {
    name: "IT Department",
    token: "it-dept",
    tokens: [
      {
        type: "credential",
        name: "Backup Domain Admin",
        content: "svc_backup_admin / Wint3r!Backup2024",
        location: "\\\\fileserver\\it\\runbooks\\domain-recovery.docx",
      },
      {
        type: "document",
        name: "Network Recovery Runbook",
        content:
          "INTERNAL — Domain controller recovery procedure. Contains break-glass account details for DC01/DC02.",
        location: "\\\\fileserver\\it\\runbooks\\",
      },
    ],
  },
  {
    name: "Mechanical Department",
    token: "mech-dept",
    tokens: [
      {
        type: "credential",
        name: "CAD Server Service Account",
        content: "cad_licence_svc / S0lidW0rks#Lic",
        location: "\\\\fileserver\\mech\\cad\\licence-server-notes.txt",
      },
      {
        type: "document",
        name: "Turbine Assembly Drawings (Confidential)",
        content:
          "CONFIDENTIAL — Assembly tolerances and supplier schedule for the Mk-IV turbine housing.",
        location: "\\\\fileserver\\mech\\drawings\\",
      },
    ],
  },
  {
    name: "Admin Office",
    token: "admin-dept",
    tokens: [
      {
        type: "credential",
        name: "Student Records Portal Login",
        content: "registrar_readonly / Enr0lment@2024",
        location: "\\\\fileserver\\admin\\records\\portal-access.xlsx",
      },
      {
        type: "api_key",
        name: "Fee Payment Gateway Key",
        content: "pk_live_4Xq9mReAdM1nOff1ceTestKey",
        location: "\\\\fileserver\\admin\\finance\\gateway-config.env",
      },
    ],
  },
  {
    // Carries the source-code decoy. The Deception Console offers four token
    // types, so the default board has to demonstrate all four — otherwise the
    // one type a judge picks at random is the one nothing has exercised.
    name: "Research Computing",
    token: "research-dept",
    tokens: [
      {
        type: "source_code_secret",
        name: "Sensor Pipeline .env",
        content: "LAB_DATA_API_TOKEN=lab_sk_7f2Ke9RtVmQx4NbZ",
        location: "git@github.internal:research/sensor-pipeline.git — .env",
      },
      {
        type: "credential",
        name: "HPC Cluster Scheduler Account",
        content: "slurm_batch_svc / Gr1dRun#2025",
        location: "\\\\fileserver\\research\\hpc\\scheduler-notes.md",
      },
    ],
  },
]

/**
 * Idempotent — safe to call from any request path. Seeds only once per process
 * so the demo can be reset by restarting the dev server.
 */
export function ensureSeeded(): void {
  const store = db()
  if (store.seeded || listDepartments().length > 0) {
    store.seeded = true
    return
  }

  for (const dept of SEED) {
    const department = createDepartment(dept.name, dept.token)
    for (const token of dept.tokens) {
      createHoneytoken({
        department_id: department.id,
        type: token.type,
        name: token.name,
        content: token.content,
        location: token.location,
        // Deterministic tracking ids: the demo attacker flow needs a URL you can
        // type, and a random uuid per restart would break rehearsed links.
        tracking_id: `wt_${dept.token}_${token.type}`,
        ai_generated: false,
      })
    }
  }

  store.seeded = true
}
