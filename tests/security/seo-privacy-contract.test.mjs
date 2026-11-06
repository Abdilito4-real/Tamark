import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [seo, home, training, sitemap, robots, middleware, authCallback, consentModule, consentUi, layout] = await Promise.all([
  readSource("../../src/lib/seo.ts"),
  readSource("../../src/app/page.tsx"),
  readSource("../../src/app/training/[slug]/page.tsx"),
  readSource("../../src/app/sitemap.ts"),
  readSource("../../src/app/robots.ts"),
  readSource("../../src/middleware.ts"),
  readSource("../../src/app/auth/callback/route.ts"),
  readSource("../../src/lib/cookie-consent.ts"),
  readSource("../../src/components/cookie-consent.tsx"),
  readSource("../../src/app/layout.tsx"),
]);

test("public page metadata uses canonical URLs, descriptive social metadata, and explicit indexing", () => {
  assert.match(seo, /alternates:\s*\{\s*canonical\s*\}/);
  assert.match(seo, /robots:\s*\{\s*index:\s*indexable,\s*follow:\s*indexable\s*\}/);
  assert.match(seo, /openGraph:/);
  assert.match(seo, /twitter:/);
  assert.match(home, /title:\s*"Solar Energy Solutions and Training"/);
  assert.match(training, /indexable:\s*programme\.is_published === true && programme\.price_approved === true/);
  assert.match(training, /programme\.is_published && programme\.price_approved/);
});

test("production SEO requires the configured canonical origin instead of localhost", () => {
  const { outputText } = ts.transpileModule(seo, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const loadSeo = (env) => {
    const module = { exports: {} };
    runInNewContext(outputText, { module, exports: module.exports, process: { env }, URL });
    return module.exports;
  };
  assert.throws(() => loadSeo({ NODE_ENV: "production" }).getSiteOrigin(), /NEXT_PUBLIC_SITE_URL/);
  assert.throws(
    () => loadSeo({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).getSiteOrigin(),
    /public HTTP\(S\) origin/,
  );
  assert.equal(loadSeo({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://tamark.example/path" }).getSiteOrigin(), "https://tamark.example");
  assert.equal(loadSeo({ NODE_ENV: "development" }).getSiteOrigin(), "http://localhost:3000");
});

test("robots and sitemap expose only intended public URLs while private endpoints return noindex", async () => {
  assert.match(robots, /allow:\s*"\/"/);
  assert.match(robots, /disallow:\s*\["\/api\/",\s*"\/webhooks\/"\]/);
  assert.match(sitemap, /getPublishedProgrammes\(\)/);
  assert.match(sitemap, /getSiteUrl\("\/"\)/);
  assert.match(sitemap, /getSiteUrl\("\/training"\)/);
  assert.doesNotMatch(sitemap, /admin|student|apply|checkout|privacy-policy|cookie-policy/);
  assert.match(middleware, /X-Robots-Tag/);
  assert.match(middleware, /isSensitivePage/);
  assert.match(authCallback, /X-Robots-Tag/);
  for (const route of [
    "../../src/app/admin/[[...section]]/page.tsx",
    "../../src/app/student/[[...section]]/page.tsx",
    "../../src/app/sign-in/page.tsx",
    "../../src/app/sign-up/page.tsx",
    "../../src/app/reset-password/page.tsx",
    "../../src/app/apply/page.tsx",
    "../../src/app/checkout/[applicationId]/page.tsx",
    "../../src/app/checkout/confirmation/page.tsx",
    "../../src/app/access-denied/page.tsx",
  ]) {
    assert.match(await readSource(route), /indexable:\s*false/, route);
  }
});

test("cookie consent parser rejects invalid records and preserves default-deny categories", () => {
  const { outputText } = ts.transpileModule(consentModule, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  runInNewContext(outputText, { module, exports: module.exports });
  const { COOKIE_POLICY_VERSION, createCookieConsent, parseCookieConsent } = module.exports;

  assert.equal(parseCookieConsent(null), null);
  assert.equal(parseCookieConsent("{"), null);
  assert.equal(parseCookieConsent(JSON.stringify({ policyVersion: "old" })), null);
  const timestamp = "2026-11-06T12:00:00.000Z";
  const initial = createCookieConsent("rejected_optional", {
    analytics: false, functional: false, marketing: false,
  }, timestamp);
  assert.deepEqual(JSON.parse(JSON.stringify(initial)), {
    status: "rejected_optional",
    categories: { essential: true, analytics: false, functional: false, marketing: false },
    policyVersion: COOKIE_POLICY_VERSION,
    timestamp,
    updatedAt: timestamp,
  });
  assert.equal(parseCookieConsent(JSON.stringify(initial)).categories.essential, true);
  assert.equal(parseCookieConsent(JSON.stringify({ ...initial, categories: { ...initial.categories, analytics: "yes" } })), null);
  assert.equal(parseCookieConsent(JSON.stringify({
    ...initial,
    status: "accepted_all",
    categories: { ...initial.categories, analytics: true, functional: true, marketing: true },
  })).status, "accepted_all");
  assert.equal(parseCookieConsent(JSON.stringify({
    ...initial,
    status: "accepted_all",
    categories: { ...initial.categories, analytics: false, functional: true, marketing: true },
  })), null);

  const updated = createCookieConsent("customized", {
    analytics: true, functional: false, marketing: false,
  }, "2026-11-07T12:00:00.000Z", timestamp);
  assert.equal(updated.timestamp, timestamp);
  assert.equal(updated.updatedAt, "2026-11-07T12:00:00.000Z");
  assert.equal(parseCookieConsent(JSON.stringify(updated)).categories.analytics, true);
});

test("consent failures are surfaced and no analytics/marketing vendor is loaded without approved integration", () => {
  assert.match(consentUi, /Could not read cookie preferences/);
  assert.match(consentUi, /Could not save cookie preferences/);
  assert.match(consentUi, /role="alert"/);
  assert.match(consentUi, /setAnalyticsConsent|data\.analyticsConsent|dataset\.analyticsConsent/);
  assert.doesNotMatch(`${layout}\n${consentUi}`, /GoogleAnalytics|GoogleTagManager|gtag\(|googletagmanager\.com|google-analytics\.com/i);
});
