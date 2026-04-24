import { and, eq, inArray } from "drizzle-orm";

import { resolveCustomerScope } from "@/lib/auth-helpers";
import { customers, db, itemState, vendorSnapshotCache } from "@/lib/db";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const scope = await resolveCustomerScope(customerId);
  const cid = scope.customerId!;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, cid))
    .limit(1);
  const config: Customer | null = customer ? JSON.parse(customer.configJson) : null;
  const vendorNames = new Set<string>(
    (config?.vendors || []).map((v) => v.name),
  );

  const activeRows = await db
    .select()
    .from(itemState)
    .where(
      and(
        eq(itemState.customerId, cid),
        eq(itemState.stateKey, "unarchive_candidate"),
      ),
    );

  const vendorRows = vendorNames.size
    ? await db
        .select()
        .from(vendorSnapshotCache)
        .where(inArray(vendorSnapshotCache.vendorName, [...vendorNames]))
    : [];

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm uppercase tracking-wider text-slate-400">
          Unarchive candidates ({activeRows.length})
        </h2>
        {activeRows.length === 0 ? (
          <p className="text-sm text-slate-500">No active state — either first-run pending or everything reconciled.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Vendor</th>
                  <th className="px-4 py-2">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {activeRows.map((r) => (
                  <tr key={`${r.vendorName}:${r.sku}`}>
                    <td className="px-4 py-2 font-mono text-slate-200">{r.sku}</td>
                    <td className="px-4 py-2 text-slate-400">{r.vendorName}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(r.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm uppercase tracking-wider text-slate-400">
          Vendor snapshot cache ({vendorRows.length})
        </h2>
        {vendorRows.length === 0 ? (
          <p className="text-sm text-slate-500">Cache is cold for this customer's vendors.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-2">Vendor</th>
                  <th className="px-4 py-2">Product ID</th>
                  <th className="px-4 py-2">Available</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Fetched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {vendorRows.slice(0, 200).map((r) => (
                  <tr key={`${r.vendorName}:${r.vendorProductId}`}>
                    <td className="px-4 py-2 text-slate-400">{r.vendorName}</td>
                    <td className="px-4 py-2 font-mono text-slate-200">{r.vendorProductId}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          r.isAvailable
                            ? "rounded bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300"
                            : "rounded bg-rose-900/40 px-2 py-0.5 text-xs text-rose-300"
                        }
                      >
                        {r.isAvailable ? "yes" : "no"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {r.price ? `${r.price} ${r.currency ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(r.fetchedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vendorRows.length > 200 && (
              <div className="bg-slate-900 px-4 py-2 text-xs text-slate-500">
                Showing 200 of {vendorRows.length}.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
