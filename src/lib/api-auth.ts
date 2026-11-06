import { createSupabaseServerClient } from "@/lib/supabase";

export async function getAdminRequestContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase is not configured.", status: 503 };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return { ok: false as const, error: "Could not verify the current account.", status: 401 };
  if (!user) return { ok: false as const, error: "Sign in is required.", status: 401 };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role,suspended_at").eq("id", user.id).maybeSingle();
  if (profileError) return { ok: false as const, error: "Could not verify administrator permissions.", status: 503 };
  if (!profile || profile.role !== "admin" || profile.suspended_at) {
    return { ok: false as const, error: "Administrator access is required.", status: 403 };
  }
  return { ok: true as const, user };
}

export async function getStudentRequestContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false as const, error: "Supabase is not configured.", status: 503 };
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return { ok: false as const, error: "Could not verify the current account.", status: 401 };
  if (!user) return { ok: false as const, error: "Sign in is required.", status: 401 };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role,suspended_at").eq("id", user.id).maybeSingle();
  if (profileError) return { ok: false as const, error: "Could not verify student permissions.", status: 503 };
  if (profile?.role !== "student" || profile.suspended_at) return { ok: false as const, error: "Student access is required.", status: 403 };
  return { ok: true as const, user, supabase };
}
