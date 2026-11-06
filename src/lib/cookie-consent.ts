export const COOKIE_CONSENT_STORAGE_KEY = "tamark-cookie-consent-v1";
export const COOKIE_POLICY_VERSION = "2026-11-draft-1";

export type ConsentCategories = {
  essential: true;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
};

export type CookieConsent = {
  status: "accepted_all" | "rejected_optional" | "customized";
  categories: ConsentCategories;
  policyVersion: string;
  timestamp: string;
  updatedAt: string;
};

export function parseCookieConsent(value: string | null): CookieConsent | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const categories = record.categories;
    if (typeof categories !== "object" || categories === null) return null;
    const selected = categories as Record<string, unknown>;
    const allOptionalEnabled = selected.analytics === true && selected.functional === true && selected.marketing === true;
    const allOptionalDisabled = selected.analytics === false && selected.functional === false && selected.marketing === false;
    if (record.policyVersion !== COOKIE_POLICY_VERSION ||
        !["accepted_all", "rejected_optional", "customized"].includes(String(record.status)) ||
        (record.status === "accepted_all" && !allOptionalEnabled) ||
        (record.status === "rejected_optional" && !allOptionalDisabled) ||
        selected.essential !== true ||
        typeof selected.analytics !== "boolean" ||
        typeof selected.functional !== "boolean" ||
        typeof selected.marketing !== "boolean" ||
        typeof record.timestamp !== "string" ||
        !Number.isFinite(Date.parse(record.timestamp)) ||
        typeof record.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(record.updatedAt))) {
      return null;
    }
    return {
      status: record.status as CookieConsent["status"],
      categories: {
        essential: true,
        analytics: selected.analytics,
        functional: selected.functional,
        marketing: selected.marketing,
      },
      policyVersion: COOKIE_POLICY_VERSION,
      timestamp: record.timestamp,
      updatedAt: record.updatedAt,
    };
  } catch {
    return null;
  }
}

export function createCookieConsent(
  status: CookieConsent["status"],
  categories: Omit<ConsentCategories, "essential">,
  now = new Date().toISOString(),
  timestamp = now,
): CookieConsent {
  return {
    status,
    categories: { essential: true, ...categories },
    policyVersion: COOKIE_POLICY_VERSION,
    timestamp,
    updatedAt: now,
  };
}
