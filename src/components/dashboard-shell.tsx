import Link from "next/link";
import { ArrowLeft, LayoutDashboard, BookOpen, Users, CreditCard, ChartNoAxesColumn, Megaphone, Settings, Bell, CalendarDays, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { MobileDrawer } from "@/components/mobile-drawer";
import { BrandMark } from "@/components/brand-mark";

const studentItems = [
  ["Overview", "/student", LayoutDashboard],
  ["My Applications", "/student/applications", BookOpen],
  ["My Payments", "/student/payments", CreditCard],
  ["Training Schedule", "/student/schedule", CalendarDays],
  ["Notifications", "/student/notifications", Bell],
  ["My Profile", "/student/profile", UserRound],
] as const;
const adminItems = [
  ["Dashboard", "/admin", LayoutDashboard],
  ["Applications", "/admin/applications", BookOpen],
  ["Students", "/admin/students", Users],
  ["Training Programmes", "/admin/programmes", Sun],
  ["Payments", "/admin/payments", CreditCard],
  ["Reports", "/admin/reports", ChartNoAxesColumn],
  ["Announcements", "/admin/announcements", Megaphone],
  ["Settings", "/admin/settings", Settings],
] as const;

function Sun({ size = 18 }: { size?: number }) { return <span aria-hidden="true" style={{ fontSize: size }}>☼</span>; }

export function DashboardShell({
  kind,
  active,
  children,
}: {
  kind: "student" | "admin";
  active: string;
  children: ReactNode;
}) {
  const items = kind === "student" ? studentItems : adminItems;
  const label = kind === "student" ? "Student portal" : "Administration";
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand brand-sidebar" href="/"><BrandMark /><span>TAMARK<small>{label.toUpperCase()}</small></span></Link>
        <nav aria-label={`${label} navigation`}>
          {items.map(([name, href, Icon]) => (
            <Link className={`sidebar-link ${active === href ? "active" : ""}`} href={href} key={href} aria-current={active === href ? "page" : undefined}>
              <Icon size={18} strokeWidth={1.8} />{name}
            </Link>
          ))}
        </nav>
        <Link className="sidebar-back" href="/"><ArrowLeft size={17} /> Back to website</Link>
        <SignOutButton />
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <MobileDrawer id={`${kind}-navigation`} label={label} triggerLabel={`Open ${label.toLowerCase()} navigation`} className="dashboard-drawer">
            <>
              <nav aria-label={`${label} navigation`}>
                {items.map(([name, href, Icon]) => (
                  <Link className={`sidebar-link ${active === href ? "active" : ""}`} href={href} key={href} aria-current={active === href ? "page" : undefined}>
                    <Icon size={18} strokeWidth={1.8} />{name}
                  </Link>
                ))}
              </nav>
              <Link className="sidebar-back" href="/"><ArrowLeft size={17} /> Back to website</Link>
              <SignOutButton />
            </>
          </MobileDrawer>
          <p>{label}</p>
          <Link href={kind === "student" ? "/student/profile" : "/admin/settings"}>{kind === "student" ? "My profile" : "Settings"}</Link>
        </header>
        {children}
      </main>
    </div>
  );
}
