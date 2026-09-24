import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { removeGoogleDriveConfig, saveGoogleDriveToken } from "@/lib/backupService";

// POST /api/backup/disconnect - Disconnect Google Drive
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    removeGoogleDriveConfig();
    return NextResponse.json({ success: true, message: "Google Drive disconnected successfully." });
  } catch (err: any) {
    console.error("[POST /api/backup/disconnect]", err);
    return NextResponse.json({ error: err.message || "Failed to disconnect" }, { status: 500 });
  }
}

// PUT /api/backup/disconnect - Save manual token (if user wants to paste token directly)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "Token string is required" }, { status: 400 });
    }

    // Try parsing as JSON if user pasted JSON
    let tokenStr = token.trim();
    if (!tokenStr.startsWith("{")) {
      tokenStr = JSON.stringify({
        access_token: tokenStr,
        token_type: "Bearer",
        refresh_token: tokenStr,
        expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
      });
    }

    saveGoogleDriveToken(tokenStr);
    return NextResponse.json({ success: true, message: "Google Drive token configured successfully." });
  } catch (err: any) {
    console.error("[PUT /api/backup/disconnect]", err);
    return NextResponse.json({ error: err.message || "Failed to save token" }, { status: 500 });
  }
}
