import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// A quick check before any page: without a session cookie, the app sends you to sign in. It only
// looks at the cookie; the real check of the session happens on the server for every data request
// (lib/dal), so a forged cookie opens an empty page, not someone's data.

export function proxy(request: NextRequest) {
  const signedIn = getSessionCookie(request) !== null;
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }
  // Resetting a forgotten password and reading the Privacy Policy work without a session.
  if (pathname === "/reset-password" || pathname === "/privacy") return NextResponse.next();
  if (!signedIn) {
    const login = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Better Auth's own endpoints, Next.js files and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
