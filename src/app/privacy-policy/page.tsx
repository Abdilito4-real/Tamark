import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy Policy",
  description: "Draft privacy information for Tamark Solar Energy; pending review under applicable Nigerian data protection requirements.",
  path: "/privacy-policy",
  indexable: false,
});

export default function PrivacyPolicyPage() {
  return <LegalPage
    title="Privacy Policy"
    intro="This draft identifies data practices that Tamark must confirm before publication. It is not a complete privacy notice."
    sections={[
      { title: "Information and purposes", paragraphs: ["The platform may process account identifiers and contact details, student application information, payment records and technical security data to provide account, training application, payment and support functions.", "[COMPANY REVIEW REQUIRED: confirm each collected field, purpose and whether any analytics or optional technologies are used.]"] },
      { title: "Lawful basis and sharing", paragraphs: ["[LEGAL REVIEW REQUIRED: identify the applicable lawful basis for each processing purpose under the Nigeria Data Protection Act 2023 and applicable guidance.]", "Payment processing uses Paystack, while account and application services use Supabase. [COMPANY/LEGAL REVIEW REQUIRED: confirm providers, subprocessors, transfer locations, safeguards and current contracts.]"] },
      { title: "Retention and security", paragraphs: ["[COMPANY/LEGAL REVIEW REQUIRED: publish approved retention periods for accounts, applications, payment, audit and support data, plus a deletion and backup schedule.]", "Access controls and technical safeguards are used. [COMPANY REVIEW REQUIRED: confirm the measures that may accurately be disclosed; do not describe security as absolute.]"] },
      { title: "Rights and contact", paragraphs: ["[LEGAL REVIEW REQUIRED: describe applicable data rights, request channels, response periods, complaints and the responsible privacy contact. Official contact details are pending confirmation.]"] },
    ]}
  />;
}
