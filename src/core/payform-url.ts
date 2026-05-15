import { createHmac } from "node:crypto"
import type { FortisProviderOptions } from "../types/options"

/**
 * Transaction fields wrapped under `data.transaction` in the iframe URL payload.
 * Fortis's PayForm endpoint validates these against the transaction model.
 */
export interface PayFormDataInput {
  payment_method: "cc" | "ach"
  action: "sale" | "authonly" | "refund"
  /** Decimal-string amount in the major unit, e.g. "10.00". */
  transaction_amount: string
  /** Merchant-supplied correlation id. */
  transaction_api_id: string
  /** Fortis service id (configures which payment service to route through). */
  product_transaction_id: string
  location_id?: string
  [key: string]: unknown
}

/**
 * AccountForm transaction fields wrapped under `data.account_vault`.
 */
export interface AccountFormDataInput {
  payment_method: "cc" | "ach"
  location_id?: string
  /** Merchant-supplied id for the saved card; absence creates a new vault entry. */
  account_vault_api_id: string
  contact_id?: string
  [key: string]: unknown
}

/**
 * Iframe-behavior flags hoisted to the top level of the data envelope (not inside
 * `transaction`/`account_vault`). All optional — sensible defaults are applied.
 */
export interface PayFormIframeOptions {
  /** Post the result JSON to the parent window on submit. Default: 1 (enabled). */
  parent_send_message?: 0 | 1
  /** Have the iframe close itself on success. */
  parent_close?: 0 | 1
  redirect_url_on_approval?: string
  redirect_url_on_decline?: string
  /** Override the per-merchant stylesheet from options. */
  stylesheet_url?: string
}

interface BuildIframeUrlInput {
  options: FortisProviderOptions
  formPath: "/v2/payform" | "/v2/accountform"
  data: Record<string, unknown>
  now?: () => number
}

export function buildPayFormUrl(
  options: FortisProviderOptions,
  data: PayFormDataInput,
  iframeOptions: PayFormIframeOptions = {},
  now?: () => number,
): string {
  return buildIframeUrl({
    options,
    formPath: "/v2/payform",
    data: wrapDataPayload(options, "transaction", data, iframeOptions),
    now,
  })
}

export function buildAccountFormUrl(
  options: FortisProviderOptions,
  data: AccountFormDataInput,
  iframeOptions: PayFormIframeOptions = {},
  now?: () => number,
): string {
  return buildIframeUrl({
    options,
    formPath: "/v2/accountform",
    data: wrapDataPayload(options, "account_vault", data, iframeOptions),
    now,
  })
}

function wrapDataPayload(
  options: FortisProviderOptions,
  envelopeKey: "transaction" | "account_vault",
  data: Record<string, unknown>,
  iframeOptions: PayFormIframeOptions,
): Record<string, unknown> {
  const envelope: Record<string, unknown> = {
    [envelopeKey]: {
      location_id: options.locationId,
      ...data,
    },
    // Default postMessage on; consumer can disable by passing parent_send_message: 0
    parent_send_message: iframeOptions.parent_send_message ?? 1,
    ...iframeOptions,
  }
  if (options.stylesheetUrl && !iframeOptions.stylesheet_url) {
    envelope.stylesheet_url = options.stylesheetUrl
  }
  return envelope
}

function buildIframeUrl({ options, formPath, data, now }: BuildIframeUrlInput): string {
  const timestamp = Math.floor((now?.() ?? Date.now()) / 1000).toString()
  const json = JSON.stringify(data)
  const hex = Buffer.from(json, "utf8").toString("hex")
  const hash = createHmac("sha256", options.userHashKey)
    .update(options.userId + timestamp)
    .digest("hex")

  const params = new URLSearchParams({
    "developer-id": options.developerId,
    "hash-key": hash,
    "user-id": options.userId,
    timestamp,
    data: hex,
  })

  return `${options.apiBaseUrl}${formPath}?${params.toString()}`
}
