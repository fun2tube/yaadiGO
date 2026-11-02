import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { listInvoices } from "@/lib/crm/invoices";
import { listBookings } from "@/lib/cms/bookings";
import InvoiceDesk from "@/components/cms/invoice-desk";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

/**
 * The accounts desk.
 *
 * Until now invoices existed only behind an API: the numbering, the financial
 * year sequence and the GST fields were all built and correct, but nobody
 * could reach them from the panel. So the Accounts role had the permission and
 * nowhere to use it.
 *
 * Two lists, in the order the work happens: what still needs an invoice, then
 * what has one. Deliberately not a single merged table — "what do I owe
 * today" is the question this screen exists to answer.
 */
export default async function InvoicesPage() {
  const user = await currentUser();
  if (!userCan(user, "bookings.read")) redirect("/admin");

  const [invoices, bookings] = await Promise.all([listInvoices(), listBookings()]);

  const invoiced = new Set(invoices.map((i) => i.bookingId));

  // A cancelled booking cannot be invoiced — `issueInvoice` refuses it — so
  // showing it in a queue of work would be a row nobody can ever clear.
  const awaiting = bookings
    .filter((b) => b.status !== "cancelled" && !invoiced.has(b.id))
    .sort((a, b) => String(a.departureStart ?? "").localeCompare(String(b.departureStart ?? "")));

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          Invoices
        </h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Numbers run in sequence per financial year and cannot be edited once raised. Only
          Accounts and the super admin can issue one.
        </p>
      </header>

      <InvoiceDesk
        invoices={invoices}
        awaiting={awaiting}
        canIssue={userCan(user, "invoices.write")}
      />
    </>
  );
}
