import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import { getCustomerDossier, updateCustomer } from "@/lib/crm/customers";
import { userCan } from "@/lib/crm/schema";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().max(160).optional(),
  company: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  notes: z.string().max(4000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  marketingConsent: z.boolean().optional(),
});

/** Edit a customer. Same scope as leads: a salesperson edits only their own customers. */
export async function PATCH(request) {
  const { user, denied } = await authorise("leads.write");
  if (denied) return denied;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json({ message: first ? `${first.path.join(".")}: ${first.message}` : "That didn't look right." }, { status: 400 });
  }

  const dossier = await getCustomerDossier(parsed.data.id);
  if (!dossier) return Response.json({ message: "That customer no longer exists." }, { status: 404 });
  if (!userCan(user, "team.read") && !dossier.ownerIds.includes(user.id)) {
    return Response.json({ message: "That customer belongs to a colleague's pipeline." }, { status: 403 });
  }

  const { id, ...input } = parsed.data;
  const result = await updateCustomer(id, input);
  if (result.error) {
    return Response.json({ message: result.error, clashId: result.clashId ?? null }, { status: result.clashId ? 409 : 400 });
  }
  return Response.json({ customer: result.customer });
}
