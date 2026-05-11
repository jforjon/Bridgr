import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";

const protectedRoutes = ["/learn", "/practice", "/profile", "/settings", "/onboarding"];
const publicRoutes = ["/welcome", "/login", "/signup", "/forgot-password", "/reset-password"];
const authRedirectRoutes = ["/welcome", "/login", "/signup"];

function isRouteMatch(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected = protectedRoutes.some((route) => isRouteMatch(pathname, route));
  const isAuthRedirectRoute = authRedirectRoutes.some((route) => pathname === route);
  const isPublic = publicRoutes.some((route) => pathname === route) || pathname === "/";

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("sb-") && cookie.name.endsWith("-auth-token"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  let userId: string | null = null;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {},
        remove() {}
      }
    });

    const {
      data: { user }
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  const isAuthenticated = Boolean(userId) || hasAuthCookie;

  if (pathname === "/") {
    const rootDestination = request.nextUrl.clone();
    rootDestination.pathname = isAuthenticated ? "/learn" : "/welcome";
    return NextResponse.redirect(rootDestination);
  }

  /** Old per-language course home was removed; only `/learn` + lesson URLs remain under `/learn/…`. */
  const learnSegments = pathname.split("/").filter(Boolean);
  if (
    learnSegments.length === 2 &&
    learnSegments[0] === "learn" &&
    learnSegments[1] !== "reading"
  ) {
    const toLearn = request.nextUrl.clone();
    toLearn.pathname = "/learn";
    return NextResponse.redirect(toLearn);
  }

  if (!isAuthenticated && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAuthenticated || !userId || isPublic) {
    return response;
  }

  if (isAuthRedirectRoute) {
    const learnUrl = request.nextUrl.clone();
    learnUrl.pathname = "/learn";
    return NextResponse.redirect(learnUrl);
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set() {},
      remove() {}
    }
  });

  const { data: knownRows, error: knownError } = await supabase
    .from("known_languages")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (knownError) {
    return response;
  }

  const hasKnownLanguages = (knownRows ?? []).length > 0;

  if (!hasKnownLanguages && pathname !== "/onboarding/1") {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding/1";
    return NextResponse.redirect(onboardingUrl);
  }

  if (hasKnownLanguages) {
    const { data: learningRows, error: learningError } = await supabase
      .from("learning_languages")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!learningError) {
      const hasLearningLanguages = (learningRows ?? []).length > 0;
      if (!hasLearningLanguages && pathname !== "/learn") {
        const learnUrl = request.nextUrl.clone();
        learnUrl.pathname = "/learn";
        return NextResponse.redirect(learnUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks/stripe).*)"]
};
