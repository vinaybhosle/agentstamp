import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "agentstamp-admin-session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (except /admin/login)
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Allow login page through
  if (pathname === "/admin/login") {
    // If already authenticated, redirect to analytics
    const secret = getSecret();
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (secret && token) {
      try {
        await jwtVerify(token, secret);
        return NextResponse.redirect(new URL("/admin/analytics", request.url));
      } catch {
        // Token invalid, let them see login
      }
    }
    return NextResponse.next();
  }

  // Check auth for all other /admin/* routes
  const secret = getSecret();
  if (!secret) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Token expired or invalid
    const response = NextResponse.redirect(
      new URL("/admin/login", request.url)
    );
    response.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
