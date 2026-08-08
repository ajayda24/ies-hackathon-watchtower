import type { NextRequest } from "next/server"

import { generateDecoy } from "@/lib/ai/generate-decoy"
import { ORG_NAME } from "@/lib/org"
import { ensureSeeded } from "@/lib/seed"
import {
  createDepartment,
  createHoneytoken,
  listDepartments,
  newTrackingId,
} from "@/lib/store"
import type { HoneytokenType } from "@/lib/types"

/**
 * Decoy types planted automatically when a department joins.
 *
 * A department with no decoys is invisible to the platform, so onboarding
 * plants immediately rather than leaving an operator to do it by hand. One of
 * each signal class: a credential (the `use` path) and a document (`access`).
 */
const STARTER_TYPES: HoneytokenType[] = ["credential", "document"]

export async function GET() {
  await ensureSeeded()
  return Response.json(
    { departments: await listDepartments() },
    { headers: { "cache-control": "no-store" } }
  )
}

/** Registers a department and plants its starter decoys. */
export async function POST(req: NextRequest) {
  await ensureSeeded()

  const body = (await req.json().catch(() => ({}))) as { name?: string }
  const name = body.name?.trim()

  if (!name) {
    return Response.json({ error: "A department needs a name" }, { status: 400 })
  }
  if (name.length > 60) {
    return Response.json({ error: "Name is too long" }, { status: 400 })
  }

  const token = slugify(name)
  const departments = await listDepartments()
  const existing = departments.find(
    (d) => d.registration_token === token || d.name.toLowerCase() === name.toLowerCase()
  )
  if (existing) {
    return Response.json(
      { error: `${existing.name} is already registered`, department: existing },
      { status: 409 }
    )
  }

  // The check above is a read followed by a write, so two simultaneous
  // registrations can both pass it. The unique constraint on
  // registration_token is the actual guard; this turns the resulting insert
  // error back into the same 409 rather than a 500.
  let department
  try {
    department = await createDepartment(name, token)
  } catch {
    const after = await listDepartments()
    const winner = after.find((d) => d.registration_token === token)
    return Response.json(
      {
        error: `${winner?.name ?? name} is already registered`,
        department: winner ?? null,
      },
      { status: 409 }
    )
  }

  // Generated in parallel — two sequential model calls would put ~3s of dead
  // air in the middle of the onboarding screen.
  const drafts = await Promise.all(
    STARTER_TYPES.map((type, i) =>
      generateDecoy({
        type,
        departmentName: name,
        organizationName: ORG_NAME,
        seed: i,
      })
    )
  )

  const planted = await Promise.all(
    drafts.map((draft, i) =>
      createHoneytoken({
        department_id: department.id,
        type: STARTER_TYPES[i]!,
        name: draft.name,
        content: draft.content,
        location: draft.location,
        tracking_id: newTrackingId(),
        ai_generated: draft.source === "ai",
      })
    )
  )

  return Response.json(
    {
      department,
      honeytokens: planted,
      generation: {
        source: drafts[0]?.source ?? "fallback",
        provider: drafts[0]?.provider ?? "fallback",
        elapsed_ms: Math.max(...drafts.map((d) => d.elapsed_ms)),
      },
    },
    { status: 201 }
  )
}

/** Registration tokens are URL segments, so keep them lowercase and hyphenated. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "dept"
  )
}
