"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FortisPaymentProvider = void 0;
const utils_1 = require("@medusajs/framework/utils");
const node_crypto_1 = require("node:crypto");
const fortis_client_1 = require("../core/fortis-client");
const payform_url_1 = require("../core/payform-url");
const status_mapping_1 = require("../core/status-mapping");
const api_1 = require("../types/api");
class FortisPaymentProvider extends utils_1.AbstractPaymentProvider {
    static identifier = "fortis";
    client;
    constructor(container, options) {
        super(container, options);
        this.client = new fortis_client_1.FortisClient(options);
    }
    static validateOptions(options) {
        const required = [
            "userId",
            "userApiKey",
            "developerId",
            "userHashKey",
            "locationId",
            "apiBaseUrl",
            "ccProductTransactionId",
        ];
        const missing = required.filter((k) => !options[k]);
        if (missing.length > 0) {
            throw new Error(`medusa-payment-fortis: missing required options: ${missing.join(", ")}`);
        }
    }
    async initiatePayment(input) {
        try {
            const transaction_api_id = `medusa_${(0, node_crypto_1.randomUUID)()}`;
            const payform_url = (0, payform_url_1.buildPayFormUrl)(this.config, {
                payment_method: "cc",
                action: this.intentAction(),
                transaction_amount: formatAmount(input.amount),
                transaction_api_id,
                product_transaction_id: this.config.ccProductTransactionId,
            });
            const data = { payform_url, transaction_api_id };
            return { id: transaction_api_id, data };
        }
        catch (e) {
            throw this.buildError("initiatePayment failed", e);
        }
    }
    async authorizePayment(input) {
        const session = (input.data ?? {});
        if (!session.fortis_transaction_id) {
            return { status: utils_1.PaymentSessionStatus.PENDING, data: session };
        }
        try {
            const tx = await this.client.getTransaction(session.fortis_transaction_id);
            if (tx.status_id === api_1.FortisStatus.Declined) {
                throw this.buildDeclineError(tx);
            }
            return {
                status: (0, status_mapping_1.mapFortisStatus)(tx),
                data: { ...session, transaction: tx },
            };
        }
        catch (e) {
            if (isDeclineError(e))
                throw e;
            throw this.buildError("authorizePayment failed", e);
        }
    }
    async capturePayment(input) {
        const session = requireFortisId(input.data, "capture");
        try {
            // If the original action was `sale`, the transaction is already captured; no-op.
            const current = await this.client.getTransaction(session.fortis_transaction_id);
            if ((0, status_mapping_1.mapFortisStatus)(current) === utils_1.PaymentSessionStatus.CAPTURED) {
                return { data: { ...session, transaction: current } };
            }
            const tx = await this.client.updateTransaction(session.fortis_transaction_id, {
                transaction: { action: "authcomplete" },
            });
            return { data: { ...session, transaction: tx } };
        }
        catch (e) {
            throw this.buildError("capturePayment failed", e);
        }
    }
    async refundPayment(input) {
        const session = requireFortisId(input.data, "refund");
        try {
            const tx = await this.client.createTransaction({
                transaction: {
                    action: "refund",
                    payment_method: "cc",
                    previous_transaction_id: session.fortis_transaction_id,
                    transaction_amount: formatAmount(input.amount),
                    location_id: this.config.locationId,
                },
            });
            return { data: { ...session, last_refund: tx } };
        }
        catch (e) {
            throw this.buildError("refundPayment failed", e);
        }
    }
    async cancelPayment(input) {
        const session = (input.data ?? {});
        if (!session.fortis_transaction_id) {
            return { data: session };
        }
        try {
            const current = await this.client.getTransaction(session.fortis_transaction_id);
            const action = String(current.action ?? "");
            const isUnsettledAuth = current.status_id === api_1.FortisStatus.Approved &&
                (action === "authonly" || action === "authincrement");
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
                });
            return { data: { ...session, transaction: result } };
        }
        catch (e) {
            throw this.buildError("cancelPayment failed", e);
        }
    }
    async retrievePayment(input) {
        const session = (input.data ?? {});
        if (!session.fortis_transaction_id) {
            return { data: session };
        }
        try {
            const tx = await this.client.getTransaction(session.fortis_transaction_id);
            return { data: { ...session, transaction: tx } };
        }
        catch (e) {
            throw this.buildError("retrievePayment failed", e);
        }
    }
    async updatePayment(input) {
        const session = (input.data ?? {});
        // Once the iframe has submitted and we have a Fortis tx id, the amount is locked.
        if (session.fortis_transaction_id) {
            return { data: session };
        }
        try {
            const transaction_api_id = session.transaction_api_id ?? `medusa_${(0, node_crypto_1.randomUUID)()}`;
            const payform_url = (0, payform_url_1.buildPayFormUrl)(this.config, {
                payment_method: "cc",
                action: this.intentAction(),
                transaction_amount: formatAmount(input.amount),
                transaction_api_id,
                product_transaction_id: this.config.ccProductTransactionId,
            });
            return { data: { ...session, payform_url, transaction_api_id } };
        }
        catch (e) {
            throw this.buildError("updatePayment failed", e);
        }
    }
    async deletePayment(input) {
        // Fortis transactions can't be deleted, only voided/refunded.
        // Cancellation belongs in cancelPayment; here we just drop the local session.
        return { data: input.data ?? {} };
    }
    async getPaymentStatus(input) {
        const session = (input.data ?? {});
        if (!session.fortis_transaction_id) {
            return { status: utils_1.PaymentSessionStatus.PENDING, data: session };
        }
        try {
            const tx = await this.client.getTransaction(session.fortis_transaction_id);
            return {
                status: (0, status_mapping_1.mapFortisStatus)(tx),
                data: { ...session, transaction: tx },
            };
        }
        catch (e) {
            throw this.buildError("getPaymentStatus failed", e);
        }
    }
    async getWebhookActionAndData(payload) {
        const body = (payload.data ?? {});
        if (String(body.resource ?? "") !== "transaction") {
            return { action: utils_1.PaymentActions.NOT_SUPPORTED };
        }
        let tx;
        try {
            const raw = body.data;
            tx = typeof raw === "string" ? JSON.parse(raw) : raw;
        }
        catch {
            return { action: utils_1.PaymentActions.NOT_SUPPORTED };
        }
        const action = toWebhookAction(tx);
        if (!action) {
            return { action: utils_1.PaymentActions.NOT_SUPPORTED };
        }
        const sessionId = await this.findSessionIdForTransaction(tx);
        if (!sessionId) {
            return { action: utils_1.PaymentActions.NOT_SUPPORTED };
        }
        return {
            action,
            data: {
                session_id: sessionId,
                amount: Number(tx.transaction_amount ?? 0),
            },
        };
    }
    /**
     * The Fortis action this provider uses when the storefront initiates payment.
     * `sale` captures immediately; `authonly` reserves funds for a later capture.
     */
    intentAction() {
        return this.config.capture ? "sale" : "authonly";
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
    async findSessionIdForTransaction(tx) {
        const apiId = tx.transaction_api_id;
        if (!apiId)
            return undefined;
        const container = this.container;
        let paymentModule;
        try {
            paymentModule = container.resolve(utils_1.Modules.PAYMENT);
        }
        catch {
            return undefined;
        }
        const sessions = await paymentModule.listPaymentSessions({ provider_id: "pp_fortis_fortis" }, { take: 200, order: { created_at: "DESC" } });
        return sessions.find((s) => {
            const data = s.data;
            return data?.transaction_api_id === apiId;
        })?.id;
    }
    /**
     * Wrap an unknown failure into an `Error` with a stable message shape.
     * Extracts Fortis-side detail from `FortisHttpError.body` (the JSON Fortis returns
     * on validation/auth/server errors) so consumers see actionable messages, while
     * deliberately *not* including credentials, headers, or request bodies.
     */
    buildError(message, error) {
        if (error instanceof fortis_client_1.FortisHttpError) {
            const detail = extractFortisErrorDetail(error.body);
            return new Error(`medusa-payment-fortis: ${message} — HTTP ${error.status}${detail ? `: ${detail}` : ""}`);
        }
        if (error instanceof Error) {
            return new Error(`medusa-payment-fortis: ${message} — ${error.message}`);
        }
        return new Error(`medusa-payment-fortis: ${message} — ${String(error)}`);
    }
    /**
     * Construct a customer-facing decline error from a Fortis transaction with
     * status_id 100. Surfaces `response_message` and `reason_code_id` so the
     * storefront can show "Card declined: insufficient funds" instead of a
     * generic failure.
     */
    buildDeclineError(tx) {
        const reason = tx.response_message?.trim() || "Card declined";
        const code = tx.reason_code_id ? ` (code ${tx.reason_code_id})` : "";
        const err = new Error(`${reason}${code}`);
        Object.assign(err, {
            isFortisDecline: true,
            fortisTransactionId: tx.id,
            fortisStatusId: tx.status_id,
            fortisReasonCode: tx.reason_code_id,
            fortisResponseMessage: tx.response_message,
        });
        return err;
    }
}
exports.FortisPaymentProvider = FortisPaymentProvider;
function isDeclineError(e) {
    return Boolean(e && typeof e === "object" && "isFortisDecline" in e);
}
function requireFortisId(data, op) {
    const session = (data ?? {});
    if (!session.fortis_transaction_id) {
        throw new Error(`medusa-payment-fortis: cannot ${op} — no fortis_transaction_id on session`);
    }
    return session;
}
function toWebhookAction(tx) {
    if (tx.status_id === api_1.FortisStatus.Voided)
        return utils_1.PaymentActions.CANCELED;
    if (tx.status_id === api_1.FortisStatus.Declined)
        return utils_1.PaymentActions.FAILED;
    if (tx.status_id !== api_1.FortisStatus.Approved &&
        tx.status_id !== api_1.FortisStatus.PartialApproval) {
        return undefined;
    }
    const action = String(tx.action ?? "");
    return action === "authonly" || action === "authincrement"
        ? utils_1.PaymentActions.AUTHORIZED
        : utils_1.PaymentActions.SUCCESSFUL;
}
/**
 * Convert a Medusa BigNumber-ish amount to the decimal-string format Fortis expects ("10.00").
 *
 * TODO: verify on first sandbox call whether Medusa sends major-unit (10.00 → "10.00") or
 * minor-unit (1000 → "10.00") here. The base-class amount semantics shifted in 2.x. If wrong,
 * divide by 100 before toFixed.
 */
