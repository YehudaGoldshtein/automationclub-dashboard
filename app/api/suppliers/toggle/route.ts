import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { requireSession, resolveCustomerScope } from "@/lib/auth-helpers";
import { log } from "@/lib/log";
import { db, supplierSettings } from "@/lib/db";

// Must match the backend's supplier keys exactly (lowercase).
const SUPPLIERS = ["laura", "segal", "bambino", "snir"];

/**
 * Enable/disable a supplier's sync for a customer.
 *
 * Neon write ONLY (no Shopify). Upserts one supplier_settings row; the
 * orchestrator reads these flags and skips disabled suppliers on its next
 * tick (≤3h). Scoped via resolveCustomerScope — tenant comes from the
 * session, not the body.
 */
export async function POST(req: Request) {
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));
  const requestedId: string | null = body?.customerId ?? null;
  const supplier: unknown = body?.supplier;
  const enabled: unknown = body?.enabled;

  if (typeof supplier !== "string" || !SUPPLIERS.includes(supplier)) {
    return new NextResponse(`supplier must be one of: ${SUPPLIERS.join(", ")}`, { status: 400 });
  }
  if (typeof enabled !== "boolean") {
    return new NextResponse("enabled must be a boolean", { status: 400 });
  }

  const scope = await resolveCustomerScope(requestedId);
  if (!scope.customerId) {
    return new NextResponse("customerId required", { status: 400 });
  }

  try {
    await db
      .insert(supplierSettings)
      .values({
        customerId: scope.customerId,
        supplier,
        enabled,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [supplierSettings.customerId, supplierSettings.supplier],
        set: { enabled, updatedAt: sql`now()` },
      });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("supplier_toggle_failed", {
      email: session.user.email,
      customer_id: scope.customerId,
      supplier,
      enabled,
      error: message,
    });
    // Most likely the backend hasn't created supplier_settings yet.
    return new NextResponse(`toggle failed: ${message}`, { status: 502 });
  }

  log.info("supplier_toggle_ok", {
    email: session.user.email,
    customer_id: scope.customerId,
    supplier,
    enabled,
  });

  return NextResponse.json({ ok: true, supplier, enabled });
}
