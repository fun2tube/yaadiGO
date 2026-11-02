import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import {
  INVOICEABLE_STATUSES,
  invoicingBlocker,
  listCreditNotes,
  listInvoices,
  sellerGstin,
} from "@/lib/crm/invoices";
import { stateOfGstin } from "@/lib/crm/gst";
import { listBookings } from "@/lib/cms/bookings";
import InvoiceDesk from "@/components/cms/invoice-desk";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

/**
 * The accounts desk.
 *
 * Two lists, in the order the work happens: what still needs an invoice, then
 * what has one. Deliberately not a single merged table — "what do I owe
 * today" is the question this screen exists to answer.
 */
export default async function InvoicesPage() {
  const user = await currentUser();
  if (!userCan(user, "bookings.read")) redirect("/admin");

  const [invoices, bookings, creditNotes] = await Promise.all([
    listInvoices(),
    listBookings(),
    listCreditNotes(),
  ]);

  const invoiced = new Set(invoices.map((i) => i.bookingId));

  // Only bookings that have actually been sold. A seat REQUEST used to sit
  // here (F11, 2026-10-14) and `issueInvoice` now refuses it, so it would be
  // a row nobody could ever clear. Cancelled ones likewise.
  const awaiting = bookings
    .filter((b) => INVOICEABLE_STATUSES.includes(b.status) && !invoiced.has(b.id))
    .sort((a, b) => String(a.departureStart ?? "").localeCompare(String(b.departureStart ?? "")));

  const credited = {};
  for (const note of creditNotes) {
    credited[note.invoiceId] = (credited[note.invoiceId] ?? 0) + (note.total ?? 0);
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">
          Invoices
        </h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Numbers run in sequence per financial year and cannot be edited once raised — a mistake
          is corrected with a credit note. Only Accounts and the super admin can issue either.
        </p>
      </header>

      <InvoiceDesk
        invoices={invoices}
        awaiting={awaiting}
        credited={credited}
        canIssue={userCan(user, "invoices.write")}
        blocker={invoicingBlocker()}
        sellerStateCode={stateOfGstin(sellerGstin())?.code ?? null}
      />
    </>
  );
}
