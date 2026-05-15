"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayFormIframe = PayFormIframe;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const APPROVED = 101;
const PARTIAL_APPROVAL = 102;
const DECLINED = 100;
/**
 * Renders a Fortis PayForm iframe and forwards the postMessage result to callbacks.
 *
 * The provider's `initiatePayment` must include `parent_send_message: 1` in the iframe
 * data payload (the plugin does this automatically) so Fortis posts the transaction
 * JSON to this window after submission.
 *
 * Origin verification: only messages from the iframe's own origin are processed.
 */
function PayFormIframe({ payformUrl, onSuccess, onError, onLoad, className, height = 480, }) {
    const iframeRef = (0, react_1.useRef)(null);
    const expectedOrigin = (() => {
        try {
            return new URL(payformUrl).origin;
        }
        catch {
            return null;
        }
    })();
    (0, react_1.useEffect)(() => {
        if (!expectedOrigin)
            return;
        function handleMessage(event) {
            if (event.origin !== expectedOrigin)
                return;
            let data = event.data;
            if (typeof data === "string") {
                try {
                    data = JSON.parse(data);
                }
                catch {
                    return;
                }
            }
            if (!data || typeof data !== "object")
                return;
            const result = data;
            const statusId = typeof result.status_id === "number" ? result.status_id : undefined;
            if (statusId === APPROVED || statusId === PARTIAL_APPROVAL) {
                onSuccess(result);
            }
            else if (statusId === DECLINED) {
                onError?.(result);
            }
            else if ("error" in result || "errors" in result) {
                onError?.(result);
            }
            // Anything else (heartbeats, partial/intermediate messages) is ignored.
        }
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [expectedOrigin, onSuccess, onError]);
    if (!expectedOrigin) {
        return null;
    }
    return ((0, jsx_runtime_1.jsx)("iframe", { ref: iframeRef, src: payformUrl, onLoad: onLoad, className: className, style: { width: "100%", height, border: 0 }, title: "Fortis payment form" }));
}
//# sourceMappingURL=payform-iframe.js.map