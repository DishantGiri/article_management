import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_ROUTES: Record<string, string[]> = {
  SUPER_ADMIN: ["/", "/products", "/articles", "/links", "/sites", "/categories", "/product-categories", "/reports", "/history", "/users", "/notifications", "/notices", "/settings", "/team-members", "/calendar", "/commission-settings", "/commissions", "/user-commissions"],
  ADMIN: ["/", "/products", "/articles", "/links", "/sites", "/categories", "/product-categories", "/reports", "/history", "/users", "/notifications", "/notices", "/settings", "/team-members", "/calendar", "/commissions", "/user-commissions"],
  TEAM_LEAD: ["/", "/products", "/articles", "/links", "/reports", "/notifications", "/notices", "/settings", "/team-members", "/calendar", "/commissions", "/user-commissions"],
  LINKER: ["/", "/products", "/links", "/sites", "/categories", "/product-categories", "/reports", "/notifications", "/notices", "/settings", "/calendar", "/commissions", "/user-commissions"],
  WRITER: ["/", "/products", "/articles", "/reports", "/notifications", "/notices", "/settings", "/calendar", "/commissions", "/user-commissions"],
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

    // 1. Redirect logged-in users away from sign-in page to the home page (dashboard)
    if (token && pathname === "/auth/signin") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 2. Handle unauthenticated API requests cleanly (instead of NextAuth redirecting them to signin HTML)
    if (!token && pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Check if user is approved and has an assigned role
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

    // 4. Prevent access to pending page for approved/activated users
    if (token && isApproved && hasRole && pathname === "/auth/pending") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 5. Enforce role-based path authorization (pages only, bypass api paths and websocket)
    if (token && isApproved && hasRole && !pathname.startsWith("/api/") && pathname !== "/ws") {
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
        // Let middleware function handle authentication checks on API paths, ws and signin page
        if (pathname === "/auth/signin" || pathname.startsWith("/api/") || pathname === "/ws") {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    // Protect all routes except api/auth routes, websocket and static assets
    "/((?!api/auth|ws|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|loading.svg|404.svg|file.svg|globe.svg|next.svg|vercel.svg|window.svg|mixkit-software-interface-back-2575.wav|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wav|mp3|mp4|json|js)).*)",
  ],
};
