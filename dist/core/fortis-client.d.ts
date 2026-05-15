import type { FortisProviderOptions } from "../types/options";
import type { FortisApiError, FortisTransaction, FortisTransactionRequest, FortisTransactionUpdateRequest } from "../types/api";
export declare class FortisHttpError extends Error {
    readonly status: number;
    readonly body: FortisApiError | Record<string, unknown>;
    constructor(status: number, body: FortisApiError | Record<string, unknown>);
}
export declare class FortisClient {
    private readonly options;
    constructor(options: FortisProviderOptions);
    private get baseHeaders();
    private request;
    private unwrap;
    createTransaction(body: FortisTransactionRequest): Promise<FortisTransaction>;
    updateTransaction(id: string, body: FortisTransactionUpdateRequest): Promise<FortisTransaction>;
    getTransaction(id: string): Promise<FortisTransaction>;
}
//# sourceMappingURL=fortis-client.d.ts.map