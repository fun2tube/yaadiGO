import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import {
  getPage,
  listPages,
  saveDraft,
  publishPage,
  unpublishPage,
} from "@/lib/cms/pages";

export const dynamic = "force-dynamic";

/**
 * The page builder's storage endpoint.
 *
 * `data` is Puck's own document shape, so it is stored as given rather than
 * validated field by field — the block registry already constrains what can be
 * in it, and a schema here would have to be rewritten every time a block gains
 * a field. What IS enforced is the envelope: a content array, a size ceiling,
 * and a real action.
 */

const DataSchema = z.object({
  content: z.array(z.record(z.string(), z.unknown())).max(200),
  root: z.record(z.string(), z.unknown()).optional(),
  zones: z.record(z.string(), z.unknown()).optional(),
});

const BodySchema = z.object({
  path: z.string().min(1).max(200),
  action: z.enum(["draft", "publish", "unpublish"]),
  data: DataSchema.optional(),
});

export async function GET(request) {
  const { denied } = await authorise("content.write");
  if (denied) return denied;

  const path = new URL(request.url).searchParams.get("path");
  if (!path) return Response.json({ pages: await listPages() });

  return Response.json({ page: await getPage(path) });
}

export async function POST(request) {
  const { user, denied } = await authorise("content.write");
  if (denied) return denied;

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ message: "That didn't look right." }, { status: 400 });
  }

  const { path, action, data } = parsed.data;

  if (action === "unpublish") {
    await unpublishPage(path, { actor: user });
    return Response.json({ ok: true, published: false });
  }

  if (!data) return Response.json({ message: "Nothing to save." }, { status: 400 });

  // Publishing an empty canvas would replace a working page with a blank one,
  // which is almost always somebody clearing it by accident rather than
  // meaning it. Unpublishing is the deliberate way back to the coded page.
  if (action === "publish" && data.content.length === 0) {
    return Response.json(
      {
        message:
          "There is nothing on this page to publish. Use 'Revert to the coded page' if that is what you want.",
      },
      { status: 400 }
    );
  }

  if (action === "publish") {
    await publishPage(path, data, { actor: user });
    return Response.json({ ok: true, published: true });
  }

  await saveDraft(path, data, { actor: user });
  return Response.json({ ok: true, published: false });
}
