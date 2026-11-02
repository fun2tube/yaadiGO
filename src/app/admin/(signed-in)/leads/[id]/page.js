import { whatsappTo } from "@/lib/crm/messages";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { getLeadDossier } from "@/lib/crm/leads";
import { listUsers } from "@/lib/cms/users";
import { paymentsFor } from "@/lib/crm/payments";
import {
  userCan,
  money,
  LEAD_STAGES,
  QUOTE_STATUSES,
  BOOKING_STAGES,
  TONE_CLASSES,
} from "@/lib/crm/schema";
import LeadActions from "@/components/cms/lead-actions";
import TripBrief from "@/components/cms/trip-brief";
import { WhatsAppIcon, ChevronIcon, SparkleIcon } from "@/components/icons";

export const metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

/**
 * One lead, the whole story.
 *
 * Quotations, bookings, payments, notes and the timeline on a single screen,
 * because the cost of switching pages mid-call is the customer hearing dead
 * air while somebody hunts for what they were quoted.
 */
export default async function LeadPage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "leads.read")) redirect("/admin");

  const { id } = await params;
  const dossier = await getLeadDossier(id);
  if (!dossier) notFound();

  const { lead, quotations, bookings, timeline } = dossier;

  // A salesperson without team.read sees their own leads and unassigned ones —
  // enforced here, not only in the list, or the URL is the way around it.
  //
  // The `lead.ownerId &&` in the first version made the null-owner case pass
  // by accident rather than by decision. It is now deliberate and matches what
  // the list shows.
  const mineOrUnowned = !lead.ownerId || lead.ownerId === user.id;
  if (!userCan(user, "team.read") && !mineOrUnowned) {
    redirect("/admin/leads");
  }

  const staff = await listUsers();
  const byId = new Map(staff.map((u) => [u.id, u]));

  const payments = (
    await Promise.all(bookings.map((b) => paymentsFor(b.id)))
  ).flat();

  const stage = LEAD_STAGES.find((s) => s.value === (lead.status ?? "new")) ?? LEAD_STAGES[0];
  const totalBooked = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (b.total ?? 0), 0);
  const collected = bookings.reduce((sum, b) => sum + (b.collected ?? 0), 0);
  const outstanding = Math.max(0, totalBooked - collected);

  const canWrite = userCan(user, "leads.write");

  return (
    <>
      <header className="mb-4">
        <Link
          href="/admin/leads"
          className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text"
        >
          ← Leads
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[24px] font-bold tracking-tight text-paper-text">
            {lead.name}
          </h1>
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${TONE_CLASSES[stage.tone]}`}
          >
            {stage.label}
          </span>
        </div>
        <p className="mt-0.5 font-mono text-[11.5px] text-paper-text-faint">
          {[lead.destination, lead.dates, lead.groupSize ? `${lead.groupSize} travellers` : null]
            .filter(Boolean)
            .join(" · ")}
          {lead.company ? ` · ${lead.company}` : ""}
        </p>
        <p className="mt-0.5 font-mono text-[10.5px] text-paper-text-faint">
          {lead.source} · owner {byId.get(lead.ownerId)?.name ?? "unassigned"}
        </p>
        {lead.customerId ? (
          <Link
            href={`/admin/customers/${lead.customerId}`}
            className="mt-1 inline-flex text-[12.5px] font-semibold text-accent-deep"
          >
            Everything this customer has enquired about and booked →
          </Link>
        ) : null}
      </header>

      {/* Contact first — it is why they opened this. */}
      <div className="flex flex-wrap gap-2">
        {lead.phone && (
          <>
            <a
              href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
              className="rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-bold text-ink-text"
            >
              Call {lead.phone}
            </a>
            <a
              href={whatsappTo(lead.phone) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 py-2 text-[12.5px] font-bold text-white"
            >
              <WhatsAppIcon size={13} /> WhatsApp
            </a>
          </>
        )}
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="rounded-lg border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-semibold text-paper-text-muted"
          >
            Email
          </a>
        )}
      </div>

      {canWrite && (
        <div className="mt-4">
          <LeadActions lead={lead} staff={staff} currentUserId={user.id} />
        </div>
      )}

      {/* The brief sits directly under the stage controls and above the
          quotations, because it is what you fill in during the call that
          decides the stage — and it is what the quotation below is built
          from. */}
      {canWrite && (
        <div className="mt-5">
          <TripBrief lead={lead} />
        </div>
      )}

      {/* Money, when there is any */}
      {totalBooked > 0 && (
        <section className="mt-5 rounded-2xl border border-paper-line bg-card p-4">
          <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
            <div>
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
                Booked
              </dt>
              <dd className="font-semibold text-paper-text">{money(totalBooked)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
                Collected
              </dt>
              <dd className="font-semibold text-good">{money(collected)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">
                Outstanding
              </dt>
              <dd className={`font-bold ${outstanding > 0 ? "text-warn" : "text-good"}`}>
                {money(outstanding)}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* Quotations */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Quotations
          </h2>
          {userCan(user, "quotations.write") && (
            <div className="flex items-center gap-3">
              {/* One tap: straight into a drafting quotation, built from the
                  brief above and from the itinerary the customer saw. The
                  empty form is still one click away for anyone who would
                  rather start from nothing. */}
              <Link
                href={`/admin/quotations/new?lead=${lead.id}&draft=1`}
                className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-bold text-white"
              >
                <SparkleIcon size={12} /> Draft quotation
              </Link>
              <Link
                href={`/admin/quotations/new?lead=${lead.id}`}
                className="text-[12.5px] font-bold text-accent-deep"
              >
                Blank
              </Link>
            </div>
          )}
        </div>
        {quotations.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-paper-line-strong p-5 text-center text-[12.5px] text-paper-text-muted">
            Nothing quoted yet.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {quotations.map((q) => {
              const meta = QUOTE_STATUSES.find((s) => s.value === q.status) ?? QUOTE_STATUSES[0];
              return (
                <Link
                  key={q.id}
                  href={`/admin/quotations/${q.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-paper-line bg-card px-3.5 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-paper-text">
                        v{q.version}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${TONE_CLASSES[meta.tone]}`}
                      >
                        {meta.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-paper-text-muted">
                      {q.title}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-paper-text">{money(q.total)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Bookings */}
      {bookings.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Bookings
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {bookings.map((b) => {
              const meta = BOOKING_STAGES.find((s) => s.value === b.status) ?? BOOKING_STAGES[0];
              const owed = Math.max(0, (b.total ?? 0) - (b.collected ?? 0));
              return (
                <Link
                  key={b.id}
                  href={`/admin/bookings/${b.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-paper-line bg-card px-3.5 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-paper-text">
                        {b.reference}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${TONE_CLASSES[meta.tone]}`}
                      >
                        {meta.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-paper-text-muted">
                      {b.tripTitle}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-semibold text-paper-text">
                      {money(b.total)}
                    </span>
                    {owed > 0 && (
                      <span className="font-mono text-[10px] text-warn">{money(owed)} due</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Payments */}
      {payments.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Payments
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 text-[12.5px]">
                <span className="text-paper-text-muted">
                  {new Date(p.receivedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {p.method}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className={`shrink-0 font-semibold ${p.amount < 0 ? "text-danger" : "text-good"}`}>
                  {p.amount < 0 ? "−" : ""}
                  {money(Math.abs(p.amount))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The AI itinerary they were shown, if any */}
      {lead.itinerary?.days?.length > 0 && (
        <section className="mt-6 rounded-2xl border border-paper-line bg-card p-4">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            What our planner showed them
          </h2>
          <p className="mt-1.5 text-[13.5px] font-semibold text-paper-text">
            {lead.itinerary.title}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {lead.itinerary.days.map((d) => (
              <li key={d.day} className="text-[12.5px] leading-snug text-paper-text-muted">
                <strong className="font-semibold text-paper-text">Day {d.day}</strong> — {d.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Notes */}
      {lead.notes?.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            Notes
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {[...lead.notes].reverse().map((n) => (
              <li key={n.at} className="rounded-xl bg-paper-dim px-3.5 py-2.5">
                <p className="text-[13px] leading-relaxed text-paper-text">{n.body}</p>
                <p className="mt-1 font-mono text-[10px] text-paper-text-faint">
                  {n.byName ?? "—"} ·{" "}
                  {new Date(n.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <section className="mt-6">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">
            History
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {timeline.map((e) => (
              <li key={e.id} className="flex gap-3 text-[12px]">
                <span className="w-[68px] shrink-0 font-mono text-[10px] text-paper-text-faint">
                  {new Date(e.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
                <span className="min-w-0 text-paper-text-muted">
                  <strong className="font-semibold text-paper-text">{e.type}</strong>
                  {e.payload?.summary ? ` — ${e.payload.summary}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
