"use client"
import { useEffect, useRef } from "react"

export interface FortisPayFormResult {
  /** Fortis-assigned transaction id. */
  id: string
  /** Fortis status_id: 101 = approved, 100 = declined, 102 = partial approval. */
  status_id: number
  /** Echo of the merchant-supplied transaction_api_id we set at initiate. */
  transaction_api_id?: string
  transaction_amount?: string | number
  reason_code_id?: number
  response_message?: string
  [key: string]: unknown
}

export interface PayFormIframeProps {
  /** Signed PayForm URL from session.data.payform_url. */
  payformUrl: string
  /** Fired when the iframe posts an approved transaction result (status_id 101 or 102). */
  onSuccess: (result: FortisPayFormResult) => void
  /** Fired on a decline or other error result from the iframe. */
  onError?: (result: FortisPayFormResult | unknown) => void
  /** Fired when the iframe's content finishes loading. Useful for hiding a spinner. */
  onLoad?: () => void
  className?: string
  /** Iframe height in px; default 480. */
  height?: number | string
}

const APPROVED = 101
const PARTIAL_APPROVAL = 102
const DECLINED = 100

/**
 * Renders a Fortis PayForm iframe and forwards the postMessage result to callbacks.
 *
 * The provider's `initiatePayment` must include `parent_send_message: 1` in the iframe
 * data payload (the plugin does this automatically) so Fortis posts the transaction
 * JSON to this window after submission.
 *
 * Origin verification: only messages from the iframe's own origin are processed.
 */
export function PayFormIframe({
  payformUrl,
  onSuccess,
  onError,
  onLoad,
  className,
  height = 480,
}: PayFormIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const expectedOrigin = (() => {
    try {
      return new URL(payformUrl).origin
    } catch {
      return null
    }
  })()

  useEffect(() => {
    if (!expectedOrigin) return

    function handleMessage(event: MessageEvent) {
      if (event.origin !== expectedOrigin) return

      let data: unknown = event.data
      if (typeof data === "string") {
        try {
          data = JSON.parse(data)
        } catch {
          return
        }
      }
      if (!data || typeof data !== "object") return

      const result = data as FortisPayFormResult
      const statusId = typeof result.status_id === "number" ? result.status_id : undefined

      if (statusId === APPROVED || statusId === PARTIAL_APPROVAL) {
        onSuccess(result)
      } else if (statusId === DECLINED) {
        onError?.(result)
      } else if ("error" in result || "errors" in result) {
        onError?.(result)
      }
      // Anything else (heartbeats, partial/intermediate messages) is ignored.
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [expectedOrigin, onSuccess, onError])

  if (!expectedOrigin) {
    return null
  }

  return (
    <iframe
      ref={iframeRef}
      src={payformUrl}
      onLoad={onLoad}
      className={className}
      style={{ width: "100%", height, border: 0 }}
      title="Fortis payment form"
    />
  )
}
