import type { EventType, HoneytokenType } from "./types"

/**
 * Static ATT&CK lookup. Deliberately a table, not an inference step — every tag
 * shown in the UI can be traced to one line here.
 */
export const MITRE_MAP = {
  credential_use: { id: "T1078", name: "Valid Accounts" },
  document_access: { id: "T1552", name: "Unsecured Credentials" },
  api_key_use: { id: "T1552.001", name: "Credentials In Files" },
  code_access: { id: "T1213", name: "Data from Information Repositories" },
  lateral_pattern: { id: "TA0008", name: "Lateral Movement" },
} as const

export interface MitreTechnique {
  id: string
  name: string
}

/**
 * Maps a (token type, event type) pair to its technique. `use` events are the
 * escalating ones, so they map to the credential/key techniques; `access`
 * events map to the discovery-flavoured ones.
 */
export function classify(
  tokenType: HoneytokenType,
  eventType: EventType
): MitreTechnique {
  if (eventType === "use") {
    switch (tokenType) {
      case "api_key":
        return MITRE_MAP.api_key_use
      case "source_code_secret":
        return MITRE_MAP.api_key_use
      default:
        return MITRE_MAP.credential_use
    }
  }

  switch (tokenType) {
    case "source_code_secret":
      return MITRE_MAP.code_access
    default:
      return MITRE_MAP.document_access
  }
}
