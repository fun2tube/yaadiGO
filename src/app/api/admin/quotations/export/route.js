import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { listQuotations } from "@/lib/crm/quotations";
import { listLeads } from "@/lib/crm/leads";
import { listUsers } from "@/lib/cms/users";
import { bookingScope, userCan } from "@/lib/crm/schema";
import { resolvePeriod } from "@/lib/crm/periods";
import { REGISTER_STATUSES, buildRegister, registerCsv } from "@/lib/crm/register";

export const dynamic = "force-dynamic";

/**
 * The register as CSV — exactly the rows the screen shows for the same
 * filters, with the same scoping (a salesperson exports their own) and margin
 * only for people who may see it.
 */
export async function GET(request) {
  const { user, denied } = await authorise("quotations.read");
  if (denied) return denied;

  const p = new URL(request.url).searchParams;
  const period = resolvePeriod(p.get("period") ?? "30d", { from: p.get("from"), to: p.get("to"), fallback: "30d" });
  const status = REGISTER_STATUSES.some((s) => s.value === p.get("status")) ? p.get("status") : "all";
  const scope = bookingScope(user);
  const ownerId = scope ?? (p.get("owner") && p.get("owner") !== "any" ? p.get("owner") : null);

  const [quotations, leads, users] = await Promise.all([listQuotations(), listLeads(), listUsers({ includeInactive: true })]);
  const { rows } = buildRegister({ quotations, leads, users, period, filters: { status, ownerId, query: p.get("q") ?? "" } });

  const csv = registerCsv(rows, { withMargin: userCan(user, "team.read") });
  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so Excel opens ₹ and Hindi names as UTF-8.
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yaadigo-quotations-${period.key}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
