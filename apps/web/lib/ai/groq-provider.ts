import Groq from "groq-sdk"

import {
  DECOY_SCHEMA,
  DECOY_SYSTEM,
  NARRATIVE_SYSTEM,
  decoyUserPrompt,
  parseDraft,
  type DecoyDraft,
  type DecoyRequest,
  type Provider,
} from "./provider"

/**
 * Default model.
 *
 * Groq only supports `json_schema` on a subset of its catalogue — the popular
 * llama-3.3-70b rejects it outright. gpt-oss-120b accepts it with
 * `strict: true`, which is what makes the decoy shape a guarantee rather than a
 * hope, so it is the default even though llama is roughly twice as fast.
 */
const DEFAULT_MODEL = "openai/gpt-oss-120b"

/** Models that reject `json_schema` and must use plain JSON mode instead. */
function supportsJsonSchema(model: string): boolean {
  return /gpt-oss|kimi|moonshot/i.test(model)
}

export function groqProvider(): Provider {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL
  const schemaMode = supportsJsonSchema(model)

  return {
    name: "groq",
    model,

    async generateDecoy(req: DecoyRequest): Promise<DecoyDraft> {
      // On models without schema support, the shape has to be requested in the
      // prompt instead — JSON mode guarantees valid JSON, not the right keys,
      // so parseDraft still validates before anything reaches the UI.
      const system = schemaMode
        ? DECOY_SYSTEM
        : `${DECOY_SYSTEM}\n\nRespond with a JSON object containing exactly these keys: name, content, location, rationale.`

      const completion = await client.chat.completions.create({
        model,
        // Bait is short; a low ceiling keeps generation fast on screen.
        max_tokens: 700,
        messages: [
          { role: "system", content: system },
          { role: "user", content: decoyUserPrompt(req) },
        ],
        response_format: schemaMode
          ? {
              type: "json_schema",
              json_schema: {
                name: "decoy",
                schema: DECOY_SCHEMA as unknown as Record<string, unknown>,
                strict: true,
              },
            }
          : { type: "json_object" },
      })

      const raw = completion.choices[0]?.message?.content
      if (!raw) throw new Error("Groq returned an empty completion")
      return parseDraft(raw)
    },

    async writeNarrative(prompt: string): Promise<string> {
      const completion = await client.chat.completions.create({
        model,
        max_tokens: 600,
        messages: [
          { role: "system", content: NARRATIVE_SYSTEM },
          { role: "user", content: prompt },
        ],
      })

      const text = completion.choices[0]?.message?.content?.trim()
      if (!text) throw new Error("Groq returned an empty narrative")
      return text
    },
  }
}
