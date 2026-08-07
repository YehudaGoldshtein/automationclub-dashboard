import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { requireSession } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

/**
 * Poll an ingest run's outcome by its run_ref (a UUID the client generated at
 * upload and passed into the workflow dispatch). Read-only.
 *
 * ingest_runs is backend-owned; if the table doesn't exist yet (or there's no
 * row), we return { status: null } which the UI renders as "Queued…". Raw SQL
 * so we don't depend on a Drizzle mirror while the table's shape settles.
 */
export async function GET(req: Request) {
  await requireSession();

  const runRef = new URL(req.url).searchParams.get("runRef");
  if (!runRef) return new NextResponse("runRef required", { status: 400 });

  try {
    const result = await db.execute(sql`
      select status, reason, created, archived, skipped_existing, errors,
             started_at, finished_at
      from ingest_runs
      where run_ref = ${runRef}
      limit 1
    `);
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows) ?? [];
    const row = rows[0] as Record<string, unknown> | undefined;

    if (!row) return NextResponse.json({ status: null });

    return NextResponse.json({
      status: row.status ?? null,
      reason: row.reason ?? null,
      created: row.created ?? null,
      archived: row.archived ?? null,
      skipped_existing: row.skipped_existing ?? null,
      errors: row.errors ?? null,
      started_at: row.started_at ?? null,
      finished_at: row.finished_at ?? null,
    });
  } catch {
    // Table not created yet, or a transient error — treat as still queuing.
    return NextResponse.json({ status: null });
  }
}
