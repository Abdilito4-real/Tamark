import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = await readFile(
  new URL("../../supabase/security_financial_03_concurrency.sql", import.meta.url),
  "utf8",
);
const draftMigration = await readFile(
  new URL("../../supabase/security_financial_04_draft_concurrency.sql", import.meta.url),
  "utf8",
);
const adminRoute = await readFile(
  new URL("../../src/app/api/admin/[...path]/route.ts", import.meta.url),
  "utf8",
);
const applicationsRoute = await readFile(
  new URL("../../src/app/api/applications/route.ts", import.meta.url),
  "utf8",
);
const dashboard = await readFile(
  new URL("../../src/components/dashboard-manager.tsx", import.meta.url),
  "utf8",
);
const applicationWizard = await readFile(
  new URL("../../src/components/application-wizard.tsx", import.meta.url),
  "utf8",
);

test("repeated paid-application submission returns its existing reference under a row lock", () => {
  assert.match(migration, /where a\.id = p_application_id and a\.student_id = owner_id\s+for update/i);
  assert.match(
    migration,
    /current_status in \('submitted', 'under_review', 'approved', 'rejected'\)\s+and current_reference is not null then\s+return query select p_application_id, current_reference/i,
  );
  assert.match(migration, /if not exists \([\s\S]*p\.status = 'successful'[\s\S]*\) then raise exception/i);
  assert.match(migration, /perform public\.write_audit_log\([\s\S]*'application\.submitted'/i);
});

test("administrator decisions require and compare the record version", () => {
  assert.match(adminRoute, /select\("id,status,created_at,updated_at,submitted_at/);
  assert.match(adminRoute, /typeof expectedUpdatedAt !== "string" \|\| !Number\.isFinite\(Date\.parse\(expectedUpdatedAt\)\)/);
  assert.match(adminRoute, /\.eq\("updated_at", expectedUpdatedAt\)/);
  assert.match(adminRoute, /This application changed after you loaded it/);
  assert.match(dashboard, /status, expectedUpdatedAt/);
  assert.match(dashboard, /String\(row\.updated_at\)/);
});

test("application draft writes use optimistic versions and preserve conflicting server data", () => {
  assert.match(draftMigration, /p_expected_updated_at timestamptz/);
  assert.match(draftMigration, /application_row\.updated_at is distinct from p_expected_updated_at/i);
  assert.match(draftMigration, /errcode = '40001'[\s\S]*Application draft changed/i);
  assert.match(draftMigration, /updated_at = clock_timestamp\(\)/i);
  assert.match(draftMigration, /revoke all on function public\.save_student_application\(uuid, jsonb, jsonb, uuid, timestamptz\)/i);
  assert.match(applicationsRoute, /p_expected_updated_at: expectedUpdatedAt \?\? null/);
  assert.match(applicationsRoute, /\.eq\("student_id", user\.id\)[\s\S]*\.eq\("programme_id", body\.programmeId\)/);
  assert.match(applicationsRoute, /currentDraft,\s*\}, \{ status: 409 \}\)/);
  assert.match(applicationWizard, /expectedUpdatedAt: serverUpdatedAt/);
  assert.match(applicationWizard, /Load latest saved draft/);
});
