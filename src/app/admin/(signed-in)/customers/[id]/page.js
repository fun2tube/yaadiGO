import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { getCustomerDossier } from "@/lib/crm/customers";
import { whatsappTo } from "@/lib/crm/messages";
import { userCan, money, LEAD_STAGES, QUOTE_STATUSES, BOOKING_STAGES, TONE_CLASSES } from "@/lib/crm/schema";
import CustomerEditor from "@/components/cms/customer-editor";
import { WhatsAppIcon } from "@/components/icons";

export const metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

function Badge({ list, value }) {
  const meta = list.find((s) => s.value === value) ?? list[0];
  return <span className={`rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${TONE_CLASSES[meta.tone]}`}>{meta.label}</span>;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-paper-line bg-card px-3.5 py-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper-text-faint">{label}</p>
      <p className="mt-1 font-display text-[18px] font-bold leading-tight text-paper-text">{value}</p>
    </div>
  );
}

/**
 * One customer: every enquiry, quotation, booking and payment they have made
 * with us, newest first, and what they are worth. The lead page answers
 * "this trip"; this page answers "this person".
 */
export default async function CustomerPage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "leads.read")) redirect("/admin");

  const { id } = await params;
  const dossier = await getCustomerDossier(id);
  if (!dossier) notFound();
  // Enforced here, not only in the list, or the URL is the way around it.
  if (!userCan(user, "team.read") && !dossier.ownerIds.includes(user.id)) redirect("/admin/customers");

  const { customer: c, leads, quotations, bookings, totals } = dossier;
  const quotesByLead = new Map();
  for (const q of quotations) quotesByLead.set(q.leadId, [...(quotesByLead.get(q.leadId) ?? []), q]);
  const bookingsByLead = new Map();
  for (const b of bookings) bookingsByLead.set(b.leadId, [...(bookingsByLead.get(b.leadId) ?? []), b]);

  return (
    <>
      <header className="mb-4">
        <Link href="/admin/customers" className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text">
          ← Customers
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[24px] font-bold tracking-tight text-paper-text">{c.name}</h1>
          {totals.bookings > 1 ? (
            <span className="rounded-md bg-good/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-good">Repeat customer</span>
          ) : null}
        </div>
        <p className="mt-0.5 font-mono text-[11.5px] text-paper-text-faint">
          {[c.company, c.city, `first came via ${c.firstSource ?? "unknown"} on ${day(c.firstSeenAt)}`].filter(Boolean).join(" · ")}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {c.phone ? (
          <>
            <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-bold text-ink-text">
              Call {c.phone}
            </a>
            <a
              href={whatsappTo(c.phone) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 py-2 text-[12.5px] font-bold text-white"
            >
              <WhatsAppIcon size={13} /> WhatsApp
            </a>
          </>
        ) : null}
        {c.email ? (
          <a href={`mailto:${c.email}`} className="rounded-lg border border-paper-line-strong px-3.5 py-2 text-[12.5px] font-semibold text-paper-text-muted">
            Email
          </a>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Enquiries" value={totals.enquiries} />
        <Stat label="Bookings" value={totals.bookings} />
        <Stat label="Booked" value={money(totals.bookedValue)} />
        <Stat label="Still owed" value={money(Math.max(0, totals.outstanding))} />
      </div>

      <section className="mt-6">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">Enquiries, newest first</h2>
        {leads.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-paper-text-muted">No enquiries on record.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {leads.map((lead) => (
              <li key={lead.id} className="rounded-2xl border border-paper-line bg-card px-4 py-3">
                <Link href={`/admin/leads/${lead.id}`} className="flex flex-wrap items-center gap-2 hover:underline">
                  <strong className="text-[13.5px] text-paper-text">{lead.destination || "No destination given"}</strong>
                  <Badge list={LEAD_STAGES} value={lead.status ?? "new"} />
                  <span className="font-mono text-[11px] text-paper-text-faint">
                    {day(lead.receivedAt ?? lead.createdAt)} · via {lead.source}
                  </span>
                </Link>
                {(quotesByLead.get(lead.id) ?? []).map((q) => (
                  <Link key={q.id} href={`/admin/quotations/${q.id}`} className="mt-1.5 flex items-center gap-2 text-[12.5px] text-paper-text-muted hover:underline">
                    Quotation v{q.version} <Badge list={QUOTE_STATUSES} value={q.status} /> {q.total ? money(q.total) : ""}
                  </Link>
                ))}
                {(bookingsByLead.get(lead.id) ?? []).map((b) => (
                  <Link key={b.id} href={`/admin/bookings/${b.id}`} className="mt-1.5 flex items-center gap-2 text-[12.5px] text-paper-text-muted hover:underline">
                    Booking {b.reference} · {b.tripTitle} <Badge list={BOOKING_STAGES} value={b.status} /> {money(b.total ?? 0)}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {userCan(user, "leads.write") ? (
        <section className="mt-6">
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">Details</h2>
          <div className="mt-2">
            <CustomerEditor customer={c} />
          </div>
        </section>
      ) : null}
    </>
  );
}
