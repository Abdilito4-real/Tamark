import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-shell";

export type LegalSection = { title: string; paragraphs: string[] };

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return <>
    <PublicHeader />
    <main className="container legal-page">
      <p className="eyebrow">INFORMATION</p>
      <h1>{title}</h1>
      <div className="legal-review-notice" role="note">
        <strong>Draft — requires Tamark and legal review before publication</strong>
        <p>This page contains placeholders where company policies or legal details have not been confirmed. It is not approved legal advice or a final policy.</p>
      </div>
      <p className="legal-intro">{intro}</p>
      {sections.map((section) => <section key={section.title}>
        <h2>{section.title}</h2>
        {section.paragraphs.map((paragraph, index) => <p key={`${section.title}-${index}`}>{paragraph}</p>)}
      </section>)}
      <p className="muted">Questions about these draft notices: <Link href="/#contact">contact Tamark</Link> once official contact details are published.</p>
    </main>
    <PublicFooter />
  </>;
}
