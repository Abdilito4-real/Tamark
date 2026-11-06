import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardContent } from "@/components/dashboard-content";
import { DashboardShell } from "@/components/dashboard-shell";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Student Portal",
  description: "Private Tamark Solar Energy student account and application pages.",
  path: "/student",
  indexable: false,
});

const routeSections: Record<string, string> = {
  "": "overview",
  applications: "applications",
  payments: "payments",
  schedule: "schedule",
  notifications: "notifications",
  profile: "profile",
};

export default async function StudentPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section: path = [] } = await params;
  const key = path.join("/");
  const section = routeSections[key];
  if (!section) notFound();
  return <DashboardShell kind="student" active={key ? `/student/${key}` : "/student"}><DashboardContent kind="student" section={section} /></DashboardShell>;
}
