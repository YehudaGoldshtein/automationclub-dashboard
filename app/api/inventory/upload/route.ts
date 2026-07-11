import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { requireSession } from "@/lib/auth-helpers";
import { log } from "@/lib/log";

// Content types accepted for inventory spreadsheets.
const ALLOWED = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
];

/**
 * Issues a short-lived client-upload token so the browser can PUT the raw
 * spreadsheet straight to Vercel Blob — bypassing the ~4.5MB serverless body
 * limit. The dashboard never touches the file bytes; the backend digests it.
 *
 * Auth is enforced here: only an authenticated user scoped to the requested
 * customer (or an admin) can obtain a token. The workflow that actually
 * ingests the file is fired separately by /api/inventory/trigger once the
 * client reports the upload finished.
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await requireSession();
        const requestedId = clientPayload || undefined;

        if (session.user.role !== "admin") {
          if (!session.user.customerId || requestedId !== session.user.customerId) {
            log.warn("inventory_upload_forbidden", {
              email: session.user.email,
              requested: requestedId ?? null,
              own: session.user.customerId,
            });
            throw new Error("forbidden");
          }
        }

        return {
          allowedContentTypes: ALLOWED,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            email: session.user.email,
            customerId: requestedId ?? null,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Fires via Vercel Blob webhook (production only — not on localhost).
        // The authoritative trigger is /api/inventory/trigger, called by the
        // client after upload; this is just an audit breadcrumb.
        log.info("inventory_upload_completed", {
          url: blob.url,
          payload: tokenPayload ?? null,
        });
      },
    });

    return Response.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "forbidden" ? 403 : 400;
    return new Response(message, { status });
  }
}
