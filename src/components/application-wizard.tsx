"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Programme } from "@/lib/programmes";
import { EmptyState, Notice } from "@/components/ui";
import { isPastIsoDate } from "@/lib/validation";
import { BrandMark } from "@/components/brand-mark";

const STORAGE_KEY = "tamark-application-draft-v1";
const SUBMISSION_KEY_STORAGE_KEY = "tamark-application-submission-key-v1";
const steps = ["Personal information", "Contact information", "Programme", "Review & send"];
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
const emptyDraft: Draft = {
  firstName: "", lastName: "", dateOfBirth: "", gender: "",
  email: "", phone: "", address: "",
  programmeId: "",
};

export function ApplicationWizard({
  programmes,
  defaultSlug,
  initialEmail,
  initialFirstName,
  initialLastName,
  initialPhone,
}: {
  programmes: Programme[];
  defaultSlug?: string;
  initialEmail: string;
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
}) {
  const [form, setForm] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const savedDraft = window.localStorage.getItem(STORAGE_KEY);
      const parsed = savedDraft ? JSON.parse(savedDraft) as Partial<Draft> : {};
      const slugProgramme = programmes.find((programme) => programme.slug === defaultSlug);
      const savedText = (value: unknown) => typeof value === "string" ? value : "";
      setForm({
        firstName: savedText(parsed.firstName) || initialFirstName,
        lastName: savedText(parsed.lastName) || initialLastName,
        dateOfBirth: savedText(parsed.dateOfBirth),
        gender: savedText(parsed.gender),
        email: savedText(parsed.email) || initialEmail,
        phone: savedText(parsed.phone).replace(/\D/g, "").slice(0, 15) || initialPhone.replace(/\D/g, "").slice(0, 15),
        address: savedText(parsed.address),
        programmeId: savedText(parsed.programmeId) || slugProgramme?.id || "",
      });
      setLoaded(true);
    } catch {
      setError("Your saved draft could not be read. Clear this site's saved application data and try again.");
      setLoaded(true);
    }
  }, [defaultSlug, initialEmail, initialFirstName, initialLastName, initialPhone, programmes]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      setSaved(true);
    } catch {
      setSaved(false);
      setError("Draft autosave is unavailable in this browser. Keep this page open while completing the application.");
    }
  }, [form, loaded]);

  const selectedProgramme = useMemo(() => programmes.find((item) => item.id === form.programmeId), [form.programmeId, programmes]);
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
  async function submitApplication() {
    if (!selectedProgramme) {
      setError("Select an available programme before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify({
        programmeId: selectedProgramme.id,
        personalDetails: { firstName: form.firstName.trim(), lastName: form.lastName.trim(), dateOfBirth: form.dateOfBirth, gender: form.gender },
        contactDetails: { email: form.email.trim(), phone: form.phone, address: form.address.trim() },
      });
      const savedSubmission = window.localStorage.getItem(SUBMISSION_KEY_STORAGE_KEY);
      let idempotencyKey: string;
      try {
        const parsed = savedSubmission ? JSON.parse(savedSubmission) as { fingerprint?: unknown; key?: unknown } : {};
        idempotencyKey = parsed.fingerprint === fingerprint && typeof parsed.key === "string"
          ? parsed.key
          : window.crypto.randomUUID();
        if (parsed.fingerprint !== fingerprint || parsed.key !== idempotencyKey) {
          window.localStorage.setItem(SUBMISSION_KEY_STORAGE_KEY, JSON.stringify({ fingerprint, key: idempotencyKey }));
        }
      } catch {
        idempotencyKey = window.crypto.randomUUID();
        window.localStorage.setItem(SUBMISSION_KEY_STORAGE_KEY, JSON.stringify({ fingerprint, key: idempotencyKey }));
      }

      const applicationResponse = await fetch("/api/applications/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          programmeId: selectedProgramme.id,
          personalDetails: { firstName: form.firstName, lastName: form.lastName, dateOfBirth: form.dateOfBirth, gender: form.gender },
          contactDetails: { email: form.email.trim(), phone: form.phone, address: form.address.trim() },
        }),
      });
      const applicationResult = await applicationResponse.json() as {
        applicationReference?: string;
        whatsappUrl?: string;
        error?: string;
      };
      if (!applicationResponse.ok || !applicationResult.applicationReference || !applicationResult.whatsappUrl) {
        throw new Error(applicationResult.error || "Could not submit your application.");
      }

      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SUBMISSION_KEY_STORAGE_KEY);
      window.location.assign(applicationResult.whatsappUrl);
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
        <p>You can apply without an account. If you are signed in, your name, email, and phone may be prefilled.</p>
        {saved && <p className="muted" aria-live="polite" style={{ fontSize: 11 }}>Draft autosaved on this device.</p>}

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
          {selectedProgramme && <div className="info-summary"><strong>{selectedProgramme.name}</strong><p className="muted" style={{ margin: "5px 0 0", fontSize: 12 }}>{selectedProgramme.summary}</p></div>}
        </div>}
        {step === 3 && <div className="form-card">
          <h2 style={{ fontSize: 18 }}>Review and send your application</h2>
          <Summary label="Name" value={`${form.firstName} ${form.lastName}`} />
          <Summary label="Email" value={form.email} />
          <Summary label="Phone" value={form.phone} />
          <Summary label="Programme" value={selectedProgramme?.name ?? "Not selected"} />
          <Notice title="Continue on WhatsApp">Submitting saves your application first, then opens WhatsApp with your name, programme, and application reference. The WhatsApp contact is checked when you submit. No payment is collected through this website.</Notice>
        </div>}

        {error && <p className="wizard-error" role="alert">{error}</p>}
        {step < steps.length - 1 && <div className="wizard-actions">
          <button className="button button-outline" type="button" onClick={() => { setError(""); setStep((current) => Math.max(0, current - 1)); }} disabled={step === 0}><ChevronLeft size={17} /> Previous</button>
          <button className="button button-primary" type="button" onClick={next}>Continue <ChevronRight size={17} /></button>
        </div>}
        {step === steps.length - 1 && <div className="wizard-actions">
          <button className="button button-outline" type="button" onClick={() => { setError(""); setStep((current) => Math.max(0, current - 1)); }}><ChevronLeft size={17} /> Previous</button>
          <button className="button button-primary" type="button" disabled={busy || !selectedProgramme} onClick={() => void submitApplication()}>{busy ? "Submitting…" : "Submit & continue to WhatsApp"} <ChevronRight size={17} /></button>
        </div>}
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
