import { redirect } from "next/navigation";
import TeamBoard from "@/components/cms/team-board";
import { currentUser } from "@/lib/cms/auth";
import { listUsers, ensureBootstrapAdmin } from "@/lib/cms/users";
import { userCan } from "@/lib/crm/schema";
import { emailConfigured } from "@/lib/crm/staff-mail";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await currentUser();
  // The layout already proved they are signed in; this proves they may be HERE.
  // A page that only checks the nav hid the link is a page anyone can reach by
  // typing the URL.
  if (!userCan(user, "team.read")) redirect("/admin");

  await ensureBootstrapAdmin();
  const users = await listUsers({ includeInactive: true });

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-paper-text">Team</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-paper-text-muted">
          Invite people, approve them, and choose exactly which modules each person can open.
        </p>
      </header>

      {!emailConfigured() && (
        <div className="mb-4 rounded-2xl border border-paper-line bg-card px-4 py-3">
          <p className="text-[13px] font-bold text-paper-text">Email isn&apos;t set up yet</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-paper-text-muted">
            Invitations won&apos;t send automatically. You&apos;ll get a link to pass on yourself
            instead. Set <code className="font-mono text-[11.5px]">RESEND_API_KEY</code> to send
            them properly.
          </p>
        </div>
      )}

      <TeamBoard initialUsers={users} />
    </>
  );
}
