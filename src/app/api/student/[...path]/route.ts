import { NextResponse, type NextRequest } from "next/server";
import { getStudentRequestContext } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ path: string[] }> };

function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const context = await getStudentRequestContext();
  if (!context.ok) return failure(context.error, context.status);
  const { supabase } = context;
  const { path: [resource] } = await params;

  if (resource === "overview") {
    const [applications, payments, verifiedPayments, notifications] = await Promise.all([
      supabase.from("applications").select("id,status,created_at,submitted_at,programmes(name)", { count: "exact" }).order("created_at", { ascending: false }).limit(5),
      supabase.from("payments").select("id,amount_minor,currency,status,verified_at,provider_reference,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(5),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "successful"),
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    ]);
    const error = applications.error ?? payments.error ?? verifiedPayments.error ?? notifications.error;
    if (error) return failure("Could not load student dashboard.", 500);
    return NextResponse.json({
      applications: applications.data ?? [],
      payments: payments.data ?? [],
      unread: notifications.count ?? 0,
      stats: { applications: applications.count ?? 0, verifiedPayments: verifiedPayments.count ?? 0 },
    });
  }
  if (resource === "applications") {
    const { data, error } = await supabase.from("applications")
      .select("id,status,created_at,submitted_at,application_reference,programmes(name),payments(status)")
      .order("created_at", { ascending: false }).limit(500);
    if (error) return failure("Could not load applications.", 500);
    return NextResponse.json({ data: data ?? [] });
  }
  if (resource === "payments") {
    const { data, error } = await supabase.from("payments")
      .select("id,amount_minor,currency,status,verified_at,provider_reference,created_at")
      .order("created_at", { ascending: false }).limit(500);
    if (error) return failure("Could not load payments.", 500);
    return NextResponse.json({ data: data ?? [] });
  }
  if (resource === "profile") {
    const { data, error } = await supabase.from("profiles").select("id,full_name,phone,created_at").eq("id", context.user.id).maybeSingle();
    if (error) return failure("Could not load your profile.", 500);
    if (!data) return failure("Student profile has not been created yet.", 404);
    return NextResponse.json({ data, email: context.user.email ?? "" });
  }
  if (resource === "schedule") {
    const { data, error } = await supabase.from("training_sessions").select("id,title,starts_at,ends_at,location,details,programmes(name)").order("starts_at");
    if (error) return failure("Could not load training schedule.", 500);
    return NextResponse.json({ data: data ?? [] });
  }
  if (resource === "announcements") {
    const { data, error } = await supabase.from("announcements").select("id,title,body,published_at,created_at").eq("published", true).order("published_at", { ascending: false });
    if (error) return failure("Could not load announcements.", 500);
    return NextResponse.json({ data: data ?? [] });
  }
  if (resource === "notifications") {
    const { data, error } = await supabase.from("notifications").select("id,title,body,read_at,created_at").order("created_at", { ascending: false });
    if (error) return failure("Could not load notifications.", 500);
    return NextResponse.json({ data: data ?? [] });
  }
  return failure("Unknown student resource.", 404);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getStudentRequestContext();
  if (!context.ok) return failure(context.error, context.status);
  const { supabase } = context;
  const { path } = await params;
  const [resource, id] = path;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Request body must be valid JSON."); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return failure("Request body must be a JSON object.");
  const values = body as Record<string, unknown>;

  if (resource === "profile") {
    const fullName = typeof values.full_name === "string" ? values.full_name.trim() : "";
    const phone = typeof values.phone === "string" ? values.phone.trim() : "";
    if (!fullName || fullName.length > 160 || phone.length > 40) return failure("Enter a name and a valid phone number.");
    const { data, error } = await supabase.from("profiles")
      .update({ full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() })
      .eq("id", context.user.id)
      .select("id,full_name,phone")
      .single();
    if (error) return failure("Could not save your profile.", 500);
    return NextResponse.json({ data });
  }
  if (resource === "notifications" && id && values.read === true) {
    const { data, error } = await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id).eq("student_id", context.user.id)
      .select("id").maybeSingle();
    if (error) return failure("Could not update notification.", 500);
    if (!data) return failure("Notification not found.", 404);
    return NextResponse.json({ success: true });
  }
  if (resource === "notifications" && id && values.read === false) {
    const { data, error } = await supabase.from("notifications")
      .update({ read_at: null })
      .eq("id", id).eq("student_id", context.user.id)
      .select("id").maybeSingle();
    if (error) return failure("Could not update notification.", 500);
    if (!data) return failure("Notification not found.", 404);
    return NextResponse.json({ success: true });
  }
  return failure("This student resource cannot be updated.", 404);
}
