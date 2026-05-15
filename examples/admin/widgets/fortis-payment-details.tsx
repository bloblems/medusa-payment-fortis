/**
 * Example admin widget for medusa-payment-fortis.
 *
 * Drops Fortis-side transaction details onto the order detail page in Medusa Admin:
 * transaction id, response message, AVS/CVV results, and an optional deep link to
 * the Fortis merchant dashboard.
 *
 * # Install
 *
 * Copy this file to your Medusa backend at:
 *   `src/admin/widgets/fortis-payment-details.tsx`
 *
 * Then restart `pnpm dev`. The widget will appear on /app/orders/:id pages
 * for orders that were paid via the Fortis provider.
 *
 * # Customize
 *
 * Set `FORTIS_DASHBOARD_URL` below (or via the `VITE_FORTIS_DASHBOARD_URL`
 * env var) to your merchant dashboard URL, e.g.
 *   "https://<your-merchant-slug>.sandbox.zeamster.com"
 * If unset, the widget renders the transaction id without a link.
 */
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Button } from "@medusajs/ui"
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types"

const FORTIS_DASHBOARD_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_FORTIS_DASHBOARD_URL) ||
  ""

interface FortisTransactionSnapshot {
  id?: string
  status_id?: number
  response_message?: string
  reason_code_id?: number
  avs?: string
  avs_enhanced?: string
  cvv_response?: string
  account_number?: string
  last_four?: string
  transaction_amount?: string | number
}

interface FortisPaymentData {
  fortis_transaction_id?: string
  transaction?: FortisTransactionSnapshot
}

const FortisPaymentDetails = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  // Find a Fortis-provider payment among the order's payment collections.
  const payment = order.payment_collections
    ?.flatMap((c) => c.payments ?? [])
    ?.find((p) => p.provider_id?.endsWith("_fortis"))

  if (!payment) return null

  const sessionData = (payment.data ?? {}) as FortisPaymentData
  const tx = sessionData.transaction
  const txId = sessionData.fortis_transaction_id ?? tx?.id

  if (!txId) return null

  const dashboardLink = FORTIS_DASHBOARD_URL
    ? `${FORTIS_DASHBOARD_URL.replace(/\/$/, "")}/#/transactions/${encodeURIComponent(txId)}`
    : null

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Fortis Payment</Heading>
        {dashboardLink && (
          <Button size="small" variant="secondary" asChild>
            <a href={dashboardLink} target="_blank" rel="noreferrer">
              Open in Fortis ↗
            </a>
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 py-4 text-ui-fg-subtle">
        <Field label="Transaction ID" value={txId} mono />
        <Field
          label="Status"
          value={
            <StatusBadge statusId={tx?.status_id} message={tx?.response_message} />
          }
        />
        {tx?.transaction_amount !== undefined && (
          <Field
            label="Amount"
            value={formatAmount(tx.transaction_amount)}
            mono
          />
        )}
        {tx?.last_four && <Field label="Card" value={`•••• ${tx.last_four}`} mono />}
        {(tx?.avs || tx?.avs_enhanced) && (
          <Field label="AVS" value={tx.avs_enhanced ?? tx.avs} mono />
        )}
        {tx?.cvv_response && (
          <Field label="CVV" value={tx.cvv_response} mono />
        )}
        {tx?.reason_code_id !== undefined && (
          <Field label="Reason code" value={String(tx.reason_code_id)} mono />
        )}
      </div>
    </Container>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <>
      <Text size="small" leading="compact" weight="plus">
        {label}
      </Text>
      <Text size="small" leading="compact" className={mono ? "font-mono" : ""}>
        {value}
      </Text>
    </>
  )
}

function StatusBadge({
  statusId,
  message,
}: {
  statusId?: number
  message?: string
}) {
  // Fortis status_id: 100 = Declined, 101 = Approved, 102 = Partial, 201 = Voided.
  if (statusId === 101 || statusId === 102) {
    return <Badge color="green">{message ?? "Approved"}</Badge>
  }
  if (statusId === 100) {
    return <Badge color="red">{message ?? "Declined"}</Badge>
  }
  if (statusId === 201) {
    return <Badge color="grey">{message ?? "Voided"}</Badge>
  }
  return <Badge color="orange">{message ?? "Pending"}</Badge>
}

function formatAmount(v: string | number): string {
  if (typeof v === "number") return v.toFixed(2)
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n.toFixed(2) : String(v)
}

export const config = defineWidgetConfig({
  zone: "order.details.after",
})

export default FortisPaymentDetails
