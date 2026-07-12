import { and, asc, eq } from "drizzle-orm";

import { resolveCustomerScope } from "@/lib/auth-helpers";
import { customers, db, storeProducts } from "@/lib/db";
import type { Customer } from "@/lib/types";
import { TriggerSyncButton } from "../trigger-button";
import { PendingActions } from "./pending-actions";

export const dynamic = "force-dynamic";

type PendingProduct = {
  storeProductId: string | null;
  title: string | null;
  skus: string[];
  isNewCollection: boolean;
  needsReview: boolean;
  adminUrl: string | null;
};

export default async function PendingPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
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

  const rows = await db
    .select()
    .from(storeProducts)
    .where(
      and(
        eq(storeProducts.customerId, cid),
        eq(storeProducts.status, "draft"),
        eq(storeProducts.approved, false),
      ),
    )
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
  }
  const products = [...byProduct.values()];

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-slate-400">
            Pending new items
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Draft products awaiting your confirmation. Confirming marks them
            approved; the next sync activates them in Shopify.
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">{products.length}</div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            pending
          </div>
        </div>
      </section>

      {products.length > 0 && (
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
          No products pending review.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {products.map((p) => (
            <div
              key={p.storeProductId ?? p.skus[0]}
              className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-slate-100">
                  {p.title || <span className="text-slate-500">Untitled draft</span>}
                </h3>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {p.isNewCollection && (
                    <span className="rounded bg-sky-900/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-300">
                      ⚠️ New collection
                    </span>
                  )}
                  {p.needsReview && (
                    <span className="rounded bg-amber-900/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                      ⚠️ Needs review
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-400">
                <span className="uppercase tracking-wider text-slate-500">
                  {p.skus.length} variant{p.skus.length === 1 ? "" : "s"}
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.skus.map((sku) => (
                    <span
                      key={sku}
                      className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300"
                    >
                      {sku}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 pt-2">
                <PendingActions customerId={cid} storeProductId={p.storeProductId ?? ""} />
                {p.adminUrl && (
                  <a
                    href={p.adminUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-slate-800 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300 hover:bg-slate-700"
                  >
                    Review in Shopify
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
