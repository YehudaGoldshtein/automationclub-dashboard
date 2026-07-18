import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";

import { requireSession, resolveCustomerScope } from "@/lib/auth-helpers";
import { log } from "@/lib/log";
import { db, storeProducts } from "@/lib/db";

/**
 * Bulk approve / ignore pending draft products in one round-trip.
 *
 * Neon write ONLY (no Shopify). Same contract as the single-product routes:
 *  - approve → approved=true, approved_at=now()
 *  - ignore  → status='rejected'
 * Scoped via resolveCustomerScope; only draft rows for the caller's tenant are
 * touched. store_product_ids come from the request body, the tenant does not.
 */
export async function POST(req: Request) {
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));
  const requestedId: string | null = body?.customerId ?? null;
  const action: unknown = body?.action;
  const ids: string[] = Array.isArray(body?.storeProductIds)
    ? body.storeProductIds.filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
    : [];

  if (action !== "approve" && action !== "ignore") {
    return new NextResponse("action must be 'approve' or 'ignore'", { status: 400 });
  }
  if (ids.length === 0) {
    return new NextResponse("storeProductIds required", { status: 400 });
  }

  const scope = await resolveCustomerScope(requestedId);
  if (!scope.customerId) {
    return new NextResponse("customerId required", { status: 400 });
  }

  const where = and(
    eq(storeProducts.customerId, scope.customerId),
    inArray(storeProducts.storeProductId, ids),
    eq(storeProducts.status, "draft"),
  );

  const updated =
    action === "approve"
      ? await db
          .update(storeProducts)
          .set({ approved: true, approvedAt: sql`now()` })
          .where(where)
          .returning({ sku: storeProducts.sku })
      : await db
          .update(storeProducts)
          .set({ status: "rejected" })
          .where(where)
          .returning({ sku: storeProducts.sku });

  log.info("pending_bulk_ok", {
    email: session.user.email,
    customer_id: scope.customerId,
    action,
    products: ids.length,
    variants_updated: updated.length,
  });

  return NextResponse.json({
    ok: true,
    action,
    products: ids.length,
    variants_updated: updated.length,
  });
}
