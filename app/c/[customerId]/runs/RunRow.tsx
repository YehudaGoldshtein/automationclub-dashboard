"use client";

import { useState } from "react";

type Change = {
  id: number;
  sku: string;
  kind: string;
  newStock: number | null;
  reason: string | null;
  applied: boolean;
  vendor: {
    name: string | null;
    imageUrl: string | null;
    price: string | null;
    currency: string | null;
    vendorName: string;
    isAvailable: boolean;
  } | null;
  store: {
    title: string | null;
    handle: string | null;
    storefrontUrl: string | null;
    adminUrl: string | null;
  } | null;
};

type ErrorRow = {
  id: number;
  sku: string | null;
  message: string;
  whenAt: string;
};

export type RunSummary = {
  runId: string;
  startedAt: string;
  itemsChecked: number;
  changesPlannedCount: number;
  changesAppliedCount: number;
  errorsCount: number;
  durationSeconds: string | null;
};

export function RunRow({ run }: { run: RunSummary }) {
  const expandable = run.changesPlannedCount > 0 || run.errorsCount > 0;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ changes: Change[]; errors: ErrorRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    if (!expandable) return;
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/runs/${run.runId}/changes`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : "load failed");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <tr
        className={expandable ? "cursor-pointer hover:bg-slate-900/40" : "hover:bg-slate-900/20"}
        onClick={toggle}
      >
        <td className="px-4 py-2 font-mono text-xs text-slate-400">
          {expandable ? (
            <span className="mr-1 inline-block w-3 text-slate-500">{open ? "▾" : "▸"}</span>
          ) : (
            <span className="mr-1 inline-block w-3" />
          )}
          {run.runId}
        </td>
        <td className="px-4 py-2 text-slate-400">
          {new Date(run.startedAt).toLocaleString()}
        </td>
        <td className="px-4 py-2">{run.itemsChecked}</td>
        <td className="px-4 py-2">{run.changesPlannedCount}</td>
        <td className="px-4 py-2">{run.changesAppliedCount}</td>
        <td className={`px-4 py-2 ${run.errorsCount > 0 ? "text-red-400" : ""}`}>
          {run.errorsCount}
        </td>
        <td className="px-4 py-2 text-slate-400">
          {run.durationSeconds ? `${Number(run.durationSeconds).toFixed(2)}s` : "—"}
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-950">
          <td colSpan={7} className="px-4 py-3">
            {loading && <div className="text-sm text-slate-500">Loading…</div>}
            {err && <div className="text-sm text-red-400">Failed to load: {err}</div>}
            {data && (
              <RunDetails changes={data.changes} errors={data.errors} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function RunDetails({ changes, errors }: { changes: Change[]; errors: ErrorRow[] }) {
  return (
    <div className="space-y-4">
      {changes.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
            Changed items ({changes.length})
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">New stock</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {changes.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">
                      {c.vendor?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.vendor.imageUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-slate-800" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-200">
                      {c.store?.storefrontUrl ? (
                        <a
                          href={c.store.storefrontUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-slate-700 underline-offset-2 hover:decoration-slate-400"
                        >
                          {c.sku}
                        </a>
                      ) : (
                        c.sku
                      )}
                      {c.store?.adminUrl && (
                        <a
                          href={c.store.adminUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 hover:bg-slate-700"
                        >
                          admin
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {c.store?.title || c.vendor?.name || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{c.kind}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {c.newStock === null ? "—" : c.newStock}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {c.reason || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {c.applied ? (
                        <span className="rounded bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">
                          yes
                        </span>
                      ) : (
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                          no
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {errors.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
            Errors ({errors.length})
          </div>
          <div className="overflow-hidden rounded-lg border border-red-900/50">
            <table className="w-full text-sm">
              <thead className="bg-red-950/30 text-left text-xs uppercase text-red-300">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-900/40">
                {errors.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 text-slate-400">
                      {new Date(e.whenAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-300">
                      {e.sku || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-red-300">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {changes.length === 0 && errors.length === 0 && (
        <div className="text-sm text-slate-500">No changes or errors recorded.</div>
      )}
    </div>
  );
}
