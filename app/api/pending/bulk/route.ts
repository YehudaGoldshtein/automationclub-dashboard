import { NextResponse } from "next/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";

import { requireSession, resolveCustomerScope } from "@/lib/auth-helpers";
import { log } from "@/lib/log";
import { db, storeProducts } from "@/lib/db";

const ACTIONS = [
  "approve",
  "ignore",
  "delete",
  "unarchive",
  "cancel",
  "blacklist",
  "release",
] as const;
type Action = (typeof ACTIONS)[number];

/**
 * Bulk product actions in one round-trip. Neon write ONLY (no Shopify):
 *  - approve   → approved=true, approved_at=now()  (draft rows)
 *  - ignore    → status='rejected'                 (draft rows)
 *  - delete    → status='rejected'                 (missing-at-source OR unarchive-candidate rows)
 *  - unarchive → status='unarchive_requested'      (unarchive-candidate rows)
 *  - cancel    → status='active'                   (rows currently unarchive_requested)
 *  - blacklist → blacklisted=true, unarchive_candidate=false  (unarchive-candidate rows; keep archived forever)
 *  - release   → blacklisted=false                 (blacklisted rows)
 * The tokened reconcile job reads these and applies them in Shopify next sync.
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

  if (typeof action !== "string" || !ACTIONS.includes(action as Action)) {
    return new NextResponse(`action must be one of: ${ACTIONS.join(", ")}`, { status: 400 });
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

  let updated: { sku: string }[] = [];
  switch (action as Action) {
    case "approve":
      updated = await db
        .update(storeProducts)
        .set({ approved: true, approvedAt: sql`now()` })
        .where(and(base, eq(storeProducts.status, "draft")))
        .returning({ sku: storeProducts.sku });
      break;
    case "ignore":
      updated = await db
        .update(storeProducts)
        .set({ status: "rejected" })
        .where(and(base, eq(storeProducts.status, "draft")))
        .returning({ sku: storeProducts.sku });
      break;
    case "delete":
      updated = await db
        .update(storeProducts)
        .set({ status: "rejected" })
        .where(
          and(
            base,
            or(eq(storeProducts.missingAtSource, true), eq(storeProducts.unarchiveCandidate, true)),
          ),
        )
        .returning({ sku: storeProducts.sku });
      break;
    case "unarchive":
      updated = await db
        .update(storeProducts)
        .set({ status: "unarchive_requested" })
        .where(and(base, eq(storeProducts.unarchiveCandidate, true)))
        .returning({ sku: storeProducts.sku });
      break;
    case "cancel":
      updated = await db
        .update(storeProducts)
        .set({ status: "active" })
        .where(and(base, eq(storeProducts.status, "unarchive_requested")))
        .returning({ sku: storeProducts.sku });
      break;
    case "blacklist":
      updated = await db
        .update(storeProducts)
        .set({ blacklisted: true, unarchiveCandidate: false })
        .where(and(base, eq(storeProducts.unarchiveCandidate, true)))
        .returning({ sku: storeProducts.sku });
      break;
    case "release":
      updated = await db
        .update(storeProducts)
        .set({ blacklisted: false })
        .where(and(base, eq(storeProducts.blacklisted, true)))
        .returning({ sku: storeProducts.sku });
      break;
  }

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
