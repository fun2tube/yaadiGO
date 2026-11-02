import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import { getDestination, getTrip } from "@/lib/cms/catalogue";
import {
  archiveTrip,
  createTrip,
  deleteDraftTrip,
  discardDraft,
  duplicateTrip,
  getTripForEdit,
  publishTrip,
  restoreTrip,
  saveDraft,
} from "@/lib/cms/trips";
import { tripPath } from "@/lib/trip-model";

export const dynamic = "force-dynamic";

/**
 * Trip management (docs/design/trip-management.md, phase 1).
 *
 * One route, one `action` per request — the editor's buttons map one-to-one
 * onto the verbs a person uses: save, publish, archive, restore, duplicate,
 * delete. Reading needs catalogue.read; every write needs catalogue.write,
 * checked here on the server whatever the screen showed.
 */

/** The page as visitors see it now, for seeding a coded trip's first record. */
async function currentPage(slug) {
  return (
    (await getTrip(slug, { includeUnpublished: true })) ??
    (await getDestination(slug, { includeUnpublished: true }))
  );
}

function refresh(kind, slug) {
  // Listings, the nav mega-menu, the homepage and the sitemap all list trips.
  revalidatePath("/", "layout");
  if (slug) revalidatePath(tripPath(kind, slug));
  revalidatePath("/sitemap.xml");
}

export async function GET(request) {
  const { denied } = await authorise("catalogue.read");
  if (denied) return denied;

  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return Response.json({ message: "Which trip?" }, { status: 400 });

  const trip = await getTripForEdit(slug, await currentPage(slug));
  if (!trip) return Response.json({ message: "No such trip." }, { status: 404 });
  return Response.json({ trip });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), kind: z.enum(["group", "customized"]), title: z.string() }),
  z.object({ action: z.literal("save"), slug: z.string().min(1), content: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal("publish"), slug: z.string().min(1), target: z.enum(["published", "internal"]) }),
  z.object({ action: z.literal("discard"), slug: z.string().min(1) }),
  z.object({ action: z.literal("archive"), slug: z.string().min(1), redirectTo: z.string().nullable().optional() }),
  z.object({ action: z.literal("restore"), slug: z.string().min(1) }),
  z.object({ action: z.literal("duplicate"), slug: z.string().min(1) }),
  z.object({ action: z.literal("delete"), slug: z.string().min(1) }),
]);

export async function POST(request) {
  const { user, denied } = await authorise("catalogue.write");
  if (denied) return denied;

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ message: "That request is not one this screen sends." }, { status: 400 });
  }
  const body = parsed.data;
  const actor = { id: user.id, name: user.name };

  let result;
  switch (body.action) {
    case "create":
      result = await createTrip({ kind: body.kind, title: body.title, actor });
      break;
    case "save":
      result = await saveDraft(body.slug, body.content, { actor, current: await currentPage(body.slug) });
      break;
    case "publish":
      result = await publishTrip(body.slug, { target: body.target, actor, current: await currentPage(body.slug) });
      break;
    case "discard":
      result = await discardDraft(body.slug, { actor });
      break;
    case "archive":
      result = await archiveTrip(body.slug, {
        redirectTo: body.redirectTo || null,
        actor,
        current: await currentPage(body.slug),
      });
      break;
    case "restore":
      result = await restoreTrip(body.slug, { actor });
      break;
    case "duplicate":
      result = await duplicateTrip(body.slug, { actor, current: await currentPage(body.slug) });
      break;
    case "delete":
      result = await deleteDraftTrip(body.slug);
      break;
  }

  if (result?.error) {
    return Response.json({ message: result.error, problems: result.problems ?? [] }, { status: 409 });
  }

  // Only actions that change what visitors see need the cache cleared.
  if (["publish", "archive", "restore"].includes(body.action)) {
    refresh(result.trip?.kind, body.slug);
  }

  return Response.json({ ok: true, trip: result.trip ?? null });
}
