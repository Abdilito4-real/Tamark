import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const destinationUrl = requestedNext?.startsWith("/") ? new URL(requestedNext, request.url) : null;
  const destination = destinationUrl?.origin === request.nextUrl.origin
    ? `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`
    : "/student";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!code || !url || !key) {
    const response = NextResponse.redirect(new URL("/sign-in?error=auth", request.url));
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: ((cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))) as SetAllCookies,
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const failed = NextResponse.redirect(new URL("/sign-in?error=auth", request.url));
    failed.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return failed;
  }
  return response;
}
