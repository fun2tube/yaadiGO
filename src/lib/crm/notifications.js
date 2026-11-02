import "server-only";

import { createRecord, listRecords, updateRecord } from "@/lib/cms/records";
import { listUsers } from "@/lib/cms/users";
import { NOTIFICATION_EVENTS } from "@/lib/crm/schema";
import { on } from "@/lib/crm/events";

/**
 * Who gets told what.
 *
 * This module subscribes to the event log rather than being called from inside
 * leads, bookings and payments. That is the whole point: adding "tell ops when
 * a booking is paid" is one line here, not an edit to the payment module, and
 * no module has to know that notifications exist at all.
 *
 * Delivery is split in two on purpose:
 *
 *   IN-APP always works. It is a record in this system, it needs no provider,
 *   and it is what the bell in the header reads.
 *
 *   EMAIL and WHATSAPP need credentials the project may not have. When they
 *   are unconfigured the message is still recorded with `status: "pending"`
 *   and logged, so nothing is silently lost and the outbox shows exactly what
 *   would have gone out. Pretending to send is the one thing that must not
 *   happen — a customer who was never told, in a system that says they were,
 *   is worse than no notification at all.
 */

export const NOTIFICATIONS = "notifications";
export const OUTBOX = "outbox";

// Either provider will do. SMTP is now genuinely implemented — it used to be
// accepted here while `deliver()` threw "not implemented yet", so setting
// SMTP_URL alone marked every message queued and then immediately failed.
const emailConfigured = () => Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL);
const whatsappConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

/** Staff notification — lands in the bell menu. */
async function notifyUser({ userId, event, title, body, href }) {
  if (!userId) return null;
  return createRecord(NOTIFICATIONS, {
    userId,
    event,
    title,
    body: body ?? null,
    href: href ?? null,
    read: false,
    leadId: null,
    bookingId: null,
  });
}

/**
 * Customer notification — queued for a channel we may not have yet.
 *
 * Recorded either way. `status` is the honest bit: "sent" only after a
 * provider accepted it, "pending" when there is no provider, "failed" when one
 * refused. The outbox screen groups by that field.
 */
async function queueForCustomer({ to, channel, subject, body, event, meta = {} }) {
  const configured = channel === "email" ? emailConfigured() : whatsappConfigured();

  const row = await createRecord(OUTBOX, {
    channel,
    to,
    subject: subject ?? null,
    body,
    event,
    status: configured ? "queued" : "pending",
    reason: configured ? null : `No ${channel} provider configured`,
    attempts: 0,
    sentAt: null,
    ...meta,
  });

  if (!configured) {
    console.info(`[notify] ${channel} to ${to} not sent — no provider. Recorded in the outbox.`);
    return row;
  }

  try {
    await deliver(channel, row);
    await updateRecord(OUTBOX, row.id, { status: "sent", sentAt: new Date().toISOString() });
  } catch (error) {
    console.error(`[notify] ${channel} delivery failed`, error);
    await updateRecord(OUTBOX, row.id, {
      status: "failed",
      reason: String(error?.message ?? error).slice(0, 300),
      attempts: 1,
    });
  }
  return row;
}

/**
 * The only place that talks to a provider.
 *
 * Both branches are written against the provider's documented HTTP API rather
 * than an SDK, to keep the dependency count where it is. Neither has been
 * exercised against a live account in this project — the credentials are not
 * set — so treat the first real send as the test.
 */
/**
 * One SMTP connection per process, not one per email.
 *
 * A fresh TLS handshake and AUTH for every message is slow, and Gmail and most
 * providers rate-limit on connections rather than messages — so a burst of
 * notifications fails on connection count long before it fails on volume.
 * Cached on globalThis because Next re-evaluates modules on hot reload, and
 * without the cache every edit leaks a connection pool.
 */
const globalForMail = globalThis;

