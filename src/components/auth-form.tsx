"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const signUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Account services are not configured yet.");
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const destinationUrl = requestedNext?.startsWith("/") ? new URL(requestedNext, window.location.origin) : null;
      const destination = destinationUrl?.origin === window.location.origin
        ? `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`
        : "/student";
      const result = signUp
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}` } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signUp && !result.data.session) {
        setMessage("Check your email for a confirmation link to finish creating your account.");
      } else {
        router.replace(destination);
        router.refresh();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not complete sign in.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="form-card" onSubmit={submit}>
    {signUp && <label className="field">Full name<input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>}
    <label className="field">Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label className="field">Password<input type="password" autoComplete={signUp ? "new-password" : "current-password"} minLength={signUp ? 12 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required />{signUp && <small className="muted">Use at least 12 characters. Configure the same minimum in Supabase Auth.</small>}</label>
    {error && <p className="wizard-error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Please wait…" : signUp ? "Create account" : "Sign in"}</button>
    {!signUp && <p className="muted" style={{ margin: "12px 0 0", fontSize: 12 }}><Link href="/reset-password">Forgot your password?</Link></p>}
    <p className="muted" style={{ margin: "16px 0 0", fontSize: 12 }}>{signUp ? "Already registered?" : "New to Tamark?"} <Link href={signUp ? "/sign-in" : "/sign-up"}>{signUp ? "Sign in" : "Create an account"}</Link></p>
  </form>;
}
