"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";

export function UploadInventoryButton({ customerId }: { customerId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(file: File) {
    startTransition(async () => {
      setMsg(`Uploading ${file.name}…`);
      try {
        // Raw file goes straight to Vercel Blob — never through this server.
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/inventory/upload",
          clientPayload: customerId,
        });

        // Hand the backend the blob URL and let it digest the sheet.
        const res = await fetch("/api/inventory/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, blobUrl: blob.url }),
        });

        if (res.ok) {
          setMsg("Uploaded — queued for ingestion. Watch the Runs tab for results.");
        } else {
          const text = await res.text();
          setMsg(`Upload saved but ingestion failed: ${text || res.statusText}`);
        }
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        setMsg(`Failed: ${text}`);
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <button
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-white disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload inventory sheet"}
      </button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </div>
  );
}
