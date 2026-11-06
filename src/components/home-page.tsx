import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, GraduationCap, Leaf, Lightbulb, PlugZap, Sun, Wrench } from "lucide-react";
import { ProgrammeCard } from "@/components/programme-card";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { getPublishedProgrammes } from "@/lib/programmes";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getPublicOrganizationSettings } from "@/lib/organization";
import { JsonLd } from "@/components/json-ld";
import { getSiteOrigin } from "@/lib/seo";

const services = [
  { title: "Solar Installation", text: "Rooftop and ground-mounted solar systems designed around real energy needs.", Icon: Sun },
  { title: "Inverter & Backup", text: "Backup power solutions to keep essential equipment running.", Icon: PlugZap },
  { title: "System Maintenance", text: "Inspection, testing, and maintenance to help solar systems perform reliably.", Icon: Wrench },
  { title: "Energy Consultancy", text: "Independent guidance on system sizing, options, and project planning.", Icon: Lightbulb },
];

export async function HomePage() {
  const [programmes, organization] = await Promise.all([getPublishedProgrammes(), getPublicOrganizationSettings()]);
  const origin = getSiteOrigin();
  return (
    <>
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Tamark Solar Energy",
          url: origin,
          logo: `${origin}/solar-leaf-energy-emblem.png`,
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Tamark Solar Energy",
          url: origin,
          inLanguage: "en",
        },
      ]} />
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <p className="eyebrow">POWERING A SUSTAINABLE FUTURE</p>
              <h1>Powering tomorrow with clean energy.</h1>
              <p className="hero-copy">Discover solar energy solutions and build practical technical skills for a brighter, more sustainable future.</p>
              <div className="hero-actions">
                <a className="button button-sun" href="#services">Explore our services</a>
                <ButtonLink href="/apply" variant="outline">Apply for training</ButtonLink>
              </div>
              <div className="trust-row">
                <span><Sun size={17} /> Solar energy solutions</span>
                <span><GraduationCap size={18} /> Professional training</span>
                <span><Wrench size={17} /> Technical expertise</span>
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-photo">
                <Image src="/images/solar-engineer.jpg" alt="Solar installation engineer working beside photovoltaic panels" fill priority sizes="(max-width: 800px) 90vw, 42vw" />
              </div>
              <div className="float-card float-one"><Sun size={21} /><span>Clean energy<small>Designed for your needs</small></span></div>
              <div className="float-card float-two"><BadgeCheck size={21} /><span>Practical skills<small>Learn by doing</small></span></div>
              <div className="float-card float-three"><Leaf size={21} /><span>Built for tomorrow<small>Powering a brighter future</small></span></div>
            </div>
          </div>
        </section>

        <section className="section" id="about">
          <div className="container split">
            <div className="about-visual"><Image src="/images/solar-panels.jpg" alt="Clean energy illustration featuring a light bulb and solar panels" fill sizes="(max-width: 800px) 90vw, 45vw" /></div>
            <div>
              <p className="eyebrow">ABOUT TAMARK</p>
              <h2>Energy expertise. Skills for the future.</h2>
              <p className="muted">Tamark Solar Energy brings solar solutions and hands-on technical learning together. Explore our services or find a training programme that fits your goals.</p>
              <div className="feature-list">
                <div className="feature-item"><span className="feature-icon"><Sun size={20} /></span><div><h3>Solar energy solutions</h3><p className="muted">Practical services for homes, businesses, and organizations.</p></div></div>
                <div className="feature-item"><span className="feature-icon"><GraduationCap size={20} /></span><div><h3>Professional learning</h3><p className="muted">Technical training designed to build applied solar skills.</p></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container split">
            <div>
              <p className="eyebrow">WHY CHOOSE TAMARK</p>
              <h2>Practical solutions. Lasting skills.</h2>
              <p className="muted">From solar project support to technical training, Tamark helps people and organizations make informed progress with clean energy.</p>
              <div className="feature-list">
                <div className="feature-item"><span className="feature-icon"><Wrench size={20} /></span><div><h3>Technical expertise</h3><p className="muted">Explore services shaped around the practical needs of each project.</p></div></div>
                <div className="feature-item"><span className="feature-icon"><GraduationCap size={20} /></span><div><h3>Hands-on learning</h3><p className="muted">Build applied skills through training programmes published by Tamark.</p></div></div>
              </div>
            </div>
            <div className="about-visual"><Image src="/images/solar-farm.jpg" alt="Ground-mounted solar panels in a solar farm" fill sizes="(max-width: 800px) 90vw, 45vw" /></div>
          </div>
        </section>

        <section className="section" id="services" style={{ background: "#f2f8f4" }}>
          <div className="container">
            <SectionHeading eyebrow="WHAT WE DO" title="Solar services for real-world needs">Explore the ways Tamark can support your energy project.</SectionHeading>
            <div className="services-grid">
              {services.map(({ title, text, Icon }) => <article className="service-card" key={title}><span className="service-icon"><Icon size={25} /></span><h3>{title}</h3><p className="muted">{text}</p></article>)}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head-row">
              <SectionHeading eyebrow="BUILD YOUR SKILLS" title="Training programmes">Explore programmes currently published by Tamark.</SectionHeading>
              <ButtonLink href="/training" variant="outline">All programmes <ArrowRight size={16} /></ButtonLink>
            </div>
            {!isSupabaseConfigured() ? <p className="muted">The programme catalogue will appear when the training database is connected.</p> : programmes.length ? <div className="programme-grid">{programmes.slice(0, 3).map((programme) => <ProgrammeCard key={programme.id} programme={programme} />)}</div> : <p className="muted">There are no published programmes at this time.</p>}
          </div>
        </section>

        <section className="section" id="contact">
          <div className="container">
            <div className="contact-panel">
              <div><h3>{organization?.organization_name || "Contact Tamark Solar Energy"}</h3>
                {organization?.contact_email && <p><a href={`mailto:${organization.contact_email}`}>{organization.contact_email}</a></p>}
                {organization?.contact_phone && <p><a href={`tel:${organization.contact_phone}`}>{organization.contact_phone}</a></p>}
                {!organization?.contact_email && !organization?.contact_phone && <p>Contact details will be added when confirmed by Tamark.</p>}
              </div>
              <Link className="text-link" href="/training">Explore training <ArrowRight size={16} /></Link>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container cta-panel">
            <h2>Ready to build your solar skills?</h2>
            <p>Browse available training programmes and start your application when a programme is open.</p>
            <ButtonLink href="/training" variant="sun">Explore training programmes <ArrowRight size={17} /></ButtonLink>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
