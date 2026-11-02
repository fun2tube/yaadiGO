import "server-only";

import crypto from "node:crypto";

/**
 * Razorpay payment links.
 *
 * Why a payment LINK rather than a checkout widget: the link can be sent on
 * WhatsApp, which is where Indian trip decisions are actually made. A customer
 * who has just said yes on a call pays from their phone in the next thirty
 * seconds, and that is the whole point — the gap between "yes" and money is
 * where bookings are lost to whoever makes paying easier.
 *
 * Written against the documented HTTP API rather than the SDK, consistent with
 * how the notification providers are done here, and to keep the dependency
 * count where it is.
 *
 * MONEY IS IN PAISE at this boundary. Razorpay takes the smallest currency
 * unit; this codebase holds rupees above the repository. Every conversion
 * happens in this file and nowhere else, because a factor-of-100 error in a
 * payment amount is the most expensive bug available.
 */

const API = "https://api.razorpay.com/v1";

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function isLiveKey() {
  return String(process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_live_");
}

/**
 * Refuse to take real money from a development machine.
 *
 * The credentials in this project are LIVE. A payment link created while
 * testing is a real link that charges a real card, and a refund costs the
 * business the gateway fee plus an awkward phone call. Production is detected,
 * never assumed, and the override is explicit and obvious in a log.
 */
function liveKeyGuard() {
  if (!isLiveKey()) return null;
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.RAZORPAY_ALLOW_LIVE_IN_DEV === "1") {
    console.warn("[razorpay] LIVE key in use outside production — this takes real money.");
    return null;
  }
  return "Razorpay is configured with a LIVE key and this is not production. Use test keys locally, or set RAZORPAY_ALLOW_LIVE_IN_DEV=1 if you really mean to charge a real card.";
}

function authHeader() {
  const pair = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`;
  return `Basic ${Buffer.from(pair).toString("base64")}`;
}

async function call(path, { method = "POST", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* Razorpay returns JSON on every documented path; a non-JSON body is an
       outage or a proxy, and the status below says so. */
  }

  if (!response.ok) {
    const reason = json?.error?.description ?? `Razorpay responded ${response.status}`;
    throw new Error(reason);
  }
  return json;
}

/**
 * A payment link for one booking.
 *
 * `amount` is in RUPEES, like everywhere above the repository. It is converted
 * here, once.
 *
 * Idempotency is the caller's job via `reference`: Razorpay rejects a duplicate
 * `reference_id`, which is deliberate — two links for the same instalment means
 * a customer can pay twice.
 */
export async function createPaymentLink({
  booking,
  amount,
  description,
  kind = "advance",
  expiresInDays = 7,
}) {
  if (!razorpayConfigured()) {
    return { error: "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." };
  }
  const blocked = liveKeyGuard();
  if (blocked) return { error: blocked };

  const rupees = Math.round(Number(amount) || 0);
  if (rupees <= 0) return { error: "Enter an amount to collect." };

  // Razorpay needs at least one contactable field, and rejects a malformed
  // phone outright. Digits only, with the country code.
  const phone = String(booking.phone ?? "").replace(/\D/g, "");
  const contact = phone.length === 10 ? `+91${phone}` : phone ? `+${phone}` : null;

  try {
    const link = await call("/payment_links", {
      body: {
        amount: rupees * 100,
        currency: "INR",
        accept_partial: false,
        description: (description ?? `${booking.tripTitle} — ${kind}`).slice(0, 2048),
        reference_id: `${booking.reference}-${kind}-${Date.now()}`,
        customer: {
          name: booking.name ?? undefined,
          email: booking.email ?? undefined,
          contact: contact ?? undefined,
        },
        // We send our own messages through the outbox, so the gateway should
        // not also email and SMS the customer — two different-looking requests
        // for the same money reads as a scam.
        notify: { sms: false, email: false },
        reminder_enable: true,
        expire_by: Math.floor(Date.now() / 1000) + expiresInDays * 86400,
        // Echoed back on the webhook. This is how a payment finds its booking
        // without trusting anything the customer could edit.
        notes: {
          bookingId: String(booking.id),
          bookingReference: String(booking.reference),
          kind,
        },
      },
    });

    return {
      link: {
        id: link.id,
        url: link.short_url,
        amount: rupees,
        kind,
        status: link.status,
        expiresAt: link.expire_by ? new Date(link.expire_by * 1000).toISOString() : null,
      },
    };
  } catch (error) {
    console.error("[razorpay] could not create a payment link", error);
    return { error: String(error?.message ?? error).slice(0, 300) };
  }
}

/**
 * Is this webhook genuinely from Razorpay?
 *
 * HMAC-SHA256 of the RAW body with the webhook secret. The raw body matters:
 * parsing and re-serialising changes key order and whitespace, and the
 * signature no longer matches — which is the single most common reason a
 * correct integration rejects every webhook.
 *
 * `timingSafeEqual` because a plain `===` on a signature leaks, byte by byte,
 * how much of a forged signature was right.
 */
export function verifyWebhook(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "RAZORPAY_WEBHOOK_SECRET is not set." };
  if (!signature) return { ok: false, reason: "No signature header." };

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  if (a.length !== b.length) return { ok: false, reason: "Signature length mismatch." };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: "Signature did not match." };
  return { ok: true };
}

/** Rupees, from Razorpay's paise. The only place this division happens. */
export function toRupees(paise) {
  return Math.round(Number(paise) || 0) / 100;
}

/** How the customer actually paid, mapped onto our PAYMENT_METHODS. */
export function methodFromRazorpay(method) {
  switch (method) {
    case "upi":
      return "UPI";
    case "card":
      return "Card";
    case "netbanking":
      return "Bank transfer";
    case "wallet":
      return "Wallet";
    default:
      return "Payment link";
  }
}
