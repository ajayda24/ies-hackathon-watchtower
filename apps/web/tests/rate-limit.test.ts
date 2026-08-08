import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"

import {
  checkRateLimit,
  resetRateLimits,
  ruleFor,
} from "../lib/rate-limit.ts"

/**
 * Rate limiter behaviour.
 *
 * The clock is injected rather than mocked globally, so window expiry can be
 * tested without sleeping and without leaving a patched Date behind for the
 * next file.
 */

const RULE = { limit: 3, windowMs: 1000 }

describe("rule selection", () => {
  it("matches the detection surfaces", () => {
    assert.ok(ruleFor("/api/track/wt_abc"))
    assert.ok(ruleFor("/api/decoy/login"))
    assert.ok(ruleFor("/api/auth"))
  })

  it("leaves the operator console unlimited", () => {
    // The dashboard polls every 2s by design; limiting it would break the
    // product to defend an endpoint nobody outside can reach anyway.
    assert.equal(ruleFor("/api/overview"), null)
    assert.equal(ruleFor("/api/incidents/abc"), null)
  })

  it("does not match a path that merely starts with the same letters", () => {
    assert.equal(ruleFor("/api/trackers"), null)
  })
})

describe("fixed window", () => {
  beforeEach(() => resetRateLimits())

  it("allows requests up to the limit", () => {
    for (let i = 0; i < RULE.limit; i++) {
      const r = checkRateLimit("k", RULE, 1000)
      assert.equal(r.ok, true, `request ${i + 1} should pass`)
    }
  })

  it("blocks the request after the limit", () => {
    for (let i = 0; i < RULE.limit; i++) checkRateLimit("k", RULE, 1000)
    const blocked = checkRateLimit("k", RULE, 1000)

    assert.equal(blocked.ok, false)
    assert.equal(blocked.remaining, 0)
    assert.ok(blocked.retryAfter > 0, "a block must say when to retry")
  })

  it("reports remaining requests accurately", () => {
    assert.equal(checkRateLimit("k", RULE, 1000).remaining, 2)
    assert.equal(checkRateLimit("k", RULE, 1000).remaining, 1)
    assert.equal(checkRateLimit("k", RULE, 1000).remaining, 0)
  })

  it("keeps separate keys independent", () => {
    for (let i = 0; i < RULE.limit; i++) checkRateLimit("a", RULE, 1000)
    assert.equal(checkRateLimit("a", RULE, 1000).ok, false)
    // One flooded source must not lock out everyone else.
    assert.equal(checkRateLimit("b", RULE, 1000).ok, true)
  })

  it("resets once the window elapses", () => {
    for (let i = 0; i < RULE.limit; i++) checkRateLimit("k", RULE, 1000)
    assert.equal(checkRateLimit("k", RULE, 1000).ok, false)

    // Just past the window boundary.
    const after = checkRateLimit("k", RULE, 1000 + RULE.windowMs + 1)
    assert.equal(after.ok, true)
    assert.equal(after.remaining, RULE.limit - 1)
  })

  it("keeps blocking for the remainder of the window", () => {
    for (let i = 0; i < RULE.limit; i++) checkRateLimit("k", RULE, 1000)
    // Mid-window: still blocked, and the retry hint has shrunk.
    const mid = checkRateLimit("k", RULE, 1500)
    assert.equal(mid.ok, false)
    assert.ok(mid.retryAfter <= 1)
  })

  it("does not overflow on a sustained flood", () => {
    for (let i = 0; i < 5000; i++) checkRateLimit("flood", RULE, 1000)
    const r = checkRateLimit("flood", RULE, 1000)
    assert.equal(r.ok, false)
    assert.equal(r.remaining, 0)
  })
})
