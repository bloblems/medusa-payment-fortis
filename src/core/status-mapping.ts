import { PaymentSessionStatus } from "@medusajs/framework/utils"
import { FortisStatus, type FortisTransaction } from "../types/api"

/**
 * Maps a Fortis transaction's status_id (and action context) to a Medusa PaymentSessionStatus.
 *
 * Fortis exposes a small, coarse status set on the transaction itself; the Medusa enum is finer.
 * We rely on the originating action to disambiguate "approved auth-only" from "approved & captured".
 */
export function mapFortisStatus(transaction: FortisTransaction): PaymentSessionStatus {
  const statusId = transaction.status_id

  switch (statusId) {
    case FortisStatus.Declined:
      return PaymentSessionStatus.ERROR

    case FortisStatus.Voided:
      return PaymentSessionStatus.CANCELED

    case FortisStatus.Approved:
    case FortisStatus.PartialApproval: {
      const action = (transaction.action as string | undefined) ?? ""
      // sale / authcomplete / tipadjust / partialreversal settle immediately.
      // authonly is an authorization that still needs capture.
      if (action === "authonly" || action === "authincrement") {
        return PaymentSessionStatus.AUTHORIZED
      }
      return PaymentSessionStatus.CAPTURED
    }

    default:
      return PaymentSessionStatus.PENDING
  }
}
