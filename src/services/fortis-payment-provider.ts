import {
  AbstractPaymentProvider,
  Modules,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  BigNumberInput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  IPaymentModuleService,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { randomUUID } from "node:crypto"
import { FortisClient, FortisHttpError } from "../core/fortis-client"
import { buildPayFormUrl } from "../core/payform-url"
import { mapFortisStatus } from "../core/status-mapping"
import { FortisStatus, type FortisTransaction } from "../types/api"
import type { FortisProviderOptions } from "../types/options"

export interface FortisSessionData extends Record<string, unknown> {
  /** Signed PayForm iframe URL the storefront renders. Set on initiate/update. */
  payform_url?: string
  /** Correlation id passed to Fortis as transaction_api_id. Set on initiate. */
  transaction_api_id: string
  /** Fortis-side transaction id. Set after iframe postMessage or webhook arrives. */
  fortis_transaction_id?: string
  /** Snapshot of the most recently fetched transaction. */
  transaction?: FortisTransaction
}

export class FortisPaymentProvider extends AbstractPaymentProvider<FortisProviderOptions> {
  static identifier = "fortis"

  private readonly client: FortisClient

  constructor(container: Record<string, unknown>, options: FortisProviderOptions) {
    super(container, options)
    this.client = new FortisClient(options)
  }

  static validateOptions(options: Record<string, unknown>): void {
    const required: Array<keyof FortisProviderOptions> = [
      "userId",
      "userApiKey",
      "developerId",
      "userHashKey",
      "locationId",
      "apiBaseUrl",
      "ccProductTransactionId",
    ]
    const missing = required.filter((k) => !options[k])
    if (missing.length > 0) {
      throw new Error(
        `medusa-payment-fortis: missing required options: ${missing.join(", ")}`,
      )
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentOutput> {
    try {
      const transaction_api_id = `medusa_${randomUUID()}`
      const payform_url = buildPayFormUrl(this.config, {
        payment_method: "cc",
        action: this.intentAction(),
        transaction_amount: formatAmount(input.amount),
        transaction_api_id,
        product_transaction_id: this.config.ccProductTransactionId,
      })
      const data: FortisSessionData = { payform_url, transaction_api_id }
      return { id: transaction_api_id, data }
    } catch (e) {
      throw this.buildError("initiatePayment failed", e)
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> {
    const session = (input.data ?? {}) as FortisSessionData
    if (!session.fortis_transaction_id) {
      return { status: PaymentSessionStatus.PENDING, data: session }
    }

    try {
      const tx = await this.client.getTransaction(session.fortis_transaction_id)
      if (tx.status_id === FortisStatus.Declined) {
        throw this.buildDeclineError(tx)
      }
      return {
        status: mapFortisStatus(tx),
        data: { ...session, transaction: tx },
      }
    } catch (e) {
      if (isDeclineError(e)) throw e
      throw this.buildError("authorizePayment failed", e)
    }
  }

  async capturePayment(
    input: CapturePaymentInput,
  ): Promise<CapturePaymentOutput> {
    const session = requireFortisId(input.data, "capture")
    try {
      // If the original action was `sale`, the transaction is already captured; no-op.
      const current = await this.client.getTransaction(session.fortis_transaction_id)
      if (mapFortisStatus(current) === PaymentSessionStatus.CAPTURED) {
        return { data: { ...session, transaction: current } }
      }
      const tx = await this.client.updateTransaction(session.fortis_transaction_id, {
        transaction: { action: "authcomplete" },
      })
      return { data: { ...session, transaction: tx } }
    } catch (e) {
      throw this.buildError("capturePayment failed", e)
    }
  }

  async refundPayment(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentOutput> {
    const session = requireFortisId(input.data, "refund")
    try {
      const tx = await this.client.createTransaction({
        transaction: {
          action: "refund",
          payment_method: "cc",
          previous_transaction_id: session.fortis_transaction_id,
          transaction_amount: formatAmount(input.amount),
          location_id: this.config.locationId,
        },
      })
      return { data: { ...session, last_refund: tx } }
    } catch (e) {
      throw this.buildError("refundPayment failed", e)
    }
  }

  async cancelPayment(
    input: CancelPaymentInput,
  ): Promise<CancelPaymentOutput> {
    const session = (input.data ?? {}) as FortisSessionData
    if (!session.fortis_transaction_id) {
      return { data: session }
    }
    try {
      const current = await this.client.getTransaction(session.fortis_transaction_id)
      const action = String(current.action ?? "")
      const isUnsettledAuth =
        current.status_id === FortisStatus.Approved &&
        (action === "authonly" || action === "authincrement")

      const result = isUnsettledAuth
        ? await this.client.updateTransaction(session.fortis_transaction_id, {
            transaction: { action: "void" },
          })
        : await this.client.createTransaction({
            transaction: {
              action: "refund",
              payment_method: "cc",
              previous_transaction_id: session.fortis_transaction_id,
              transaction_amount: current.transaction_amount,
              location_id: this.config.locationId,
            },
          })

      return { data: { ...session, transaction: result } }
    } catch (e) {
      throw this.buildError("cancelPayment failed", e)
    }
  }

  async retrievePayment(
    input: RetrievePaymentInput,
  ): Promise<RetrievePaymentOutput> {
    const session = (input.data ?? {}) as FortisSessionData
    if (!session.fortis_transaction_id) {
      return { data: session }
    }
    try {
      const tx = await this.client.getTransaction(session.fortis_transaction_id)
      return { data: { ...session, transaction: tx } }
    } catch (e) {
      throw this.buildError("retrievePayment failed", e)
    }
  }

  async updatePayment(
    input: UpdatePaymentInput,
  ): Promise<UpdatePaymentOutput> {
    const session = (input.data ?? {}) as FortisSessionData
    // Once the iframe has submitted and we have a Fortis tx id, the amount is locked.
    if (session.fortis_transaction_id) {
      return { data: session }
    }
    try {
      const transaction_api_id = session.transaction_api_id ?? `medusa_${randomUUID()}`
      const payform_url = buildPayFormUrl(this.config, {
        payment_method: "cc",
        action: this.intentAction(),
        transaction_amount: formatAmount(input.amount),
        transaction_api_id,
        product_transaction_id: this.config.ccProductTransactionId,
      })
      return { data: { ...session, payform_url, transaction_api_id } }
    } catch (e) {
      throw this.buildError("updatePayment failed", e)
    }
  }

  async deletePayment(
    input: DeletePaymentInput,
  ): Promise<DeletePaymentOutput> {
    // Fortis transactions can't be deleted, only voided/refunded.
    // Cancellation belongs in cancelPayment; here we just drop the local session.
    return { data: input.data ?? {} }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusOutput> {
    const session = (input.data ?? {}) as FortisSessionData
    if (!session.fortis_transaction_id) {
      return { status: PaymentSessionStatus.PENDING, data: session }
    }
    try {
      const tx = await this.client.getTransaction(session.fortis_transaction_id)
      return {
        status: mapFortisStatus(tx),
        data: { ...session, transaction: tx },
      }
    } catch (e) {
      throw this.buildError("getPaymentStatus failed", e)
    }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    const body = (payload.data ?? {}) as Record<string, unknown>
    if (String(body.resource ?? "") !== "transaction") {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    let tx: FortisTransaction
    try {
      const raw = body.data
      tx = typeof raw === "string" ? JSON.parse(raw) : (raw as FortisTransaction)
    } catch {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const action = toWebhookAction(tx)
    if (!action) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const sessionId = await this.findSessionIdForTransaction(tx)
    if (!sessionId) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    return {
      action,
      data: {
        session_id: sessionId,
        amount: Number(tx.transaction_amount ?? 0),
      },
    }
  }

  /**
   * The Fortis action this provider uses when the storefront initiates payment.
   * `sale` captures immediately; `authonly` reserves funds for a later capture.
   */
  private intentAction(): "sale" | "authonly" {
    return this.config.capture ? "sale" : "authonly"
  }

  /**
   * Map a Fortis postback back to a Medusa payment_session.id.
   *
   * Fortis postbacks carry our `transaction_api_id` (set at initiate as a random UUID),
   * which is *not* the Medusa session id — Medusa generates the session id only after
   * `initiatePayment` returns. We recover the session id by listing recent Fortis-provider
   * sessions and matching on `data.transaction_api_id`.
   *
   * O(n) over Fortis sessions; fine for typical merchant volumes. For high-volume stores,
   * stamp the Medusa session id back into Fortis (e.g. via transaction edit + description)
   * during the confirm flow and read it from there instead.
   */
  private async findSessionIdForTransaction(
    tx: FortisTransaction,
  ): Promise<string | undefined> {
    const apiId = tx.transaction_api_id
    if (!apiId) return undefined

    const container = this.container as {
      resolve: <T>(key: string) => T
    }
    let paymentModule: IPaymentModuleService
    try {
      paymentModule = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    } catch {
      return undefined
    }

    const sessions = await paymentModule.listPaymentSessions(
      { provider_id: "pp_fortis_fortis" },
      { take: 200, order: { created_at: "DESC" } },
    )
    return sessions.find((s) => {
      const data = s.data as { transaction_api_id?: string } | null
      return data?.transaction_api_id === apiId
    })?.id
  }

  /**
   * Wrap an unknown failure into an `Error` with a stable message shape.
   * Extracts Fortis-side detail from `FortisHttpError.body` (the JSON Fortis returns
   * on validation/auth/server errors) so consumers see actionable messages, while
   * deliberately *not* including credentials, headers, or request bodies.
   */
  private buildError(message: string, error: unknown): Error {
    if (error instanceof FortisHttpError) {
      const detail = extractFortisErrorDetail(error.body)
      return new Error(
        `medusa-payment-fortis: ${message} — HTTP ${error.status}${detail ? `: ${detail}` : ""}`,
      )
    }
    if (error instanceof Error) {
      return new Error(`medusa-payment-fortis: ${message} — ${error.message}`)
    }
    return new Error(`medusa-payment-fortis: ${message} — ${String(error)}`)
  }

  /**
   * Construct a customer-facing decline error from a Fortis transaction with
   * status_id 100. Surfaces `response_message` and `reason_code_id` so the
   * storefront can show "Card declined: insufficient funds" instead of a
   * generic failure.
   */
  private buildDeclineError(tx: FortisTransaction): Error {
    const reason = tx.response_message?.trim() || "Card declined"
    const code = tx.reason_code_id ? ` (code ${tx.reason_code_id})` : ""
    const err = new Error(`${reason}${code}`)
    Object.assign(err, {
      isFortisDecline: true,
      fortisTransactionId: tx.id,
      fortisStatusId: tx.status_id,
      fortisReasonCode: tx.reason_code_id,
      fortisResponseMessage: tx.response_message,
    })
    return err
  }
}

function isDeclineError(e: unknown): boolean {
  return Boolean(e && typeof e === "object" && "isFortisDecline" in e)
}

function requireFortisId(
  data: unknown,
  op: string,
): FortisSessionData & { fortis_transaction_id: string } {
  const session = (data ?? {}) as FortisSessionData
  if (!session.fortis_transaction_id) {
    throw new Error(
      `medusa-payment-fortis: cannot ${op} — no fortis_transaction_id on session`,
    )
  }
  return session as FortisSessionData & { fortis_transaction_id: string }
}

function toWebhookAction(tx: FortisTransaction): PaymentActions | undefined {
  if (tx.status_id === FortisStatus.Voided) return PaymentActions.CANCELED
  if (tx.status_id === FortisStatus.Declined) return PaymentActions.FAILED
  if (
    tx.status_id !== FortisStatus.Approved &&
    tx.status_id !== FortisStatus.PartialApproval
  ) {
    return undefined
  }
  const action = String(tx.action ?? "")
  return action === "authonly" || action === "authincrement"
    ? PaymentActions.AUTHORIZED
    : PaymentActions.SUCCESSFUL
}

/**
 * Convert a Medusa BigNumber-ish amount to the decimal-string format Fortis expects ("10.00").
 *
 * TODO: verify on first sandbox call whether Medusa sends major-unit (10.00 → "10.00") or
 * minor-unit (1000 → "10.00") here. The base-class amount semantics shifted in 2.x. If wrong,
 * divide by 100 before toFixed.
 */
function formatAmount(amount: BigNumberInput): string {
  let n: number
  if (typeof amount === "number") {
    n = amount
  } else if (typeof amount === "string") {
    n = parseFloat(amount)
  } else if (amount && typeof (amount as { numeric?: number }).numeric === "number") {
    n = (amount as { numeric: number }).numeric
  } else {
    n = parseFloat(String(amount))
  }
  if (!Number.isFinite(n)) {
    throw new Error(`medusa-payment-fortis: invalid amount ${String(amount)}`)
  }
  return n.toFixed(2)
}

/**
 * Pull a human-readable detail out of whatever shape Fortis returned in its error body.
 * Defensive — Fortis varies between `{ message }`, `{ errors: { field: [msg] } }`, and
 * `{ name, message, code, status }`. Never includes the raw body verbatim (some fields
 * could leak request context).
 */
function extractFortisErrorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined
  const b = body as Record<string, unknown>

  if (typeof b.message === "string" && b.message.length > 0) {
    return b.message
  }
  if (b.errors && typeof b.errors === "object") {
    const errs = b.errors as Record<string, unknown>
    const parts: string[] = []
    for (const [field, val] of Object.entries(errs)) {
      const text = Array.isArray(val) ? val.join(", ") : String(val ?? "")
      parts.push(`${field}: ${text}`)
    }
    if (parts.length > 0) return parts.join("; ")
  }
  return undefined
}
