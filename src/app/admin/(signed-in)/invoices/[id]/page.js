import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { creditableOn, getInvoice } from "@/lib/crm/invoices";
import PrintButton from "@/components/cms/print-button";
import CreditNoteForm from "@/components/cms/credit-note-form";

export const metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

const money = (n) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

function address(a) {
  if (!a) return null;
  if (typeof a === "string") return a;
  return [a.street, a.locality, a.region, a.postalCode].filter(Boolean).join(", ");
}

function TaxRows({ split, taxPercent, tax }) {
  if (!split) {
    return (
      <div className="flex justify-between">
        <dt>GST {taxPercent}%</dt>
        <dd>{money(tax)}</dd>
      </div>
    );
  }
  if (split.kind === "igst") {
    return (
      <div className="flex justify-between">
        <dt>IGST {taxPercent}%</dt>
        <dd>{money(split.igst)}</dd>
      </div>
    );
  }
  return (
    <>
      <div className="flex justify-between">
        <dt>CGST {taxPercent / 2}%</dt>
        <dd>{money(split.cgst)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>SGST {taxPercent / 2}%</dt>
        <dd>{money(split.sgst)}</dd>
      </div>
    </>
  );
}

/**
 * One tax invoice, as the customer receives it.
 *
 * There was no way to see an invoice at all — the desk listed a number and a
 * total (review 2026-10-14-full-function-test, F3). Printed with the browser
 * (Save as PDF), like the traveller list. Credit notes against it are listed
 * underneath, and Accounts can issue one here.
 */
export default async function InvoicePage({ params }) {
  const user = await currentUser();
  if (!userCan(user, "bookings.read") && !userCan(user, "invoices.read")) redirect("/admin");

  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const { notes, credited, remaining } = await creditableOn(invoice);
  const seller = invoice.seller ?? {};
  const customer = invoice.customer ?? {};
  const taxable = (invoice.subtotal ?? 0) - (invoice.discount ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href="/admin/invoices" className="text-[13px] font-semibold text-paper-text-muted">
          ← Invoices
        </Link>
        <PrintButton className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-ink-text" />
      </div>

      <article className="rounded-2xl border border-paper-line bg-card p-5 text-[13px] text-paper-text print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-paper-line pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper-text-faint">
              Tax invoice
            </p>
            <h1 className="mt-1 font-display text-[22px] font-bold">{invoice.number}</h1>
            <p className="text-paper-text-muted">Issued {day(invoice.issuedAt)}</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{seller.name}</p>
            {address(seller.address) && <p className="text-paper-text-muted">{address(seller.address)}</p>}
            <p className="font-mono text-[11.5px]">GSTIN {seller.gstin ?? "— not set —"}</p>
            {seller.state && (
              <p className="text-paper-text-muted">
                State {seller.state} ({seller.stateCode})
              </p>
            )}
            {seller.cin && <p className="font-mono text-[11.5px]">CIN {seller.cin}</p>}
          </div>
        </header>

        <section className="grid gap-4 border-b border-paper-line py-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint">Billed to</p>
            <p className="mt-1 font-bold">{customer.name ?? "—"}</p>
            {customer.address && <p className="text-paper-text-muted">{customer.address}</p>}
            {customer.gstin && <p className="font-mono text-[11.5px]">GSTIN {customer.gstin}</p>}
            {customer.phone && <p className="text-paper-text-muted">{customer.phone}</p>}
            {customer.email && <p className="text-paper-text-muted">{customer.email}</p>}
          </div>
          <div className="sm:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-paper-text-faint">Supply</p>
            <p className="mt-1">
              Place of supply:{" "}
              <strong>
                {invoice.placeOfSupply ?? "—"}
                {invoice.placeOfSupplyCode ? ` (${invoice.placeOfSupplyCode})` : ""}
              </strong>
            </p>
            <p>SAC {invoice.sac ?? "—"} · Tour operator services</p>
            <p className="text-paper-text-muted">
              {invoice.title} · {invoice.travellers} travellers · {invoice.travelDates}
            </p>
          </div>
        </section>

        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-paper-line font-mono text-[10px] uppercase tracking-[0.08em] text-paper-text-faint">
              <th className="py-2 pr-3 font-normal">Description</th>
              <th className="py-2 pr-3 text-right font-normal">Qty</th>
              <th className="py-2 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lines ?? []).map((line, i) => (
              <tr key={i} className="border-b border-paper-line align-top">
                <td className="py-2 pr-3">
                  <p className="font-semibold">{line.label}</p>
                  {line.detail && <p className="text-[12px] text-paper-text-muted">{line.detail}</p>}
                </td>
                <td className="py-2 pr-3 text-right">
                  {line.quantity}
                  {line.perPerson ? " / person" : ""}
                </td>
                <td className="py-2 text-right">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 flex max-w-[320px] flex-col gap-1">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(invoice.subtotal)}</dd>
          </div>
          {invoice.discount ? (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>−{money(invoice.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Taxable value</dt>
            <dd>{money(taxable)}</dd>
          </div>
          <TaxRows split={invoice.taxSplit} taxPercent={invoice.taxPercent ?? 0} tax={invoice.tax} />
          <div className="mt-1 flex justify-between border-t border-paper-line pt-1.5 text-[15px] font-bold">
            <dt>Total</dt>
            <dd>{money(invoice.total)}</dd>
          </div>
        </dl>

        <p className="mt-6 text-[11.5px] leading-relaxed text-paper-text-faint">
          GST charged at {invoice.taxPercent ?? 0}% on tour operator services. This invoice is
          computer-generated and its number cannot be reused. Issued by {invoice.issuedByName ?? "the accounts desk"}.
        </p>
      </article>

      <section className="no-print rounded-2xl border border-paper-line bg-card p-4">
        <h2 className="font-display text-[14px] font-bold text-paper-text">Credit notes</h2>
        {notes.length === 0 ? (
          <p className="mt-1.5 text-[12.5px] text-paper-text-faint">None against this invoice.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-paper-line">
            {notes.map((note) => (
              <li key={note.id} className="flex items-start justify-between gap-3 py-2 text-[12.5px]">
                <span className="min-w-0">
                  <strong className="font-semibold text-paper-text">{note.number}</strong>{" "}
                  <span className="text-paper-text-muted">
                    · {day(note.issuedAt)} · {note.reason}
                    {note.issuedByName ? ` · by ${note.issuedByName}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-danger">−{money(note.total)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[12px] text-paper-text-muted">
          Credited {money(credited)} · {money(remaining)} still invoiced.
        </p>
        {userCan(user, "invoices.write") && remaining > 0 && (
          <CreditNoteForm invoiceId={invoice.id} remaining={remaining} />
        )}
      </section>
    </div>
  );
}
