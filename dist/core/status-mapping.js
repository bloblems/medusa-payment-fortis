"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFortisStatus = mapFortisStatus;
const utils_1 = require("@medusajs/framework/utils");
const api_1 = require("../types/api");
/**
 * Maps a Fortis transaction's status_id (and action context) to a Medusa PaymentSessionStatus.
 *
 * Fortis exposes a small, coarse status set on the transaction itself; the Medusa enum is finer.
 * We rely on the originating action to disambiguate "approved auth-only" from "approved & captured".
 */
function mapFortisStatus(transaction) {
    const statusId = transaction.status_id;
    switch (statusId) {
        case api_1.FortisStatus.Declined:
            return utils_1.PaymentSessionStatus.ERROR;
        case api_1.FortisStatus.Voided:
            return utils_1.PaymentSessionStatus.CANCELED;
        case api_1.FortisStatus.Approved:
        case api_1.FortisStatus.PartialApproval: {
            const action = transaction.action ?? "";
            // sale / authcomplete / tipadjust / partialreversal settle immediately.
            // authonly is an authorization that still needs capture.
            if (action === "authonly" || action === "authincrement") {
                return utils_1.PaymentSessionStatus.AUTHORIZED;
            }
            return utils_1.PaymentSessionStatus.CAPTURED;
        }
        default:
            return utils_1.PaymentSessionStatus.PENDING;
    }
}
//# sourceMappingURL=status-mapping.js.map