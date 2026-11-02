import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import { describeError, PlannerUnavailableError } from "@/lib/ai";
import { draftQuotation } from "@/lib/crm/quote-ai";
import { getLead } from "@/lib/crm/leads";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The two-minute quotation.
 *
 * Drafts only. Nothing here is saved or sent — the salesperson gets a filled
 * form they then correct. Every line carries the model's own confidence so the
 * numbers that need checking are the ones highlighted.
 */
export async function POST(request) {
  const { user, denied } = await authorise("quotations.write");
  if (denied) return denied;

  const parsed = z
    .object({ leadId: z.string().min(1), instruction: z.string().max(600).optional() })
    .safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return Response.json({ message: "That request didn't look right." }, { status: 400 });
  }

  const lead = await getLead(parsed.data.leadId);
  if (!lead) return Response.json({ message: "No such lead." }, { status: 404 });

  try {
    const result = await draftQuotation({ lead, instruction: parsed.data.instruction });
    if (result.error) return Response.json({ message: result.error }, { status: 502 });
    // `grounding` says whether the draft was anchored to real catalogue prices
    // or guessed from the model's training data. It was being computed and
    // thrown away here, so the builder could not tell a salesperson which they
    // were looking at — and an unanchored draft is exactly when every figure
    // needs checking.
    return Response.json({
      draft: result.draft,
      grounding: result.grounding,
      leadName: lead.name,
    });
  } catch (error) {
    const { status, message } = describeError(
      error instanceof PlannerUnavailableError ? error : error,
      { audience: "admin" }
    );
    return Response.json({ message }, { status });
  }
}
