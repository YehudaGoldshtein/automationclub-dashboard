"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Manual "add to blacklist by SKU" box for the Blacklist tab. Resolve-only:
 * the API blacklists only SKUs already tracked in store_products and reports the
 * rest back as not-found, so typos never create junk rows.
 */
export function BlacklistAdd({ customerId }: { customerId: string }) {
  const [skuInput, setSkuInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
    const skus = skuInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (skus.length === 0) return;
    startTransition(async () => {
      setErr(null);
      setMsg(null);
      const res = await fetch("/api/blacklist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, skus }),
      });
      if (res.ok) {
        const data = await res.json();
        setSkuInput("");
        const parts = [
          `Blacklisted ${data.matched.length} SKU${data.matched.length === 1 ? "" : "s"}.`,
        ];
        if (data.unmatched?.length) parts.push(`Not found: ${data.unmatched.join(", ")}`);
        setMsg(parts.join(" "));
        router.refresh();
      } else {
        setErr(`Add failed: ${(await res.text()) || res.statusText}`);
      }
    });
  }

  return (
    <section className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
      <div className="mb-2 text-xs uppercase tracking-wider text-amber-400/80">
        Add to blacklist by SKU
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Enter one or more SKUs (comma or space separated). Only SKUs already tracked in the
        catalog are blacklisted; unknown SKUs are reported back. Blacklisting keeps a product
        archived — it&apos;s never recommended for unarchive or republished.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={skuInput}
          onChange={(e) => setSkuInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="e.g. 145011300, 145011324"
          className="w-80 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
        />
        <button
          disabled={pending || skuInput.trim().length === 0}
          onClick={add}
          className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {pending ? "Working…" : "Add to blacklist"}
        </button>
        {msg && <span className="text-xs text-slate-300">{msg}</span>}
        {err && <span className="text-xs text-red-400">{err}</span>}
      </div>
    </section>
  );
}
