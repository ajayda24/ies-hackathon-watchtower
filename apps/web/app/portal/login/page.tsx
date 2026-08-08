/**
 * 8A — Decoy login portal. An attacker prop, not product UI.
 *
 * Styled as a real but dated internal web app: the banner-and-panel layout
 * institutions actually run, circa an ASP.NET or Java portal that has been
 * reskinned once and left alone. Earlier this was deliberately bare, which
 * read as unfinished rather than as old — and an attacker who thinks a page is
 * unfinished treats it as a test system and moves on, which is the one
 * response a decoy cannot afford.
 *
 * Everything on it must be plausible and nothing on it may be Watchtower's
 * design language. If this looked like the console, an attacker would
 * recognise the security product and leave.
 *
 * Submits to /api/decoy/login, which returns the same 401 whether or not the
 * username matched a planted decoy.
 */
export default async function DecoyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ ip?: string; error?: string }>
}) {
  const { ip, error } = await searchParams
  const action = `/api/decoy/login${ip ? `?ip=${encodeURIComponent(ip)}` : ""}`

  return (
    <div
      style={{
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        background: "#eceff1",
        color: "#1a1a1a",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Institutional banner. The maroon-and-grey of a university IT service. */}
      <header
        style={{
          background: "#7b1e2b",
          color: "#fff",
          padding: "14px clamp(14px, 5vw, 32px)",
          borderBottom: "3px solid #5c161f",
        }}
      >
        <div
          style={{
            maxWidth: 940,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 34,
              height: 34,
              border: "2px solid rgba(255,255,255,.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: ".02em",
              flex: "none",
            }}
          >
            NIT
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.2 }}>
              Northfield Institute of Technology
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Information Technology Services
            </div>
          </div>
        </div>
      </header>

      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #d6d9dc",
          padding: "0 clamp(14px, 5vw, 32px)",
        }}
      >
        <div
          style={{
            maxWidth: 940,
            margin: "0 auto",
            display: "flex",
            gap: 20,
            fontSize: 12.5,
            flexWrap: "wrap",
          }}
        >
          {["Home", "Staff Portal", "Student Portal", "Helpdesk", "Directory"].map(
            (t, i) => (
              <span
                key={t}
                style={{
                  padding: "9px 0",
                  borderBottom: i === 1 ? "3px solid #7b1e2b" : "3px solid transparent",
                  color: i === 1 ? "#7b1e2b" : "#31577a",
                  fontWeight: i === 1 ? 600 : 400,
                  cursor: "default",
                }}
              >
                {t}
              </span>
            )
          )}
        </div>
      </div>

      <main
        style={{
          flex: 1,
          padding: "clamp(20px, 5vw, 44px) clamp(14px, 5vw, 32px)",
        }}
      >
        <div
          style={{
            maxWidth: 940,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "clamp(18px, 4vw, 34px)",
            alignItems: "start",
          }}
        >
          {/* Sign-in panel */}
          <section
            style={{
              background: "#fff",
              border: "1px solid #c9ced3",
              boxShadow: "0 1px 2px rgba(0,0,0,.06)",
            }}
          >
            <h1
              style={{
                margin: 0,
                padding: "11px 16px",
                fontSize: 14.5,
                fontWeight: 600,
                background: "#f4f6f8",
                borderBottom: "1px solid #d6d9dc",
                color: "#2b2b2b",
              }}
            >
              Sign in to Staff Portal
            </h1>

            <div style={{ padding: "18px 16px 22px" }}>
              {error && (
                <div
                  role="alert"
                  style={{
                    background: "#fdecea",
                    border: "1px solid #e0b4b0",
                    color: "#8a1c13",
                    padding: "8px 10px",
                    fontSize: 12.5,
                    marginBottom: 14,
                  }}
                >
                  The username or password you entered is incorrect.
                </div>
              )}

              <form method="post" action={action}>
                <label
                  htmlFor="username"
                  style={{ display: "block", fontSize: 12.5, marginBottom: 4 }}
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  autoComplete="off"
                  style={inputStyle}
                />

                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    marginBottom: 4,
                    marginTop: 12,
                  }}
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="off"
                  style={inputStyle}
                />

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    margin: "12px 0 16px",
                    color: "#333",
                  }}
                >
                  <input type="checkbox" name="remember" /> Keep me signed in
                </label>

                <button
                  type="submit"
                  style={{
                    background: "linear-gradient(#8c2333,#711926)",
                    border: "1px solid #5c161f",
                    color: "#fff",
                    padding: "7px 20px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Sign in
                </button>
              </form>

              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: "1px solid #e6e9ec",
                  fontSize: 12,
                  lineHeight: 1.7,
                }}
              >
                <a href="#" style={linkStyle}>
                  Forgot your password?
                </a>
                <br />
                <a href="#" style={linkStyle}>
                  Activate a new staff account
                </a>
              </div>
            </div>
          </section>

          {/* Notices. Filler that makes the page feel maintained by someone. */}
          <aside style={{ fontSize: 12.5, color: "#333" }}>
            <h2
              style={{
                margin: "0 0 10px",
                fontSize: 14,
                fontWeight: 600,
                color: "#7b1e2b",
              }}
            >
              Service notices
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75 }}>
              <li>
                Scheduled maintenance on the file server: Sunday 02:00–04:00.
                Shared drives may be briefly unavailable.
              </li>
              <li>
                Password policy update — staff passwords must now be changed
                every 180 days.
              </li>
              <li>
                Phishing advisory: ITS will never ask for your password by
                email. Report suspicious messages to ext. 214.
              </li>
            </ul>

            <div
              style={{
                marginTop: 18,
                padding: "10px 12px",
                background: "#fffbe6",
                border: "1px solid #e8dca4",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              <strong>Notice:</strong> This system is for authorised users only.
              Activity may be monitored and recorded.
            </div>
          </aside>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid #d6d9dc",
          background: "#f4f6f8",
          padding: "12px clamp(14px, 5vw, 32px)",
          fontSize: 11.5,
          color: "#666",
        }}
      >
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          © Northfield Institute of Technology · ITS Helpdesk ext. 214 ·
          Portal v3.4.1
        </div>
      </footer>
    </div>
  )
}

const inputStyle = {
  width: "100%",
  border: "1px solid #a6acb2",
  padding: "7px 8px",
  // 16px minimum: iOS zooms the viewport on focus below this, which looks like
  // a broken page mid-demo.
  fontSize: 16,
  fontFamily: "inherit",
  background: "#fff",
  boxSizing: "border-box" as const,
}

const linkStyle = { color: "#31577a", textDecoration: "underline" }
