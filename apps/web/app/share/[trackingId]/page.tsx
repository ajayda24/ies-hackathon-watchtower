import { ensureSeeded } from "@/lib/seed"
import { getHoneytokenByTrackingId } from "@/lib/store"

export const dynamic = "force-dynamic"

/**
 * 8B — Decoy document viewer. An attacker prop, not product UI.
 *
 * Rendered plain, like a file-share preview. The tracking pixel at the bottom
 * is what actually fires the `access` event: no script required, which is why
 * this technique works inside real documents too.
 */
export default async function DecoyDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ trackingId: string }>
  searchParams: Promise<{ ip?: string }>
}) {
  ensureSeeded()
  const { trackingId } = await params
  const { ip } = await searchParams
  const token = getHoneytokenByTrackingId(trackingId)

  // The pixel carries the demo's source-IP override so the "attacker" presents
  // a distinct address from the dashboard operator.
  const pixelSrc = `/api/track/${trackingId}${ip ? `?ip=${encodeURIComponent(ip)}` : ""}`

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        background: "#fff",
        color: "#000",
        minHeight: "100vh",
        padding: "30px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 620,
          margin: "0 auto",
          border: "1px solid #999",
          padding: "18px 20px 24px",
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "#444",
            background: "#e8e8e8",
            borderBottom: "1px solid #bbb",
            margin: "-18px -20px 16px",
            padding: "6px 8px",
            wordBreak: "break-all",
          }}
        >
          {token?.location ?? "file://fileserver/shared"}
        </div>

        <div style={{ font: "bold 15px/1.3 Arial", marginBottom: 12 }}>
          {token?.name ?? "Document"}
        </div>

        {token ? (
          <>
            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                borderTop: "1px solid #ddd",
                paddingTop: 12,
              }}
            >
              {token.content}
            </div>

            <table
              style={{
                borderCollapse: "collapse",
                fontSize: 11.5,
                width: "100%",
                marginTop: 16,
              }}
            >
              <tbody>
                <tr style={{ background: "#eee" }}>
                  <th style={cell}>Ref</th>
                  <th style={cell}>Item</th>
                  <th style={cell}>Owner</th>
                </tr>
                <tr>
                  <td style={cellMono}>NIT-40182</td>
                  <td style={cellPlain}>Assembly tolerance sheet</td>
                  <td style={cellPlain}>R. Iyer</td>
                </tr>
                <tr>
                  <td style={cellMono}>NIT-40185</td>
                  <td style={cellPlain}>Supplier schedule Q3</td>
                  <td style={cellPlain}>M. Fernandes</td>
                </tr>
                <tr>
                  <td style={cellMono}>NIT-40190</td>
                  <td style={cellPlain}>Housing revision notes</td>
                  <td style={cellPlain}>R. Iyer</td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontSize: 11, color: "#777", marginTop: 14 }}>
              Every value in this file is synthetic. Opening it logged an access
              event.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: "#555" }}>
            This document is no longer available.
          </div>
        )}

        {/* The trigger. No JavaScript involved — an image request is enough. */}
        <img src={pixelSrc} width={1} height={1} alt="" style={{ opacity: 0 }} />
      </div>
    </div>
  )
}

const cell = {
  border: "1px solid #bbb",
  padding: 4,
  textAlign: "left" as const,
}
const cellPlain = { border: "1px solid #ddd", padding: 4 }
const cellMono = { ...cellPlain, fontFamily: "monospace" }
