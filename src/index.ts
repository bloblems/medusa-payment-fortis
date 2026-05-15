import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { FortisPaymentProvider } from "./services/fortis-payment-provider"

export default ModuleProvider(Modules.PAYMENT, {
  services: [FortisPaymentProvider],
})

export { FortisPaymentProvider } from "./services/fortis-payment-provider"
export type { FortisProviderOptions } from "./types/options"
export type {
  FortisAction,
  FortisPaymentMethod,
  FortisPostback,
  FortisStatusId,
  FortisTransaction,
} from "./types/api"
export { FortisStatus } from "./types/api"
export {
  buildAccountFormUrl,
  buildPayFormUrl,
  type AccountFormDataInput,
  type PayFormDataInput,
} from "./core/payform-url"
export { FortisClient, FortisHttpError } from "./core/fortis-client"
export { mapFortisStatus } from "./core/status-mapping"
