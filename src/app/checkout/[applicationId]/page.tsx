import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CheckoutActions } from "@/components/checkout-actions";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Notice } from "@/components/ui";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Secure Checkout",
  description: "Private student payment checkout.",
  path: "/checkout",
  indexable: false,
});

export default async function CheckoutPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  if (!isSupabaseConfigured()) return <main className="content-narrow"><Notice title="Checkout is not configured">Supabase and Paystack settings are required to load a verified application checkout.</Notice></main>;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="content-narrow"><Notice title="Checkout is not configured">Connect the account database to continue.</Notice></main>;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify the current account: ${authError.message}`);
  if (!user) return <main className="content-narrow"><Notice title="Sign in required"><Link href="/sign-in">Sign in</Link> to continue checkout.</Notice></main>;
  const { data: application, error } = await supabase.from("applications")
    .select("id,status,student_id,programmes!inner(name,price_minor,currency,is_published,price_approved)")
    .eq("id", applicationId).eq("student_id", user.id).maybeSingle();
  if (error) throw new Error(`Could not load checkout: ${error.message}`);
  if (!application) notFound();
  const programme = application.programmes as unknown as { name: string; price_minor: number | null; currency: string; is_published: boolean; price_approved: boolean };
  const canPay = application.status === "draft" && programme.is_published && programme.price_approved && programme.price_minor != null && programme.price_minor > 0;
  return <main className="content-narrow">
    <Link className="back-link" href="/student/applications"><ArrowLeft size={15} /> My applications</Link>
    <p className="eyebrow">SECURE CHECKOUT</p><h1>Review your payment</h1>
    <div className="form-card">
      <div className="checkout-summary">
        <div className="summary-row"><span>Programme</span><strong>{programme.name}</strong></div>
        <div className="summary-row"><span>Amount due</span><strong>{canPay ? new Intl.NumberFormat(undefined, { style: "currency", currency: programme.currency }).format(programme.price_minor! / 100) : "Not available"}</strong></div>
      </div>
      {canPay ? <><p className="muted">Payment is securely initialized by Tamark and processed by Paystack. Your application is submitted only after server-side payment verification.</p><CheckoutActions applicationId={application.id} /></> : <Notice title="Payment is not available">The application is not payable until Tamark has published an approved programme fee.</Notice>}
    </div>
  </main>;
}
