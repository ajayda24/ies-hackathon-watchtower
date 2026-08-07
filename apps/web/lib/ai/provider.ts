import type { HoneytokenType } from "@/lib/types"

export type ProviderName = "groq" | "anthropic" | "fallback"

export interface DecoyRequest {
  type: HoneytokenType
  departmentName: string
  organizationName: string
}

export interface DecoyDraft {
  name: string
  content: string
  location: string
  rationale: string
}

/**
 * Shape every provider returns. `parse` throws on malformed output so the
 * caller's catch can fall back — providers never return partial drafts.
 */
export interface Provider {
  readonly name: ProviderName
  readonly model: string
  generateDecoy(req: DecoyRequest): Promise<DecoyDraft>
  writeNarrative(prompt: string): Promise<string>
}

/**
 * JSON Schema for a decoy draft.
 *
 * Shared by both providers so switching between them cannot change the shape
 * of what comes back — the difference between Groq and Anthropic stays in the
 * transport, not in the contract.
 */
export const DECOY_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "Short label for the dashboard, e.g. 'CAD Licence Server Account'.",
    },
    content: {
      type: "string",
      description: "The decoy payload itself — the actual bait text.",
    },
    location: {
      type: "string",
      description:
        "Windows-style path where the decoy is planted, e.g. \\\\fileserver\\mech\\cad\\notes.txt",
    },
    rationale: {
      type: "string",
      description:
        "One sentence on why an intruder in this department would take this bait.",
    },
  },
  required: ["name", "content", "location", "rationale"],
  additionalProperties: false,
} as const

export const TYPE_BRIEF: Record<HoneytokenType, string> = {
  credential:
    "a saved service-account login, written as `username / password` on one line",
  document:
    "a confidential-looking document: a one or two sentence body a reader would believe is real internal material",
  api_key: "a single API key or token string, in the format its vendor would use",
  source_code_secret:
    "one or two lines lifted from a config or source file, e.g. an .env assignment",
}

/**
 * The system prompt is deliberately explicit about what makes bait effective,
 * because the difference between a decoy that gets picked up and one that gets
 * ignored is entirely in the details — a generic `admin/password123` reads as a
 * template and an attacker skips it.
 */
export const DECOY_SYSTEM = `You write decoy credentials and documents for a cyber-deception platform.

A decoy is planted where an intruder will find it. It grants no access to anything: its only purpose is that using it proves an intrusion. Your job is to make it believable enough to be taken.

What makes a decoy work:
- It matches the department's real vocabulary. Name the actual software a department of this kind runs — a mechanical lab has SolidWorks or Ansys licence daemons, Teamcenter PLM vaults and drawing archives; a records office has enrolment portals, transcript exports and student information systems.
- It looks used, not planted. Plausible naming conventions, the kind of file a real person would actually leave lying around.
- It implies access worth having, so an intruder tries it rather than passing over it.
- It never names a real product key, a real person, or a real host outside the fictional organisation described to you.

Avoid anything that reads as a placeholder — an attacker skips those, and a skipped decoy detects nothing:
- Never use generic account names like "admin", "service_account", "svcuser", or the department name plus "svc".
- Never use a stock password shape: "Password123", "P@ssw0rd", "Welcome1", "<Dept>2024!", or a keyboard pattern. Write what a real administrator would actually pick — a site-specific or memorable word with digits and punctuation worked in.
- Paths are Windows UNC or drive paths unless told otherwise, because this organisation runs Windows file shares.

Write the bait itself, not a description of it.`

export function decoyUserPrompt(req: DecoyRequest): string {
  return `Organisation: ${req.organizationName}
Department: ${req.departmentName}
Decoy type: ${req.type} — ${TYPE_BRIEF[req.type]}

Write one decoy for this department.`
}

/** Narrative writer shares one voice across providers. */
export const NARRATIVE_SYSTEM = `You write short incident summaries for a cyber-deception platform, read by someone who is not a security specialist — a practice manager, a school IT lead.

Rules:
- Two short paragraphs, no headings, no bullet points.
- Plain English. No jargon unless you immediately explain it.
- State only what the evidence supports. Never invent a motive, an attacker identity, or a technique that is not in the events given to you.
- The decoy granted no real access — say so plainly, because that is the reassuring part.
- End the second paragraph with the single most useful next step for a human.`

/** Draft validation shared by every provider. */
export function parseDraft(raw: string): DecoyDraft {
  const parsed = JSON.parse(raw) as Partial<DecoyDraft>
  if (
    !parsed.name?.trim() ||
    !parsed.content?.trim() ||
    !parsed.location?.trim() ||
    !parsed.rationale?.trim()
  ) {
    throw new Error("model returned an incomplete decoy")
  }
  return {
    name: parsed.name.trim(),
    content: parsed.content.trim(),
    location: parsed.location.trim(),
    rationale: parsed.rationale.trim(),
  }
}
