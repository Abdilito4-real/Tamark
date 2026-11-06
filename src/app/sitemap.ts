import type { MetadataRoute } from "next";
import { getPublishedProgrammes } from "@/lib/programmes";
import { getSiteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const programmes = await getPublishedProgrammes();
  return [
    { url: getSiteUrl("/").toString() },
    { url: getSiteUrl("/training").toString() },
    ...programmes.map((programme) => ({ url: getSiteUrl(`/training/${encodeURIComponent(programme.slug)}`).toString() })),
  ];
}
