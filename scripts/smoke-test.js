#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Smoke test against the Fortis sandbox using credentials from .env.local.
 * Verifies: (1) PayForm URL signing, (2) Fortis accepts the signed URL,
 * (3) auth headers are accepted by the REST API.
 *
 * No Medusa boot, no database. Run with: node scripts/smoke-test.js
 */
const fs = require("node:fs")
const path = require("node:path")

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local")
  if (!fs.existsSync(envPath)) {
    console.error(`Missing ${envPath}. Copy from .env.local.template and fill in.`)
    process.exit(1)
  }
  const lines = fs.readFileSync(envPath, "utf8").split("\n")
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 0) continue
    const k = line.slice(0, eq).trim()
    const v = line.slice(eq + 1).trim()
    if (process.env[k] === undefined) process.env[k] = v
  }
}

loadEnv()

const required = [
  "FORTIS_USER_ID",
  "FORTIS_USER_API_KEY",
  "FORTIS_DEVELOPER_ID",
  "FORTIS_USER_HASH_KEY",
  "FORTIS_LOCATION_ID",
  "FORTIS_API_BASE_URL",
]
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}`)
  process.exit(1)
}

const options = {
  userId: process.env.FORTIS_USER_ID,
  userApiKey: process.env.FORTIS_USER_API_KEY,
  developerId: process.env.FORTIS_DEVELOPER_ID,
  userHashKey: process.env.FORTIS_USER_HASH_KEY,
  locationId: process.env.FORTIS_LOCATION_ID,
  apiBaseUrl: process.env.FORTIS_API_BASE_URL,
}

const distPath = path.join(__dirname, "..", "dist", "index.js")
if (!fs.existsSync(distPath)) {
  console.error("dist/ not found. Run `pnpm build` first.")
  process.exit(1)
}
const { FortisClient, FortisHttpError, buildPayFormUrl } = require(distPath)

function redactUrl(url) {
  // Hide hash-key, user-id, developer-id values; keep structure visible.
  const u = new URL(url)
  for (const k of ["hash-key", "user-id", "developer-id"]) {
    if (u.searchParams.has(k)) u.searchParams.set(k, "<redacted>")
  }
  return u.toString()
}

async function step1_generateUrl() {
  console.log("\n[1/3] Generating PayForm URL...")
  const ccPtxId = process.env.FORTIS_CC_PRODUCT_TRANSACTION_ID
  if (!ccPtxId) {
    throw new Error("FORTIS_CC_PRODUCT_TRANSACTION_ID is required in .env.local")
  }
  const url = buildPayFormUrl(options, {
    payment_method: "cc",
    action: "authonly",
    transaction_amount: "1.00",
    transaction_api_id: `smoke_${Date.now()}`,
    product_transaction_id: ccPtxId,
  })
  // Decode the data param to verify the new envelope shape
  const decoded = Buffer.from(new URL(url).searchParams.get("data"), "hex").toString("utf8")
  console.log("  envelope preview:", decoded.slice(0, 200))
  const u = new URL(url)
  const required = ["developer-id", "hash-key", "user-id", "timestamp", "data"]
  const present = required.filter((k) => u.searchParams.has(k))
  console.log(`  origin: ${u.origin}${u.pathname}`)
  console.log(`  params present: ${present.length}/${required.length} → ${present.join(", ")}`)
  console.log(`  redacted URL: ${redactUrl(url)}`)
  if (present.length !== required.length) {
    throw new Error(`Missing URL params: ${required.filter((k) => !present.includes(k)).join(", ")}`)
  }
  // Decode the hex data param to confirm round-trip.
  const hex = u.searchParams.get("data")
  const json = Buffer.from(hex, "hex").toString("utf8")
  const parsed = JSON.parse(json)
  console.log(`  decoded data fields: ${Object.keys(parsed).sort().join(", ")}`)
  return url
}

function classify(status, body) {
  // AWS API Gateway 404-as-403 — request didn't match any route
  if (/Missing Authentication Token/i.test(body)) {
    return { kind: "wrong-host", note: "AWS API Gateway: route doesn't exist on this host" }
  }
  // Fortis-shaped auth rejection
  if (status === 401 && /Unauthorized|invalid credentials/i.test(body)) {
    return { kind: "bad-creds", note: "credentials rejected by Fortis" }
  }
  // Fortis-shaped permission rejection — auth OK, ACL not granted
  if (status === 403 && /Forbidden|do not have the privilege/i.test(body)) {
    return { kind: "no-privilege", note: "credentials OK, sandbox user lacks privilege" }
  }
  if (status === 404) {
    return { kind: "ok-resource-missing", note: "path works, resource not found (expected for bogus id)" }
  }
  if (status >= 200 && status < 300) {
    return { kind: "ok", note: "success" }
  }
  return { kind: "other", note: `unrecognized HTTP ${status}` }
}

async function step2_fetchUrl(url) {
  console.log("\n[2/3] Fetching the signed PayForm URL from Fortis sandbox...")
  const res = await fetch(url, { redirect: "manual" })
  const body = await res.text()
  const c = classify(res.status, body)
  console.log(`  HTTP ${res.status} → ${c.kind}: ${c.note}`)
  if (c.kind === "wrong-host") {
    throw new Error(`PayForm endpoint isn't on ${new URL(url).host} — fix FORTIS_API_BASE_URL`)
  }
  if (c.kind === "bad-creds") {
    throw new Error("PayForm signature/credentials rejected — verify hash-key and signing algorithm")
  }
  if (c.kind === "no-privilege") {
    console.log("  → signing works, account needs PayForm privilege grant from Fortis")
    return
  }
  if (c.kind !== "ok") {
    console.log(`  ⚠ unexpected response, body preview: ${body.slice(0, 160).replace(/\s+/g, " ").trim()}`)
  }
}

async function step3_authHeaders() {
  console.log("\n[3/3] Probing REST auth headers via GET /v2/transactions/<bogus-id>...")
  const client = new FortisClient(options)
  const bogusId = `smoke_probe_${Date.now()}`
  try {
    await client.getTransaction(bogusId)
    console.log(`  unexpected success — Fortis returned a transaction we never created`)
  } catch (err) {
    if (!(err instanceof FortisHttpError)) {
      console.error(`  unexpected non-HTTP error:`, err)
      throw err
    }
    const bodyStr = JSON.stringify(err.body)
    const c = classify(err.status, bodyStr)
    console.log(`  HTTP ${err.status} → ${c.kind}: ${c.note}`)
    if (c.kind === "wrong-host") {
      throw new Error(`REST API isn't on ${new URL(options.apiBaseUrl).host} — fix FORTIS_API_BASE_URL`)
    }
    if (c.kind === "bad-creds") {
      throw new Error("REST credentials rejected — verify user-id, user-api-key, developer-id")
    }
    if (c.kind === "no-privilege") {
      console.log("  → auth works, account needs transactions:read privilege grant from Fortis")
    }
  }
}

;(async () => {
  console.log(`Fortis smoke test — base URL: ${options.apiBaseUrl}`)
  const url = await step1_generateUrl()
  await step2_fetchUrl(url)
  await step3_authHeaders()
  console.log("\n✓ smoke test complete")
})().catch((err) => {
  console.error("\n✗ smoke test failed:", err.message || err)
  process.exit(1)
})
