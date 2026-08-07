import { anthropicProvider } from "./anthropic-provider"
import { fallbackDecoy, type DecoyContent } from "./fallbacks"
import { groqProvider } from "./groq-provider"
import type { Provider, ProviderName } from "./provider"
import type { HoneytokenType } from "@/lib/types"

export interface GenerationResult extends DecoyContent {
  /** Which path produced this — surfaced in the UI, never implied. */
  source: "ai" | "fallback"
  /** Provider and model, so a demo can state exactly what ran. */
  provider: ProviderName
  model?: string
  /** Wall-clock milliseconds, shown in the console so the cost is visible. */
  elapsed_ms: number
  /** Present when a live call was attempted and failed. */
  error?: string
}

let cached: Provider | null | undefined

/**
 * Picks a provider from the environment.
 *
 * Whichever key is present wins, Groq first — it is the faster of the two, and
 * on a live demo generation latency is on screen. `AI_PROVIDER` forces a choice
 * when both keys exist.
 */
function selectProvider(): Provider | null {
  if (cached !== undefined) return cached

  const forced = process.env.AI_PROVIDER?.toLowerCase()
  const hasGroq = Boolean(process.env.GROQ_API_KEY)
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY)

  if (forced === "fallback") return (cached = null)
  if (forced === "groq") return (cached = hasGroq ? groqProvider() : null)
  if (forced === "anthropic") {
    return (cached = hasAnthropic ? anthropicProvider() : null)
  }

  if (hasGroq) return (cached = groqProvider())
  if (hasAnthropic) return (cached = anthropicProvider())
  return (cached = null)
}

export function activeProvider(): { name: ProviderName; model?: string } {
  const provider = selectProvider()
  return provider
    ? { name: provider.name, model: provider.model }
    : { name: "fallback" }
}

export function aiConfigured(): boolean {
  return selectProvider() !== null
}

/**
 * Generates decoy content for a department, falling back to curated content
 * when no provider is configured or the call fails.
 *
 * Never throws: the console must always produce a decoy, and the caller
 * surfaces `source` so the UI can state which path ran rather than implying a
 * model was involved when it wasn't.
 */
export async function generateDecoy(params: {
  type: HoneytokenType
  departmentName: string
  organizationName: string
  seed: number
}): Promise<GenerationResult> {
  const { type, departmentName, organizationName, seed } = params
  const started = Date.now()
  const provider = selectProvider()

  if (!provider) {
    return {
      ...fallbackDecoy(type, departmentName, seed),
      source: "fallback",
      provider: "fallback",
      elapsed_ms: Date.now() - started,
    }
  }

  try {
    const draft = await provider.generateDecoy({
      type,
      departmentName,
      organizationName,
    })
    return {
      ...draft,
      source: "ai",
      provider: provider.name,
      model: provider.model,
      elapsed_ms: Date.now() - started,
    }
  } catch (err) {
    // A failed generation must not block the demo — fall back and say so.
    return {
      ...fallbackDecoy(type, departmentName, seed),
      source: "fallback",
      provider: "fallback",
      elapsed_ms: Date.now() - started,
      error: err instanceof Error ? err.message : "generation failed",
    }
  }
}

/**
 * Writes the plain-English attribution narrative for an incident.
 *
 * Returns null rather than a placeholder when no provider is configured, so
 * the Threat Timeline can keep showing its rule-derived summary instead of an
 * empty panel.
 */
export async function writeNarrative(prompt: string): Promise<ProseResult | null> {
  return prose(prompt, (p, text) => p.writeNarrative(text))
}

/** Generates the formal incident report. Null when no provider is configured. */
export async function writeReport(prompt: string): Promise<ProseResult | null> {
  return prose(prompt, (p, text) => p.writeReport(text))
}

export interface ProseResult {
  text: string
  provider: ProviderName
  model?: string
  elapsed_ms: number
}

async function prose(
  prompt: string,
  call: (provider: Provider, prompt: string) => Promise<string>
): Promise<ProseResult | null> {
  const provider = selectProvider()
  if (!provider) return null

  const started = Date.now()
  try {
    const text = await call(provider, prompt)
    return {
      text,
      provider: provider.name,
      model: provider.model,
      elapsed_ms: Date.now() - started,
    }
  } catch {
    return null
  }
}
