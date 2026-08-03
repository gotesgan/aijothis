import { createHmac } from "node:crypto";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export function razorpayConfigured(): boolean {
  return Boolean(KEY_ID && KEY_SECRET);
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
}

/** Fetches an order to read its receipt (the encoded device id). */
export async function getOrderReceipt(orderId: string): Promise<string | null> {
  if (!KEY_ID || !KEY_SECRET) return null;
  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/orders/${orderId}`,
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64"),
        },
      }
    );
    if (!res.ok) return null;
    const order = (await res.json()) as RazorpayOrder;
    return order.receipt ?? null;
  } catch {
    return null;
  }
}

/** Creates a one-time order (amount in paise). Receipt encodes the device id. */
export async function createRazorpayOrder(
  deviceId: string,
  amountPaise: number
): Promise<RazorpayOrder> {
  if (!KEY_ID || !KEY_SECRET) throw new Error("razorpay_not_configured");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64"),
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: deviceId,
      payment_capture: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`razorpay order failed (${res.status})`);
  }
  return (await res.json()) as RazorpayOrder;
}

/** Verifies the checkout-page signature returned after a successful payment. */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!KEY_SECRET) return false;
  const expected = createHmac("sha256", KEY_SECRET)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return expected === params.signature;
}

/** Verifies a webhook using the x-razorpay-signature header + raw body. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  if (!WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}

export { KEY_ID };
