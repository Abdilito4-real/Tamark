"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ApplicationSubmitAction } from "@/components/application-submit-action";

export function CheckoutActions({ applicationId }: { applicationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function begin() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const result = await response.json() as { authorizationUrl?: string; error?: string };
      if (!response.ok || !result.authorizationUrl) throw new Error(result.error || "Could not start secure checkout.");
      window.location.assign(result.authorizationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start secure checkout.");
      setBusy(false);
    }
  }

  return <><button className="button button-primary" onClick={begin} disabled={busy}>{busy ? "Starting checkout…" : "Continue to Paystack"} <ArrowRight size={17} /></button>{error && <p className="wizard-error" role="alert">{error}</p>}</>;
}

export function PaymentVerification({ reference }: { reference: string }) {
  const [state, setState] = useState<"checking" | "verified" | "submitted" | "pending" | "error">("checking");
  const [message, setMessage] = useState("Checking payment status with Paystack…");
  const [applicationId, setApplicationId] = useState("");
  const [applicationReference, setApplicationReference] = useState("");

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        const response = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const result = await response.json() as { verified?: boolean; applicationId?: string; error?: string };
        if (!response.ok) throw new Error(result.error || "Payment status could not be checked.");
        if (active && result.verified) {
          setApplicationId(result.applicationId ?? "");
          setState("verified");
          setMessage("Your payment is verified. Review and submit your application to complete it.");
        }
        else if (active) {
          setApplicationId(result.applicationId ?? "");
          setState("pending");
          setMessage("Paystack has not confirmed this payment. You can retry verification shortly.");
        }
      } catch (reason) {
        if (active) {
          setState("error");
          setMessage(reason instanceof Error ? reason.message : "Payment status could not be checked.");
        }
      }
    }
    void verify();
    return () => { active = false; };
  }, [reference]);

  return <div className="form-card">
    <span className="service-icon"><ShieldCheck size={26} /></span>
    <h1>{state === "submitted" ? "Application submitted" : state === "verified" ? "Payment verified" : state === "checking" ? "Verifying payment" : "Payment not verified"}</h1>
    <p className="muted" role="status">{message}</p>
    <div className="checkout-summary"><div className="summary-row"><span>Reference</span><strong>{reference || "Unavailable"}</strong></div><div className="summary-row"><span>Status</span><strong>{state === "verified" || state === "submitted" ? "Verified" : "Not verified"}</strong></div>{applicationReference && <div className="summary-row"><span>Application reference</span><strong>{applicationReference}</strong></div>}</div>
    {state === "verified" && applicationId && <div className="wizard-actions">
      <a className="button button-outline" href={`/api/payments/receipt?reference=${encodeURIComponent(reference)}`}><Download size={16} /> Download verified receipt</a>
      <ApplicationSubmitAction applicationId={applicationId} onSubmitted={(result) => {
        setApplicationReference(result);
        setState("submitted");
        setMessage("Your application has been submitted.");
      }} />
    </div>}
    {state === "verified" && !applicationId && <p className="wizard-error" role="alert">Payment is verified but the application could not be loaded. Contact support.</p>}
    {state === "submitted" && <div className="wizard-actions"><Link className="button button-primary" href="/student/applications">View application</Link></div>}
    {(state === "pending" || state === "error" || state === "checking") && <div className="wizard-actions"><button className="button button-outline" onClick={() => window.location.reload()}>Check again</button>{applicationId && <Link className="button button-primary" href={`/checkout/${applicationId}`}>Return to checkout</Link>}</div>}
  </div>;
}
