"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FortisClient = exports.FortisHttpError = void 0;
const options_1 = require("../types/options");
class FortisHttpError extends Error {
    status;
    body;
    constructor(status, body) {
        super(`Fortis API error ${status}: ${JSON.stringify(body)}`);
        this.status = status;
        this.body = body;
        this.name = "FortisHttpError";
    }
}
exports.FortisHttpError = FortisHttpError;
class FortisClient {
    options;
    constructor(options) {
        this.options = options;
    }
    get baseHeaders() {
        return {
            "user-id": this.options.userId,
            "user-api-key": this.options.userApiKey,
            "developer-id": this.options.developerId,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }
    async request(method, path, body) {
        const url = `${this.options.apiBaseUrl}${path}`;
        const controller = new AbortController();
        const timeoutMs = this.options.timeoutMs ?? options_1.DEFAULT_TIMEOUT_MS;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                method,
                headers: this.baseHeaders,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller.signal,
            });
            const text = await res.text();
            const parsed = text.length > 0 ? JSON.parse(text) : {};
            if (!res.ok) {
                throw new FortisHttpError(res.status, parsed);
            }
            return parsed;
        }
        finally {
            clearTimeout(timer);
        }
    }
    unwrap(raw) {
        if (raw && typeof raw === "object" && "transaction" in raw && raw.transaction) {
            return raw.transaction;
        }
        return raw;
    }
    async createTransaction(body) {
        const raw = await this.request("POST", "/v2/transactions", body);
        return this.unwrap(raw);
    }
    async updateTransaction(id, body) {
        const raw = await this.request("PUT", `/v2/transactions/${encodeURIComponent(id)}`, body);
        return this.unwrap(raw);
    }
    async getTransaction(id) {
        const raw = await this.request("GET", `/v2/transactions/${encodeURIComponent(id)}`);
        return this.unwrap(raw);
    }
}
exports.FortisClient = FortisClient;
//# sourceMappingURL=fortis-client.js.map