import type { NextRequest } from "next/server"

import { ensureSeeded } from "@/lib/seed"
import {
  createHoneytoken,
  getDepartment,
  listHoneytokens,
  newTrackingId,
} from "@/lib/store"
import type { HoneytokenType } from "@/lib/types"

const VALID_TYPES: HoneytokenType[] = [
  "credential",
  "document",
  "api_key",
  "source_code_secret",
]

/** Lists planted decoys, optionally scoped to one department. */
export async function GET(req: NextRequest) {
  ensureSeeded()
  const departmentId = new URL(req.url).searchParams.get("department_id")
  return Response.json(
    { honeytokens: listHoneytokens(departmentId ?? undefined) },
    { headers: { "cache-control": "no-store" } }
  )
}

/** Plants a decoy. Called with the content returned by /api/decoys/generate. */
export async function POST(req: NextRequest) {
  ensureSeeded()

  const body = (await req.json().catch(() => ({}))) as {
    department_id?: string
    type?: string
    name?: string
    content?: string
    location?: string
    ai_generated?: boolean
  }

  const department = body.department_id
    ? getDepartment(body.department_id)
    : undefined
  if (!department) {
    return Response.json({ error: "Unknown department" }, { status: 400 })
  }
  if (!body.name?.trim() || !body.content?.trim()) {
    return Response.json(
      { error: "A decoy needs both a name and content" },
      { status: 400 }
    )
  }

  const type = VALID_TYPES.includes(body.type as HoneytokenType)
    ? (body.type as HoneytokenType)
    : "credential"

  const token = createHoneytoken({
    department_id: department.id,
    type,
    name: body.name.trim(),
    content: body.content.trim(),
    location: body.location?.trim() || "\\\\fileserver\\shared",
    tracking_id: newTrackingId(),
    ai_generated: Boolean(body.ai_generated),
  })

  return Response.json({ honeytoken: token }, { status: 201 })
}
