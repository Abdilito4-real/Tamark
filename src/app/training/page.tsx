import type { Metadata } from "next";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { ProgrammeCatalog } from "@/components/programme-catalog";
import { getListedProgrammes } from "@/lib/programmes";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Solar Energy Training Programmes",
  description: "Explore solar energy training programmes published by Tamark Solar Energy. Programme availability and fees are confirmed on each listing.",
  path: "/training",
});

export default async function TrainingPage() {
  const programmes = await getListedProgrammes();
  return <>
    <PublicHeader />
    <main>
      <section className="page-hero"><div className="container"><p className="eyebrow">TAMARK TRAINING</p><h1>Training programmes</h1><p>Explore Tamark’s solar training programmes. Draft programmes are marked as coming soon.</p></div></section>
      <section className="container page-content">
        {!isSupabaseConfigured() && <div className="notice"><strong>Programme catalogue not connected</strong><p>Connect Supabase to load live programme information. No sample courses or prices are displayed.</p></div>}
        <ProgrammeCatalog programmes={programmes} />
      </section>
    </main>
    <PublicFooter />
  </>;
}
