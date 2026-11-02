import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/cms/auth";
import { filterLeads } from "@/lib/crm/workspace";
import { listUsers } from "@/lib/cms/users";
import { userCan } from "@/lib/crm/schema";
import LeadFilters from "@/components/cms/lead-filters";
import LeadList from "@/components/cms/lead-list";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }) {
  const user = await currentUser();
  if (!userCan(user, "leads.read")) redirect("/admin");

  const params = await searchParams;
  const canSeeEveryone = userCan(user, "team.read");

  // Scope enforced on the server. Without team.read a salesperson sees only
  // their own pipeline, whatever they put in the query string.
  const { leads, total, shown } = await filterLeads({
    scopeToOwner: canSeeEveryone ? null : user.id,
    ownerId: params?.owner && params.owner !== "any" ? params.owner : null,
    stages: params?.stage && params.stage !== "any" ? [params.stage] : null,
    due: params?.due,
    money: params?.money,
    source: params?.source,
    search: params?.q,
  });

  const staff = canSeeEveryone ? await listUsers() : [];

  return (
    <>
      <header className="mb-4">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          Leads
        </h1>
        <Link
          href="/admin/leads/interests"
          className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-deep"
        >
          Asked Yaadi — people who did not leave a number →
        </Link>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          {canSeeEveryone ? "Every enquiry on the desk." : "Your pipeline."} Filter by when it is
          due, what stage it is at, or whether money is outstanding.
        </p>
      </header>

      <LeadFilters
        shown={shown}
        total={total}
        canSeeEveryone={canSeeEveryone}
        staff={staff.filter((u) => u.role !== "ops")}
      />

      <div className="mt-4">
        <LeadList leads={leads} />
      </div>
    </>
  );
}
