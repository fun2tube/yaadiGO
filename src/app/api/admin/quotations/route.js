import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import {
  createQuotation,
  decide,
  getQuotation,
  listQuotations,
  sendQuotation,
  updateDraft,
  reviseQuotation,
  discardDraft,
  setPresentation,
} from "@/lib/crm/quotations";
import { setStage } from "@/lib/crm/leads";
import { convertQuotationToBooking } from "@/lib/crm/convert";
import { QUOTE_LINE_KIND_VALUES } from "@/lib/crm/schema";

export const dynamic = "force-dynamic";

const LineSchema = z.object({
  kind: z.enum(QUOTE_LINE_KIND_VALUES).optional(),
  label: z.string().min(1).max(160),
  detail: z.string().max(300).nullable().optional(),
  quantity: z.number().int().min(1).max(60),
  unitPrice: z.number().min(0).max(10000000),
  // What we pay the supplier. Omitted here originally, which meant zod
  // stripped it and every quotation reported 100% margin — a number that
  // would have told a salesperson they had unlimited room to discount.
  unitCost: z.number().min(0).max(10000000).optional(),
  perPerson: z.boolean(),
  confidence: z.enum(["known", "estimate", "placeholder"]).optional(),
});

const DraftSchema = z.object({
  title: z.string().max(120).optional(),
  summary: z.string().max(2000).optional(),
  destination: z.string().max(160).optional(),
  durationDays: z.number().int().min(1).max(60).nullable().optional(),
  startDate: z.string().max(40).nullable().optional(),
  travellers: z.number().int().min(1).max(60).optional(),
  discount: z.number().min(0).optional(),
  taxPercent: z.number().min(0).max(40).optional(),
  lines: z.array(LineSchema).min(1).max(40),
  inclusions: z.array(z.string().max(200)).max(30).optional(),
  exclusions: z.array(z.string().max(200)).max(30).optional(),
  terms: z.string().max(4000).nullable().optional(),
  validUntil: z.string().max(40).nullable().optional(),
  // The day-by-day, from the AI planner or the quote drafter. It MUST be
  // declared here or zod strips it silently on the way in and every quotation
  // prints as a table of money with no plan — the same failure mode as
  // `unitCost` above, which cost us every margin figure in the system.
  itinerary: z
    .object({
      title: z.string().max(160).nullable().optional(),
      destination: z.string().max(160).nullable().optional(),
      durationDays: z.number().int().min(1).max(60).nullable().optional(),
      days: z
        .array(
          z
            .object({
              day: z.number().int().min(1).max(60),
              title: z.string().max(160).optional(),
              summary: z.string().max(400).optional(),
              morning: z.string().max(400).optional(),
              afternoon: z.string().max(400).optional(),
              evening: z.string().max(400).optional(),
              imageId: z.string().max(120).nullable().optional(),
              imageUrl: z.string().max(600).nullable().optional(),
            })
            .passthrough()
        )
        .max(60),
    })
    .nullable()
    .optional(),
});

export async function GET(request) {
  const { user, denied } = await authorise("quotations.read");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const id = params.get("id");

  if (id) {
    const quotation = await getQuotation(id);
    if (!quotation) return Response.json({ message: "No such quotation." }, { status: 404 });
    return Response.json({ quotation });
  }

  // Sales see their own by default; a manager or admin sees everything.
  const mine = params.get("mine") === "1";
  const quotations = await listQuotations({
    leadId: params.get("leadId") ?? undefined,
    status: params.get("status") ?? undefined,
    ownerId: mine ? user.id : undefined,
  });

  return Response.json({ quotations });
}

export async function POST(request) {
  const { user, denied } = await authorise("quotations.write");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const parsed = z.object({ leadId: z.string().min(1), draft: DraftSchema }).safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "Invalid quotation." },
      { status: 400 }
    );
  }

  const result = await createQuotation({ ...parsed.data, actor: user });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });
  return Response.json({ quotation: result.quotation });
}

export async function PATCH(request) {
  const { user, denied } = await authorise("quotations.write");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const parsed = z
    .object({
      id: z.string().min(1),
      action: z.enum(["save", "send", "approve", "reject", "revise", "discard", "presentation"]),
      draft: DraftSchema.optional(),
      content: z.record(z.string(), z.unknown()).optional(),
      note: z.string().max(1000).optional(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return Response.json({ message: "That update didn't look right." }, { status: 400 });
  }

  const { id, action, draft, note, content } = parsed.data;

  if (action === "presentation") {
    // Allowed even once sent: template, images and the overview are
    // presentation, not the offer. No figure is reachable from here — the
    // schema above has no money fields — so the immutability that matters is
    // intact.
    const result = await setPresentation(id, content ?? {}, { actor: user });
    if (result.error) return Response.json({ message: result.error }, { status: 400 });
    return Response.json({ quotation: result.quotation });
  }

  if (action === "save") {
    if (!draft) return Response.json({ message: "Nothing to save." }, { status: 400 });
    const result = await updateDraft(id, draft, { actor: user });
    if (result.error) return Response.json({ message: result.error }, { status: 409 });
    return Response.json({ quotation: result.quotation });
  }

  if (action === "discard") {
    const result = await discardDraft(id, { actor: user });
    if (result.error) return Response.json({ message: result.error }, { status: 409 });
    return Response.json({ quotation: result.quotation });
  }

  if (action === "revise") {
    const result = await reviseQuotation(id, { actor: user });
    if (result.error) return Response.json({ message: result.error }, { status: 409 });
    return Response.json({ quotation: result.quotation });
  }

  if (action === "send") {
    const result = await sendQuotation(id, { actor: user });
    if (result.error) return Response.json({ message: result.error }, { status: 409 });

    // Sending a quotation IS the lead moving to "quoted". Leaving the desk to
    // remember that separately is how a pipeline stops reflecting reality.
    await setStage(result.quotation.leadId, "quoted", { actor: user }).catch(() => {});

    return Response.json({ quotation: result.quotation });
  }

  const result = await decide(id, action === "approve" ? "approved" : "rejected", {
    actor: user,
    note,
  });
  if (result.error) return Response.json({ message: result.error }, { status: 409 });

  if (action === "approve") {
    // An approved quotation with no booking behind it is a won lead that owes
    // nothing and reaches nobody — the gap the reconciliation check caught.
    const converted = await convertQuotationToBooking(id, { actor: user });
    if (converted.error) {
      return Response.json(
        { quotation: result.quotation, warning: converted.error },
        { status: 200 }
      );
    }
    return Response.json({ quotation: result.quotation, booking: converted.booking });
  }

  await setStage(result.quotation.leadId, "negotiating", { actor: user }).catch(() => {});
  return Response.json({ quotation: result.quotation });
}
