export interface FortisPayFormResult {
    /** Fortis-assigned transaction id. */
    id: string;
    /** Fortis status_id: 101 = approved, 100 = declined, 102 = partial approval. */
    status_id: number;
    /** Echo of the merchant-supplied transaction_api_id we set at initiate. */
    transaction_api_id?: string;
    transaction_amount?: string | number;
    reason_code_id?: number;
    response_message?: string;
    [key: string]: unknown;
}
export interface PayFormIframeProps {
    /** Signed PayForm URL from session.data.payform_url. */
    payformUrl: string;
    /** Fired when the iframe posts an approved transaction result (status_id 101 or 102). */
    onSuccess: (result: FortisPayFormResult) => void;
    /** Fired on a decline or other error result from the iframe. */
    onError?: (result: FortisPayFormResult | unknown) => void;
    /** Fired when the iframe's content finishes loading. Useful for hiding a spinner. */
    onLoad?: () => void;
    className?: string;
    /** Iframe height in px; default 480. */
    height?: number | string;
}
/**
 * Renders a Fortis PayForm iframe and forwards the postMessage result to callbacks.
 *
 * The provider's `initiatePayment` must include `parent_send_message: 1` in the iframe
 * data payload (the plugin does this automatically) so Fortis posts the transaction
 * JSON to this window after submission.
 *
 * Origin verification: only messages from the iframe's own origin are processed.
 */
export declare function PayFormIframe({ payformUrl, onSuccess, onError, onLoad, className, height, }: PayFormIframeProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=payform-iframe.d.ts.map