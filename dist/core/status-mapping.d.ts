import { PaymentSessionStatus } from "@medusajs/framework/utils";
import { type FortisTransaction } from "../types/api";
/**
 * Maps a Fortis transaction's status_id (and action context) to a Medusa PaymentSessionStatus.
 *
 * Fortis exposes a small, coarse status set on the transaction itself; the Medusa enum is finer.
 * We rely on the originating action to disambiguate "approved auth-only" from "approved & captured".
 */
export declare function mapFortisStatus(transaction: FortisTransaction): PaymentSessionStatus;
//# sourceMappingURL=status-mapping.d.ts.map