import { desc, eq } from "drizzle-orm";

import { resolveCustomerScope } from "@/lib/auth-helpers";
import { db, syncRuns } from "@/lib/db";
import { RunRow, type RunSummary } from "./RunRow";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const scope = await resolveCustomerScope(customerId);
  const rows = await db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.customerId, scope.customerId!))
    .orderBy(desc(syncRuns.startedAt))
    .limit(100);

  const serialized: RunSummary[] = rows.map((r) => ({
    runId: r.runId,
    startedAt: r.startedAt.toISOString(),
    itemsChecked: r.itemsChecked,
    changesPlannedCount: r.changesPlannedCount,
    changesAppliedCount: r.changesAppliedCount,
    errorsCount: r.errorsCount,
    durationSeconds: r.durationSeconds,
  }));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-left text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-2">Run ID</th>
            <th className="px-4 py-2">Started</th>
            <th className="px-4 py-2">Items</th>
            <th className="px-4 py-2">Planned</th>
            <th className="px-4 py-2">Applied</th>
            <th className="px-4 py-2">Errors</th>
            <th className="px-4 py-2">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {serialized.map((r) => (
            <RunRow key={r.runId} run={r} />
          ))}
          {serialized.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No runs recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
