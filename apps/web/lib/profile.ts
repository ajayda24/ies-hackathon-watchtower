import type { Event, Honeytoken, HoneytokenType } from "./types"

/**
 * Behavioural profiling.
 *
 * Characterises *how* an actor operated, never who they are. That distinction
 * is the whole design: an earlier draft of this platform stored an
 * `attribution_profile` and a confidence score, and both were fabrications —
 * nothing computed them, and nothing could have, because a source address and
 * a sequence of decoy interactions cannot identify a person, an organisation
 * or a country.
 *
 * What the evidence *does* support is behaviour. A client that presents as
 * curl is scripted. A password submitted at exactly the planted length was
 * copied verbatim. Two events fourteen seconds apart is a different actor
 * profile from two events four minutes apart. Every trait below is read
 * directly off a stored event, and each one carries the observation that
 * produced it so a reader can check the claim rather than trust it.
 *
 * No scores. A trait is either observed or absent.
 */

export type TraitKind = "tooling" | "tradecraft" | "cadence" | "targeting"

export interface Trait {
  kind: TraitKind
  /** Short label for the UI. */
  label: string
  /** The observation this was read from — always a fact, never a judgement. */
  evidence: string
}

export interface BehaviourProfile {
  traits: Trait[]
  /** Distinct decoy types the actor interacted with. */
  surfaces: HoneytokenType[]
  /** Seconds between first and last event; null when there is only one. */
  spanSeconds: number | null
}

/** User-agent strings that identify a scripted client outright. */
const TOOL_UA = /curl|wget|python-requests|httpie|go-http-client|libwww|powershell|axios|okhttp/i

/** Recognisable interactive browsers. Deliberately narrow — an unknown string
 *  yields no trait rather than a guess in either direction. */
const BROWSER_UA = /mozilla|chrome|safari|firefox|edg\//i

function agentOf(event: Event): string {
  const ua = (event.raw_details as { user_agent?: unknown }).user_agent
  return typeof ua === "string" ? ua : ""
}

export function buildProfile(
  events: Event[],
  tokens: Map<string, Honeytoken>
): BehaviourProfile {
  const traits: Trait[] = []
  const ordered = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // ---- tooling: what kind of client made the requests -----------------------
  const agents = [...new Set(ordered.map(agentOf).filter(Boolean))]
  const scripted = agents.filter((a) => TOOL_UA.test(a))
  const browsers = agents.filter((a) => BROWSER_UA.test(a) && !TOOL_UA.test(a))

  if (scripted.length > 0) {
    traits.push({
      kind: "tooling",
      label: "Scripted client, not a browser",
      evidence: `Requests presented as ${scripted[0]}. A person opening a file from a share does not send that user agent.`,
    })
  }
  if (browsers.length > 0 && scripted.length > 0) {
    // Both present is more interesting than either alone.
    traits.push({
      kind: "tradecraft",
      label: "Mixed manual and automated activity",
      evidence: `Both a browser and a scripted client appear from this source, which suggests a person driving tooling rather than either alone.`,
    })
  } else if (browsers.length > 0) {
    traits.push({
      kind: "tooling",
      label: "Interactive browser session",
      evidence: `Requests presented as ${browsers[0]}.`,
    })
  }

  // ---- tradecraft: how the decoy content was handled ------------------------
  const uses = ordered.filter((e) => e.event_type === "use")
  const verbatim = uses.filter((e) => {
    const d = e.raw_details as {
      submitted_username?: unknown
      submitted_password_length?: unknown
    }
    if (typeof d.submitted_password_length !== "number") return false
    const token = tokens.get(e.token_id)
    if (!token) return false
    const planted = token.content.split("/")[1]?.trim()
    return planted !== undefined && planted.length === d.submitted_password_length
  })

  if (verbatim.length > 0) {
    traits.push({
      kind: "tradecraft",
      label: "Credential used verbatim",
      evidence: `The submitted password matched the planted value's exact length, so the decoy's contents were copied rather than guessed or brute-forced.`,
    })
  }

  const accesses = ordered.filter((e) => e.event_type === "access")
  if (accesses.length > 0 && uses.length > 0) {
    const firstAccess = new Date(accesses[0]!.timestamp).getTime()
    const firstUse = new Date(uses[0]!.timestamp).getTime()
    if (firstUse >= firstAccess) {
      traits.push({
        kind: "tradecraft",
        label: "Read before use",
        evidence: `A decoy file was opened before its credential was submitted — the actor harvested the content first, which is discovery followed by attempted access rather than a stray click.`,
      })
    }
  }

  if (uses.length > 1) {
    const usernames = new Set(
      uses
        .map((e) => (e.raw_details as { submitted_username?: unknown }).submitted_username)
        .filter((u): u is string => typeof u === "string")
    )
    if (usernames.size === 1) {
      traits.push({
        kind: "tradecraft",
        label: "Retried a single credential",
        evidence: `${uses.length} submissions of the same account rather than a spray across many — consistent with an actor who believed the credential was valid.`,
      })
    } else if (usernames.size > 1) {
      traits.push({
        kind: "tradecraft",
        label: "Multiple accounts attempted",
        evidence: `${usernames.size} distinct decoy accounts were submitted from this source.`,
      })
    }
  }

  // ---- cadence: the timing between actions ---------------------------------
  let spanSeconds: number | null = null
  if (ordered.length > 1) {
    const first = new Date(ordered[0]!.timestamp).getTime()
    const last = new Date(ordered[ordered.length - 1]!.timestamp).getTime()
    spanSeconds = Math.round((last - first) / 1000)

    const gaps: number[] = []
    for (let i = 1; i < ordered.length; i++) {
      gaps.push(
        (new Date(ordered[i]!.timestamp).getTime() -
          new Date(ordered[i - 1]!.timestamp).getTime()) / 1000
      )
    }
    const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0

    if (median <= 2) {
      traits.push({
        kind: "cadence",
        label: "Machine-speed sequence",
        evidence: `Median ${median.toFixed(1)}s between actions. Faster than a person reading a file and typing a password.`,
      })
    } else if (median <= 60) {
      traits.push({
        kind: "cadence",
        label: "Hands-on-keyboard pace",
        evidence: `Median ${Math.round(median)}s between actions — consistent with someone working through the material as they find it.`,
      })
    } else {
      traits.push({
        kind: "cadence",
        label: "Intermittent activity",
        evidence: `Median ${Math.round(median / 60)} minutes between actions, so the source returned rather than acting in one pass.`,
      })
    }
  }

  // ---- targeting: which decoys drew attention -------------------------------
  const surfaces = [
    ...new Set(
      ordered
        .map((e) => tokens.get(e.token_id)?.type)
        .filter((t): t is HoneytokenType => t !== undefined)
    ),
  ]
  if (surfaces.length > 1) {
    traits.push({
      kind: "targeting",
      label: "Multiple decoy types touched",
      evidence: `Interacted with ${surfaces.length} different asset types, so the activity was not confined to one file.`,
    })
  }

  return { traits, surfaces, spanSeconds }
}

/**
 * The sentence that must accompany any profile shown to a person.
 *
 * Kept beside the profile rather than in a template so it cannot be dropped by
 * editing a component: everything above describes an actor's behaviour, and
 * behaviour is not identity.
 */
export const PROFILE_CAVEAT =
  "These are observed behaviours, not an identity. The evidence describes how the source acted; it cannot establish who they are, whether they are inside or outside the organisation, or who they act for."
