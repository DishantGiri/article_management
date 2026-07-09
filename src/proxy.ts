import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_ROUTES: Record<string, string[]> = {
  SUPER_ADMIN: ["/", "/products", "/articles", "/links", "/sites", "/categories", "/reports", "/history", "/users", "/notifications", "/settings", "/team-members"],
  ADMIN: ["/", "/products", "/articles", "/links", "/sites", "/categories", "/reports", "/history", "/users", "/notifications", "/settings", "/team-members"],
  TEAM_LEAD: ["/", "/products", "/articles", "/links", "/reports", "/notifications", "/settings", "/team-members"],
  LINKER: ["/", "/products", "/links", "/notifications", "/settings"],
  WRITER: ["/", "/products", "/articles", "/notifications", "/settings"],
};

function isRouteAllowed(pathname: string, role: string | null | undefined): boolean {
  if (!role || !ROLE_ROUTES[role]) return false;
  
  const allowedParents = ROLE_ROUTES[role];
  return allowedParents.some(route => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname === route || pathname.startsWith(route + "/");
  });
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // 1. Handle unauthenticated API requests cleanly (instead of NextAuth redirecting them to signin HTML)
    if (!token && pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Check if user is approved and has an assigned role
    const isApproved = token && token.approved === true;
    const hasRole = token && !!token.role;

    if (token && (!isApproved || !hasRole)) {
      if (pathname !== "/auth/pending") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Access Denied: Pending Activation" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/auth/pending", req.url));
      }
      return;
    }

    // 3. Prevent access to pending page for approved/activated users
    if (token && isApproved && hasRole && pathname === "/auth/pending") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 4. Enforce role-based path authorization (pages only, bypass api paths)
    if (token && isApproved && hasRole && !pathname.startsWith("/api/")) {
      if (!isRouteAllowed(pathname, token.role)) {
        console.log(`Access Denied: Role ${token.role} cannot access route ${pathname}`);
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl;
        // Let middleware function handle authentication checks on API paths
        if (pathname.startsWith("/api/")) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    // Protect all routes except signin page, api/auth routes, and static assets
    "/((?!api/auth|auth/signin|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png).*)",
  ],
};
