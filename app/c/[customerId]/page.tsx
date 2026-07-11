import { and, desc, eq } from "drizzle-orm";

import { resolveCustomerScope } from "@/lib/auth-helpers";
import { db, itemState, syncRuns, vendorSnapshotCache } from "@/lib/db";
import { TriggerSyncButton } from "./trigger-button";
import { UploadInventoryButton } from "./upload-inventory";

export const dynamic = "force-dynamic";

export default async function CustomerOverview({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const scope = await resolveCustomerScope(customerId);
  const cid = scope.customerId!;

  const recentRuns = await db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.customerId, cid))
    .orderBy(desc(syncRuns.startedAt))
    .limit(5);

  const activeStateCount = await db
    .select({ sku: itemState.sku })
    .from(itemState)
    .where(
      and(
        eq(itemState.customerId, cid),
        eq(itemState.stateKey, "unarchive_candidate"),
      ),
    );

  const cacheSize = await db.select({ id: vendorSnapshotCache.vendorProductId }).from(vendorSnapshotCache);

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card label="Unarchive candidates" value={activeStateCount.length} />
        <Card label="Cached vendor snapshots (all vendors)" value={cacheSize.length} />
        <Card label="Recent runs" value={recentRuns.length} />
      </section>

      <section>
        <h2 className="mb-3 text-sm uppercase tracking-wider text-slate-400">Actions</h2>
        <div className="space-y-3">
          <TriggerSyncButton customerId={cid} />
          <UploadInventoryButton customerId={cid} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm uppercase tracking-wider text-slate-400">
          Recent runs
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2">Started</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2">Planned / applied</th>
                <th className="px-4 py-2">Errors</th>
                <th className="px-4 py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentRuns.map((r) => (
                <tr key={r.runId}>
                  <td className="px-4 py-2 text-slate-400">
                    {new Date(r.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{r.itemsChecked}</td>
                  <td className="px-4 py-2">
                    {r.changesPlannedCount} / {r.changesAppliedCount}
                  </td>
                  <td className={`px-4 py-2 ${r.errorsCount > 0 ? "text-red-400" : ""}`}>
                    {r.errorsCount}
                  </td>
                  <td className="px-4 py-2 text-slate-400">
                    {r.durationSeconds ? `${Number(r.durationSeconds).toFixed(2)}s` : "—"}
                  </td>
                </tr>
              ))}
              {recentRuns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
