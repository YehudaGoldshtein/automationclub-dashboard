"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PendingActions } from "./pending-actions";

export type PendingProductDTO = {
  storeProductId: string | null;
  title: string | null;
  skus: string[];
  isNewCollection: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  vendor: string | null;
  adminUrl: string | null;
};

export type ListMode = "pending" | "review" | "missing";

// needs_review_reason is a comma-joined list of codes from the backend.
const REVIEW_LABELS: Record<string, string> = {
  no_image: "No image",
  no_price: "No price",
  no_collection: "No collection",
  no_body: "No description",
  image_rejected: "Image rejected",
  supplier_flag: "Supplier flag",
  multi_variant: "Multiple variants",
};

function reasonLabels(raw: string): string[] {
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((code) => REVIEW_LABELS[code] ?? code);
}

export function PendingList({
  customerId,
  products,
  mode = "pending",
}: {
  customerId: string;
  products: PendingProductDTO[];
  mode?: ListMode;
}) {
  const [query, setQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const canSelect = mode !== "review";

  // Distinct suppliers present in this list (empty until the backend
  // populates store_products.vendor — the dropdown appears once it has data).
  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.vendor) set.add(p.vendor);
    return [...set].sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (vendorFilter && p.vendor !== vendorFilter) return false;
      if (!q) return true;
      return (
        (p.title?.toLowerCase().includes(q) ?? false) ||
        p.skus.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [products, query, vendorFilter]);

  const selectableIds = useMemo(
    () => filtered.map((p) => p.storeProductId).filter((id): id is string => !!id),
    [filtered],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  function act(ids: string[], action: "approve" | "ignore" | "delete") {
    if (ids.length === 0) return;
    if (action === "delete") {
      const ok = window.confirm(
        `Permanently delete ${ids.length} product${ids.length === 1 ? "" : "s"} from Shopify on the next sync? This can't be undone.`,
      );
      if (!ok) return;
    }
    startTransition(async () => {
      setErr(null);
      const res = await fetch("/api/pending/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, storeProductIds: ids, action }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      } else {
        const text = await res.text();
        setErr(`${action} failed: ${text || res.statusText}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title or SKU…"
          className="w-64 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
        />
        {vendors.length > 0 && (
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
          >
            <option value="">All suppliers</option>
            {vendors.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
        {canSelect && (
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={selectableIds.length === 0}
            />
            Select all ({selectableIds.length})
          </label>
        )}
        <span className="text-xs text-slate-500">
          {filtered.length} of {products.length} shown
        </span>
      </div>

      {canSelect && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2">
          <span className="text-sm text-slate-300">{selected.size} selected</span>
          {mode === "pending" && (
            <>
              <button
                disabled={pending}
                onClick={() => act([...selected], "approve")}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {pending ? "Working…" : `Confirm ${selected.size}`}
              </button>
              <button
                disabled={pending}
                onClick={() => act([...selected], "ignore")}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-400 hover:text-white disabled:opacity-50"
              >
                {pending ? "Working…" : `Ignore ${selected.size}`}
              </button>
            </>
          )}
          {mode === "missing" && (
            <button
              disabled={pending}
              onClick={() => act([...selected], "delete")}
              className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {pending ? "Working…" : `Delete ${selected.size}`}
            </button>
          )}
          {err && <span className="text-xs text-red-400">{err}</span>}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 px-4 py-12 text-center text-slate-500">
          No products match “{query}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((p) => {
            const id = p.storeProductId;
            const checked = canSelect && id ? selected.has(id) : false;
            return (
              <div
                key={id ?? p.skus[0]}
                className={`flex flex-col rounded-xl border p-4 ${
                  checked ? "border-emerald-700/60 bg-emerald-950/20" : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {canSelect && (
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        disabled={!id}
                        onChange={() => id && toggle(id)}
                      />
                    )}
                    <h3 className="font-medium text-slate-100">
                      {p.title || <span className="text-slate-500">Untitled draft</span>}
                    </h3>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {p.isNewCollection && (
                      <span className="rounded bg-sky-900/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-300">
                        ⚠️ New collection
                      </span>
                    )}
                    {p.needsReview && (
                      <span className="rounded bg-amber-900/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                        ⚠️ Needs review
                      </span>
                    )}
                  </div>
                </div>

                {p.reviewReason && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-amber-500/80">
                      Reason:
                    </span>
                    {reasonLabels(p.reviewReason).map((label) => (
                      <span
                        key={label}
                        className="rounded border border-amber-900/40 bg-amber-950/40 px-1.5 py-0.5 text-[11px] text-amber-300"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-2 text-xs text-slate-400">
                  <span className="uppercase tracking-wider text-slate-500">
                    {p.skus.length} variant{p.skus.length === 1 ? "" : "s"}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.skus.map((sku) => (
                      <span
                        key={sku}
                        className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300"
                      >
                        {sku}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 pt-2">
                  {mode === "pending" && (
                    <PendingActions customerId={customerId} storeProductId={id ?? ""} />
                  )}
                  {mode === "missing" && (
                    <button
                      disabled={pending || !id}
                      onClick={() => id && act([id], "delete")}
                      className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {pending ? "Working…" : "Delete"}
                    </button>
                  )}
                  {mode === "review" && <span />}
                  {p.adminUrl && (
                    <a
                      href={p.adminUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-slate-800 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300 hover:bg-slate-700"
                    >
                      Review in Shopify
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