async function smtpTransport() {
  if (globalForMail.__yaadigoMail) return globalForMail.__yaadigoMail;

  // Imported lazily so the marketing site and the AI planner never pay for a
  // mail library they do not use.
  const { default: nodemailer } = await import("nodemailer");

  globalForMail.__yaadigoMail = nodemailer.createTransport(process.env.SMTP_URL, {
    pool: true,
    maxConnections: 3,
    // Gmail's app-password limit is generous but not unlimited; staying well
    // under it matters more than sending a queue three seconds sooner.
    maxMessages: 50,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return globalForMail.__yaadigoMail;
}

async function deliverBySmtp(row) {
  const transport = await smtpTransport();
  const from = process.env.NOTIFY_FROM_EMAIL || "YaadiGo <info@yaadigo.com>";

  const info = await transport.sendMail({
    from,
    to: row.to,
    subject: row.subject ?? "YaadiGo",
    text: row.body,
    // Replies go to a human, not into a no-reply void. The desk works from
    // this mailbox already.
    replyTo: process.env.NOTIFY_REPLY_TO || from,
  });

  // `rejected` means the server accepted the envelope but refused this
  // recipient. Treated as a failure so the outbox says so rather than
  // reporting a send that never landed.
  if (info?.rejected?.length) {
    throw new Error(`SMTP rejected ${info.rejected.join(", ")}`);
  }
  return info;
}

/**
 * Deliver one already-queued outbox row.
 *
 * Exported so the retry worker can reuse the exact same code path a first
 * attempt took — a worker with its own copy of the provider calls would drift,
 * and the retry would eventually stop matching what the original send did.
 *
 * Throws on failure; the caller decides what that means.
 */
export async function deliverQueued(row) {
  if (!row?.channel) throw new Error("Outbox row has no channel");
  const configured = row.channel === "email" ? emailConfigured() : whatsappConfigured();
  if (!configured) throw new Error(`No ${row.channel} provider configured`);
  return deliver(row.channel, row);
}

async function deliver(channel, row) {
  if (channel === "email") {
    // SMTP first when it is configured: it sends from the business's own
    // mailbox (info@yaadigo.com), so there is no sending domain to verify and
    // replies land where the desk already looks. Resend is the alternative for
    // volume, and needs DNS records before it can send as @yaadigo.com.
    if (process.env.SMTP_URL) return deliverBySmtp(row);

    if (!process.env.RESEND_API_KEY) throw new Error("No email provider is configured");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || "YaadiGo <info@yaadigo.com>",
        to: [row.to],
        subject: row.subject ?? "YaadiGo",
        text: row.body,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}`);
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: String(row.to).replace(/[^\d]/g, ""),
        type: "text",
        text: { body: row.body },
      }),
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!response.ok) throw new Error(`WhatsApp responded ${response.status}`);
}

/** Expand an audience list into concrete user ids. */
async function resolveAudience(audience, event) {
  const ids = new Set();
  const staff = await listUsers();

  for (const target of audience) {
    if (target === "customer") continue;
    if (target === "owner") {
      if (event.ownerId) ids.add(event.ownerId);
      continue;
    }
    // Otherwise it is a role name.
    for (const user of staff) {
      if (user.role === target) ids.add(user.id);
    }
  }

  // Never notify someone about their own action — the bell should mean
  // "something happened that you did not do".
  if (event.actorId) ids.delete(event.actorId);
  return [...ids];
}

function describe(event) {
  const spec = NOTIFICATION_EVENTS[event.type];
  const p = event.payload ?? {};
  const who = p.customerName ? ` — ${p.customerName}` : "";
  const amount = event.amount ? ` (₹${Number(event.amount).toLocaleString("en-IN")})` : "";

  return {
    title: `${spec?.title ?? event.type}${who}`,
    body: p.summary ?? null,
    href: p.href
      ? p.href
      : event.bookingId
      ? `/admin/bookings/${event.bookingId}`
      : event.leadId
        ? `/admin/leads/${event.leadId}`
        : null,
    customerSubject: spec?.customerTitle ?? spec?.title ?? "YaadiGo",
    customerBody: p.customerMessage ?? `${spec?.customerTitle ?? "Update"}${amount}`,
  };
}

/**
 * One subscriber for every event type in the schema.
 *
 * Registered at module load. `dispatch` is the reason this file is imported
 * for its side effect by the CRM entry point — see lib/crm/index.js.
 */
export function register() {
  for (const [type, spec] of Object.entries(NOTIFICATION_EVENTS)) {
    on(type, async (event) => {
      const text = describe(event);

      const userIds = await resolveAudience(spec.audience, event);
      await Promise.all(
        userIds.map((userId) =>
          notifyUser({
            userId,
            event: type,
            title: text.title,
            body: text.body,
            href: text.href,
          })
        )
      );

      if (!spec.audience.includes("customer")) return;

      const p = event.payload ?? {};
      if (p.customerEmail) {
        await queueForCustomer({
          to: p.customerEmail,
          channel: "email",
          subject: text.customerSubject,
          body: text.customerBody,
          event: type,
          meta: { leadId: event.leadId, bookingId: event.bookingId },
        });
      }
      if (p.customerPhone) {
        await queueForCustomer({
          to: p.customerPhone,
          channel: "whatsapp",
          body: text.customerBody,
          event: type,
          meta: { leadId: event.leadId, bookingId: event.bookingId },
        });
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function inboxFor(userId, { limit = 50 } = {}) {
  const rows = await listRecords(NOTIFICATIONS);
  const mine = rows
    .filter((row) => row.userId === userId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    notifications: mine.slice(0, limit),
    unread: mine.filter((row) => !row.read).length,
  };
}

export async function markRead(userId, id) {
  const rows = await listRecords(NOTIFICATIONS);
  const targets = id
    ? rows.filter((row) => row.id === id && row.userId === userId)
    : rows.filter((row) => row.userId === userId && !row.read);

  await Promise.all(targets.map((row) => updateRecord(NOTIFICATIONS, row.id, { read: true })));
  return targets.length;
}

/** What would have gone to customers, and what actually did. */
export async function outbox({ status } = {}) {
  const rows = await listRecords(OUTBOX);
  const filtered = status ? rows.filter((row) => row.status === status) : rows;
  return filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function channelStatus() {
  return {
    inapp: { configured: true, note: "Always available." },
    email: {
      configured: emailConfigured(),
      note: emailConfigured()
        ? (process.env.SMTP_URL ? "Sending over SMTP." : "Sending through Resend.")
        : "Set SMTP_URL (or RESEND_API_KEY) to send. Messages wait in the outbox meanwhile.",
    },
    whatsapp: {
      configured: whatsappConfigured(),
      note: whatsappConfigured()
        ? "Sending through the WhatsApp Business API."
        : "Set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID to send. Messages are recorded in the outbox meanwhile.",
    },
  };
}
