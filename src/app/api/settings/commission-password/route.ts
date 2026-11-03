import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCommissionPasswordConfig,
  setCommissionPassword,
  toggleCommissionPassword,
  removeCommissionPassword,
} from "@/lib/commission-password";

// GET /api/settings/commission-password - Check status of commission password
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getCommissionPasswordConfig();
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    return NextResponse.json({
      isSet: !!config,
      enabled: config ? config.enabled : false,
      updatedAt: config?.updatedAt || null,
      updatedBy: isSuperAdmin ? config?.updatedBy || null : null,
    });
  } catch (err: any) {
    console.error("[GET /api/settings/commission-password]", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch password status" },
      { status: 500 }
    );
  }
}

// POST /api/settings/commission-password - Manage commission password (SUPER_ADMIN only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admin can manage the commission password" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, password, enabled } = body;
    const author = session.user.name || session.user.email || "Super Admin";

    if (action === "set") {
      if (!password || typeof password !== "string" || password.trim().length < 4) {
        return NextResponse.json(
          { error: "Password must be at least 4 characters long" },
          { status: 400 }
        );
      }

      await setCommissionPassword(password.trim(), enabled !== false, author);
      return NextResponse.json({
        success: true,
        message: "Commission password updated successfully",
      });
    }

    if (action === "toggle") {
      if (typeof enabled !== "boolean") {
        return NextResponse.json(
          { error: "The 'enabled' field must be a boolean" },
          { status: 400 }
        );
      }

      await toggleCommissionPassword(enabled, author);
      return NextResponse.json({
        success: true,
        enabled,
        message: enabled
          ? "Commission password protection enabled"
          : "Commission password protection disabled",
      });
    }

    if (action === "remove") {
      await removeCommissionPassword();
      return NextResponse.json({
        success: true,
        message: "Commission password removed successfully",
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: 'set', 'toggle', 'remove'" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[POST /api/settings/commission-password]", err);
    return NextResponse.json(
      { error: err.message || "Failed to update commission password" },
      { status: 500 }
    );
  }
}
