/**
 * Fortis status IDs returned on transaction responses.
 * @see https://docs.fortispay.com/developers/api/endpoints/transactions
 */
export declare const FortisStatus: {
    readonly Declined: 100;
    readonly Approved: 101;
    readonly PartialApproval: 102;
    readonly Voided: 201;
};
export type FortisStatusId = (typeof FortisStatus)[keyof typeof FortisStatus];
export type FortisAction = "sale" | "authonly" | "authcomplete" | "authincrement" | "tipadjust" | "void" | "partialreversal" | "refund" | "force" | "avsonly" | "debit" | "credit";
export type FortisPaymentMethod = "cc" | "ach";
export interface FortisTransaction {
    id: string;
    status_id: number;
    reason_code_id?: number;
    response_message?: string;
    transaction_amount: FortisAmount;
    transaction_api_id?: string;
    payment_method: FortisPaymentMethod;
    account_vault_id?: string;
    location_id: string;
    avs?: string;
    cvv_response?: string;
    created_ts?: number;
    modified_ts?: number;
    [key: string]: unknown;
}
/** Fortis accepts amounts as either a decimal string ("10.00") or a number; we send strings. */
export type FortisAmount = string | number;
export type FortisTransactionRequest = {
    transaction: {
        action: FortisAction;
        payment_method: FortisPaymentMethod;
        transaction_amount: FortisAmount;
        location_id: string;
        transaction_api_id?: string;
        account_vault_id?: string;
        previous_transaction_id?: string;
        [key: string]: unknown;
    };
};
export type FortisTransactionUpdateRequest = {
    transaction: {
        action: Extract<FortisAction, "authcomplete" | "authincrement" | "void" | "tipadjust" | "partialreversal">;
        transaction_amount?: FortisAmount;
        tip_amount?: FortisAmount;
        [key: string]: unknown;
    };
};
export interface FortisTransactionResponse {
    transaction?: FortisTransaction;
}
export type FortisPostbackEventType = "CREATE" | "UPDATE" | "DELETE";
export interface FortisPostback {
    type: FortisPostbackEventType;
    resource: string;
    number_of_attempts?: number;
    /**
     * Stringified JSON of the resource at the time of the event.
     * Fortis sends post backs as URL-encoded form data; the parser hydrates this.
     */
    data: string;
}
/** Fortis API error response shape. */
export interface FortisApiError {
    type?: string;
    errors?: Array<{
        code?: string;
        message?: string;
        field?: string;
    }>;
    message?: string;
}
//# sourceMappingURL=api.d.ts.map