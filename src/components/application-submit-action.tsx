"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";

export function ApplicationSubmitAction({ applicationId, onSubmitted }: { applicationId: string; onSubmitted?: (reference: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/submit`, { method: "POST" });
      const result = await response.json() as { applicationReference?: string; error?: string };
      if (!response.ok || !result.applicationReference) {
        throw new Error(result.error || "Could not submit your application.");
      }
      setReference(result.applicationReference);
      onSubmitted?.(result.applicationReference);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit your application.");
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return <p className="success-message" role="status"><Check size={16} /> Submitted · {reference}</p>;
  }
  return <div>
    <button className="button button-primary button-small" type="button" onClick={() => void submit()} disabled={busy}>
      <Send size={14} />{busy ? "Submitting…" : "Review and submit"}
    </button>
    {error && <p className="wizard-error" role="alert">{error}</p>}
  </div>;
}
