import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { listInterests, promoteInterest } from "@/lib/crm/interests";

export const dynamic = "force-dynamic";

const Schema = z
  .object({
    conversationId: z.string().min(1).max(64),
    name: z.string().max(120).optional(),
    phone: z.string().max(30).optional(),
    email: z.string().max(160).optional(),
  })
  // One contact route is enough. Requiring both would lose the people who gave
  // a number and nothing else, which is most of them.
  .refine((v) => Boolean(v.phone?.trim() || v.email?.trim()), {
    message: "Add a phone number or an email.",
  });

export async function GET() {
  const { denied } = await authorise("leads.read");
  if (denied) return denied;
  return Response.json({ interests: await listInterests() });
}

export async function POST(request) {
  const { denied } = await authorise("leads.write");
  if (denied) return denied;

  const parsed = Schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "That didn't look right." },
      { status: 400 }
    );
  }

  const result = await promoteInterest(parsed.data.conversationId, parsed.data);
  if (!result) return Response.json({ message: "No such conversation." }, { status: 404 });

  if (result.alreadyPromoted) {
    // Not an error — somebody got there first. Hand back the lead so the UI
    // can go to it rather than creating a duplicate.
    return Response.json({ leadId: result.leadId, alreadyPromoted: true });
  }

  return Response.json({ leadId: result.leadId });
}
