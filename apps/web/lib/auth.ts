import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Operator authentication.
 *
 * A single shared passphrase, not user accounts. The threat model here is
 * "keep the console off the open internet", not "distinguish Alice from Bob" —
 * this platform has one operator role and no per-user data, so accounts would
 * add a user table and a password-reset flow without changing who can see what.
 *
 * The session cookie is an HMAC over an expiry timestamp, signed with the
 * passphrase itself. That keeps the whole thing stateless: no session table to
 * query on a request path that already talks to Postgres, and nothing to clean
 * up. Rotating the passphrase invalidates every existing session, which is the
 * behaviour you want from a shared secret anyway.
 */
export const SESSION_COOKIE = "wt_operator"

const SESSION_MS = 12 * 60 * 60 * 1000

/** Auth is off unless a passphrase is set, so the demo runs unprotected by
 *  default and a deployment opts in. Stated on /scope either way. */
export function authConfigured(): boolean {
  return Boolean(process.env.OPERATOR_PASSPHRASE)
}

function secret(): string {
  return process.env.OPERATOR_PASSPHRASE ?? ""
}

function sign(expiry: number): string {
  return createHmac("sha256", secret()).update(String(expiry)).digest("hex")
}

/** Cookie value: "<expiry-ms>.<hmac>". */
export function issueSession(): { value: string; maxAge: number } {
  const expiry = Date.now() + SESSION_MS
  return {
    value: `${expiry}.${sign(expiry)}`,
    maxAge: Math.floor(SESSION_MS / 1000),
  }
}

/**
 * Verifies a session cookie.
 *
 * The signature is compared with timingSafeEqual rather than `===`: string
 * comparison returns early on the first differing byte, which leaks how much
 * of a forged signature was correct and makes the remainder guessable.
 */
export function verifySession(value: string | undefined): boolean {
  if (!value || !authConfigured()) return false

  const [expiryRaw, mac] = value.split(".")
  if (!expiryRaw || !mac) return false

  const expiry = Number(expiryRaw)
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false

  const expected = sign(expiry)
  const a = Buffer.from(mac, "hex")
  const b = Buffer.from(expected, "hex")
  // Length must match before timingSafeEqual, which throws on mismatch.
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Constant-time passphrase check, for the same reason as above. */
export function checkPassphrase(candidate: string): boolean {
  if (!authConfigured()) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(secret())
  return a.length === b.length && timingSafeEqual(a, b)
}
