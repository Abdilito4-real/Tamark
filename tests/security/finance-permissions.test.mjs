import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const auth = await readFile(new URL("../../src/lib/api-auth.ts", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../../src/app/api/admin/[...path]/route.ts", import.meta.url), "utf8");
const refundRoute = await readFile(new URL("../../src/app/api/admin/finance/refunds/route.ts", import.meta.url), "utf8");
const reconciliationRoute = await readFile(new URL("../../src/app/api/admin/finance/reconciliation/route.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../../supabase/security_financial_01_primitives.sql", import.meta.url), "utf8");
const cleanupMigration = await readFile(new URL("../../supabase/security_financial_05_admin_access.sql", import.meta.url), "utf8");

test("any active admin can access finance routes without an extra permission column", () => {
  assert.match(auth, /profile\.role !== "admin"/);
  assert.doesNotMatch(auth, /can_manage_finances|canManageFinances|getFinanceRequestContext/);
  assert.doesNotMatch(adminRoute, /canManageFinances|FINANCE_ACCESS_REQUIRED/);
  assert.match(refundRoute, /getAdminRequestContext/);
  assert.match(reconciliationRoute, /getAdminRequestContext/);
  assert.match(migration, /or \(select public\.current_user_is_admin\(\)\)/);
  assert.doesNotMatch(migration, /can_manage_finances|current_user_can_manage_finances/);
  assert.doesNotMatch(migration, /super_admin/);
});

test("legacy cleanup removes the extra finance flag and maps the legacy role to admin", () => {
  assert.match(cleanupMigration, /drop column if exists can_manage_finances/i);
  assert.match(cleanupMigration, /update public\.profiles set role = 'admin' where role = 'super_admin'/i);
  assert.match(cleanupMigration, /drop type public\.account_role/i);
  assert.match(cleanupMigration, /create type public\.account_role_admin_only as enum \('student', 'admin'\)/i);
  assert.match(cleanupMigration, /review dependencies before cleanup/i);
  assert.doesNotMatch(cleanupMigration, /cascade/i);
});

test("the role enum migration does not add a super-admin role", async () => {
  const enumMigration = await readFile(new URL("../../supabase/security_financial_00_enum_values.sql", import.meta.url), "utf8");
  assert.doesNotMatch(enumMigration, /account_role|super_admin/);
});
