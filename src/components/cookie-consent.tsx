"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  createCookieConsent,
  parseCookieConsent,
  type ConsentCategories,
  type CookieConsent as CookieConsentRecord,
} from "@/lib/cookie-consent";

type ConsentContextValue = {
  consent: CookieConsentRecord | null;
  ready: boolean;
};

const ConsentContext = createContext<ConsentContextValue>({ consent: null, ready: false });

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [saveError, setSaveError] = useState("");
  const preferencesRef = useRef<HTMLElement | null>(null);
  const [draft, setDraft] = useState<Omit<ConsentCategories, "essential">>({
    analytics: false,
    functional: false,
    marketing: false,
  });

  useEffect(() => {
    try {
      const stored = parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
      setConsent(stored);
      if (stored) {
        setDraft({
          analytics: stored.categories.analytics,
          functional: stored.categories.functional,
          marketing: stored.categories.marketing,
        });
      }
    } catch (reason) {
      console.error("Could not read cookie preferences:", reason);
      setSaveError("Your saved privacy choice could not be read from this browser.");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!preferencesOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = preferencesRef.current;
    const getFocusable = () => dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? [];
    getFocusable()[0]?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreferencesOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [preferencesOpen]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.cookieConsent = consent ? "saved" : "pending";
    document.documentElement.dataset.analyticsConsent = consent?.categories.analytics ? "granted" : "denied";
  }, [consent, ready]);

  useEffect(() => {
    function openPreferences() {
      setDraft({
        analytics: consent?.categories.analytics ?? false,
        functional: consent?.categories.functional ?? false,
        marketing: consent?.categories.marketing ?? false,
      });
      setPreferencesOpen(true);
    }
    window.addEventListener("tamark:open-cookie-preferences", openPreferences);
    return () => window.removeEventListener("tamark:open-cookie-preferences", openPreferences);
  }, [consent]);

  const save = useCallback((status: CookieConsentRecord["status"], categories: Omit<ConsentCategories, "essential">) => {
    const next = createCookieConsent(status, categories, new Date().toISOString(), consent?.timestamp);
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch (reason) {
      console.error("Could not save cookie preferences:", reason);
      setSaveError("Your choice could not be saved in this browser. Check storage settings and try again.");
      return false;
    }
    setSaveError("");
    setConsent(next);
    setDraft(categories);
    setPreferencesOpen(false);
    return true;
  }, [consent?.timestamp]);

  const contextValue = useMemo(() => ({ consent, ready }), [consent, ready]);
  return (
    <ConsentContext.Provider value={contextValue}>
      {children}
      {ready && !consent && !preferencesOpen && <section className="cookie-consent-banner" aria-labelledby="cookie-consent-title">
        <div className="cookie-consent-copy">
          <strong id="cookie-consent-title">Your privacy matters to us</strong>
          <p>Tamark uses essential technologies to keep this website working. Optional analytics and other technologies remain off unless you choose to enable them.</p>
          {saveError && <p className="wizard-error" role="alert">{saveError}</p>}
          <p className="cookie-consent-links"><Link href="/privacy-policy">Privacy Policy</Link><Link href="/cookie-policy">Cookie Policy</Link></p>
        </div>
        <div className="cookie-consent-actions">
          <button type="button" className="button button-outline button-small" onClick={() => save("accepted_all", { analytics: true, functional: true, marketing: true })}>Accept all</button>
          <button type="button" className="button button-outline button-small" onClick={() => save("rejected_optional", { analytics: false, functional: false, marketing: false })}>Reject optional</button>
          <button type="button" className="button button-outline button-small" onClick={() => {
            setDraft({ analytics: false, functional: false, marketing: false });
            setPreferencesOpen(true);
          }}>Customize preferences</button>
        </div>
      </section>}
      {ready && preferencesOpen && <div className="cookie-preferences-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setPreferencesOpen(false);
      }}>
        <section className="cookie-preferences" ref={preferencesRef} role="dialog" aria-modal="true" aria-labelledby="cookie-preferences-title">
          <div className="cookie-preferences-heading">
            <div><p className="eyebrow">PRIVACY SETTINGS</p><h2 id="cookie-preferences-title">Cookie preferences</h2></div>
            <button type="button" className="mobile-drawer-close" aria-label="Close cookie preferences" onClick={() => setPreferencesOpen(false)}>×</button>
          </div>
          <p className="muted">Choose which optional technologies you allow. Your choice is saved on this device and can be changed at any time.</p>
          {saveError && <p className="wizard-error" role="alert">{saveError}</p>}
          <div className="cookie-category">
            <div><strong>Essential</strong><p>Required for core site, account security and session functionality. Always active.</p></div>
            <input type="checkbox" checked disabled aria-label="Essential cookies always active" />
          </div>
          {([
            ["analytics", "Analytics", "Helps understand public-site usage. No analytics service is currently enabled."],
            ["functional", "Functional", "Remembers optional convenience preferences where supported."],
            ["marketing", "Marketing", "Would support relevant marketing technologies. None are currently enabled."],
          ] as const).map(([key, label, description]) => <label className="cookie-category" key={key}>
            <span><strong>{label}</strong><span>{description}</span></span>
            <input type="checkbox" checked={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))} aria-label={`Allow ${label.toLowerCase()} technologies`} />
          </label>)}
          <div className="cookie-preferences-actions">
            <button type="button" className="button button-outline" onClick={() => save("rejected_optional", { analytics: false, functional: false, marketing: false })}>Reject optional</button>
            <button type="button" className="button button-outline" onClick={() => {
              const acceptedAll = draft.analytics && draft.functional && draft.marketing;
              save(acceptedAll ? "accepted_all" : "customized", draft);
            }}>Save preferences</button>
          </div>
        </section>
      </div>}
    </ConsentContext.Provider>
  );
}

export function useCookieConsent() {
  return useContext(ConsentContext);
}

export function CookiePreferencesLink() {
  return <button className="cookie-preferences-link" type="button" onClick={() => window.dispatchEvent(new Event("tamark:open-cookie-preferences"))}>Cookie Preferences</button>;
}
