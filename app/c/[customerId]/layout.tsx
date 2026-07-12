import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { signOut } from "@/auth";
import { resolveCustomerScope } from "@/lib/auth-helpers";
import { customers, db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
  params: Promise<{ customerId: string }>;
};

export default async function CustomerLayout({ children, params }: Props) {
  const { customerId } = await params;
  const scope = await resolveCustomerScope(customerId);
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, scope.customerId!))
    .limit(1);
  if (!customer) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-slate-500">
            {scope.isAdmin && (
              <Link href="/" className="hover:text-slate-300">
                ← All customers
              </Link>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {customer.displayName}
          </h1>
          <p className="text-xs text-slate-400">
            {customer.id} · {customer.syncIntervalMinutes}m interval · last synced{" "}
            {customer.lastSyncedAt
              ? new Date(customer.lastSyncedAt).toLocaleString()
              : "never"}
          </p>
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

      <nav className="mb-6 flex gap-4 border-b border-slate-800 text-sm">
        <TabLink href={`/c/${customer.id}`} label="Overview" />
        <TabLink href={`/c/${customer.id}/pending`} label="Pending" />
        <TabLink href={`/c/${customer.id}/runs`} label="Runs" />
        <TabLink href={`/c/${customer.id}/state`} label="State" />
      </nav>

      {children}
    </main>
  );
}

function TabLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="border-b-2 border-transparent px-1 pb-2 text-slate-300 hover:border-slate-400 hover:text-white"
    >
      {label}
    </Link>
  );
}
