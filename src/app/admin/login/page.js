import LoginForm from "@/components/cms/login-form";
import { adminConfigured, adminConfigError, googleConfigured, isAdmin } from "@/lib/cms/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }) {
  if (await isAdmin()) redirect("/admin");

  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <span className="eyebrow text-accent-deep">YaadiGo</span>
        <h1 className="mt-2 font-display text-[30px] font-bold tracking-tight text-paper-text">
          Admin
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-paper-text-muted">
          Sign in to your YaadiGo workspace.
        </p>

        {adminConfigured() ? (
          <LoginForm googleEnabled={googleConfigured()} initialError={params?.error ?? null} />
        ) : (
          <div className="mt-6 rounded-xl border border-warn/40 bg-warn/10 p-4">
            <p className="text-[13px] font-bold text-paper-text">Not configured</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-paper-text-muted">
              {adminConfigError()}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
