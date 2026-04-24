import { desc, eq } from "drizzle-orm";

import { resolveCustomerScope } from "@/lib/auth-helpers";
import { db, syncRuns } from "@/lib/db";

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
          {rows.map((r) => (
            <tr key={r.runId}>
              <td className="px-4 py-2 font-mono text-xs text-slate-400">{r.runId}</td>
              <td className="px-4 py-2 text-slate-400">
                {new Date(r.startedAt).toLocaleString()}
              </td>
              <td className="px-4 py-2">{r.itemsChecked}</td>
              <td className="px-4 py-2">{r.changesPlannedCount}</td>
              <td className="px-4 py-2">{r.changesAppliedCount}</td>
              <td className={`px-4 py-2 ${r.errorsCount > 0 ? "text-red-400" : ""}`}>
                {r.errorsCount}
              </td>
              <td className="px-4 py-2 text-slate-400">
                {r.durationSeconds ? `${Number(r.durationSeconds).toFixed(2)}s` : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
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
