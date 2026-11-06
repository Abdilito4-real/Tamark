import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-shell";
import { PasswordResetRequestForm, PasswordUpdateForm } from "@/components/password-reset-form";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Reset Password",
  description: "Reset your Tamark Solar Energy student account password.",
  path: "/reset-password",
  indexable: false,
});

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  return <><PublicHeader /><main className="content-narrow">
    <Link className="back-link" href="/sign-in">← Back to sign in</Link>
    <p className="eyebrow">ACCOUNT SECURITY</p>
    <h1>{user ? "Choose a new password" : "Reset your password"}</h1>
    {!isSupabaseConfigured() ? <div className="notice"><strong>Account services are not configured</strong><p>Connect Supabase to reset account passwords.</p></div> : user ? <PasswordUpdateForm /> : <PasswordResetRequestForm />}
  </main></>;
}
