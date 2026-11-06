import type { Metadata } from "next";
import { PaymentVerification } from "@/components/checkout-actions";
import { Notice } from "@/components/ui";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Payment Confirmation",
  description: "Private payment verification status.",
  path: "/checkout/confirmation",
  indexable: false,
});

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  if (!reference || reference.length > 200) return <main className="content-narrow"><Notice title="Payment reference unavailable">Return to your application and payment history to check its current status.</Notice></main>;
  return <main className="content-narrow"><p className="eyebrow">PAYMENT CONFIRMATION</p><PaymentVerification reference={reference} /></main>;
}
