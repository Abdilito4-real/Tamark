import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../../supabase/security_financial_06_whatsapp_applications.sql", import.meta.url), "utf8");
const removalMigration = await readFile(new URL("../../supabase/security_financial_08_remove_payments.sql", import.meta.url), "utf8");
const appRoute = await readFile(new URL("../../src/app/api/applications/route.ts", import.meta.url), "utf8");
const wizard = await readFile(new URL("../../src/components/application-wizard.tsx", import.meta.url), "utf8");
const guestAppRoute = await readFile(new URL("../../src/app/api/applications/guest/route.ts", import.meta.url), "utf8");

test("application eligibility is payment-free and WhatsApp opens only after submit succeeds", () => {
  assert.match(migration, /where p\.id = p_programme_id and p\.is_published/);
  assert.doesNotMatch(migration, /price_approved|price_minor|payment_status/);
  assert.match(appRoute, /This programme is not currently open for applications/);
  assert.match(wizard, /initialFirstName/);
  assert.match(wizard, /initialEmail/);
  assert.match(wizard, /initialPhone/);
  assert.match(wizard, /window\.location\.assign\(applicationResult\.whatsappUrl\)/);
  assert.match(guestAppRoute, /application\.application_reference/);
  assert.match(guestAppRoute, /from\("organization_settings"\)[\s\S]*select\("whatsapp_phone"\)/);
  assert.match(wizard, /No payment is collected through this website/);
});

test("payment purge removes persisted financial records and fee dependencies without cascading", () => {
  assert.match(removalMigration, /drop table if exists public\.refunds/i);
  assert.match(removalMigration, /drop table if exists public\.payments/i);
  assert.match(removalMigration, /delete from public\.audit_logs[\s\S]*payment\.%[\s\S]*refund\.%/i);
  assert.match(removalMigration, /drop column if exists price_minor/i);
  assert.doesNotMatch(removalMigration, /cascade/i);
});

test("new programme and application policies no longer depend on fee columns", () => {
  assert.match(migration, /drop policy if exists "Listed programmes and published programmes are public"/);
  assert.match(migration, /using \(is_listed or is_published/);
  assert.doesNotMatch(migration, /price_approved|price_minor/);
});
