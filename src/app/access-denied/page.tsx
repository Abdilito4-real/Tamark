import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Access Denied",
  description: "Account access information.",
  path: "/access-denied",
  indexable: false,
});

export default function AccessDeniedPage() {
  return <main className="content-narrow"><p className="eyebrow">ACCOUNT ACCESS</p><h1>Access unavailable</h1><p className="muted">This account is not authorized to view the requested area.</p><Link className="button button-primary" href="/">Return to website</Link></main>;
}
