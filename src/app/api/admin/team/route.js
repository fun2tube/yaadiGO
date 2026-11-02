import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import {
  approveUser,
  countAdmins,
  getUser,
  listUsers,
  setStatus,
  updateUser,
} from "@/lib/cms/users";
import { ALL_PERMISSIONS, ROLE_VALUES } from "@/lib/crm/schema";
import { sendApproved } from "@/lib/crm/staff-mail";
import { emit } from "@/lib/crm/events";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  id: z.string().min(1).max(80),
  action: z.enum(["approve", "suspend", "reactivate", "update"]),
  name: z.string().max(120).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
  monthlyTarget: z.number().min(0).max(1000000000).nullable().optional(),
});

export async function GET() {
  const { denied } = await authorise("team.read");
  if (denied) return denied;

  const users = await listUsers({ includeInactive: true });
  return Response.json({
    users,
    counts: {
      total: users.length,
      pending: users.filter((u) => u.status === "pending").length,
      invited: users.filter((u) => u.status === "invited").length,
      active: users.filter((u) => u.status === "active").length,
    },
  });
}

export async function PATCH(request) {
  const { user: actor, denied } = await authorise("team.write");
  if (denied) return denied;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ message: "That update didn't look right." }, { status: 400 });
  }

  const { id, action, ...patch } = parsed.data;
  const target = await getUser(id);
  if (!target) return Response.json({ message: "No such account." }, { status: 404 });

  /**
   * You cannot lock the business out of its own admin.
   *
   * Suspending or demoting the last active admin leaves nobody able to
   * approve, invite or restore anyone — recoverable only by editing the data
   * files by hand. Cheap to prevent, miserable to undo.
   */
  const losingAdmin =
    target.role === "admin" &&
    target.status === "active" &&
    ((action === "suspend") || (action === "update" && patch.role && patch.role !== "admin"));

  if (losingAdmin && (await countAdmins()) <= 1) {
    return Response.json(
      { message: "This is the only active admin. Promote someone else first." },
      { status: 409 }
    );
  }

  if (action === "approve") {
    const result = await approveUser(id, { approvedBy: actor });
    if (result.error) return Response.json({ message: result.error }, { status: 400 });

    const signInUrl = new URL("/admin/login", request.url).toString();
    const delivery = await sendApproved({ user: result.user, signInUrl });

    await emit(
      "team.approved",
      { summary: `${result.user.name} approved as ${result.user.role}` },
      { actorId: actor.id, actorName: actor.name }
    );

    return Response.json({ user: result.user, delivery });
  }

  if (action === "suspend" || action === "reactivate") {
    const result = await setStatus(id, action === "suspend" ? "suspended" : "active");
    if (result.error) return Response.json({ message: result.error }, { status: 400 });

    await emit(
      "team.status",
      { summary: `${result.user.name} ${action === "suspend" ? "suspended" : "reactivated"}` },
      { actorId: actor.id, actorName: actor.name }
    );
    return Response.json({ user: result.user });
  }

  const result = await updateUser(id, patch);
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  await emit(
    "team.updated",
    { summary: `${result.user.name}: ${result.user.role}, ${result.user.permissions.length} permissions` },
    { actorId: actor.id, actorName: actor.name }
  );

  return Response.json({ user: result.user });
}
