"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Action = "approve" | "ignore";

export function PendingActions({
  customerId,
  storeProductId,
}: {
  customerId: string;
  storeProductId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Action | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function run(action: Action) {
    startTransition(async () => {
      setErr(null);
      setActive(action);
      const res = await fetch(
        `/api/pending/${encodeURIComponent(storeProductId)}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId }),
        },
      );
      if (res.ok) {
        // Re-run the server component; the row drops off the pending list.
        router.refresh();
      } else {
        const text = await res.text();
        setErr(`Failed: ${text || res.statusText}`);
        setActive(null);
      }
    });
  }

  const busy = (a: Action) => pending && active === a;

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() => run("approve")}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy("approve") ? "Approving…" : "Confirm"}
      </button>
      <button
        disabled={pending}
        onClick={() => run("ignore")}
        className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-400 hover:text-white disabled:opacity-50"
      >
        {busy("ignore") ? "Ignoring…" : "Ignore"}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
