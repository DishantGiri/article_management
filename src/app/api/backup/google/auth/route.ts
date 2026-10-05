import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const clientId = process.env.GDRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "GDRIVE_CLIENT_ID not found in .env" }, { status: 400 });
    }

    // Determine base URL dynamically from request headers first, then env variables
    const forwardedHost = req.headers.get("x-forwarded-host");
    const hostHeader = req.headers.get("host");
    const host = forwardedHost || hostHeader || "localhost:3022";
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const protocol = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    
    // If the request came through a real domain (not localhost), use that domain
    let baseUrl: string;
    if (forwardedHost || (hostHeader && !hostHeader.startsWith("localhost") && !hostHeader.startsWith("127.0.0.1"))) {
      baseUrl = `${protocol}://${host}`;
    } else {
      baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    }
    const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/backup/google/callback`;

    const scope = [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent"); // Force prompt to ensure refresh_token is returned

    return NextResponse.redirect(authUrl.toString());
  } catch (err: any) {
    console.error("[GET /api/backup/google/auth]", err);
    return NextResponse.json({ error: err.message || "Failed to start Google Drive auth" }, { status: 500 });
  }
}
