import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/cms/auth";
import { getField, patchField, resetField, listEdits, describeStorage } from "@/lib/cms/store";
import { sanitiseStyle } from "@/lib/cms/style-tokens";
import { getImage } from "@/lib/media";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  id: z.string().min(1).max(200),
  text: z.string().max(6000).nullable().optional(),
  style: z.record(z.string(), z.string()).nullable().optional(),
  imageId: z.string().max(120).nullable().optional(),
  hidden: z.boolean().optional(),
  // Which page to rebuild after the edit. Without it a static page would keep
  // serving the pre-edit HTML until the next deploy.
  path: z.string().max(300).optional(),
});

export async function GET(request) {
  const denied = await requireAuth("content.write");
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (id) return Response.json({ field: await getField(id), storage: describeStorage() });

  return Response.json({ ...(await listEdits()), storage: describeStorage() });
}

export async function PATCH(request) {
  const denied = await requireAuth("content.write");
  if (denied) return denied;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ message: "That edit didn't look right." }, { status: 400 });
  }

  const { id, text, style, imageId, hidden, path } = parsed.data;

  // An image override must name a real library entry, or the page would
  // render nothing and look like a bug rather than a bad edit.
  if (imageId != null && imageId !== "" && !getImage(imageId)) {
    return Response.json(
      { message: `No image with id "${imageId}" in the media library.` },
      { status: 400 }
    );
  }

  const patch = {};
  if (text !== undefined) patch.text = text;
  if (style !== undefined) patch.style = style === null ? null : sanitiseStyle(style);
  if (imageId !== undefined) patch.image = imageId;
  if (hidden !== undefined) patch.hidden = hidden;

  try {
    const field = await patchField(id, patch);
    if (path) revalidatePath(path);
    return Response.json({ field, storage: describeStorage() });
  } catch (error) {
    console.error("[cms] write failed", error);
    return Response.json(
      {
        message:
          "Couldn't save that. The content store is not writable here — see the storage note in the admin bar.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const denied = await requireAuth("content.write");
  if (denied) return denied;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const path = url.searchParams.get("path");
  if (!id) return Response.json({ message: "No id." }, { status: 400 });

  const field = await resetField(id);
  if (path) revalidatePath(path);
  return Response.json({ field });
}
