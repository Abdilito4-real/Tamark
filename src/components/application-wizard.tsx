"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Programme } from "@/lib/programmes";
import { EmptyState, Notice } from "@/components/ui";
import { isPastIsoDate } from "@/lib/validation";
import { BrandMark } from "@/components/brand-mark";

const STORAGE_KEY = "tamark-application-draft-v1";
const steps = ["Personal information", "Contact information", "Programme", "Review", "Payment"];
type Draft = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  programmeId: string;
};
type ServerDraft = {
  id: string;
  updated_at: string;
  personal_details: Record<string, unknown> | null;
  contact_details: Record<string, unknown> | null;
};
const emptyDraft: Draft = {
  firstName: "", lastName: "", dateOfBirth: "", gender: "",
  email: "", phone: "", address: "",
  programmeId: "",
};

function currency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(amount / 100);
}

export function ApplicationWizard({
  programmes,
  defaultSlug,
  initialEmail,
}: {
  programmes: Programme[];
  defaultSlug?: string;
  initialEmail: string;
}) {
  const [form, setForm] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [serverUpdatedAt, setServerUpdatedAt] = useState("");
  const [serverConflict, setServerConflict] = useState<ServerDraft | null>(null);

  useEffect(() => {
    try {
      const savedDraft = window.localStorage.getItem(STORAGE_KEY);
      const parsed = savedDraft ? JSON.parse(savedDraft) as Partial<Draft> & { applicationId?: unknown; serverUpdatedAt?: unknown } : {};
      const slugProgramme = programmes.find((programme) => programme.slug === defaultSlug);
      const savedText = (value: unknown) => typeof value === "string" ? value : "";
      setForm({
        firstName: savedText(parsed.firstName),
        lastName: savedText(parsed.lastName),
        dateOfBirth: savedText(parsed.dateOfBirth),
        gender: savedText(parsed.gender),
        email: savedText(parsed.email) || initialEmail,
        phone: savedText(parsed.phone).replace(/\D/g, "").slice(0, 15),
        address: savedText(parsed.address),
        programmeId: savedText(parsed.programmeId) || slugProgramme?.id || "",
      });
      if (typeof parsed.applicationId === "string" && typeof parsed.serverUpdatedAt === "string") {
        setApplicationId(parsed.applicationId);
        setServerUpdatedAt(parsed.serverUpdatedAt);
      }
      setLoaded(true);
    } catch {
      setError("Your saved draft could not be read. Clear this site's saved application data and try again.");
      setLoaded(true);
    }
  }, [defaultSlug, initialEmail, programmes]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, applicationId, serverUpdatedAt }));
      setSaved(true);
    } catch {
      setSaved(false);
      setError("Draft autosave is unavailable in this browser. Keep this page open while completing the application.");
    }
  }, [applicationId, form, loaded, serverUpdatedAt]);

  const selectedProgramme = useMemo(() => programmes.find((item) => item.id === form.programmeId), [form.programmeId, programmes]);
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "programmeId") {
      setApplicationId("");
      setServerUpdatedAt("");
      setServerConflict(null);
    }
    setError("");
  }
  function loadLatestDraft(draft: ServerDraft) {
    const text = (value: unknown) => typeof value === "string" ? value : "";
    setForm((current) => ({
      firstName: text(draft.personal_details?.firstName),
      lastName: text(draft.personal_details?.lastName),
      dateOfBirth: text(draft.personal_details?.dateOfBirth),
      gender: text(draft.personal_details?.gender),
      email: text(draft.contact_details?.email),
      phone: text(draft.contact_details?.phone),
      address: text(draft.contact_details?.address),
      programmeId: current.programmeId,
    }));
    setApplicationId(draft.id);
    setServerUpdatedAt(draft.updated_at);
    setServerConflict(null);
    setError("");
  }
  function validStep() {
    const validName = (name: string) => /^[\p{L}\p{M}][\p{L}\p{M}'’ -]{0,79}$/u.test(name.trim());
    if (step === 0 && (!validName(form.firstName) || !validName(form.lastName) || !isPastIsoDate(form.dateOfBirth) || !["Female", "Male", "Prefer not to say"].includes(form.gender))) {
      return "Enter valid names, a past date of birth, and select a gender option.";
    }
    if (step === 1 && (!/^\S+@\S+\.\S+$/.test(form.email.trim()) || !/^\d{7,15}$/.test(form.phone) || form.address.length > 300)) {
      return "Enter a valid email and a phone number containing 7–15 digits only.";
    }
    if (step === 2 && !selectedProgramme) return "Select an available programme.";
    if (step === 3 && !selectedProgramme) return "Select an available programme before continuing.";
    return "";
  }
  function next() {
    const validation = validStep();
    if (validation) { setError(validation); return; }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }
  async function beginPayment() {
    if (!selectedProgramme) {
      setError("Select an available programme before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const applicationResponse = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programmeId: selectedProgramme.id,
          personalDetails: { firstName: form.firstName, lastName: form.lastName, dateOfBirth: form.dateOfBirth, gender: form.gender },
          contactDetails: { email: form.email.trim(), phone: form.phone, address: form.address.trim() },
          ...(applicationId && serverUpdatedAt ? { applicationId, expectedUpdatedAt: serverUpdatedAt } : {}),
        }),
      });
      const applicationResult = await applicationResponse.json() as {
        applicationId?: string;
        updatedAt?: string;
        currentDraft?: ServerDraft;
        error?: string;
      };
      if (!applicationResponse.ok || !applicationResult.applicationId || !applicationResult.updatedAt) {
        if (applicationResponse.status === 409 && applicationResult.currentDraft) {
          setServerConflict(applicationResult.currentDraft);
          setError("");
          return;
        }
        throw new Error(applicationResult.error || "Could not save your application.");
      }
      const currentApplicationId = applicationResult.applicationId;
      setApplicationId(currentApplicationId);
      setServerUpdatedAt(applicationResult.updatedAt);

      const paymentResponse = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: currentApplicationId }),
      });
      const paymentResult = await paymentResponse.json() as { authorizationUrl?: string; error?: string };
      if (!paymentResponse.ok || !paymentResult.authorizationUrl) throw new Error(paymentResult.error || "Could not initialize payment.");

      window.localStorage.removeItem(STORAGE_KEY);
      window.location.assign(paymentResult.authorizationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Application could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wizard-layout">
      <aside className="wizard-aside">
        <Link className="brand" href="/"><BrandMark /><span>TAMARK<small style={{ color: "#b9cbc3" }}>APPLICATION</small></span></Link>
        <nav className="wizard-steps" aria-label="Application progress">
          {steps.map((label, index) => <div className={`wizard-step ${step === index ? "active" : ""} ${step > index ? "complete" : ""}`} aria-current={step === index ? "step" : undefined} key={label}><span>{step > index ? <Check size={15} /> : index + 1}</span><span>{label}</span></div>)}
        </nav>
      </aside>
      <main className="wizard-main">
        <p className="eyebrow">APPLICATION · STEP {step + 1} OF {steps.length}</p>
        <h1>{steps[step]}</h1>
        <p>Your progress is saved in this browser. No information is pre-filled.</p>
        {saved && <p className="muted" aria-live="polite" style={{ fontSize: 11 }}>Draft autosaved on this device.</p>}
        {serverConflict && <>
          <Notice title="A newer server draft was found">Your current entries remain saved on this device. Load the latest server version before continuing.</Notice>
          <button className="button button-outline button-small" type="button" onClick={() => loadLatestDraft(serverConflict)}>Load latest saved draft</button>
        </>}

        {step === 0 && <div className="form-card">
          <div className="form-row">
            <Field label="First name" value={form.firstName} onChange={(value) => update("firstName", value)} autoComplete="given-name" maxLength={80} required />
            <Field label="Last name" value={form.lastName} onChange={(value) => update("lastName", value)} autoComplete="family-name" maxLength={80} required />
          </div>
          <div className="form-row">
            <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => update("dateOfBirth", value)} required />
            <label className="field">Gender<select value={form.gender} onChange={(event) => update("gender", event.target.value)} required><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>
          </div>
        </div>}
        {step === 1 && <div className="form-card">
          <Field label="Email address" type="email" autoComplete="email" value={form.email} onChange={(value) => update("email", value.trim())} maxLength={254} required />
          <div className="form-row"><Field label="Phone number" type="text" autoComplete="tel-national" value={form.phone} onChange={(value) => update("phone", value.replace(/\D/g, "").slice(0, 15))} inputMode="numeric" pattern="[0-9]{7,15}" maxLength={15} required /><Field label="Address" autoComplete="street-address" value={form.address} onChange={(value) => update("address", value)} maxLength={300} /></div>
        </div>}
        {step === 2 && <div className="form-card">
          {programmes.length ? <label className="field">Training programme<select value={form.programmeId} onChange={(event) => update("programmeId", event.target.value)} required><option value="">Select a programme</option>{programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.name}</option>)}</select></label> : <EmptyState title="No programmes are open">You can continue after Tamark publishes a training programme.</EmptyState>}
          {selectedProgramme && <div className="checkout-summary"><strong>{selectedProgramme.name}</strong><p className="muted" style={{ margin: "5px 0 0", fontSize: 12 }}>{selectedProgramme.summary}</p></div>}
        </div>}
        {step === 3 && <div className="form-card">
          <h2 style={{ fontSize: 18 }}>Review your details</h2>
          <Summary label="Name" value={`${form.firstName} ${form.lastName}`} />
          <Summary label="Email" value={form.email} />
          <Summary label="Phone" value={form.phone} />
          <Summary label="Programme" value={selectedProgramme?.name ?? "Not selected"} />
          <Notice title="Your application is not submitted yet">Payment must be verified before your application is submitted.</Notice>
        </div>}
        {step === 4 && <div className="form-card">
          <h2 style={{ fontSize: 18 }}>Secure payment</h2>
          <p className="muted">Payment amount is set by Tamark. Prices are not displayed until an approved programme fee is available.</p>
          {selectedProgramme && <div className="checkout-summary">
            <Summary label="Programme" value={selectedProgramme.name} />
            <Summary label="Programme fee" value={selectedProgramme.price_minor == null ? "Not yet approved" : currency(selectedProgramme.price_minor, selectedProgramme.currency)} />
          </div>}
          <Notice title="Verified payment required">You will be redirected to Paystack. Your application will only be submitted after the transaction is verified.</Notice>
          <button className="button button-primary" type="button" disabled={busy || Boolean(serverConflict) || !selectedProgramme || selectedProgramme.price_minor == null || selectedProgramme.price_minor <= 0} onClick={beginPayment}>{busy ? "Starting secure checkout…" : "Continue to secure payment"} <ChevronRight size={17} /></button>
        </div>}

        {error && <p className="wizard-error" role="alert">{error}</p>}
        {step < 4 && <div className="wizard-actions">
          <button className="button button-outline" type="button" onClick={() => { setError(""); setStep((current) => Math.max(0, current - 1)); }} disabled={step === 0}><ChevronLeft size={17} /> Previous</button>
          <button className="button button-primary" type="button" onClick={next}>Continue <ChevronRight size={17} /></button>
        </div>}
        {step === 4 && <div className="wizard-actions"><button className="button button-outline" type="button" onClick={() => { setError(""); setStep(3); }}><ChevronLeft size={17} /> Previous</button></div>}
      </main>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete, required = false, inputMode, pattern, maxLength }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; required?: boolean;
  inputMode?: "numeric" | "text"; pattern?: string; maxLength?: number;
}) {
  return <label className="field">{label}{required && <span aria-hidden="true"> *</span>}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required={required} inputMode={inputMode} pattern={pattern} maxLength={maxLength} /></label>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="summary-row"><span>{label}</span><strong>{value || "—"}</strong></div>;
}
