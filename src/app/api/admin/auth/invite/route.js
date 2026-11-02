import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import { acceptInvite, findByInviteToken, inviteUser } from "@/lib/cms/users";
import { ROLE_VALUES, ALL_PERMISSIONS } from "@/lib/crm/schema";
import { sendInvite } from "@/lib/crm/staff-mail";

export const dynamic = "force-dynamic";

const InviteSchema = z.object({
  email: z.string().email().max(160),
  name: z.string().max(120).optional(),
  role: z.enum(ROLE_VALUES),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
});

const AcceptSchema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().min(2).max(120),
  password: z.string().min(10).max(200),
});

/** Check an invite link before showing the form. */
export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ message: "No invitation token." }, { status: 400 });

  const found = await findByInviteToken(token);
  if (!found) return Response.json({ valid: false, reason: "invalid" }, { status: 404 });
  if (found.expired) return Response.json({ valid: false, reason: "expired" }, { status: 410 });

  // Only what the form needs to greet them. Never the whole record.
  return Response.json({
    valid: true,
    email: found.user.email,
    name: found.user.name,
    role: found.user.role,
    invitedByName: found.user.invitedByName ?? null,
  });
}

/** Admin invites someone. */
export async function POST(request) {
  const { user: actor, denied } = await authorise("team.write");
  if (denied) return denied;

  const parsed = InviteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "Invalid invitation." },
      { status: 400 }
    );
  }

  const result = await inviteUser({ ...parsed.data, invitedBy: actor });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  // The link is built here, where the request's own origin is known, so it
  // works on localhost and in production without another variable.
  const link = new URL(`/admin/invite?token=${result.token}`, request.url).toString();
  const delivery = await sendInvite({ user: result.user, link, invitedBy: actor });

  return Response.json({
    user: result.user,
    expiresAt: result.expiresAt,
    delivery,
    // Returned so an admin can copy it when there is no email provider. This
    // is the difference between a working invite flow and a dead end on a
    // project that has not set up email yet.
    link: delivery.sent ? undefined : link,
  });
}

/** The invitee sets their name and password. No session required. */
export async function PUT(request) {
  const parsed = AcceptSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? first.message : "Check the form and try again." },
      { status: 400 }
    );
  }

  const { token, name, password } = parsed.data;
  const result = await acceptInvite(token, { name, password });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  // Deliberately does NOT sign them in: they are `pending` until a human
  // approves. Returning a session here would make the approval step
  // decorative.
  return Response.json({
    ok: true,
    status: result.user.status,
    message: "Your account is set up and waiting for an admin to approve it.",
  });
}
