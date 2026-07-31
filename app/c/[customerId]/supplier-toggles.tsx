"use client";

import { useState } from "react";

const SUPPLIERS: { key: string; label: string }[] = [
  { key: "laura", label: "Laura" },
  { key: "segal", label: "Segal" },
  { key: "bambino", label: "Bambino" },
  { key: "snir", label: "Snir" },
];

export function SupplierToggles({
  customerId,
  initial,
}: {
  customerId: string;
  // supplier key -> enabled. Absent = enabled (default on).
  initial: Record<string, boolean>;
}) {
  const [state, setState] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    for (const { key } of SUPPLIERS) s[key] = initial[key] ?? true;
    return s;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(key: string) {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next })); // optimistic
    setBusy(key);
    setErr(null);
    try {
      const res = await fetch("/api/suppliers/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, supplier: key, enabled: next }),
      });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
    } catch (e) {
      setState((s) => ({ ...s, [key]: !next })); // revert on failure
      setErr(`${key}: ${e instanceof Error ? e.message : "failed"}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
      {SUPPLIERS.map(({ key, label }) => {
        const on = state[key];
        return (
          <div key={key} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-200">{label}</div>
              <div className="text-xs text-slate-500">
                {on ? "Syncing" : "Excluded from sync"}
              </div>
            </div>
            <button
              role="switch"
              aria-checked={on}
              aria-label={`${label} sync`}
              disabled={busy === key}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                on ? "bg-emerald-600" : "bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  on ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        );
      })}
      {err && <div className="px-4 py-2 text-xs text-red-400">Failed: {err}</div>}
    </div>
  );
}
