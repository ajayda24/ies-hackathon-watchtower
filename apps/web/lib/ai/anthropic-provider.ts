import Anthropic from "@anthropic-ai/sdk"

import {
  DECOY_SCHEMA,
  DECOY_SYSTEM,
  NARRATIVE_SYSTEM,
  REPORT_SYSTEM,
  decoyUserPrompt,
  type DecoyDraft,
  type DecoyRequest,
  type Provider,
} from "./provider"

const DEFAULT_MODEL = "claude-opus-5"

/**
 * Anthropic provider. Uses `messages.parse()` with `output_config.format`,
 * which validates the response against the schema for us.
 */
export function anthropicProvider(): Provider {
  const client = new Anthropic()
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL

  return {
    name: "anthropic",
    model,

    async generateDecoy(req: DecoyRequest): Promise<DecoyDraft> {
      const response = await client.messages.parse({
        model,
        max_tokens: 2000,
        system: DECOY_SYSTEM,
        output_config: {
          format: {
            type: "json_schema",
            schema: DECOY_SCHEMA as unknown as Record<string, unknown>,
          },
        },
        messages: [{ role: "user", content: decoyUserPrompt(req) }],
      })

      const parsed = response.parsed_output as DecoyDraft | null
      if (!parsed?.content) throw new Error("model returned no usable content")
      return parsed
    },

    async writeNarrative(prompt: string): Promise<string> {
      return prose(prompt, NARRATIVE_SYSTEM, 1000)
    },

    async writeReport(prompt: string): Promise<string> {
      // Reports are multi-section documents, so they need materially more
      // room than the two-paragraph narrative.
      return prose(prompt, REPORT_SYSTEM, 3000)
    },
  }

  async function prose(
    prompt: string,
    system: string,
    maxTokens: number
  ): Promise<string> {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()

    if (!text) throw new Error("model returned an empty response")
    return text
  }
}
