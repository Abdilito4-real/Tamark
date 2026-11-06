import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-shell";
import { ApplicationWizard } from "@/components/application-wizard";
import { getPublishedProgrammes } from "@/lib/programmes";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { redirect } from "next/navigation";
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
    return <><PublicHeader /><main className="content-narrow"><Notice title="Applications are not available">Student account services must be configured before you can apply.</Notice></main></>;
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Could not connect to account services.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") {
    throw new Error(`Could not verify the current account: ${error.message}`);
  }
  const applyPath = programme ? `/apply?programme=${encodeURIComponent(programme)}` : "/apply";
  if (!user) redirect(`/sign-up?next=${encodeURIComponent(applyPath)}`);

  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error(`Could not verify student permissions: ${profileError.message}`);
  if (profile?.role !== "student") redirect(profile?.role === "admin" ? "/admin" : "/access-denied");

  return <><PublicHeader /><main><ApplicationWizard programmes={programmes} defaultSlug={programme} initialEmail={user.email ?? ""} /></main></>;
}