function formatAmount(amount) {
    let n;
    if (typeof amount === "number") {
        n = amount;
    }
    else if (typeof amount === "string") {
        n = parseFloat(amount);
    }
    else if (amount && typeof amount.numeric === "number") {
        n = amount.numeric;
    }
    else {
        n = parseFloat(String(amount));
    }
    if (!Number.isFinite(n)) {
        throw new Error(`medusa-payment-fortis: invalid amount ${String(amount)}`);
    }
    return n.toFixed(2);
}
/**
 * Pull a human-readable detail out of whatever shape Fortis returned in its error body.
 * Defensive — Fortis varies between `{ message }`, `{ errors: { field: [msg] } }`, and
 * `{ name, message, code, status }`. Never includes the raw body verbatim (some fields
 * could leak request context).
 */
function extractFortisErrorDetail(body) {
    if (!body || typeof body !== "object")
        return undefined;
    const b = body;
    if (typeof b.message === "string" && b.message.length > 0) {
        return b.message;
    }
    if (b.errors && typeof b.errors === "object") {
        const errs = b.errors;
        const parts = [];
        for (const [field, val] of Object.entries(errs)) {
            const text = Array.isArray(val) ? val.join(", ") : String(val ?? "");
            parts.push(`${field}: ${text}`);
        }
        if (parts.length > 0)
            return parts.join("; ");
    }
    return undefined;
}
//# sourceMappingURL=fortis-payment-provider.js.map