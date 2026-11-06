import Link from "next/link";
import { ArrowUpRight, BatteryCharging, BriefcaseBusiness, House, PlugZap, Ruler, Sun } from "lucide-react";
import type { Programme } from "@/lib/programmes";
import { getProgrammeImageUrl } from "@/lib/programme-images";

const iconByCategory: Record<string, typeof Sun> = {
  "Solar PV": Sun,
  Inverters: PlugZap,
  Design: Ruler,
  Storage: BatteryCharging,
  Business: BriefcaseBusiness,
  Community: House,
};

export function ProgrammeCard({ programme }: { programme: Programme }) {
  const Icon = iconByCategory[programme.category] ?? Sun;
  const imageUrl = getProgrammeImageUrl(programme.image_path);
  const price = programme.price_minor == null
    ? "Price to be confirmed"
    : new Intl.NumberFormat(undefined, { style: "currency", currency: programme.currency }).format(programme.price_minor / 100);
  return (
    <article className="programme-card">
      <div
        className={`programme-art ${imageUrl ? "has-image" : ""}`}
        role={imageUrl ? "img" : undefined}
        aria-label={imageUrl ? programme.name : undefined}
        style={imageUrl ? { backgroundImage: `linear-gradient(180deg, transparent 45%, rgba(16, 42, 42, .25)), url("${imageUrl}")` } : undefined}
      >
        {!imageUrl && <Icon size={38} strokeWidth={1.6} aria-hidden="true" />}
      </div>
      <div className="programme-body">
        <div className="programme-tags"><span className="tag">{programme.category}</span>
          {!programme.is_published && <span className="tag programme-coming-soon">Coming soon</span>}
        </div>
        <h3><Link href={`/training/${programme.slug}`}>{programme.name}</Link></h3>
        <p className="muted">{programme.summary || (programme.is_published ? "Programme details are being updated." : "Programme information is being confirmed by Tamark.")}</p>
        <div className="programme-meta">
          <span>{programme.duration ?? "Duration to be confirmed"}</span>
          <span>{price}</span>
        </div>
        <Link className="text-link" href={`/training/${programme.slug}`}>{programme.is_published ? "View programme" : "Programme details"} <ArrowUpRight size={16} /></Link>
      </div>
    </article>
  );
}
