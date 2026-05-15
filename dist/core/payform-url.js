"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPayFormUrl = buildPayFormUrl;
exports.buildAccountFormUrl = buildAccountFormUrl;
const node_crypto_1 = require("node:crypto");
function buildPayFormUrl(options, data, iframeOptions = {}, now) {
    return buildIframeUrl({
        options,
        formPath: "/v2/payform",
        data: wrapDataPayload(options, "transaction", data, iframeOptions),
        now,
    });
}
function buildAccountFormUrl(options, data, iframeOptions = {}, now) {
    return buildIframeUrl({
        options,
        formPath: "/v2/accountform",
        data: wrapDataPayload(options, "account_vault", data, iframeOptions),
        now,
    });
}
function wrapDataPayload(options, envelopeKey, data, iframeOptions) {
    const envelope = {
        [envelopeKey]: {
            location_id: options.locationId,
            ...data,
        },
        // Default postMessage on; consumer can disable by passing parent_send_message: 0
        parent_send_message: iframeOptions.parent_send_message ?? 1,
        ...iframeOptions,
    };
    if (options.stylesheetUrl && !iframeOptions.stylesheet_url) {
        envelope.stylesheet_url = options.stylesheetUrl;
    }
    return envelope;
}
function buildIframeUrl({ options, formPath, data, now }) {
    const timestamp = Math.floor((now?.() ?? Date.now()) / 1000).toString();
    const json = JSON.stringify(data);
    const hex = Buffer.from(json, "utf8").toString("hex");
    const hash = (0, node_crypto_1.createHmac)("sha256", options.userHashKey)
        .update(options.userId + timestamp)
        .digest("hex");
    const params = new URLSearchParams({
        "developer-id": options.developerId,
        "hash-key": hash,
        "user-id": options.userId,
        timestamp,
        data: hex,
    });
    return `${options.apiBaseUrl}${formPath}?${params.toString()}`;
}
//# sourceMappingURL=payform-url.js.map