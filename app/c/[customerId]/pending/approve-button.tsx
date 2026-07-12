"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ApproveButton({
  customerId,
  storeProductId,
}: {
  customerId: string;
  storeProductId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setErr(null);
            const res = await fetch(
              `/api/pending/${encodeURIComponent(storeProductId)}/approve`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId }),
              },
            );
            if (res.ok) {
              // Re-run the server component; the approved product drops off the list.
              router.refresh();
            } else {
              const text = await res.text();
              setErr(`Failed: ${text || res.statusText}`);
            }
          })
        }
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? "Approving…" : "Confirm"}
      </button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
