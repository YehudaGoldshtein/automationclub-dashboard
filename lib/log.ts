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

import { after } from "next/server";

export type Fields = Record<string, unknown>;

type Level = "DEBUG" | "INFO" | "WARN" | "ERROR";

const SERVICE = "automationclub-dashboard";

const AXIOM_URL = process.env.AXIOM_API_URL || "https://api.axiom.co";
const AXIOM_TOKEN = process.env.AXIOM_API_TOKEN || "";
const AXIOM_DATASET = process.env.AXIOM_DATASET || "";
const AXIOM_READY = Boolean(AXIOM_TOKEN && AXIOM_DATASET);

// Returns the POST promise so callers can await delivery when it matters
// (e.g. an error path that may otherwise be cut off when the function ends).
function postToAxiom(payload: Record<string, unknown>): Promise<void> {
  if (!AXIOM_READY) return Promise.resolve();
  const url = `${AXIOM_URL.replace(/\/+$/, "")}/v1/datasets/${AXIOM_DATASET}/ingest`;
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AXIOM_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([payload]),
    // Hint to the runtime not to wait on this request's completion.
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => {
      // Intentional no-op: logging failures must never propagate.
    });
}

function buildPayload(level: Level, msg: string, fields?: Fields) {
  const payload: Record<string, unknown> = {
    _time: new Date().toISOString(),
    level,
    msg,
    service: SERVICE,
  };
  if (fields) Object.assign(payload, fields);
  return payload;
}

// Vercel serverless freezes the invocation once the response is sent, which
// drops in-flight fire-and-forget fetches. `after()` uses waitUntil under the
// hood to keep the invocation alive until the Axiom POST settles.
function scheduleAxiom(payload: Record<string, unknown>) {
  try {
    after(() => postToAxiom(payload));
  } catch {
    // Called outside a request scope (e.g. a CLI script or build) — best effort.
    void postToAxiom(payload);
  }
}

function emit(level: Level, msg: string, fields?: Fields) {
  const payload = buildPayload(level, msg, fields);
  // eslint-disable-next-line no-console
  const out = level === "ERROR" || level === "WARN" ? console.warn : console.log;
  out(JSON.stringify(payload));
  scheduleAxiom(payload);
}

export const log = {
  debug(msg: string, fields?: Fields) { emit("DEBUG", msg, fields); },
  info(msg: string, fields?: Fields) { emit("INFO", msg, fields); },
  warn(msg: string, fields?: Fields) { emit("WARN", msg, fields); },
  error(msg: string, fields?: Fields) { emit("ERROR", msg, fields); },
  // Awaitable error: use where the caller can/should wait for Axiom delivery,
  // such as instrumentation's onRequestError hook.
  async errorAsync(msg: string, fields?: Fields) {
    const payload = buildPayload("ERROR", msg, fields);
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify(payload));
    await postToAxiom(payload);
  },
};
