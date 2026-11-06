import Link from "next/link";
import { EmptyState, Notice } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase";
import { DashboardManager } from "@/components/dashboard-manager";

const studentSections: Record<string, { title: string; description: string }> = {
  overview: { title: "Overview", description: "Your applications, payments, and programme information will appear here." },
  applications: { title: "My Applications", description: "Review the status and details of your applications." },
  payments: { title: "My Payments", description: "View verified payments and download receipts." },
  schedule: { title: "Training Schedule", description: "Your confirmed training schedule will appear here." },
  notifications: { title: "Notifications", description: "Important updates about your applications and training." },
  profile: { title: "My Profile", description: "Manage your account details." },
};
const adminSections: Record<string, { title: string; description: string }> = {
  dashboard: { title: "Dashboard", description: "Current application, student, and payment summaries." },
  applications: { title: "Applications", description: "Review and manage submitted applications." },
  students: { title: "Students", description: "Manage student accounts and records." },
  programmes: { title: "Training Programmes", description: "Manage programme details, pricing, and publication status." },
  payments: { title: "Payments", description: "Review verified payment records." },
  reports: { title: "Reports", description: "Reports are generated from live records." },
  announcements: { title: "Announcements", description: "Manage announcements for authenticated students." },
  settings: { title: "Settings", description: "Manage organization and application settings." },
};

export async function DashboardContent({
  kind,
  section,
}: {
  kind: "student" | "admin";
  section: string;
}) {
  const sections = kind === "student" ? studentSections : adminSections;
  const config = sections[section] ?? sections[kind === "student" ? "overview" : "dashboard"];
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <div className="dashboard-content"><h1>{config.title}</h1><Notice title="Account services are not configured">Set up Supabase environment variables and apply the database schema to connect authenticated records.</Notice></div>;
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Could not verify the current account: ${error.message}`);
  if (!user) {
    return <div className="dashboard-content"><h1>{config.title}</h1><EmptyState title="Sign in to continue"><Link href="/sign-in">Go to sign in</Link> to view your account information.</EmptyState></div>;
  }
  return (
    <div className="dashboard-content">
      <p className="eyebrow">{kind === "admin" ? "ADMINISTRATION" : "STUDENT PORTAL"}</p>
      <h1>{config.title}</h1>
      <p className="page-intro">{config.description}</p>
      <DashboardManager kind={kind} section={section} />
    </div>
  );
}
