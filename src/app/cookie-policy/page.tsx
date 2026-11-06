import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Cookie Policy",
  description: "Draft information about essential and optional browser technologies used by Tamark Solar Energy; pending review.",
  path: "/cookie-policy",
  indexable: false,
});

export default function CookiePolicyPage() {
  return <LegalPage
    title="Cookie Policy"
    intro="This draft explains the categories shown in Cookie Preferences. Tamark must verify the live cookie inventory and approve the final notice."
    sections={[
      { title: "What are cookies and similar technologies?", paragraphs: ["Cookies and browser storage can support sessions, remember preferences or provide optional analytics and marketing features. The consent interface stores its choice in local browser storage; it does not store names, account IDs or payment details."] },
      { title: "Essential technologies", paragraphs: ["Essential technologies support core site security and authenticated account sessions. They cannot be switched off in Cookie Preferences."] },
      { title: "Optional categories", paragraphs: ["Analytics, functional and marketing categories are off by default. No analytics or marketing provider is currently configured in this application. The functional category has no optional provider configured at this time."] },
      { title: "Manage your choices", paragraphs: ["Choose Accept all, Reject optional or Customize preferences in the consent banner. Use Cookie Preferences in the site footer to change or withdraw optional choices. Changes are applied immediately to the application's consent state."] },
      { title: "Inventory and review", paragraphs: ["[COMPANY/LEGAL REVIEW REQUIRED: verify all cookies, local storage, embedded media and third-party scripts in each deployment before publication, and confirm applicable consent requirements under the Nigeria Data Protection Act 2023 and NDPC guidance.]"] },
    ]}
  />;
}
