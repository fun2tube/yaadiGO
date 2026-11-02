import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { issueCreditNote } from "@/lib/crm/invoices";

export const dynamic = "force-dynamic";

/**
 * Issue a credit note — the only way an issued invoice is corrected.
 * Same permission as raising the invoice: the separation between the person
 * who set the price and the person who issues tax documents applies to both.
 */
export async function POST(request) {
  const { user, denied } = await authorise("invoices.write");
  if (denied) return denied;

  const parsed = z
    .object({
      invoiceId: z.string().min(1).max(80),
      amount: z.number().positive().max(100000000),
      reason: z.string().min(1).max(500),
    })
    .safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return Response.json({ message: "Give an amount and a reason." }, { status: 400 });
  }

  const result = await issueCreditNote(parsed.data.invoiceId, { ...parsed.data, actor: user });
  if (result.error) return Response.json({ message: result.error }, { status: 409 });
  return Response.json({ creditNote: result.creditNote });
}
