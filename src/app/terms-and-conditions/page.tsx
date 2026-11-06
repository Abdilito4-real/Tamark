import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Terms and Conditions",
  description: "Draft terms for using Tamark Solar Energy's website and training services; pending company and legal review.",
  path: "/terms-and-conditions",
  indexable: false,
});

export default function TermsAndConditionsPage() {
  return <LegalPage
    title="Terms and Conditions"
    intro="These draft terms describe topics for Tamark Solar Energy's website and training services. They have not been approved and should not be relied on until Tamark completes its review."
    sections={[
      { title: "Introduction and acceptance", paragraphs: ["[COMPANY/LEGAL REVIEW REQUIRED: confirm the contracting entity, governing law, effective date and acceptance process before publication.]", "Using the website and accepting service terms are separate from cookie consent."] },
      { title: "Website and user accounts", paragraphs: ["Use the website lawfully and provide accurate account information. Keep account credentials secure and tell Tamark if you suspect unauthorized access.", "[COMPANY REVIEW REQUIRED: confirm account suspension, termination, support and dispute procedures.]"] },
      { title: "Training applications and programme information", paragraphs: ["Programme availability, eligibility, duration, delivery format and learning outcomes must be confirmed on each published programme page. Do not rely on draft or unapproved descriptions.", "[COMPANY REVIEW REQUIRED: confirm enrolment, attendance, assessment, certification and cancellation conditions.]"] },
      { title: "Payments, refunds and cancellations", paragraphs: ["[PENDING COMPANY/LEGAL APPROVAL: insert Tamark's actual payment, cancellation, refund eligibility, timing and process. No refund or cancellation commitment is stated by this draft.]"] },
      { title: "Intellectual property and acceptable use", paragraphs: ["[COMPANY/LEGAL REVIEW REQUIRED: identify protected materials, permitted use, prohibited conduct and any applicable licence.]"] },
      { title: "Liability and third-party services", paragraphs: ["[LEGAL REVIEW REQUIRED: approve applicable warranty, limitation-of-liability and third-party-service terms. Do not rely on this placeholder as a limitation.]"] },
      { title: "Changes and contact", paragraphs: ["[COMPANY/LEGAL REVIEW REQUIRED: define effective dates, notice for material changes, renewed acceptance where required and official contact details.]"] },
    ]}
  />;
}
