import "server-only";

import { createRecord } from "@/lib/cms/records";
import { OUTBOX } from "@/lib/crm/notifications";

/**
 * Staff emails: invitations, approvals, password resets.
 *
 * Separate from customer notifications because these are transactional and
 * carry a credential. Two rules follow from that:
 *
 *   The link is NEVER written into the outbox record. An outbox row is read by
 *   any admin, and an invite or reset link is a bearer token — storing it
 *   would let one colleague take over another's account by reading a log.
 *
 *   When there is no email provider the call reports `sent: false` rather than
 *   pretending. The caller then shows the link to the admin to pass on by
 *   hand, which keeps the flow usable on a project that has not set up email
 *   instead of silently stranding every invitee.
 */

const configured = () => Boolean(process.env.RESEND_API_KEY);

const FROM = () => process.env.NOTIFY_FROM_EMAIL || "YaadiGo <info@yaadigo.com>";

async function record({ to, subject, kind, sent, reason }) {
  await createRecord(OUTBOX, {
    channel: "email",
    to,
    subject,
    // The body is summarised on purpose — see the note above.
    body: `[${kind}] link not stored for security`,
    event: `staff.${kind}`,
    status: sent ? "sent" : "pending",
    reason: reason ?? null,
    attempts: sent ? 1 : 0,
    sentAt: sent ? new Date().toISOString() : null,
  });
}

async function send({ to, subject, text, kind }) {
  if (!configured()) {
    await record({ to, subject, kind, sent: false, reason: "No email provider configured" });
    console.info(`[staff-mail] ${kind} for ${to} not sent — RESEND_API_KEY is not set.`);
    return { sent: false, reason: "No email provider is configured." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM(), to: [to], subject, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Resend responded ${response.status}`);

    await record({ to, subject, kind, sent: true });
    return { sent: true };
  } catch (error) {
    console.error(`[staff-mail] ${kind} to ${to} failed`, error);
    await record({ to, subject, kind, sent: false, reason: String(error?.message ?? error) });
    return { sent: false, reason: "The email could not be sent." };
  }
}

export function sendInvite({ user, link, invitedBy }) {
  const who = invitedBy?.name ? `${invitedBy.name} has` : "You have been";
  return send({
    to: user.email,
    subject: "Your YaadiGo team invitation",
    kind: "invite",
    text: [
      `${who} invited you to the YaadiGo team${invitedBy?.name ? "" : ""}.`,
      "",
      "Set your password here — the link works once and expires in 72 hours:",
      link,
      "",
      "After that an admin approves your account and you can sign in.",
    ].join("\n"),
  });
}

export function sendApproved({ user, signInUrl }) {
  return send({
    to: user.email,
    subject: "Your YaadiGo account is ready",
    kind: "approved",
    text: [
      `Hello ${user.name ?? ""},`.trim(),
      "",
      "Your account has been approved. You can sign in now:",
      signInUrl,
    ].join("\n"),
  });
}

export function sendPasswordReset({ user, link }) {
  return send({
    to: user.email,
    subject: "Reset your YaadiGo password",
    kind: "reset",
    text: [
      "Someone asked to reset the password on this account.",
      "",
      "If it was you, set a new one here — the link works once and expires in 2 hours:",
      link,
      "",
      "If it wasn't you, ignore this email. Nothing has changed.",
    ].join("\n"),
  });
}

export function emailConfigured() {
  return configured();
}
