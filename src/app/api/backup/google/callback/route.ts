import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveGoogleDriveToken } from "@/lib/backupService";

export async function GET(req: NextRequest) {
  // Determine base URL dynamically from request headers first, then env variables
  const forwardedHost = req.headers.get("x-forwarded-host");
  const hostHeader = req.headers.get("host");
  const host = forwardedHost || hostHeader || "localhost:3022";
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const protocol = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  
  let baseUrl: string;
  if (forwardedHost || (hostHeader && !hostHeader.startsWith("localhost") && !hostHeader.startsWith("127.0.0.1"))) {
    baseUrl = `${protocol}://${host}`;
  } else {
    baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
  }
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/backup/google/callback`;

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL("/settings?tab=backup&error=" + encodeURIComponent(error), baseUrl));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/settings?tab=backup&error=No+authorization+code+provided", baseUrl));
    }

    const clientId = process.env.GDRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GDRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/settings?tab=backup&error=Google+Drive+credentials+missing+in+env", baseUrl));
    }

    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Google OAuth Token Error]:", errText);
      return NextResponse.redirect(
        new URL("/settings?tab=backup&error=" + encodeURIComponent("Failed to exchange token with Google"), req.url)
      );
    }

    const tokenData = await tokenRes.json();

    // Format token JSON for rclone
    // rclone expects: {"access_token":"...","token_type":"Bearer","refresh_token":"...","expiry":"..."}
    const expiryDate = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    const rcloneTokenObj = {
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || "Bearer",
      refresh_token: tokenData.refresh_token,
      expiry: expiryDate,
    };

    saveGoogleDriveToken(JSON.stringify(rcloneTokenObj));

    return NextResponse.redirect(new URL("/settings?tab=backup&success=Google+Drive+connected+successfully", baseUrl));
  } catch (err: any) {
    console.error("[GET /api/backup/google/callback]", err);
    return NextResponse.redirect(
      new URL("/settings?tab=backup&error=" + encodeURIComponent(err.message || "Failed to complete Google Drive connection"), baseUrl)
    );
  }
}
