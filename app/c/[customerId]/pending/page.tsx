import Link from "next/link";
import { and, asc, countDistinct, eq, ne } from "drizzle-orm";

import { resolveCustomerScope } from "@/lib/auth-helpers";
import { customers, db, storeProducts } from "@/lib/db";
import type { Customer } from "@/lib/types";
import { TriggerSyncButton } from "../trigger-button";
import { PendingList, type ListMode } from "./pending-list";

export const dynamic = "force-dynamic";

type PendingProduct = {
  storeProductId: string | null;
  title: string | null;
  skus: string[];
  isNewCollection: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  vendor: string | null;
  adminUrl: string | null;
};

export default async function PendingPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { customerId } = await params;
  const sp = await searchParams;
  const view: ListMode =
    sp.view === "review" ? "review" : sp.view === "missing" ? "missing" : "pending";

  const scope = await resolveCustomerScope(customerId);
  const cid = scope.customerId!;

  // Deep-link domain comes from the customer's config JSON — same source the
  // run-changes view uses to build Shopify admin links.
  const [customer] = await db
    .select({ configJson: customers.configJson })
    .from(customers)
    .where(eq(customers.id, cid))
    .limit(1);
  const config: Customer | null = customer ? JSON.parse(customer.configJson) : null;
  const myshopify = config?.store.myshopify_domain ?? null;

  const pendingWhere = and(
    eq(storeProducts.customerId, cid),
    eq(storeProducts.status, "draft"),
    eq(storeProducts.approved, false),
  );
  const reviewWhere = and(
    eq(storeProducts.customerId, cid),
    eq(storeProducts.needsReview, true),
  );
  const missingWhere = and(
    eq(storeProducts.customerId, cid),
    eq(storeProducts.missingAtSource, true),
    ne(storeProducts.status, "rejected"),
  );

  // Counts for each toggle segment (per product, not per variant SKU).
  const [pendingAgg, reviewAgg, missingAgg] = await Promise.all([
    db.select({ n: countDistinct(storeProducts.storeProductId) }).from(storeProducts).where(pendingWhere),
    db.select({ n: countDistinct(storeProducts.storeProductId) }).from(storeProducts).where(reviewWhere),
    db.select({ n: countDistinct(storeProducts.storeProductId) }).from(storeProducts).where(missingWhere),
  ]);
  const pendingCount = Number(pendingAgg[0]?.n ?? 0);
  const reviewCount = Number(reviewAgg[0]?.n ?? 0);
  const missingCount = Number(missingAgg[0]?.n ?? 0);

  const activeWhere =
    view === "review" ? reviewWhere : view === "missing" ? missingWhere : pendingWhere;
  const rows = await db
    .select()
    .from(storeProducts)
    .where(activeWhere)
    .orderBy(asc(storeProducts.storeProductId), asc(storeProducts.sku));

  // One card per product (store_product_id), collapsing the per-variant SKU rows.
  const byProduct = new Map<string, PendingProduct>();
  for (const r of rows) {
    const key = r.storeProductId ?? `__nopid__:${r.sku}`;
    let g = byProduct.get(key);
    if (!g) {
      g = {
        storeProductId: r.storeProductId,
        title: r.title,
        skus: [],
        isNewCollection: false,
        needsReview: false,
        reviewReason: null,
        vendor: r.vendor,
        adminUrl:
          r.storeProductId && myshopify
            ? `https://${myshopify}/admin/products/${r.storeProductId}`
            : null,
      };
      byProduct.set(key, g);
    }
    g.skus.push(r.sku);
    if (!g.title && r.title) g.title = r.title;
    g.isNewCollection ||= r.isNewCollection;
    g.needsReview ||= r.needsReview;
    if (!g.reviewReason && r.needsReviewReason) g.reviewReason = r.needsReviewReason;
    if (!g.vendor && r.vendor) g.vendor = r.vendor;
  }
  const products = [...byProduct.values()];

  const copy = {
    pending: {
      heading: "Pending new items",
      blurb:
        "Draft products awaiting your confirmation. Confirming marks them approved; the next sync activates them in Shopify.",
      countLabel: "pending",
      empty: "No products pending review.",
    },
    review: {
      heading: "Items needing review",
      blurb: "Products the sync flagged for a closer look.",
      countLabel: "flagged",
      empty: "Nothing flagged for review.",
    },
    missing: {
      heading: "Missing at source",
      blurb:
        "Products no longer found at the supplier. Delete marks them for removal from Shopify on the next sync.",
      countLabel: "missing",
      empty: "Nothing missing at source.",
    },
  }[view];

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-slate-400">{copy.heading}</h2>
          <p className="mt-1 text-xs text-slate-500">{copy.blurb}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">{products.length}</div>
          <div className="text-xs uppercase tracking-wider text-slate-500">{copy.countLabel}</div>
        </div>
      </section>

      <nav className="inline-flex rounded-lg border border-slate-800 p-1 text-sm">
        <Segment href={`/c/${cid}/pending`} active={view === "pending"} label="Pending" count={pendingCount} />
        <Segment
          href={`/c/${cid}/pending?view=review`}
          active={view === "review"}
          label="Needs review"
          count={reviewCount}
        />
        <Segment
          href={`/c/${cid}/pending?view=missing`}
          active={view === "missing"}
          label="Missing at source"
          count={missingCount}
        />
      </nav>

      {view === "pending" && products.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
            Activate approved drafts now
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Optional — confirmed items activate on the next hourly sync anyway.
            This triggers a sync immediately.
          </p>
          <TriggerSyncButton customerId={cid} />
        </section>
      )}

      {products.length === 0 ? (
        <div className="rounded-xl border border-slate-800 px-4 py-12 text-center text-slate-500">
          {copy.empty}
        </div>
      ) : (
        <PendingList customerId={cid} products={products} mode={view} />
      )}
    </div>
  );
}

function Segment({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
        active ? "bg-slate-100 text-slate-950" : "text-slate-300 hover:text-white"
      }`}
    >
      {label}
      <span
        className={`ml-2 rounded px-1.5 py-0.5 text-[11px] tabular-nums ${
          active ? "bg-slate-300 text-slate-900" : "bg-slate-800 text-slate-400"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
