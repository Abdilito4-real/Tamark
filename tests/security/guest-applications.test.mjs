import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [applyPage, wizard, route, migration, adminRoute, middleware] = await Promise.all([
  read("../../src/app/apply/page.tsx"),
  read("../../src/components/application-wizard.tsx"),
  read("../../src/app/api/applications/guest/route.ts"),
  read("../../supabase/security_financial_09_guest_applications.sql"),
  read("../../src/app/api/admin/[...path]/route.ts"),
  read("../../src/middleware.ts"),
]);

test("the public application page does not require sign-up or a student session", () => {
  assert.doesNotMatch(applyPage, /redirect\(`\/sign-up/);
  assert.doesNotMatch(applyPage, /if \(!user\)/);
  assert.match(applyPage, /if \(user && supabase\)/);
  assert.match(wizard, /You can apply without an account/);
});

test("guest submissions validate input, rate-limit requests, and resolve WhatsApp from the database", () => {
  assert.match(route, /consumeRateLimit\(`guest-application:/);
  assert.match(route, /guest-application-email:/);
  assert.match(route, /isPastIsoDate/);
  assert.match(route, /from\("programmes"\)[\s\S]*eq\("is_published", true\)/);
  assert.match(route, /from\("organization_settings"\)[\s\S]*select\("whatsapp_phone"\)/);
  assert.match(route, /https:\/\/wa\.me\/\$\{whatsappDigits\}/);
  assert.doesNotMatch(route, /getStudentRequestContext/);
  assert.match(wizard, /\/api\/applications\/guest/);
  assert.doesNotMatch(wizard, /whatsappPhone/);
});

test("public application retries are idempotent and do not expose anonymous database access", () => {
  assert.match(migration, /alter column student_id drop not null/);
  assert.match(migration, /public_submission_key uuid/);
  assert.match(migration, /unique index[\s\S]*public_submission_key/);
  assert.match(migration, /student_id is not null or status <> 'draft'/);
  assert.match(route, /eq\("public_submission_key", body\.idempotencyKey\)/);
  assert.match(route, /This submission key was already used for different application details/);
  assert.match(route, /existingError\.code === "42703"[\s\S]*security_financial_09_guest_applications\.sql/);
  assert.match(route, /writeAuditLog\([\s\S]*application\.guest_submitted/);
  assert.doesNotMatch(migration, /to anon|grant .*applications/i);
});

test("guest application review skips student-only notifications and mutations stay same-origin", () => {
  assert.match(adminRoute, /if \(application\?\.student_id\)/);
  assert.match(middleware, /originUrl\.origin !== request\.nextUrl\.origin/);
});
