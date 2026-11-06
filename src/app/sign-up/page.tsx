import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-shell";
import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Create a Student Account",
  description: "Create an account to apply for Tamark Solar Energy training programmes.",
  path: "/sign-up",
  indexable: false,
});

export default function SignUpPage() {
  return <><PublicHeader /><main className="content-narrow"><Link className="back-link" href="/">← Back to website</Link><p className="eyebrow">STUDENT PORTAL</p><h1>Create an account</h1>{isSupabaseConfigured() ? <AuthForm mode="sign-up" /> : <div className="notice"><strong>Account services are not configured</strong><p>Connect Supabase to enable student accounts.</p></div>}</main></>;
}
