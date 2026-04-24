// Bootstrap the users table: create the admin + the maxbaby customer user.
// Idempotent — safe to re-run. Passwords are read from env (DASHBOARD_ADMIN_PASSWORD,
// DASHBOARD_MAXBABY_PASSWORD). Prints the resolved emails + "(existing)" / "(new)".
import "dotenv/config";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

import { db, users } from "../lib/db";

async function upsertUser(opts: {
  email: string;
  password: string;
  role: "admin" | "customer";
  customerId: string | null;
}) {
  const [existing] = await db.select().from(users).where(eq(users.email, opts.email)).limit(1);
  const passwordHash = await hash(opts.password, 10);
  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        role: opts.role,
        customerId: opts.customerId,
        updatedAt: new Date(),
      })
      .where(eq(users.email, opts.email));
    return "updated";
  }
  await db.insert(users).values({
    id: randomBytes(8).toString("hex"),
    email: opts.email,
    passwordHash,
    role: opts.role,
    customerId: opts.customerId,
  });
  return "created";
}

async function main() {
  const adminEmail = process.env.DASHBOARD_ADMIN_EMAIL || "yehudashtein@gmail.com";
  const adminPw = process.env.DASHBOARD_ADMIN_PASSWORD;
  const eliEmail = process.env.DASHBOARD_MAXBABY_EMAIL || "Elishosh687@gmail.com";
  const eliPw = process.env.DASHBOARD_MAXBABY_PASSWORD;

  if (!adminPw) throw new Error("DASHBOARD_ADMIN_PASSWORD env required");
  if (!eliPw) throw new Error("DASHBOARD_MAXBABY_PASSWORD env required");

  const a = await upsertUser({ email: adminEmail, password: adminPw, role: "admin", customerId: null });
  console.log(`admin ${a}: ${adminEmail}`);

  const b = await upsertUser({ email: eliEmail, password: eliPw, role: "customer", customerId: "maxbaby" });
  console.log(`customer ${b}: ${eliEmail} → maxbaby`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
