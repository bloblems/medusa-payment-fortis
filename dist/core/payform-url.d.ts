import type { FortisProviderOptions } from "../types/options";
/**
 * Transaction fields wrapped under `data.transaction` in the iframe URL payload.
 * Fortis's PayForm endpoint validates these against the transaction model.
 */
export interface PayFormDataInput {
    payment_method: "cc" | "ach";
    action: "sale" | "authonly" | "refund";
    /** Decimal-string amount in the major unit, e.g. "10.00". */
    transaction_amount: string;
    /** Merchant-supplied correlation id. */
    transaction_api_id: string;
    /** Fortis service id (configures which payment service to route through). */
    product_transaction_id: string;
    location_id?: string;
    [key: string]: unknown;
}
/**
 * AccountForm transaction fields wrapped under `data.account_vault`.
 */
export interface AccountFormDataInput {
    payment_method: "cc" | "ach";
    location_id?: string;
    /** Merchant-supplied id for the saved card; absence creates a new vault entry. */
    account_vault_api_id: string;
    contact_id?: string;
    [key: string]: unknown;
}
/**
 * Iframe-behavior flags hoisted to the top level of the data envelope (not inside
 * `transaction`/`account_vault`). All optional — sensible defaults are applied.
 */
export interface PayFormIframeOptions {
    /** Post the result JSON to the parent window on submit. Default: 1 (enabled). */
    parent_send_message?: 0 | 1;
    /** Have the iframe close itself on success. */
    parent_close?: 0 | 1;
    redirect_url_on_approval?: string;
    redirect_url_on_decline?: string;
    /** Override the per-merchant stylesheet from options. */
    stylesheet_url?: string;
}
export declare function buildPayFormUrl(options: FortisProviderOptions, data: PayFormDataInput, iframeOptions?: PayFormIframeOptions, now?: () => number): string;
export declare function buildAccountFormUrl(options: FortisProviderOptions, data: AccountFormDataInput, iframeOptions?: PayFormIframeOptions, now?: () => number): string;
//# sourceMappingURL=payform-url.d.ts.map