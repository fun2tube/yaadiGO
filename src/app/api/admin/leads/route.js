import { z } from "zod";
import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { addNote, logCall, setFollowUp, setStage, transfer } from "@/lib/crm/leads";
import { filterLeads } from "@/lib/crm/workspace";
import {
  CALL_OUTCOME_VALUES,
  LEAD_STAGE_VALUES,
  LOST_REASONS,
  userCan,
} from "@/lib/crm/schema";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  id: z.string().min(1).max(80),
  status: z.enum(LEAD_STAGE_VALUES).optional(),
  followUpAt: z.string().max(40).nullable().optional(),
  lostReason: z.enum(LOST_REASONS).optional(),
  note: z.string().max(2000).optional(),
  // A logged call sets the next follow-up from the outcome, so it is handled
  // before the stage and follow-up branches below — otherwise a request
  // carrying both would set the date twice, by two different rules.
  callOutcome: z.enum(CALL_OUTCOME_VALUES).optional(),
});

const TransferSchema = z.object({
  id: z.string().min(1).max(80),
  toUserId: z.string().min(1).max(80),
  reason: z.string().min(3).max(500),
});

export async function GET(request) {
  const { user, denied } = await authorise("leads.read");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;

  // Scope is enforced HERE, not in the UI. Without team.read a salesperson
  // sees only their own pipeline however they edit the query string.
  const scopeToOwner = userCan(user, "team.read") ? null : user.id;

  const result = await filterLeads({
    scopeToOwner,
    ownerId: params.get("owner") && params.get("owner") !== "any" ? params.get("owner") : null,
    stages: params.get("stage") && params.get("stage") !== "any" ? [params.get("stage")] : null,
    due: params.get("due"),
    money: params.get("money"),
    source: params.get("source"),
    search: params.get("q"),
  });

  return Response.json(result);
}

export async function PATCH(request) {
  const { user, denied } = await authorise("leads.write");
  if (denied) return denied;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      { message: first ? `${first.path.join(".")}: ${first.message}` : "That didn't look right." },
      { status: 400 }
    );
  }

  const { id, status, followUpAt, lostReason, note, callOutcome } = parsed.data;
  let lead = null;

  // Logging a call is a complete action on its own: it writes the note, records
  // the outcome for reporting, and sets the next follow-up. Handled first and
  // exclusively so the generic followUpAt branch below cannot overwrite the
  // date the outcome just chose.
  if (callOutcome) {
    const result = await logCall(id, { outcome: callOutcome, note, followUpAt, actor: user });
    if (result.error) return Response.json({ message: result.error }, { status: 400 });

    // A stage sent alongside a call is still applied — "spoke to them, they are
    // qualified" is one thought, and making it two requests loses half of them.
    if (status) {
      const staged = await setStage(id, status, { actor: user, lostReason });
      if (staged.error) return Response.json({ message: staged.error }, { status: 400 });
      return Response.json({ lead: staged.lead, suggestsLost: result.suggestsLost });
    }
    return Response.json({ lead: result.lead, suggestsLost: result.suggestsLost });
  }

  // Stage and follow-up move together — "called, ringing back Thursday" is one
  // thought and setStage carries the date so it cannot be half-applied.
  if (status) {
    const result = await setStage(id, status, { actor: user, lostReason, note, followUpAt });
    if (result.error) return Response.json({ message: result.error }, { status: 400 });
    lead = result.lead;
  } else if (followUpAt !== undefined) {
    const result = await setFollowUp(id, followUpAt, { actor: user });
    if (result.error) return Response.json({ message: result.error }, { status: 400 });
    lead = result.lead;
  }

  // A note alongside a stage change is already attached by setStage; this is
  // the note-only case.
  if (note?.trim() && !status) {
    const result = await addNote(id, note, { actor: user });
    if (result.error) return Response.json({ message: result.error }, { status: 400 });
    lead = result.lead;
  }

  if (!lead) return Response.json({ message: "Nothing to change." }, { status: 400 });
  return Response.json({ lead });
}

export async function PUT(request) {
  const { user, denied } = await authorise("leads.write");
  if (denied) return denied;

  const parsed = TransferSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { message: parsed.error.issues[0]?.message ?? "Say why you are transferring it." },
      { status: 400 }
    );
  }

  const { id, toUserId, reason } = parsed.data;
  const result = await transfer(id, toUserId, { actor: user, reason });
  if (result.error) return Response.json({ message: result.error }, { status: 400 });

  return Response.json({ lead: result.lead });
}
