import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { invoiceFor, issueInvoice, listInvoices } from "@/lib/crm/invoices";

export const dynamic = "force-dynamic";

export async function GET(request) {
  // Reading stays broad: a salesperson answering "has the invoice gone out?"
  // should not have to ask accounts. Only ISSUING is restricted.
  const { denied } = await authorise("bookings.read");
  if (denied) return denied;

  const bookingId = new URL(request.url).searchParams.get("bookingId");
  if (bookingId) return Response.json({ invoice: await invoiceFor(bookingId) });
  return Response.json({ invoices: await listInvoices() });
}

export async function POST(request) {
  /**
   * Raising a tax invoice is an ACCOUNTS action, not a sales one.
   *
   * This was `bookings.write` — held by every salesperson and every manager —
   * so the person who negotiated the price could also raise the statutory
   * document for it. Now it needs `invoices.write`, which only Accounts and
   * the super admin hold. A manager keeps `invoices.read` so they can still
   * see and chase one.
   */
  const { user, denied } = await authorise("invoices.write");
  if (denied) return denied;

  const parsed = z
    .object({
      bookingId: z.string().min(1).max(80),
      placeOfSupply: z.string().max(80).optional(),
      placeOfSupplyCode: z.string().max(2).optional(),
      customerGstin: z.string().max(20).optional(),
      customerAddress: z.string().max(400).optional(),
    })
    .safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) return Response.json({ message: "No booking." }, { status: 400 });

  const result = await issueInvoice(parsed.data.bookingId, { ...parsed.data, actor: user });
  if (result.error) return Response.json({ message: result.error }, { status: 409 });

  return Response.json({ invoice: result.invoice, alreadyExisted: result.alreadyExisted ?? false });
}
