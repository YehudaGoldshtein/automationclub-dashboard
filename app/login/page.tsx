import { redirect } from "next/navigation";

import { signIn, auth } from "@/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Already authenticated? Send them on.
  const session = await auth();
  if (session) {
    redirect(session.user.role === "admin" ? "/" : `/c/${session.user.customerId}`);
  }

  const params = await searchParams;
  const next = params.next || "/";
  const errorMsg = params.error
    ? "Invalid email or password."
    : null;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const redirectTo = String(formData.get("next") || "/");
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  }

  return (
    <main className="flex-1 grid place-items-center p-6">
      <form
        action={login}
        className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur"
      >
        <h1 className="mb-6 text-xl font-semibold tracking-tight">
          AutomationClub
        </h1>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs uppercase text-slate-400">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <label className="mb-6 block">
          <span className="mb-1 block text-xs uppercase text-slate-400">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>
        <input type="hidden" name="next" value={next} />
        {errorMsg && (
          <p className="mb-4 text-sm text-red-400">{errorMsg}</p>
        )}
        <button
          type="submit"
          className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
