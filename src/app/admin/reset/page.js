import TokenForm from "@/components/cms/token-form";

export const metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const token = params?.token ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <span className="eyebrow text-accent-deep">YaadiGo</span>
        <h1 className="mt-2 font-display text-[30px] font-bold tracking-tight text-paper-text">
          New password
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-paper-text-muted">
          Choose a new password for your YaadiGo account.
        </p>

        {token ? (
          <TokenForm mode="reset" token={token} />
        ) : (
          <p className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-4 text-[13.5px] font-semibold text-paper-text">
            This link is missing its reset code. Use the link from your email exactly as it was sent.
          </p>
        )}
      </div>
    </main>
  );
}
