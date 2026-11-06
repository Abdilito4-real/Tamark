import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardContent } from "@/components/dashboard-content";
import { DashboardShell } from "@/components/dashboard-shell";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Administrator Dashboard",
  description: "Private Tamark Solar Energy administrator tools.",
  path: "/admin",
  indexable: false,
});

const routeSections: Record<string, string> = {
  "": "dashboard",
  applications: "applications",
  students: "students",
  programmes: "programmes",
  payments: "payments",
  reports: "reports",
  announcements: "announcements",
  settings: "settings",
};

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section: path = [] } = await params;
  const key = path.join("/");
  const section = routeSections[key];
  if (!section) notFound();
  return <DashboardShell kind="admin" active={key ? `/admin/${key}` : "/admin"}><DashboardContent kind="admin" section={section} /></DashboardShell>;
}
