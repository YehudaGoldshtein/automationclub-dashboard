import { type Instrumentation } from "next";

import { log } from "@/lib/log";

// Ships every server-side error (Server Component renders, Route Handlers,
// Server Actions) to Axiom with its real message + digest. In production the
// digest is all the browser shows; onRequestError runs server-side so we
// capture the un-redacted error here and can match it back by digest.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const e = err as { digest?: string; message?: string; stack?: string };
  await log.errorAsync("server_request_error", {
    digest: e.digest ?? null,
    error: e.message ?? String(err),
    stack: e.stack ?? null,
    path: request.path,
    method: request.method,
    route_path: context.routePath,
    route_type: context.routeType,
    render_source:
      (context as { renderSource?: string }).renderSource ?? null,
  });
};
