import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-shell";
import { ApplicationWizard } from "@/components/application-wizard";
import { getPublishedProgrammes } from "@/lib/programmes";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { Notice } from "@/components/ui";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Apply for Training",
  description: "Private training application form for Tamark Solar Energy students.",
  path: "/apply",
  indexable: false,
});

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  const [{ programme }, programmes] = await Promise.all([searchParams, getPublishedProgrammes()]);
  if (!isSupabaseConfigured()) {
    return <><PublicHeader /><main className="content-narrow"><Notice title="Applications are not available">Application services are not configured. Please contact Tamark.</Notice></main></>;
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: null };
  if (error && error.name !== "AuthSessionMissingError") {
    throw new Error(`Could not verify the current account: ${error.message}`);
  }

  let profile: { role: string; full_name: string | null; phone: string | null } | null = null;
  if (user && supabase) {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("role,full_name,phone,suspended_at")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Error(`Could not load optional student profile details: ${profileError.message}`);
    if (data?.role === "student" && !data.suspended_at) profile = data;
  }

  const nameParts = (profile?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  const initialFirstName = nameParts.shift() ?? "";
  const initialLastName = nameParts.join(" ");
  return <><PublicHeader /><main><ApplicationWizard programmes={programmes} defaultSlug={programme} initialEmail={profile ? user?.email ?? "" : ""} initialFirstName={initialFirstName} initialLastName={initialLastName} initialPhone={profile?.phone ?? ""} /></main></>;
}
