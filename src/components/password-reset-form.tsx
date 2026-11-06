"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Account services are not configured.");
      setBusy(false);
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    setBusy(false);
    if (resetError) {
      setError("Password reset could not be started. Please try again later.");
      return;
    }
    setSent(true);
  }

  return <form className="form-card" onSubmit={(event) => void submit(event)}>
    {sent ? <p className="notice" role="status">If the address is associated with an account, password reset instructions will be sent.</p> : <>
      <label className="field">Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      {error && <p className="wizard-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
    </>}
  </form>;
}

export function PasswordUpdateForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The password entries do not match.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Account services are not configured.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError("Password could not be updated. Request a new reset link and try again.");
      return;
    }
    setUpdated(true);
  }

  if (updated) return <p className="notice" role="status">Your password has been updated. You can now sign in with your new password.</p>;
  return <form className="form-card" onSubmit={(event) => void submit(event)}>
    <label className="field">New password<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    <label className="field">Confirm new password<input type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>
    {error && <p className="wizard-error" role="alert">{error}</p>}
    <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
  </form>;
}
