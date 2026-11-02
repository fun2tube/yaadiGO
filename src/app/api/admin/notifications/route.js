import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import { inboxFor, markRead } from "@/lib/crm/notifications";

export const dynamic = "force-dynamic";

/**
 * Your notifications, and only yours.
 *
 * Scoped by the SESSION, never by a client-supplied id. A notification carries
 * customer names and deal values; letting the browser ask for someone else's
 * would be a data leak dressed as a convenience.
 */
export async function GET() {
  const { user, denied } = await authorise();
  if (denied) return denied;

  const { notifications, unread } = await inboxFor(user.id);
  return Response.json({ notifications, unread });
}

export async function PATCH(request) {
  const { user, denied } = await authorise();
  if (denied) return denied;

  const parsed = z
    .object({ id: z.string().max(80).optional(), all: z.boolean().optional() })
    .safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return Response.json({ message: "That didn't look right." }, { status: 400 });
  }

  // markRead filters by userId too, so a guessed id belonging to someone else
  // matches nothing rather than marking their notification read.
  const changed = await markRead(user.id, parsed.data.all ? null : parsed.data.id);
  const { unread } = await inboxFor(user.id);

  return Response.json({ changed, unread });
}
