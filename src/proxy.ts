import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_ROUTES: Record<string, string[]> = {
  SUPER_ADMIN: ["/", "/products", "/trendmap-products", "/articles", "/links", "/affiliates", "/sites", "/categories", "/product-categories", "/product-types", "/reports", "/history", "/users", "/notifications", "/notices", "/settings", "/team-members", "/calendar", "/commission-settings", "/commissions", "/commission-list", "/user-commissions"],
  ADMIN: ["/", "/products", "/trendmap-products", "/articles", "/links", "/affiliates", "/sites", "/categories", "/product-categories", "/product-types", "/reports", "/history", "/users", "/notifications", "/notices", "/settings", "/team-members", "/calendar", "/user-commissions"],
  TEAM_LEAD: ["/", "/products", "/articles", "/links", "/reports", "/notifications", "/notices", "/settings", "/team-members", "/calendar", "/user-commissions"],
  LINKER: ["/", "/products", "/trendmap-products", "/links", "/affiliates", "/sites", "/categories", "/product-categories", "/product-types", "/reports", "/notifications", "/notices", "/settings", "/calendar", "/user-commissions"],
  WRITER: ["/", "/products", "/articles", "/reports", "/notifications", "/notices", "/settings", "/calendar", "/user-commissions"],
  PRODUCT_RESEARCHER: ["/", "/products", "/trendmap-products", "/product-types", "/product-categories", "/notifications", "/notices", "/settings", "/calendar", "/user-commissions"],
  GUEST: ["/products", "/commission-list", "/commissions"],
};

function isRouteAllowed(pathname: string, role: string | null | undefined, roles?: string[]): boolean {
  const activeRoles = new Set<string>();
  if (role) activeRoles.add(role.toUpperCase());
  if (roles && Array.isArray(roles)) {
    roles.forEach(r => activeRoles.add(r.toUpperCase()));
  }
  if (activeRoles.size === 0) return false;
  if (activeRoles.has("SUPER_ADMIN") || activeRoles.has("ADMIN")) return true;

  for (const r of activeRoles) {
    const allowedParents = ROLE_ROUTES[r];
    if (allowedParents && allowedParents.some(route => {
      if (route === "/") {
        return pathname === "/";
      }
      return pathname === route || pathname.startsWith(route + "/");
    })) {
      return true;
    }
  }
  return false;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Never intercept NextAuth internal endpoints, WebSocket upgrades, or external Trendmap push
    if (
      pathname.startsWith("/api/auth") ||
      pathname === "/ws" ||
      (pathname.startsWith("/api/trendmap-products") && req.method === "POST")
    ) {
      return NextResponse.next();
    }

    // 0. If user has left the company, deny all access immediately
    if (token && (token as any).hasLeftCompany) {
      if (pathname === "/auth/signin") {
        return NextResponse.next();
      }
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Access Denied: Account Deactivated" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/auth/signin?error=AccessDenied", req.url));
    }

    // 1. Redirect logged-in users away from sign-in page to the home page (dashboard)
    if (token && pathname === "/auth/signin") {
      if ((token as any).hasLeftCompany) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 2. Handle unauthenticated application API requests cleanly (instead of NextAuth redirecting them to signin HTML)
    if (!token && pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Check if user is approved and has an assigned role
    const isApproved = token && token.approved === true;
    const hasRole = token && (!!token.role || (Array.isArray(token.roles) && token.roles.length > 0));
    const isGuest = token && (token.role === "GUEST" || (Array.isArray(token.roles) && token.roles.includes("GUEST")));

    if (token && (!isApproved || !hasRole)) {
      if (isGuest) {
        // GUEST users (pending admin activation) can access Products and Commission List in read-only mode
        const allowedGuestPages = ["/products", "/commission-list", "/commissions", "/auth/pending"];
        const isAllowedGuestPage = allowedGuestPages.some((p) => pathname === p || pathname.startsWith(p + "/"));

        if (!isAllowedGuestPage) {
          if (pathname.startsWith("/api/")) {
            const allowedGuestApis = [
              "/api/products",
              "/api/commissions",
              "/api/commission-settings",
              "/api/categories",
              "/api/notifications",
              "/api/settings/commission-password",
            ];
            const isAllowedApi = req.method === "GET" && allowedGuestApis.some((p) => pathname === p || pathname.startsWith(p + "/"));
            if (!isAllowedApi) {
              return NextResponse.json({ error: "Access Denied: Pending Activation" }, { status: 403 });
            }
            return NextResponse.next();
          }
          return NextResponse.redirect(new URL("/products", req.url));
        }
        return NextResponse.next();
      }

      if (pathname !== "/auth/pending") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Access Denied: Pending Activation" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/auth/pending", req.url));
      }
      return NextResponse.next();
    }

    // 4. Prevent access to pending page for approved/activated non-guest users
    if (token && isApproved && hasRole && !isGuest && pathname === "/auth/pending") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }

    // 5. Enforce role-based path authorization (pages only, bypass api paths and websocket)
    if (token && isApproved && hasRole && !pathname.startsWith("/api/") && pathname !== "/ws") {
      const activeWorkspace = req.cookies.get("active_workspace_role")?.value;
      const tokenRoles = new Set<string>();
      if (token.role) tokenRoles.add(String(token.role).toUpperCase());
      if (Array.isArray(token.roles)) {
        token.roles.forEach((r: string) => {
          if (r) tokenRoles.add(String(r).toUpperCase());
        });
      }

      const upperActiveWorkspace = activeWorkspace?.trim().toUpperCase();
      const effectiveRolesForRoute =
        upperActiveWorkspace && tokenRoles.has(upperActiveWorkspace)
          ? [
              upperActiveWorkspace,
              ...(tokenRoles.has("SUPER_ADMIN") ? ["SUPER_ADMIN"] : []),
              ...(tokenRoles.has("ADMIN") ? ["ADMIN"] : []),
            ]
          : Array.from(tokenRoles);

      if (!isRouteAllowed(pathname, token.role, effectiveRolesForRoute)) {
        console.log(`Access Denied: Roles ${JSON.stringify(effectiveRolesForRoute)} cannot access route ${pathname}`);
        const fallbackUrl =
          effectiveRolesForRoute.includes("GUEST") &&
          !effectiveRolesForRoute.includes("SUPER_ADMIN") &&
          !effectiveRolesForRoute.includes("ADMIN")
            ? "/products"
            : "/";
        return NextResponse.redirect(new URL(fallbackUrl, req.url));
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/auth/signin",
    },
    callbacks: {
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl;
        // Let middleware function handle authentication checks on API paths, ws, signin, and pending page
        if (
          pathname === "/auth/signin" ||
          pathname === "/auth/pending" ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/") ||
          pathname === "/ws"
        ) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    // Protect all routes except api/auth routes, websocket, and static assets with extensions
    "/((?!api/auth|ws|_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.[\\w]+$).*)",
  ],
};
