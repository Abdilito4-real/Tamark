import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [galleryAdmin, galleryItemAdmin, certificateAdmin, certificateDownload, studentApi, galleryData, migration, dashboardManager, toastProvider, rootLayout, styles, passwordField, authForm, passwordReset] = await Promise.all([
  read("../../src/app/api/admin/gallery/route.ts"),
  read("../../src/app/api/admin/gallery/[id]/route.ts"),
  read("../../src/app/api/admin/certificates/route.ts"),
  read("../../src/app/api/student/certificates/[id]/route.ts"),
  read("../../src/app/api/student/[...path]/route.ts"),
  read("../../src/lib/gallery.ts"),
  read("../../supabase/media_07_gallery_certificates.sql"),
  read("../../src/components/dashboard-manager.tsx"),
  read("../../src/components/toast-provider.tsx"),
  read("../../src/app/layout.tsx"),
  read("../../src/app/globals.css"),
  read("../../src/components/password-field.tsx"),
  read("../../src/components/auth-form.tsx"),
  read("../../src/components/password-reset-form.tsx"),
]);

test("gallery writes require an admin and validate image type, signature, and size", () => {
  assert.match(galleryAdmin, /getAdminRequestContext/);
  assert.match(galleryAdmin, /file\.size > 5 \* 1024 \* 1024/);
  assert.match(galleryAdmin, /isValidImage\(bytes, file\.type/);
  assert.match(galleryItemAdmin, /getAdminRequestContext/);
  assert.match(galleryData, /\.eq\("is_published", true\)/);
  assert.match(migration, /\('tamark-gallery', 'tamark-gallery', true, 5242880/);
  assert.match(galleryAdmin, /Gallery storage bucket is missing/);
  assert.match(galleryAdmin, /Gallery database schema is missing/);
});

test("gallery upload shows the selected image in a preview box without metadata placeholders", () => {
  const uploader = dashboardManager.slice(dashboardManager.indexOf("function GalleryManager"), dashboardManager.indexOf("function GalleryItemEditor"));
  assert.match(uploader, /gallery-upload-box/);
  assert.match(uploader, /gallery-upload-preview/);
  assert.match(uploader, /URL\.createObjectURL\(image\)/);
  assert.match(uploader, /form\.set\("title", title\.slice\(0, 160\)\)/);
  assert.doesNotMatch(uploader, /Image title and alt text|Display order|Publish on public homepage/);
});

test("admin gallery items render as a single-column accessible list on desktop and mobile", () => {
  assert.match(dashboardManager, /gallery-admin-list" role="list"/);
  assert.match(dashboardManager, /gallery-admin-card" role="listitem"/);
  assert.match(styles, /\.gallery-admin-list\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.gallery-admin-card\s*\{[^}]*grid-template-areas:\s*"image title"/);
  const mobileStyles = styles.slice(styles.indexOf("@media (max-width: 600px)"));
  assert.match(mobileStyles, /\.gallery-admin-card\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("WhatsApp settings prefill Nigeria's country code when no destination is saved", () => {
  const settings = dashboardManager.slice(dashboardManager.indexOf("function SettingsManager"), dashboardManager.indexOf("function AdminSummary"));
  assert.match(settings, /value\?\.whatsapp_phone \|\| "\+234"/);
  assert.match(settings, /Nigeria’s \+234 country code is prefilled/);
  assert.match(settings, /whatsapp_phone: whatsappPhone/);
});

test("global toast feedback is accessible, dismissible, timed, and used by gallery actions", () => {
  assert.match(rootLayout, /<ToastProvider>/);
  assert.match(toastProvider, /role=\{kind === "error" \? "alert" : "status"\}/);
  assert.match(toastProvider, /aria-label="Dismiss notification"/);
  assert.match(toastProvider, /clearTimeout/);
  assert.match(dashboardManager, /title: "Image uploaded"/);
  assert.match(dashboardManager, /title: "Could not save changes"/);
  assert.match(dashboardManager, /title: "Photo deleted"/);
});

test("password visibility controls are accessible and authentication flows require eight characters", () => {
  assert.match(passwordField, /type=\{visible \? "text" : "password"\}/);
  assert.match(passwordField, /aria-label=\{`\$\{visible \? "Hide" : "Show"\}/);
  assert.match(passwordField, /aria-pressed=\{visible\}/);
  assert.match(authForm, /<PasswordField label="Password"/);
  assert.match(authForm, /minLength=\{signUp \? 8 : undefined\}/);
  assert.match(authForm, /Use at least 8 characters/);
  assert.match(passwordReset, /<PasswordField label="New password"/);
  assert.match(passwordReset, /<PasswordField label="Confirm new password"/);
  assert.match(passwordReset, /password\.length < 8/);
  assert.match(passwordReset, /minLength=\{8\}/);
  assert.match(dashboardManager, /<PasswordField label="Confirm new password"/);
  assert.match(styles, /\.password-visibility-toggle/);
});

test("certificates are private, admin-issued PDFs, and downloads are student-owned", () => {
  assert.match(certificateAdmin, /getAdminRequestContext/);
  assert.match(certificateAdmin, /file\.type !== "application\/pdf"/);
  assert.match(certificateAdmin, /String\.fromCharCode\(\.\.\.bytes\.slice\(0, 5\)\) !== "%PDF-"/);
  assert.match(certificateAdmin, /from\("student-certificates"\)\.upload/);
  assert.match(certificateAdmin, /from\("notifications"\)\.insert/);
  assert.match(certificateDownload, /\.eq\("student_id", context\.user\.id\)/);
  assert.match(certificateDownload, /createSignedUrl\(data\.storage_path, 120/);
  assert.match(studentApi, /\.eq\("student_id", context\.user\.id\)/);
  assert.match(migration, /\('student-certificates', 'student-certificates', false/);
});
