import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";

import { signOut } from "@/auth";
import { requireSession } from "@/lib/auth-helpers";
import { customers, db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireSession();

  // Customer users: skip the admin list, send straight to their own dashboard.
  if (session.user.role !== "admin") {
    if (!session.user.customerId) redirect("/login");
    redirect(`/c/${session.user.customerId}`);
  }

  const rows = await db.select().from(customers).orderBy(desc(customers.lastSyncedAt));

  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-slate-400">{session.user.email} · admin</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500">
            Sign out
          </button>
        </form>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Interval</th>
              <th className="px-4 py-2">Last synced</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-900/40">
                <td className="px-4 py-2 font-mono text-slate-300">{c.id}</td>
                <td className="px-4 py-2">{c.displayName}</td>
                <td className="px-4 py-2 text-slate-400">{c.syncIntervalMinutes}m</td>
                <td className="px-4 py-2 text-slate-400">
                  {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString() : "never"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/c/${c.id}`}
                    className="text-xs font-medium text-slate-200 hover:text-white"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
