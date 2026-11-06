import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-shell";
import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Sign In",
  description: "Sign in to your Tamark Solar Energy student account.",
  path: "/sign-in",
  indexable: false,
});

export default function SignInPage() {
  return <><PublicHeader /><main className="content-narrow"><Link className="back-link" href="/">← Back to website</Link><p className="eyebrow">STUDENT PORTAL</p><h1>Sign in</h1>{isSupabaseConfigured() ? <AuthForm mode="sign-in" /> : <div className="notice"><strong>Account services are not configured</strong><p>Connect Supabase to enable student accounts.</p></div>}</main></>;
}
