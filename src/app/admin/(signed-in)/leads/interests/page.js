import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/cms/auth";
import { userCan } from "@/lib/crm/schema";
import { listInterests, describeInterest } from "@/lib/crm/interests";
import PromoteInterest from "@/components/cms/promote-interest";

export const metadata = { title: "Asked Yaadi" };
export const dynamic = "force-dynamic";

/**
 * What people asked Yaadi for, without leaving contact details.
 *
 * Kept OFF the leads board on purpose. These are demand signals, not callable
 * leads — a queue filled with rows nobody can phone is a queue people stop
 * working, and the leads board is the one screen that has to stay trustworthy.
 *
 * It is still worth reading daily: it says what to stock, what to advertise and
 * which months people are actually asking about, which is information the
 * business had no way of seeing at all before.
 */
export default async function InterestsPage() {
  const user = await currentUser();
  if (!userCan(user, "leads.read")) redirect("/admin");

  const interests = await listInterests();

  return (
    <>
      <header className="mb-4">
        <Link
          href="/admin/leads"
          className="font-mono text-[11px] text-paper-text-faint hover:text-paper-text"
        >
          ← Leads
        </Link>
        <h1 className="mt-1 font-display text-[24px] font-bold tracking-tight text-paper-text">
          Asked Yaadi
        </h1>
        <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-paper-text-muted">
          People who told the concierge what they wanted but did not leave a
          number. Not leads — nobody can call these. They tell you what to stock
          and what to advertise, and any one of them becomes a real lead the
          moment you add a contact.
        </p>
      </header>

      {interests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-paper-line-strong p-8 text-center text-[13.5px] text-paper-text-muted">
          Nothing yet. Anyone who tells Yaadi a destination plus a month, a group
          size or a budget will appear here.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {interests.map((interest) => (
            <div
              key={interest.id}
              className="rounded-2xl border border-paper-line bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-bold text-paper-text">
                    {describeInterest(interest)}
                  </p>
                  {interest.note ? (
                    <p className="mt-0.5 text-[12.5px] text-paper-text-muted">{interest.note}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-[10.5px] text-paper-text-faint">
                    {new Date(interest.lastSeenAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {userCan(user, "leads.write") ? (
                  <PromoteInterest conversationId={interest.conversationId} />
                ) : null}
              </div>

              {interest.transcript ? (
                <details className="mt-2.5">
                  <summary className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.1em] text-paper-text-faint">
                    What they said
                  </summary>
                  {/* Their own words, not just the model's summary — how
                      somebody asks is often the useful part. */}
                  <pre className="mt-1.5 whitespace-pre-wrap rounded-xl bg-paper-dim p-3 text-[12px] leading-relaxed text-paper-text-muted">
                    {interest.transcript}
                  </pre>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
