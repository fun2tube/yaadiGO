import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/cms/auth";
import { getTrips, saveTripDepartures, saveTripOverride } from "@/lib/cms/catalogue";

export const dynamic = "force-dynamic";

const DepartureSchema = z.object({
  id: z.string().min(1).max(40),
  start: z.string().regex(/^d{4}-d{2}-d{2}$/, "Use YYYY-MM-DD"),
  end: z.string().regex(/^d{4}-d{2}-d{2}$/, "Use YYYY-MM-DD"),
  price: z.number().int().min(0).max(10_000_000),
  // The SIZE of the batch. Seats left are derived from bookings and holds
  // (lib/inventory.js) and are never accepted from a client.
  capacity: z.number().int().min(0).max(999),
  minToRun: z.number().int().min(0).max(999).optional(),
  cutoffDays: z.number().int().min(0).max(90).optional(),
});

const PatchSchema = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(2).max(160).optional(),
  heroNote: z.string().max(400).optional(),
  duration: z.string().max(40).optional(),
  groupSize: z.string().max(60).optional(),
  advanceAmount: z.number().int().min(0).max(1_000_000).optional(),
  published: z.boolean().optional(),
  departures: z.array(DepartureSchema).max(40).optional(),
});

export async function GET() {
  const denied = await requireAuth("catalogue.read");
  if (denied) return denied;
  return Response.json({ trips: await getTrips({ includeUnpublished: true }) });
}

export async function PATCH(request) {
  const denied = await requireAuth("catalogue.write");
  if (denied) return denied;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "Invalid trip." },
      { status: 400 }
    );
  }

  const { slug, ...patch } = parsed.data;

  // A departure that ends before it starts would break every date display and
  // the booking maths downstream, so it is rejected here rather than rendered.
  for (const departure of patch.departures ?? []) {
    if (new Date(departure.end) <= new Date(departure.start)) {
      return Response.json(
        { message: `Departure ${departure.id}: the end date must be after the start date.` },
        { status: 400 }
      );
    }
  }

  const ids = (patch.departures ?? []).map((d) => d.id);
  if (new Set(ids).size !== ids.length) {
    return Response.json({ message: "Two departures share an id." }, { status: 400 });
  }

  // Seats first: if the departures are refused (a batch would go below zero,
  // or has travellers on it), nothing else is saved either.
  if (patch.departures) {
    const result = await saveTripDepartures(slug, patch.departures);
    if (!result.ok) return Response.json({ message: result.message }, { status: 409 });
  }

  const saved = await saveTripOverride(slug, patch);
  if (!saved) return Response.json({ message: "No such trip." }, { status: 404 });

  // The nav mega-menu lists trips, so a rename or an unpublish changes every
  // page on the site, not just the two this route obviously touches.
  revalidatePath("/", "layout");
  revalidatePath(`/group-tours/${slug}`);
  revalidatePath("/sitemap.xml");

  return Response.json({ ok: true });
}
