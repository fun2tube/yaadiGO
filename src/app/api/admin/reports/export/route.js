import { authorise } from "@/lib/cms/auth";
import "@/lib/crm";
import { buildReport } from "@/lib/crm/reports";
import { teamCsv } from "@/lib/crm/analytics";
import { resolvePeriod } from "@/lib/crm/periods";

export const dynamic = "force-dynamic";

/** The sales scorecard for a period, as CSV — the same rows as the Reports page. */
export async function GET(request) {
  const { denied } = await authorise("reports.read");
  if (denied) return denied;

  const p = new URL(request.url).searchParams;
  const period = resolvePeriod(p.get("period") ?? "month", { from: p.get("from"), to: p.get("to") });
  const report = await buildReport({ period });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${teamCsv(report.team)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yaadigo-sales-team-${period.key}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
