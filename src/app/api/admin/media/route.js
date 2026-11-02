import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { listMedia, updateMedia, uploadMedia } from "@/lib/media-library";
import { describeMediaStorage } from "@/lib/media-store";
import { MAX_UPLOAD_BYTES, MEDIA_CATEGORY_VALUES } from "@/lib/media-rules";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Whoever builds quotations, trips or pages may add photos. */
function canUpload(user) {
  return (
    userCan(user, "quotations.write") || userCan(user, "catalogue.write") || userCan(user, "content.write")
  );
}

export async function GET(request) {
  // Any signed-in staff member may browse the library.
  const { denied } = await authorise();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const items = await listMedia({
    category: params.get("category") || "all",
    query: params.get("q") || "",
    uploadsOnly: params.get("uploads") === "1",
    includeArchived: params.get("archived") === "1",
  });
  return Response.json({ items, storage: describeMediaStorage() });
}

export async function POST(request) {
  const { user, denied } = await authorise();
  if (denied) return denied;
  if (!canUpload(user)) {
    return Response.json({ message: "Your account cannot add photos." }, { status: 403 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ message: "That upload didn't arrive whole. Try again." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return Response.json({ message: "No photo in the upload." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ message: "That photo is over 4 MB. Try a smaller one." }, { status: 413 });
  }

  try {
    const result = await uploadMedia({
      bytes: new Uint8Array(await file.arrayBuffer()),
      title: form.get("title"),
      alt: form.get("alt"),
      category: form.get("category"),
      tags: form.get("tags"),
      destination: form.get("destination"),
      width: form.get("width"),
      height: form.get("height"),
      actor: user,
    });
    if (result.error) return Response.json({ message: result.error }, { status: 400 });
    return Response.json({ item: result.item });
  } catch (error) {
    console.error("[media] upload failed", error);
    return Response.json({ message: error.message ?? "The upload failed." }, { status: 502 });
  }
}

const PatchSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().max(120).optional(),
  alt: z.string().max(200).optional(),
  category: z.enum(MEDIA_CATEGORY_VALUES).optional(),
  tags: z.union([z.string().max(600), z.array(z.string().max(40)).max(20)]).optional(),
  destination: z.string().max(80).optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(request) {
  const { user, denied } = await authorise();
  if (denied) return denied;
  if (!canUpload(user)) {
    return Response.json({ message: "Your account cannot edit photos." }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ message: "That edit didn't look right." }, { status: 400 });

  const { id, ...patch } = parsed.data;
  const result = await updateMedia(id, patch);
  if (result.error) return Response.json({ message: result.error }, { status: 400 });
  return Response.json({ item: result.item });
}
