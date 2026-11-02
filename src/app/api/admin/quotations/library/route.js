import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import {
  saveAsTemplate,
  listTemplates,
  applyTemplate,
  deleteTemplate,
  TEMPLATE_KIND_VALUES,
} from "@/lib/crm/quote-library";

export const dynamic = "force-dynamic";

/**
 * The quotation library.
 *
 * GET    list, optionally filtered by kind or a search term
 * POST   save a quotation into the library
 * PUT    start a new quotation for a lead from a library entry
 * DELETE archive an entry
 */

export async function GET(request) {
  const { denied } = await authorise("quotations.read");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const templates = await listTemplates({
    kind: params.get("kind") ?? undefined,
    search: params.get("q") ?? undefined,
  });
  return Response.json({ templates });
}

export async function POST(request) {
  const { user, denied } = await authorise("quotations.write");
  if (denied) return denied;

  const parsed = z
    .object({
      quotationId: z.string().min(1),
      name: z.string().max(120).optional(),
      kind: z.enum(TEMPLATE_KIND_VALUES),
      tags: z.array(z.string().max(40)).max(12).optional(),
    })
    .safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "That didn't look right." },
      { status: 400 }
    );
  }

  const { quotationId, ...rest } = parsed.data;
  const result = await saveAsTemplate(quotationId, { ...rest, actor: user });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  return Response.json({ template: result.template });
}

export async function PUT(request) {
  const { user, denied } = await authorise("quotations.write");
  if (denied) return denied;

  const parsed = z
    .object({ templateId: z.string().min(1), leadId: z.string().min(1) })
    .safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return Response.json({ message: "Pick a saved quotation and an enquiry." }, { status: 400 });
  }

  const result = await applyTemplate(parsed.data.templateId, {
    leadId: parsed.data.leadId,
    actor: user,
  });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  return Response.json({ quotation: result.quotation });
}

export async function DELETE(request) {
  const { user, denied } = await authorise("quotations.write");
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ message: "Which one?" }, { status: 400 });

  const result = await deleteTemplate(id, { actor: user });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  return Response.json({ ok: true });
}
