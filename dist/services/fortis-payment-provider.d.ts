import { AbstractPaymentProvider } from "@medusajs/framework/utils";
import type { AuthorizePaymentInput, AuthorizePaymentOutput, CancelPaymentInput, CancelPaymentOutput, CapturePaymentInput, CapturePaymentOutput, DeletePaymentInput, DeletePaymentOutput, GetPaymentStatusInput, GetPaymentStatusOutput, InitiatePaymentInput, InitiatePaymentOutput, ProviderWebhookPayload, RefundPaymentInput, RefundPaymentOutput, RetrievePaymentInput, RetrievePaymentOutput, UpdatePaymentInput, UpdatePaymentOutput, WebhookActionResult } from "@medusajs/framework/types";
import { type FortisTransaction } from "../types/api";
import type { FortisProviderOptions } from "../types/options";
export interface FortisSessionData extends Record<string, unknown> {
    /** Signed PayForm iframe URL the storefront renders. Set on initiate/update. */
    payform_url?: string;
    /** Correlation id passed to Fortis as transaction_api_id. Set on initiate. */
    transaction_api_id: string;
    /** Fortis-side transaction id. Set after iframe postMessage or webhook arrives. */
    fortis_transaction_id?: string;
    /** Snapshot of the most recently fetched transaction. */
    transaction?: FortisTransaction;
}
export declare class FortisPaymentProvider extends AbstractPaymentProvider<FortisProviderOptions> {
    static identifier: string;
    private readonly client;
    constructor(container: Record<string, unknown>, options: FortisProviderOptions);
    static validateOptions(options: Record<string, unknown>): void;
    initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput>;
    authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput>;
    capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput>;
    refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput>;
    cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput>;
    retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput>;
    updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput>;
    deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput>;
    getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput>;
    getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult>;
    /**
     * The Fortis action this provider uses when the storefront initiates payment.
     * `sale` captures immediately; `authonly` reserves funds for a later capture.
     */
    private intentAction;
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
    private findSessionIdForTransaction;
    /**
     * Wrap an unknown failure into an `Error` with a stable message shape.
     * Extracts Fortis-side detail from `FortisHttpError.body` (the JSON Fortis returns
     * on validation/auth/server errors) so consumers see actionable messages, while
     * deliberately *not* including credentials, headers, or request bodies.
     */
    private buildError;
    /**
     * Construct a customer-facing decline error from a Fortis transaction with
     * status_id 100. Surfaces `response_message` and `reason_code_id` so the
     * storefront can show "Card declined: insufficient funds" instead of a
     * generic failure.
     */
    private buildDeclineError;
}
//# sourceMappingURL=fortis-payment-provider.d.ts.map