import Anthropic from "@anthropic-ai/sdk"

import { fallbackDecoy, type DecoyContent } from "./fallbacks"
import type { HoneytokenType } from "@/lib/types"

export interface GenerationResult extends DecoyContent {
  /** Whether a live model produced this, or the curated fallback did. */
  source: "ai" | "fallback"
  /** Wall-clock milliseconds, shown in the console so the cost is visible. */
  elapsed_ms: number
  /** Present when a live call was attempted and failed. */
  error?: string
}

const TYPE_BRIEF: Record<HoneytokenType, string> = {
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
const SYSTEM = `You write decoy credentials and documents for a cyber-deception platform.

A decoy is planted where an intruder will find it. It grants no access to anything: its only purpose is that using it proves an intrusion. Your job is to make it believable enough to be taken.

What makes a decoy work:
- It matches the department's real vocabulary. A mechanical engineering lab has CAD licence servers and drawing archives; a records office has enrolment portals and transcripts.
- It looks used, not planted. Slightly stale dates, plausible naming conventions, the kind of file a real person would actually leave lying around.
- It implies access worth having, so an intruder tries it rather than passing over it.
- It never names a real product key, a real person, or a real host outside the fictional organisation described to you.

Write the bait itself, not a description of it.`

let cached: Anthropic | null = null

function client(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  cached ??= new Anthropic()
  return cached
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * Generates decoy content for a department, falling back to curated content
 * when no key is configured or the call fails.
 *
 * Never throws: the console must always produce a decoy, and the caller
 * surfaces `source` so the UI can state which path ran rather than implying
 * the AI was involved when it wasn't.
 */
export async function generateDecoy(params: {
  type: HoneytokenType
  departmentName: string
  organizationName: string
  seed: number
}): Promise<GenerationResult> {
  const { type, departmentName, organizationName, seed } = params
  const started = Date.now()

  const anthropic = client()
  if (!anthropic) {
    return {
      ...fallbackDecoy(type, departmentName, seed),
      source: "fallback",
      elapsed_ms: Date.now() - started,
    }
  }

  try {
    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2000,
      system: SYSTEM,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
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
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `Organisation: ${organizationName}
Department: ${departmentName}
Decoy type: ${type} — ${TYPE_BRIEF[type]}

Write one decoy for this department.`,
        },
      ],
    })

    const parsed = response.parsed_output as DecoyContent | null
    if (!parsed?.content) throw new Error("model returned no usable content")

    return { ...parsed, source: "ai", elapsed_ms: Date.now() - started }
  } catch (err) {
    // A failed generation must not block the demo — fall back and say so.
    return {
      ...fallbackDecoy(type, departmentName, seed),
      source: "fallback",
      elapsed_ms: Date.now() - started,
      error: err instanceof Error ? err.message : "generation failed",
    }
  }
}
