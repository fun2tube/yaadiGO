import TokenForm from "@/components/cms/token-form";

export const metadata = {
  title: "Accept your invitation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({ searchParams }) {
  const params = await searchParams;
  const token = params?.token ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <span className="eyebrow text-accent-deep">YaadiGo</span>
        <h1 className="mt-2 font-display text-[30px] font-bold tracking-tight text-paper-text">
          Join the team
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-paper-text-muted">
          Set a password and your account goes to an admin for approval.
        </p>

        {token ? (
          <TokenForm mode="invite" token={token} />
        ) : (
          <p className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-4 text-[13.5px] font-semibold text-paper-text">
            This link is missing its invitation code. Use the link from your email exactly as it was sent.
          </p>
        )}
      </div>
    </main>
  );
}
