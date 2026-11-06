import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const isApiRequest = request.nextUrl.pathname.startsWith("/api/");
  const isSensitivePage = request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/student");
  const noIndex = (response: NextResponse) => {
    if (isApiRequest || isSensitivePage) response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  };
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  const isSignedProviderWebhook = request.nextUrl.pathname === "/api/payments/webhook";
  if (isApiRequest && isMutation && !isSignedProviderWebhook) {
    const origin = request.headers.get("origin");
    let originUrl: URL | null = null;
    try { if (origin) originUrl = new URL(origin); } catch { originUrl = null; }
    if (!originUrl || originUrl.origin !== request.nextUrl.origin) {
      const blocked = NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
      return noIndex(blocked);
    }
  }
  if (isApiRequest) return noIndex(NextResponse.next());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return noIndex(NextResponse.next());

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: ((cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }) as SetAllCookies,
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error(`Session validation failed: ${authError.message}`);
    const target = new URL("/sign-in?error=session", request.url);
    return noIndex(NextResponse.redirect(target));
  }
  if (!user) {
    const target = new URL("/sign-in", request.url);
    target.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return noIndex(NextResponse.redirect(target));
  }
  const { data: profile, error } = await supabase.from("profiles").select("role,suspended_at").eq("id", user.id).maybeSingle();
  if (error) {
    console.error(`Could not check account role: ${error.message}`);
    return noIndex(new NextResponse("Account access could not be verified.", { status: 503 }));
  }

  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isStudentRoute = request.nextUrl.pathname.startsWith("/student");
  if (profile?.suspended_at) return noIndex(NextResponse.redirect(new URL("/access-denied?reason=suspended", request.url)));
  if (isAdminRoute && profile?.role !== "admin") return noIndex(NextResponse.redirect(new URL("/access-denied", request.url)));
  if (isStudentRoute && profile?.role === "admin") return noIndex(NextResponse.redirect(new URL("/admin", request.url)));

  return noIndex(response);
}

export const config = {
  matcher: ["/student/:path*", "/admin/:path*", "/api/:path*"],
};
