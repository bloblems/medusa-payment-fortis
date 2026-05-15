# medusa-payment-fortis

[Fortis](https://fortispay.com) payment provider for [Medusa 2.x](https://medusajs.com/). Card collection via a Fortis-hosted iframe (PayForm), so merchants stay in PCI SAQ-A scope.

Status: alpha. APIs may change.

## Install

```bash
pnpm add github:bloblems/medusa-payment-fortis#main
```

(Will be on npm once stabilized.)

## Configure

```ts
// medusa-config.ts
import { Modules } from "@medusajs/framework/utils"

modules: [
  {
    key: Modules.PAYMENT,
    resolve: "@medusajs/payment",
    options: {
      providers: [
        {
          resolve: "medusa-payment-fortis",
          id: "fortis",
          options: {
            userId: process.env.FORTIS_USER_ID!,
            userApiKey: process.env.FORTIS_USER_API_KEY!,
            developerId: process.env.FORTIS_DEVELOPER_ID!,
            userHashKey: process.env.FORTIS_USER_HASH_KEY!,
            locationId: process.env.FORTIS_LOCATION_ID!,
            ccProductTransactionId: process.env.FORTIS_CC_PRODUCT_TRANSACTION_ID!,
            apiBaseUrl: process.env.FORTIS_API_BASE_URL ?? "https://api.sandbox.zeamster.com",
            capture: process.env.FORTIS_CAPTURE === "true", // optional, defaults to false (auth-only)
          },
        },
      ],
    },
  },
]
```

Production base URL is `https://api.zeamster.com`. Get `ccProductTransactionId` from your Fortis portal under Services → CC service → Product Transaction Id. The API user needs privileges for PayForm, Transactions (create/read/update), Account Vault, and Postbacks.

## Storefront

```tsx
import { PayFormIframe } from "medusa-payment-fortis/storefront"

<PayFormIframe
  payformUrl={session.data.payform_url}
  onSuccess={(result) => {
    // POST { session_id, fortis_transaction_id: result.id } to your confirm route,
    // then call cart.complete()
  }}
  onError={(err) => { /* surface decline */ }}
/>
```

Decline detection: errors thrown by `authorizePayment` on a Fortis decline carry `isFortisDecline`, `fortisResponseMessage`, and `fortisReasonCode` for programmatic handling.

## Backend routes

You need two routes in your Medusa backend. Copy-paste templates in [`examples/`](./examples/):

- `POST /store/payments/fortis/confirm` — storefront calls after iframe success to attach the transaction id to the session
- `POST /hooks/payment/fortis` — receives Fortis post-backs (use HTTP Basic auth via `FORTIS_POSTBACK_AUTH`; Fortis doesn't HMAC-sign)

## What's supported

Card sale, auth + capture, refund (full/partial), void, saved cards (Account Vault), post-back handling.

Not yet: 3DS, Apple Pay / Google Pay, ACH, recurring. Contributions welcome.

## License

MIT
