// Package-level structured logger for the dashboard. Writes JSON to stdout
// (captured by Vercel's function logs). A later change swaps the underlying
// writer for a multi-destination one (stdout + Axiom) without touching call
// sites.
//
// Usage:
//   log.info("trigger_sync", { caller: email, customer_id });
//   log.warn("forbidden_trigger", { email, requested });
//   log.error("github_dispatch_failed", { message, status });
//
// Keep event names snake_case so they match the Python + Go services.

export type Fields = Record<string, unknown>;

type Level = "DEBUG" | "INFO" | "WARN" | "ERROR";

const SERVICE = "automationclub-dashboard";

function emit(level: Level, msg: string, fields?: Fields) {
  const payload: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    msg,
    service: SERVICE,
  };
  if (fields) Object.assign(payload, fields);
  // eslint-disable-next-line no-console
  const out = level === "ERROR" || level === "WARN" ? console.warn : console.log;
  out(JSON.stringify(payload));
}

export const log = {
  debug(msg: string, fields?: Fields) { emit("DEBUG", msg, fields); },
  info(msg: string, fields?: Fields) { emit("INFO", msg, fields); },
  warn(msg: string, fields?: Fields) { emit("WARN", msg, fields); },
  error(msg: string, fields?: Fields) { emit("ERROR", msg, fields); },
};
