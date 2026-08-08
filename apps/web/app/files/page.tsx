import Link from "next/link"

import { listShare, repoDecoys, type ShareEntry } from "@/lib/fileshare"
import { ensureSeeded } from "@/lib/seed"
import { listHoneytokens } from "@/lib/store"

export const dynamic = "force-dynamic"

/**
 * 8C — Network share browser. An attacker prop, not product UI.
 *
 * The discovery step. Without it a demo has to open a decoy by pasting its
 * tracking URL, which reads as staged — the whole claim is that an intruder
 * finds these while looking around, so the looking around has to be shown.
 *
 * Styled as a Windows file share rather than as Watchtower: an attacker who
 * recognises the security product's design language knows to leave. Decoys are
 * listed among filler files with no visual distinction, because the moment
 * bait looks like bait it stops working.
 */
export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; ip?: string }>
}) {
  await ensureSeeded()
  const { path = "", ip } = await searchParams
  const at = path.split("/").filter(Boolean)

  const tokens = await listHoneytokens()
  const { folders, files } = listShare(tokens, at)
  const repos = at.length === 0 ? repoDecoys(tokens) : []

  const q = ip ? `&ip=${encodeURIComponent(ip)}` : ""
  const crumbs = ["fileserver", ...at]

  return (
    <div
      style={{
        fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
        background: "#f0f0f0",
        color: "#000",
        minHeight: "100vh",
        fontSize: 13,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          background: "linear-gradient(#fdfdfd,#eaeaea)",
          borderBottom: "1px solid #d0d0d0",
          padding: "7px 12px",
          fontSize: 12.5,
        }}
      >
        <strong style={{ fontWeight: 600 }}>
          {crumbs[crumbs.length - 1] === "fileserver"
            ? "fileserver"
            : crumbs[crumbs.length - 1]}
        </strong>
        <span style={{ color: "#555" }}> — File Explorer</span>
      </div>

      {/* Address bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "#f6f6f6",
          borderBottom: "1px solid #dcdcdc",
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#555" }}>Address:</span>
        <div
          style={{
            flex: "1 1 260px",
            minWidth: 0,
            background: "#fff",
            border: "1px solid #b5b5b5",
            padding: "4px 8px",
            fontFamily: "Consolas, monospace",
            fontSize: 12.5,
            overflowWrap: "anywhere",
          }}
        >
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && <span style={{ color: "#888" }}>\</span>}
              {i === 0 ? "\\\\" : ""}
              <Link
                href={`/files?path=${encodeURIComponent(
                  crumbs.slice(1, i + 1).join("/")
                )}${q}`}
                style={{ color: "#0645ad", textDecoration: "none" }}
              >
                {c}
              </Link>
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 12px 40px" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
            border: "1px solid #dcdcdc",
          }}
        >
          <thead>
            <tr style={{ background: "#f6f6f6" }}>
              <Th>Name</Th>
              <Th>Date modified</Th>
              <Th>Type</Th>
              <Th align="right">Size</Th>
            </tr>
          </thead>
          <tbody>
            {at.length > 0 && (
              <tr>
                <Td colSpan={4}>
                  <Link
                    href={`/files?path=${encodeURIComponent(
                      at.slice(0, -1).join("/")
                    )}${q}`}
                    style={{ color: "#0645ad", textDecoration: "none" }}
                  >
                    .. (up one level)
                  </Link>
                </Td>
              </tr>
            )}

            {folders.map((f) => (
              <Row key={f.path.join("/")} entry={f} q={q} />
            ))}
            {files.map((f) => (
              <Row key={f.path.join("/")} entry={f} q={q} />
            ))}

            {folders.length === 0 && files.length === 0 && (
              <tr>
                <Td colSpan={4}>
                  <span style={{ color: "#666" }}>This folder is empty.</span>
                </Td>
              </tr>
            )}
          </tbody>
        </table>

        {repos.length > 0 && (
          <>
            <div
              style={{
                margin: "22px 0 8px",
                fontSize: 12.5,
                color: "#444",
                fontWeight: 600,
              }}
            >
              Mapped repositories
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                background: "#fff",
                border: "1px solid #dcdcdc",
              }}
            >
              <tbody>
                {repos.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <a
                        href={`/share/${r.tracking_id}${ip ? `?ip=${encodeURIComponent(ip)}` : ""}`}
                        style={{ color: "#0645ad", textDecoration: "none" }}
                      >
                        {r.location}
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div style={{ marginTop: 14, fontSize: 11.5, color: "#777" }}>
          {folders.length} folders, {files.length} files · Connected as
          NIT\svc_fileshare
        </div>
      </div>
    </div>
  )
}

function Row({ entry, q }: { entry: ShareEntry; q: string }) {
  const isFolder = entry.kind === "folder"
  // Decoys and filler are linked identically. A decoy that behaved differently
  // in the listing would be identifiable without ever being opened.
  const href = isFolder
    ? `/files?path=${encodeURIComponent(entry.path.join("/"))}${q}`
    : entry.trackingId
      ? `/share/${entry.trackingId}${q ? `?${q.slice(1)}` : ""}`
      : undefined

  const label = isFolder ? "File folder" : typeLabel(entry.name)

  return (
    <tr>
      <Td>
        <span style={{ marginRight: 7 }}>{isFolder ? "📁" : "📄"}</span>
        {href ? (
          <a href={href} style={{ color: "#0645ad", textDecoration: "none" }}>
            {entry.name}
          </a>
        ) : (
          <span style={{ color: "#222" }}>{entry.name}</span>
        )}
      </Td>
      <Td>{entry.modified}</Td>
      <Td>{label}</Td>
      <Td align="right">{entry.size ?? ""}</Td>
    </tr>
  )
}

function typeLabel(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const map: Record<string, string> = {
    docx: "Microsoft Word Document",
    xlsx: "Microsoft Excel Worksheet",
    pdf: "PDF Document",
    txt: "Text Document",
    md: "Markdown File",
    csv: "CSV File",
    env: "ENV File",
    zip: "Compressed Folder",
    msi: "Windows Installer Package",
  }
  return map[ext] ?? "File"
}

const cell = {
  borderBottom: "1px solid #ececec",
  padding: "6px 10px",
  fontSize: 12.5,
  whiteSpace: "nowrap" as const,
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <th
      style={{
        ...cell,
        textAlign: align,
        fontWeight: 600,
        color: "#333",
        borderBottom: "1px solid #dcdcdc",
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = "left",
  colSpan,
}: {
  children: React.ReactNode
  align?: "left" | "right"
  colSpan?: number
}) {
  return (
    <td colSpan={colSpan} style={{ ...cell, textAlign: align }}>
      {children}
    </td>
  )
}
