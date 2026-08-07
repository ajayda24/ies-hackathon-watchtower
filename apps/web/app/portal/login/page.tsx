/**
 * 8A — Decoy login portal. An attacker prop, not product UI.
 *
 * Deliberately styled like an ordinary internal web app from 2011: system
 * fonts, default borders, no design system. If this looked like Watchtower the
 * illusion would break, and a real attacker would know to avoid it.
 *
 * Submits to /api/decoy/login, which returns the same 401 whether or not the
 * username matched a planted decoy.
 */
export default function DecoyLoginPage() {
  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        background: "#fff",
        color: "#000",
        minHeight: "100vh",
        padding: "clamp(16px, 5vw, 40px) clamp(12px, 4vw, 20px)",
      }}
    >
      <div
        style={{
          maxWidth: 380,
          margin: "0 auto",
          border: "1px solid #999",
          padding: "clamp(18px, 5vw, 26px) clamp(16px, 5vw, 24px) 30px",
        }}
      >
        <div style={{ font: "bold 17px/1.3 Arial", marginBottom: 2 }}>
          Northfield IT Portal
        </div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 20 }}>
          Internal use only. Sign in with your campus account.
        </div>

        <form method="post" action="/api/decoy/login">
          <div style={{ fontSize: 12, marginBottom: 3 }}>Username</div>
          <input
            name="username"
            autoComplete="off"
            style={{
              width: "100%",
              border: "1px solid #767676",
              padding: "6px 6px",
              fontFamily: "monospace",
              // 16px minimum: iOS zooms the viewport on focus below this, which
              // looks like a broken page mid-demo.
              fontSize: 16,
              marginBottom: 12,
              background: "#fff",
            }}
          />

          <div style={{ fontSize: 12, marginBottom: 3 }}>Password</div>
          <input
            name="password"
            type="password"
            autoComplete="off"
            style={{
              width: "100%",
              border: "1px solid #767676",
              padding: "6px 6px",
              fontFamily: "monospace",
              // 16px minimum: iOS zooms the viewport on focus below this, which
              // looks like a broken page mid-demo.
              fontSize: 16,
              marginBottom: 16,
              background: "#fff",
            }}
          />

          <button
            type="submit"
            style={{
              border: "1px solid #767676",
              background: "#efefef",
              padding: "4px 14px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Sign in
          </button>
        </form>

        <div style={{ fontSize: 11, color: "#777", marginTop: 18 }}>
          Forgot your password? Contact IT ext. 214.
        </div>
      </div>
    </div>
  )
}
