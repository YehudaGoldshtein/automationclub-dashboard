import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";

import { requireSession, resolveCustomerScope } from "@/lib/auth-helpers";
import { log } from "@/lib/log";
import { db, storeProducts } from "@/lib/db";

/**
 * Bulk approve / ignore / delete pending products in one round-trip.
 *
 * Neon write ONLY (no Shopify):
 *  - approve → approved=true, approved_at=now()   (draft rows)
 *  - ignore  → status='rejected'                  (draft rows)
 *  - delete  → status='rejected'                  (missing-at-source rows)
 * "delete" marks missing-at-source items for deletion; the tokened reconcile
 * job removes rejected products from Shopify on the next sync.
 * Scoped via resolveCustomerScope; store_product_ids come from the request
 * body, the tenant does not.
 */
export async function POST(req: Request) {
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));
  const requestedId: string | null = body?.customerId ?? null;
  const action: unknown = body?.action;
  const ids: string[] = Array.isArray(body?.storeProductIds)
    ? body.storeProductIds.filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
    : [];

  if (action !== "approve" && action !== "ignore" && action !== "delete") {
    return new NextResponse("action must be 'approve', 'ignore', or 'delete'", { status: 400 });
  }
  if (ids.length === 0) {
    return new NextResponse("storeProductIds required", { status: 400 });
  }

  const scope = await resolveCustomerScope(requestedId);
  if (!scope.customerId) {
    return new NextResponse("customerId required", { status: 400 });
  }

  const base = and(
    eq(storeProducts.customerId, scope.customerId),
    inArray(storeProducts.storeProductId, ids),
  );
  // approve/ignore act on drafts; delete acts on missing-at-source rows.
  const scopedWhere =
    action === "delete"
      ? and(base, eq(storeProducts.missingAtSource, true))
      : and(base, eq(storeProducts.status, "draft"));

  const updated =
    action === "approve"
      ? await db
          .update(storeProducts)
          .set({ approved: true, approvedAt: sql`now()` })
          .where(scopedWhere)
          .returning({ sku: storeProducts.sku })
      : await db
          .update(storeProducts)
          .set({ status: "rejected" })
          .where(scopedWhere)
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
