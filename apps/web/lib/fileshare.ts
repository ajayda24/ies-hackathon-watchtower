import type { Honeytoken } from "./types"

/**
 * Builds a browsable folder tree from decoy locations.
 *
 * The tree is derived, not authored: every decoy already records a UNC path
 * like `\\fileserver\it\runbooks\domain-recovery.docx`, so the share structure
 * falls out of the data. That matters for the demo — a hand-written tree would
 * drift the moment someone generates a new decoy, and the share would stop
 * matching the console.
 *
 * Decoys are mixed with filler files that lead nowhere. A share containing
 * nothing but bait is not a share, it is a trap with a sign on it, and an
 * attacker who notices every file is interesting has learned something.
 */

export interface ShareEntry {
  name: string
  kind: "folder" | "file"
  /** Path segments below the share root. */
  path: string[]
  size?: string
  modified: string
  /** Present only for decoys — the link target that fires the access event. */
  trackingId?: string
  type?: string
}

const ROOT = "fileserver"

/** Filler content per top-level folder. None of these are instrumented: they
 *  exist so the share reads like a working department drive. */
const FILLER: Record<string, Array<[string, string, string]>> = {
  it: [
    ["asset-register-2025.xlsx", "84 KB", "2026-05-12 09:41"],
    ["printer-map.pdf", "1.2 MB", "2025-11-03 14:22"],
    ["onboarding-checklist.docx", "31 KB", "2026-02-18 11:07"],
    ["vpn-client-3.4.msi", "18.6 MB", "2026-01-09 16:55"],
  ],
  mech: [
    ["shop-safety-induction.pdf", "2.8 MB", "2025-09-30 08:15"],
    ["lathe-maintenance-log.xlsx", "112 KB", "2026-06-21 13:48"],
    ["material-order-Q2.csv", "9 KB", "2026-04-02 10:30"],
  ],
  admin: [
    ["timetable-draft-sem2.xlsx", "245 KB", "2026-07-14 15:12"],
    ["staff-contact-list.docx", "62 KB", "2026-03-27 09:03"],
    ["invoice-template.docx", "48 KB", "2025-08-11 12:40"],
  ],
  research: [
    ["grant-proposal-final.docx", "301 KB", "2026-06-02 17:26"],
    ["cluster-usage-report.pdf", "890 KB", "2026-07-30 08:59"],
  ],
  civil: [
    ["site-survey-photos.zip", "44.1 MB", "2026-05-19 07:34"],
    ["concrete-mix-spec.pdf", "1.7 MB", "2025-12-08 11:19"],
  ],
}

/**
 * Filler for leaf folders, keyed loosely off the folder name.
 *
 * Deterministic rather than random: the same folder must look the same on
 * every render, or a demo that revisits a path shows different files and the
 * share stops reading as a real filesystem.
 */
function genericFiller(folder: string): Array<[string, string, string]> {
  if (/runbook|recovery|ops/.test(folder)) {
    return [
      ["ups-shutdown-procedure.docx", "27 KB", "2025-10-14 09:52"],
      ["oncall-rota-2026.xlsx", "41 KB", "2026-06-08 08:20"],
    ]
  }
  if (/cred|account|svc|licens|licenc/.test(folder)) {
    return [
      ["renewal-dates.xlsx", "22 KB", "2026-03-11 14:05"],
      ["vendor-contacts.txt", "3 KB", "2025-07-29 10:41"],
    ]
  }
  if (/record|finance|invoice/.test(folder)) {
    return [
      ["retention-policy.pdf", "310 KB", "2025-11-22 16:31"],
      ["reconciliation-jun.xlsx", "88 KB", "2026-07-05 11:58"],
    ]
  }
  if (/drawing|cad|project|survey/.test(folder)) {
    return [
      ["revision-history.xlsx", "56 KB", "2026-05-27 13:19"],
      ["as-built-notes.pdf", "1.4 MB", "2026-02-09 15:44"],
    ]
  }
  return [
    ["notes.txt", "2 KB", "2026-01-16 12:03"],
    ["archive-2024.zip", "12.7 MB", "2025-04-30 17:12"],
  ]
}

/** Plausible sizes per decoy type, so bait does not stand out by having none. */
function sizeFor(type: string): string {
  switch (type) {
    case "document":
      return "168 KB"
    case "api_key":
    case "source_code_secret":
      return "2 KB"
    default:
      return "4 KB"
  }
}

