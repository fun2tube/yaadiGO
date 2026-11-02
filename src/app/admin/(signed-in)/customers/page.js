import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { listCustomersWithStats } from "@/lib/crm/customers";
import { userCan, money } from "@/lib/crm/schema";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

/**
 * Customers: every person who has enquired, once, however many times they
 * came back, with what they have booked and paid. Scoped like leads: a
 * salesperson sees the customers in their own pipeline.
 */
export default async function CustomersPage({ searchParams }) {
  const user = await currentUser();
  if (!userCan(user, "leads.read")) redirect("/admin");

  const params = (await searchParams) ?? {};
  const search = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const canSeeEveryone = userCan(user, "team.read");
  const rows = await listCustomersWithStats({ search, ownerId: canSeeEveryone ? null : user.id });

  const repeat = rows.filter((c) => c.repeat).length;
  const booked = rows.filter((c) => c.bookings > 0).length;

  return (
    <>
      <header className="mb-4">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Customers</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          {canSeeEveryone ? "Everyone who has enquired" : "The customers in your pipeline"}, one row per person however
          often they came back. {rows.length ? `${booked} of ${rows.length} have booked; ${repeat} more than once.` : ""}
        </p>
      </header>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Name, phone, email, company or city"
          aria-label="Search customers"
          className="min-w-0 flex-1 rounded-xl border border-paper-line-strong bg-card px-3 py-2 text-[13px] text-paper-text"
        />
        <button type="submit" className="rounded-xl border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-bold text-paper-text">
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-paper-line bg-card px-4 py-3 text-[13px] text-paper-text-muted">
          {search
            ? `Nobody matches "${search}".`
            : "No customers yet. Every website enquiry with a phone number or email creates one."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/customers/${c.id}`}
                className="grid gap-x-4 gap-y-1 rounded-2xl border border-paper-line bg-card px-4 py-3 hover:border-accent sm:grid-cols-[1fr_auto]"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-[14px] text-paper-text">{c.name}</strong>
                    {c.repeat ? (
                      <span className="rounded-md bg-good/15 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase text-good">
                        Repeat
                      </span>
                    ) : null}
                    {c.company ? <span className="text-[12px] text-paper-text-muted">{c.company}</span> : null}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-paper-text-faint">
                    {[c.phone, c.email, c.city].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-paper-text-muted sm:text-right">
                  {c.enquiries} enquir{c.enquiries === 1 ? "y" : "ies"} · {c.bookings} booking{c.bookings === 1 ? "" : "s"}
                  {c.bookedValue ? ` · ${money(c.bookedValue)}` : ""}
                  <span className="block text-paper-text-faint">last {day(c.lastActivity)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
