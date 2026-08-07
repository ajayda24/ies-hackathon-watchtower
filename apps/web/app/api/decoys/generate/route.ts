import type { NextRequest } from "next/server"

import { aiConfigured, generateDecoy } from "@/lib/ai/generate-decoy"
import { ORG_NAME } from "@/lib/org"
import { ensureSeeded } from "@/lib/seed"
import { getDepartment, listHoneytokens } from "@/lib/store"
import type { HoneytokenType } from "@/lib/types"

const VALID_TYPES: HoneytokenType[] = [
  "credential",
  "document",
  "api_key",
  "source_code_secret",
]

/**
 * Generates a decoy proposal without planting it.
 *
 * Generation and deployment are separate so an operator can regenerate until
 * the bait looks right, and so the demo can show the proposal on screen before
 * anything is committed.
 */
export async function POST(req: NextRequest) {
  ensureSeeded()

  const body = (await req.json().catch(() => ({}))) as {
    department_id?: string
    type?: string
  }

  const department = body.department_id
    ? getDepartment(body.department_id)
    : undefined
  if (!department) {
    return Response.json({ error: "Unknown department" }, { status: 400 })
  }

  const type = VALID_TYPES.includes(body.type as HoneytokenType)
    ? (body.type as HoneytokenType)
    : "credential"

  // Rotates the fallback pool so repeated generations during a demo don't
  // return identical bait.
  const seed = listHoneytokens(department.id).length

  const result = await generateDecoy({
    type,
    departmentName: department.name,
    organizationName: ORG_NAME,
    seed,
  })

  return Response.json(
    {
      ...result,
      type,
      department_id: department.id,
      department_name: department.name,
      ai_configured: aiConfigured(),
    },
    { headers: { "cache-control": "no-store" } }
  )
}
