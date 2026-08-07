"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type IngestStatus = {
  status: "running" | "success" | "rejected" | "error" | null;
  reason: string | null;
  created: number | null;
  archived: number | null;
  skipped_existing: number | null;
  errors: number | null;
} | null;

const TERMINAL = new Set(["success", "rejected", "error"]);

async function fetchStatus(runRef: string): Promise<IngestStatus> {
  try {
    const res = await fetch(`/api/inventory/status?runRef=${encodeURIComponent(runRef)}`);
    if (!res.ok) return null;
    return (await res.json()) as IngestStatus;
  } catch {
    return null;
  }
}

export function UploadInventoryButton({ customerId }: { customerId: string }) {
  const storageKey = `inventory-upload:${customerId}`;
  const [uploading, setUploading] = useState(false);
  const [runRef, setRunRef] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<IngestStatus>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resume tracking after a page refresh.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { runRef?: string; fileName?: string };
        if (saved.runRef) {
          setRunRef(saved.runRef);
          setFileName(saved.fileName ?? null);
        }
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // Auto-poll while a run is tracked and not terminal.
  useEffect(() => {
    if (!runRef) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const data = await fetchStatus(runRef);
      if (stop) return;
      if (data) setStatus(data);
      if (data?.status && TERMINAL.has(data.status)) return; // done — stop polling
      timer = setTimeout(tick, 7000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [runRef]);

  async function manualRefresh() {
    if (!runRef) return;
    setRefreshing(true);
    const data = await fetchStatus(runRef);
    if (data) setStatus(data);
    setRefreshing(false);
  }

  function onFile(file: File) {
    setErr(null);
    setStatus(null);
    setUploading(true);
    setFileName(file.name);
    const ref = crypto.randomUUID();
    (async () => {
      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/inventory/upload",
          clientPayload: customerId,
        });
        const res = await fetch("/api/inventory/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, blobUrl: blob.url, runRef: ref }),
        });
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        try {
          localStorage.setItem(storageKey, JSON.stringify({ runRef: ref, fileName: file.name }));
        } catch {
          /* ignore */
        }
        setRunRef(ref); // kicks off polling
      } catch (e) {
        setErr(e instanceof Error ? e.message : "upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    })();
  }

  function reset() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setRunRef(null);
    setStatus(null);
    setFileName(null);
    setErr(null);
  }

  const terminal = Boolean(status?.status && TERMINAL.has(status.status));

  // Tracking view: a run is in flight or finished.
  if (runRef) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm">
        {fileName && (
          <div className="mb-2 font-mono text-xs text-slate-400">{fileName}</div>
        )}
        <StatusLine status={status} />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-400 hover:text-white disabled:opacity-50"
          >
            {refreshing ? "Checking…" : "Refresh status"}
          </button>
          {terminal && (
            <button
              onClick={reset}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-white"
            >
              Upload another file
            </button>
          )}
        </div>
      </div>
    );
  }

  // Idle view: the upload button.
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
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-white disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload inventory sheet"}
      </button>
      {err && <span className="text-xs text-red-400">Failed: {err}</span>}
    </div>
  );
}

function StatusLine({ status }: { status: IngestStatus }) {
  const s = status?.status ?? null;

  if (s === null) {
    return <div className="text-slate-400">Queued…</div>;
  }
  if (s === "running") {
    return (
      <div className="flex items-center gap-2 text-slate-300">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-600 border-t-slate-200" />
        Processing…
      </div>
    );
  }
  if (s === "success") {
    return (
      <div className="text-emerald-300">
        ✅ Created {status?.created ?? 0}, took down {status?.archived ?? 0}, skipped{" "}
        {status?.skipped_existing ?? 0}, errors {status?.errors ?? 0}
      </div>
    );
  }
  if (s === "rejected") {
    return (
      <div className="text-red-300">
        ❌ {status?.reason || "Bad file structure — nothing was created."}
        <div className="mt-1 text-xs text-slate-400">
          Fix the column headers and re-upload.
        </div>
      </div>
    );
  }
  // error
  return (
    <div className="text-amber-300">
      ⚠️ Ingest failed{status?.reason ? ` — ${status.reason}` : ""}. Contact support.
    </div>
  );
}
