// Package-level structured logger. Writes JSON to stdout (captured by
// Vercel's function logs) AND, when AXIOM_API_TOKEN is set, forwards the
// same event to Axiom via a fire-and-forget HTTPS POST.
//
// Usage:
//   log.info("trigger_sync_ok", { email, customer_id });
//   log.warn("run_changes_forbidden", { run_id, email });
//   log.error("github_dispatch_failed", { error });
//
// Keep event names snake_case so they match the Python + Go services.

export type Fields = Record<string, unknown>;

type Level = "DEBUG" | "INFO" | "WARN" | "ERROR";

const SERVICE = "automationclub-dashboard";

const AXIOM_URL = process.env.AXIOM_API_URL || "https://api.axiom.co";
const AXIOM_TOKEN = process.env.AXIOM_API_TOKEN || "";
const AXIOM_DATASET = process.env.AXIOM_DATASET || "";
const AXIOM_READY = Boolean(AXIOM_TOKEN && AXIOM_DATASET);

function sendToAxiom(payload: Record<string, unknown>): void {
  if (!AXIOM_READY) return;
  const url = `${AXIOM_URL.replace(/\/+$/, "")}/v1/datasets/${AXIOM_DATASET}/ingest`;
  // Fire-and-forget; errors are swallowed so logging never crashes a request.
  fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AXIOM_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([payload]),
    // Hint to the runtime not to wait on this request's completion.
    keepalive: true,
  }).catch(() => {
    // Intentional no-op: logging failures must never propagate.
  });
}

function emit(level: Level, msg: string, fields?: Fields) {
  const payload: Record<string, unknown> = {
    _time: new Date().toISOString(),
    level,
    msg,
    service: SERVICE,
  };
  if (fields) Object.assign(payload, fields);
  // eslint-disable-next-line no-console
  const out = level === "ERROR" || level === "WARN" ? console.warn : console.log;
  out(JSON.stringify(payload));
  sendToAxiom(payload);
}

export const log = {
  debug(msg: string, fields?: Fields) { emit("DEBUG", msg, fields); },
  info(msg: string, fields?: Fields) { emit("INFO", msg, fields); },
  warn(msg: string, fields?: Fields) { emit("WARN", msg, fields); },
  error(msg: string, fields?: Fields) { emit("ERROR", msg, fields); },
};
