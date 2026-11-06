import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BatteryCharging, BriefcaseBusiness, House, PlugZap, Ruler, Sun } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { ButtonLink } from "@/components/ui";
import { getListedProgrammes } from "@/lib/programmes";
import { createPageMetadata, getSiteOrigin } from "@/lib/seo";
import { JsonLd } from "@/components/json-ld";

const icons = [Sun, PlugZap, Ruler, BatteryCharging, House, BriefcaseBusiness];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const programme = (await getListedProgrammes()).find((item) => item.slug === slug);
  if (!programme) {
    return createPageMetadata({
      title: "Training Programme",
      description: "Training programme details from Tamark Solar Energy.",
      path: `/training/${encodeURIComponent(slug)}`,
      indexable: false,
    });
  }
  return createPageMetadata({
    title: programme.name,
    description: programme.summary || `${programme.name} training programme information from Tamark Solar Energy.`,
    path: `/training/${encodeURIComponent(programme.slug)}`,
    indexable: programme.is_published === true && programme.price_approved === true,
  });
}

export default async function ProgrammePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const programmes = await getListedProgrammes();
  const programme = programmes.find((item) => item.slug === slug);
  if (!programme) notFound();
  const Icon = icons[["Solar PV", "Inverters", "Design", "Storage", "Community", "Business"].indexOf(programme.category)] ?? Sun;
  const curriculum = Array.isArray(programme.curriculum) ? programme.curriculum : [];
  const outcomes = Array.isArray(programme.outcomes) ? programme.outcomes : [];
  const origin = getSiteOrigin();
  const courseSchema = programme.is_published && programme.price_approved ? {
    "@context": "https://schema.org",
    "@type": "Course",
    name: programme.name,
    description: programme.summary || `${programme.name} training programme from Tamark Solar Energy.`,
    provider: { "@type": "Organization", name: "Tamark Solar Energy", url: origin },
    ...(programme.duration ? { timeRequired: programme.duration } : {}),
    ...(programme.price_minor != null && programme.price_minor > 0
      ? { offers: { "@type": "Offer", price: (programme.price_minor / 100).toFixed(2), priceCurrency: programme.currency, url: new URL(`/training/${encodeURIComponent(programme.slug)}`, origin).toString() } }
      : {}),
  } : null;
  return <>
    {courseSchema && <JsonLd data={courseSchema} />}
    <PublicHeader />
    <main className="content-narrow">
      <Link className="back-link" href="/training"><ArrowLeft size={15} /> All training programmes</Link>
      <article className="programme-detail">
        <span className="service-icon"><Icon size={26} /></span>
        <div className="detail-header"><div><span className="tag">{programme.category}</span><h1 style={{ marginTop: 13 }}>{programme.name}</h1></div>{programme.is_published && programme.price_approved ? <ButtonLink href={`/apply?programme=${encodeURIComponent(programme.slug)}`}>Apply for training <ArrowUpRight size={16} /></ButtonLink> : <span className="tag">Coming soon</span>}</div>
        {!programme.is_published && <p className="notice" role="status">Enrollment is not open yet. Programme details and fees are being confirmed by Tamark.</p>}
        <p className="muted">{programme.summary || "Programme information is being confirmed by Tamark."}</p>
        <div className="checkout-summary"><div className="summary-row"><span>Duration</span><strong>{programme.duration ?? "To be confirmed"}</strong></div><div className="summary-row"><span>Programme fee</span><strong>{programme.price_minor == null ? "To be confirmed" : new Intl.NumberFormat(undefined, { style: "currency", currency: programme.currency }).format(programme.price_minor / 100)}</strong></div><div className="summary-row"><span>Entry requirements</span><strong>{programme.entry_requirements || "To be confirmed"}</strong></div></div>
        <h2>Curriculum</h2>{curriculum.length ? <ul className="detail-list">{curriculum.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="muted">Curriculum details will be published by Tamark.</p>}
        <h2>Learning outcomes</h2>{outcomes.length ? <ul className="detail-list">{outcomes.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="muted">Learning outcomes will be published by Tamark.</p>}
      </article>
    </main>
    <PublicFooter />
  </>;
}
