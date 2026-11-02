import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { addService, removeService, servicesFor, updateService } from "@/lib/crm/operations";
import { handToOperations } from "@/lib/crm/convert";
import { SERVICE_KIND_VALUES, SERVICE_STATUS_VALUES } from "@/lib/crm/schema";

export const dynamic = "force-dynamic";

const AddSchema = z.object({
  bookingId: z.string().min(1).max(80),
  kind: z.enum(SERVICE_KIND_VALUES),
  title: z.string().min(1).max(200),
  supplier: z.string().max(160).optional(),
  reference: z.string().max(120).optional(),
  startsAt: z.string().max(40).optional(),
  endsAt: z.string().max(40).optional(),
  cost: z.number().min(0).max(100000000).optional(),
  note: z.string().max(1000).optional(),
  status: z.enum(SERVICE_STATUS_VALUES).optional(),
});

const UpdateSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(SERVICE_KIND_VALUES).optional(),
  status: z.enum(SERVICE_STATUS_VALUES).optional(),
  title: z.string().max(200).optional(),
  supplier: z.string().max(160).nullable().optional(),
  reference: z.string().max(120).nullable().optional(),
  startsAt: z.string().max(40).nullable().optional(),
  endsAt: z.string().max(40).nullable().optional(),
  cost: z.number().min(0).max(100000000).optional(),
  note: z.string().max(1000).nullable().optional(),
});

export async function GET(request) {
  const { denied } = await authorise("bookings.read");
  if (denied) return denied;

  const bookingId = new URL(request.url).searchParams.get("bookingId");
  if (!bookingId) return Response.json({ message: "No booking." }, { status: 400 });

  return Response.json({ services: await servicesFor(bookingId) });
}

export async function POST(request) {
  // services.write, not bookings.write: arranging suppliers is the ops job and
  // a salesperson should not be editing a flight PNR.
  const { user, denied } = await authorise("services.write");
  if (denied) return denied;

  const parsed = AddSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "Invalid service." },
      { status: 400 }
    );
  }

  const { bookingId, ...input } = parsed.data;
  const result = await addService(bookingId, input, { actor: user });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });
  return Response.json({ service: result.service });
}

export async function PATCH(request) {
  const { user, denied } = await authorise("services.write");
  if (denied) return denied;

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ message: "That update didn't look right." }, { status: 400 });
  }

  const { id, ...patch } = parsed.data;
  const result = await updateService(id, patch, { actor: user });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });
  return Response.json({ service: result.service });
}

export async function DELETE(request) {
  const { denied } = await authorise("services.write");
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ message: "No id." }, { status: 400 });

  const result = await removeService(id);
  if (result.error) return Response.json({ message: result.error }, { status: 404 });
  return Response.json({ ok: true });
}

/**
 * The handover. Sales-side, deliberately separate from the service endpoints
 * above, and deliberately explicit rather than automatic on payment — ops
 * starts committing real supplier money the moment they pick it up.
 */
export async function PUT(request) {
  const { user, denied } = await authorise("bookings.write");
  if (denied) return denied;

  const parsed = z
    .object({ bookingId: z.string().min(1).max(80), opsOwnerId: z.string().max(80).nullable().optional() })
    .safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) return Response.json({ message: "No booking." }, { status: 400 });

  const result = await handToOperations(parsed.data.bookingId, {
    actor: user,
    opsOwnerId: parsed.data.opsOwnerId ?? null,
  });
  if (result.error) return Response.json({ message: result.error }, { status: 409 });

  return Response.json({ booking: result.booking, alreadyExisted: result.alreadyExisted ?? false });
}
