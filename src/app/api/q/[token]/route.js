import { z } from "zod";
import "@/lib/crm";
import { decide, getByToken } from "@/lib/crm/quotations";
import { setStage } from "@/lib/crm/leads";
import { convertQuotationToBooking } from "@/lib/crm/convert";

export const dynamic = "force-dynamic";

/**
 * The customer's decision endpoint.
 *
 * Unauthenticated by design — the token in the URL is the credential, which is
 * why it is unguessable and why only a SENT quotation resolves. The decision
 * is recorded against the quotation the token names; nothing else is
 * addressable from here.
 */
export async function POST(request, { params }) {
  const { token } = await params;

  const parsed = z
    .object({
      decision: z.enum(["approved", "rejected"]),
      note: z.string().max(1000).optional(),
    })
    .safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return Response.json({ message: "That didn't look right." }, { status: 400 });
  }

  const quotation = await getByToken(token);
  if (!quotation) return Response.json({ message: "This link is no longer valid." }, { status: 404 });

  if (quotation.status !== "sent") {
    return Response.json(
      { message: "This quotation has already been answered." },
      { status: 409 }
    );
  }

  const result = await decide(quotation.id, parsed.data.decision, {
    note: parsed.data.note,
    // No actor: the customer is not a staff member, and attributing this to
    // whoever sent it would put a decision in a salesperson's audit trail that
    // they did not make.
  });

  if (result.error) return Response.json({ message: result.error }, { status: 409 });

  if (parsed.data.decision === "approved") {
    // Most approvals happen HERE, on the customer's phone — not in the admin.
    // Converting only on the staff path would leave the common case with a won
    // lead and no booking behind it.
    const converted = await convertQuotationToBooking(quotation.id);
    if (converted.error) {
      console.error("[quote] approved but no booking was created:", converted.error);
    }
    return Response.json({
      ok: true,
      status: result.quotation.status,
      reference: converted.booking?.reference ?? null,
    });
  }

  // Declined is not dead: it goes back to the desk to rework, which is what
  // "negotiating" means.
  await setStage(quotation.leadId, "negotiating", {}).catch(() => {});

  return Response.json({ ok: true, status: result.quotation.status });
}
