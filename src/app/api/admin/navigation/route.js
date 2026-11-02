import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import {
  getNavigation,
  saveNavigation,
  resetNavigation,
  DEFAULT_LINKS,
  DEFAULT_MOBILE_EXTRA,
  DEFAULT_FOOTER,
} from "@/lib/cms/navigation";

export const dynamic = "force-dynamic";

const LinkSchema = z.object({
  label: z.string().min(1).max(40),
  href: z.string().min(1).max(200),
  mega: z.boolean().optional(),
  // Derived from position on read, so anything sent is ignored rather than
  // trusted — a stored index is how a reordered menu keeps the old numbers.
  index: z.string().max(4).optional(),
  id: z.string().max(40).optional(),
});

const BodySchema = z.object({
  action: z.enum(["save", "reset"]),
  links: z.array(LinkSchema).min(1).max(12).optional(),
  mobileExtra: z.array(LinkSchema).max(12).optional(),
  footer: z
    .array(
      z.object({
        title: z.string().min(1).max(40),
        links: z.array(LinkSchema).max(10),
      })
    )
    .max(5)
    .optional(),
});

export async function GET() {
  const { denied } = await authorise("content.write");
  if (denied) return denied;
  return Response.json(await getNavigation());
}

export async function POST(request) {
  const { user, denied } = await authorise("content.write");
  if (denied) return denied;

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "That didn't look right." },
      { status: 400 }
    );
  }

  if (parsed.data.action === "reset") {
    await resetNavigation({ actor: user });
    return Response.json({
      ok: true,
      links: DEFAULT_LINKS,
      mobileExtra: DEFAULT_MOBILE_EXTRA,
      footer: DEFAULT_FOOTER,
    });
  }

  const { links, mobileExtra } = parsed.data;

  // A menu with nothing in it would leave every page with no way to navigate.
  // The schema already requires one, but saying so is better than a zod path.
  if (!links?.length) {
    return Response.json({ message: "A menu needs at least one item." }, { status: 400 });
  }

  // Store only what is ours to store: label, href and the mega-menu flag. The
  // index is recomputed on every read.
  const clean = (list) =>
    (list ?? []).map(({ label, href, mega }) => ({
      label: label.trim(),
      href: href.trim(),
      ...(mega ? { mega: true } : {}),
    }));

  await saveNavigation(
    {
      links: clean(links),
      mobileExtra: clean(mobileExtra),
      // Undefined rather than empty when absent, so saving the menu alone does
      // not wipe the footer.
      footer: parsed.data.footer
        ? parsed.data.footer.map((c) => ({ title: c.title.trim(), links: clean(c.links) }))
        : undefined,
    },
    { actor: user }
  );

  return Response.json({ ok: true });
}
