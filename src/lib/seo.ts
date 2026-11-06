import type { Metadata } from "next";

export const SITE_NAME = "Tamark Solar Energy";
export const DEFAULT_DESCRIPTION = "Explore Tamark Solar Energy's solar solutions and practical technical training.";
export const SOCIAL_IMAGE = "/opengraph-image";

export function getSiteOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) throw new Error();
      if ((process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
          ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
        throw new Error();
      }
      return parsed.origin;
    } catch {
      throw new Error("NEXT_PUBLIC_SITE_URL must be a valid public HTTP(S) origin.");
    }
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl && process.env.VERCEL_ENV !== "production") return new URL(`https://${vercelUrl}`).origin;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Set NEXT_PUBLIC_SITE_URL to the canonical production origin before building or serving the production app.");
  }
  return "http://localhost:3000";
}

export function getSiteUrl(path = "/") {
  return new URL(path, getSiteOrigin());
}

export function createPageMetadata({
  title,
  description,
  path,
  indexable = true,
}: {
  title: string;
  description: string;
  path: string;
  indexable?: boolean;
}): Metadata {
  const canonical = getSiteUrl(path);
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: indexable, follow: indexable },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      locale: "en_NG",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} solar leaf emblem` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [SOCIAL_IMAGE],
    },
  };
}