/**
 * Splits a stored location into path segments below the share root.
 *
 * Returns null for anything that is not a `\\fileserver\...` path — the
 * source-code decoy records a git remote, which belongs in a repository view
 * rather than a file share, and forcing it into the tree would misrepresent
 * where an attacker would actually find it.
 */
function segmentsOf(location: string): string[] | null {
  const normalised = location.replace(/^\\\\/, "").replace(/\\/g, "/")
  if (!normalised.toLowerCase().startsWith(`${ROOT}/`)) return null
  return normalised
    .slice(ROOT.length + 1)
    .split("/")
    .filter(Boolean)
}

export interface ShareListing {
  /** Folders directly inside the requested path. */
  folders: ShareEntry[]
  /** Files directly inside the requested path. */
  files: ShareEntry[]
}

/**
 * Lists one directory of the share.
 *
 * `at` is the path below the root — `[]` is the share root itself.
 */
export function listShare(tokens: Honeytoken[], at: string[]): ShareListing {
  const folders = new Map<string, ShareEntry>()
  const files: ShareEntry[] = []

  for (const token of tokens) {
    const segments = segmentsOf(token.location)
    if (!segments) continue

    // Only entries under the requested path are visible from here.
    if (segments.length < at.length) continue
    if (!at.every((seg, i) => segments[i]?.toLowerCase() === seg.toLowerCase())) {
      continue
    }

    const rest = segments.slice(at.length)
    if (rest.length === 0) continue

    if (rest.length === 1) {
      // A location ending in a separator names a folder, not a file: the
      // document decoys record the directory they sit in.
      const isFolder = /[\\/]$/.test(token.location)
      if (isFolder) {
        if (!folders.has(rest[0]!)) {
          folders.set(rest[0]!, {
            name: rest[0]!,
            kind: "folder",
            path: [...at, rest[0]!],
            modified: "2026-07-22 10:14",
          })
        }
        continue
      }
      files.push({
        name: rest[0]!,
        kind: "file",
        path: [...at, rest[0]!],
        size: sizeFor(token.type),
        modified: "2026-07-22 10:14",
        trackingId: token.tracking_id,
        type: token.type,
      })
    } else if (!folders.has(rest[0]!)) {
      folders.set(rest[0]!, {
        name: rest[0]!,
        kind: "folder",
        path: [...at, rest[0]!],
        modified: "2026-06-30 16:02",
      })
    }
  }

  // Document decoys record a directory rather than a filename, so surface them
  // as a file inside that directory using the decoy's own name.
  for (const token of tokens) {
    const segments = segmentsOf(token.location)
    if (!segments || !/[\\/]$/.test(token.location)) continue
    if (segments.length !== at.length) continue
    if (!at.every((seg, i) => segments[i]?.toLowerCase() === seg.toLowerCase())) {
      continue
    }
    files.push({
      name: `${token.name}.docx`,
      kind: "file",
      path: [...at, token.name],
      size: sizeFor(token.type),
      modified: "2026-07-28 14:36",
      trackingId: token.tracking_id,
      type: token.type,
    })
  }

  // Filler, so no folder consists entirely of bait.
  //
  // Depth matters here. Department roots get their own themed filler, but the
  // leaf folders are where decoys actually sit, and a folder holding two files
  // that are both instrumented is a trap an attentive attacker would notice.
  // Generic filler is added wherever a decoy appears alongside too little else.
  const top = at[0]?.toLowerCase()
  if (at.length === 1 && top && FILLER[top]) {
    for (const [name, size, modified] of FILLER[top]) {
      files.push({ name, kind: "file", path: [...at, name], size, modified })
    }
  } else if (at.length > 1 && files.length > 0) {
    const leaf = at[at.length - 1]!.toLowerCase()
    for (const [name, size, modified] of genericFiller(leaf)) {
      files.push({ name, kind: "file", path: [...at, name], size, modified })
    }
  }

  return {
    folders: [...folders.values()].sort((a, b) => a.name.localeCompare(b.name)),
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** Decoys that live in a code repository rather than the file share. */
export function repoDecoys(tokens: Honeytoken[]): Honeytoken[] {
  return tokens.filter((t) => segmentsOf(t.location) === null)
}
