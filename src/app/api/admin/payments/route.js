import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { ledgerFor, recordPayment } from "@/lib/crm/payments";
import { PAYMENT_METHODS } from "@/lib/crm/schema";
import { getBookingFor } from "@/lib/cms/bookings";

export const dynamic = "force-dynamic";

const Schema = z.object({
  bookingId: z.string().min(1).max(80),
  amount: z.number().refine((n) => n !== 0, "Enter an amount."),
  kind: z.enum(["advance", "instalment", "balance", "refund"]).optional(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().max(120).optional(),
  note: z.string().max(1000).optional(),
  receivedAt: z.string().max(40).optional(),
  allowOverpayment: z.boolean().optional(),
});

export async function GET(request) {
  const { user, denied } = await authorise("bookings.read");
  if (denied) return denied;

  const bookingId = new URL(request.url).searchParams.get("bookingId");
  if (!bookingId) return Response.json({ message: "No booking." }, { status: 400 });
  if (!(await getBookingFor(user, bookingId))) {
    return Response.json({ message: "No such booking." }, { status: 404 });
  }

  const ledger = await ledgerFor(bookingId);
  if (!ledger) return Response.json({ message: "No such booking." }, { status: 404 });
  return Response.json(ledger);
}

export async function POST(request) {
  const { user, denied } = await authorise("bookings.write");
  if (denied) return denied;

  const parsed = Schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "Invalid payment." },
      { status: 400 }
    );
  }

  if (!(await getBookingFor(user, parsed.data.bookingId))) {
    return Response.json({ message: "No such booking." }, { status: 404 });
  }

  const result = await recordPayment({ ...parsed.data, actor: user });

  // Not an error: an overpayment is legitimate and the desk decides. 409 so
  // the client knows to ask rather than to show a failure.
  if (result.needsConfirmation) {
    return Response.json({ needsConfirmation: true, message: result.message }, { status: 409 });
  }
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  return Response.json({ payment: result.payment, booking: result.booking });
}
