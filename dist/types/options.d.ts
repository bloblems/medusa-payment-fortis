export interface FortisProviderOptions {
    userId: string;
    userApiKey: string;
    developerId: string;
    userHashKey: string;
    locationId: string;
    apiBaseUrl: string;
    /**
     * Fortis "Product Transaction ID" for the CC service. Required — Fortis uses it to
     * route the transaction to the correct configured service on the location.
     * Find it in the Fortis portal: Services tab → CC service row → Product Transaction Id.
     */
    ccProductTransactionId: string;
    /** Optional ACH equivalent. Only needed once ACH support is added (v2). */
    achProductTransactionId?: string;
    /**
     * Capture funds immediately on payment authorization.
     *
     * - `false` (default) → authorization-only. Reserves funds; merchant captures later
     *   (typically on order fulfillment) via `capturePayment`. Safer default — matches
     *   most e-commerce flows where the order can be cancelled before shipping.
     * - `true` → auth + capture in a single call. Funds move immediately on order
     *   placement. Use for digital goods, services, or any flow where the goods
     *   transfer at order time.
     *
     * Translates to Fortis `action: "authonly"` or `action: "sale"` respectively.
     */
    capture?: boolean;
    /** Optional CSS URL applied to PayForm/AccountForm iframes. */
    stylesheetUrl?: string;
    /** Default request timeout in milliseconds. */
    timeoutMs?: number;
}
export declare const DEFAULT_TIMEOUT_MS = 30000;
//# sourceMappingURL=options.d.ts.map