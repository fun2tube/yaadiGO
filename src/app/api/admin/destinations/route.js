import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/cms/auth";
import { getDestinations, saveDestinationOverride } from "@/lib/cms/catalogue";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(2).max(160).optional(),
  heroNote: z.string().max(400).optional(),
  duration: z.string().max(40).optional(),
  fromPrice: z.number().int().min(0).max(10_000_000).optional(),
  bestTime: z.string().max(120).optional(),
  published: z.boolean().optional(),
});

export async function GET() {
  const denied = await requireAuth("catalogue.read");
  if (denied) return denied;
  return Response.json({ destinations: await getDestinations({ includeUnpublished: true }) });
}

export async function PATCH(request) {
  const denied = await requireAuth("catalogue.write");
  if (denied) return denied;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "Invalid destination." },
      { status: 400 }
    );
  }

  const { slug, ...patch } = parsed.data;
  const saved = await saveDestinationOverride(slug, patch);
  if (!saved) return Response.json({ message: "No such destination." }, { status: 404 });

  // Destinations appear in the nav mega-menu too — see the trips route.
  revalidatePath("/", "layout");
  revalidatePath(`/customized-tours/${slug}`);
  revalidatePath("/sitemap.xml");

  return Response.json({ ok: true });
}
