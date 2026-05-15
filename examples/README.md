# Examples

Optional drop-in snippets that consumers of `medusa-payment-fortis` can copy into their own Medusa backend / storefront. These aren't shipped as part of the plugin's runtime — copy what you need and customize freely.

## Admin widgets

### `admin/widgets/fortis-payment-details.tsx`

Renders a panel on the Order Detail page showing Fortis-side transaction info: transaction ID, status, AVS/CVV results, and (optionally) a deep link to the Fortis merchant dashboard for that transaction.

**Install**

```bash
cp examples/admin/widgets/fortis-payment-details.tsx \
   <your-backend>/src/admin/widgets/fortis-payment-details.tsx
```

Restart your backend dev server. The widget appears under the order details on any order paid via the Fortis provider; nothing else is rendered.

**Configure the dashboard link (optional)**

Set in your backend `.env` (Vite reads `VITE_*` prefixed env vars into admin code):

```
VITE_FORTIS_DASHBOARD_URL=https://<your-merchant-slug>.sandbox.zeamster.com
```

Or edit the `FORTIS_DASHBOARD_URL` constant at the top of the widget file. If unset, the widget still renders the transaction details, just without the external link.

**Production URL**

Replace `.sandbox.zeamster.com` with `.zeamster.com` in production.
