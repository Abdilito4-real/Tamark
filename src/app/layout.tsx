import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { CookieConsentProvider } from "@/components/cookie-consent";
import { InstallPromptBanner } from "@/components/install-prompt-banner";
import { DEFAULT_DESCRIPTION, getSiteOrigin, SITE_NAME, SOCIAL_IMAGE } from "@/lib/seo";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_NG",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} solar leaf emblem` }],
  },
  twitter: { card: "summary_large_image", images: [SOCIAL_IMAGE] },
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={jakarta.variable}><CookieConsentProvider>{children}<InstallPromptBanner /></CookieConsentProvider></body></html>;
}
