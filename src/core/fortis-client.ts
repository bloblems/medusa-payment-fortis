import type { FortisProviderOptions } from "../types/options"
import { DEFAULT_TIMEOUT_MS } from "../types/options"
import type {
  FortisApiError,
  FortisTransaction,
  FortisTransactionRequest,
  FortisTransactionUpdateRequest,
} from "../types/api"

export class FortisHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: FortisApiError | Record<string, unknown>,
  ) {
    super(`Fortis API error ${status}: ${JSON.stringify(body)}`)
    this.name = "FortisHttpError"
  }
}

interface FortisRawResponse<T> {
  // Fortis sometimes wraps responses with the resource name as the key, sometimes returns the bare object.
  // The client normalizes both shapes.
  transaction?: T
}

export class FortisClient {
  constructor(private readonly options: FortisProviderOptions) {}

  private get baseHeaders(): Record<string, string> {
    return {
      "user-id": this.options.userId,
      "user-api-key": this.options.userApiKey,
      "developer-id": this.options.developerId,
      "Content-Type": "application/json",
      Accept: "application/json",
    }
  }

  private async request<TResponse>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<TResponse> {
    const url = `${this.options.apiBaseUrl}${path}`
    const controller = new AbortController()
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        method,
        headers: this.baseHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })

      const text = await res.text()
      const parsed: unknown = text.length > 0 ? JSON.parse(text) : {}

      if (!res.ok) {
        throw new FortisHttpError(res.status, parsed as FortisApiError)
      }

      return parsed as TResponse
    } finally {
      clearTimeout(timer)
    }
  }

  private unwrap<T>(raw: FortisRawResponse<T> | T): T {
    if (raw && typeof raw === "object" && "transaction" in raw && raw.transaction) {
      return raw.transaction as T
    }
    return raw as T
  }

  async createTransaction(body: FortisTransactionRequest): Promise<FortisTransaction> {
    const raw = await this.request<FortisRawResponse<FortisTransaction> | FortisTransaction>(
      "POST",
      "/v2/transactions",
      body,
    )
    return this.unwrap(raw)
  }

  async updateTransaction(
    id: string,
    body: FortisTransactionUpdateRequest,
  ): Promise<FortisTransaction> {
    const raw = await this.request<FortisRawResponse<FortisTransaction> | FortisTransaction>(
      "PUT",
      `/v2/transactions/${encodeURIComponent(id)}`,
      body,
    )
    return this.unwrap(raw)
  }

  async getTransaction(id: string): Promise<FortisTransaction> {
    const raw = await this.request<FortisRawResponse<FortisTransaction> | FortisTransaction>(
      "GET",
      `/v2/transactions/${encodeURIComponent(id)}`,
    )
    return this.unwrap(raw)
  }
}
