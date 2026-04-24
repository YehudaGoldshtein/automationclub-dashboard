"use client";

import { useState, useTransition } from "react";

export function TriggerSyncButton({ customerId }: { customerId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const res = await fetch("/api/sync/trigger", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ customerId }),
            });
            if (res.ok) {
              setMsg("Queued — next sync tick will pick it up.");
            } else {
              const text = await res.text();
              setMsg(`Failed: ${text || res.statusText}`);
            }
          })
        }
        className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-white disabled:opacity-50"
      >
        {pending ? "Triggering…" : "Trigger sync now"}
      </button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </div>
  );
}
