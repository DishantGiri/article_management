import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCommissionPasswordConfig,
  setCommissionPassword,
  toggleCommissionPassword,
  removeCommissionPassword,
  verifyPasswordHash,
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
    const { action, password, currentPassword, enabled } = body;
    const author = session.user.name || session.user.email || "Super Admin";

    const existingConfig = await getCommissionPasswordConfig();

    if (action === "set") {
      if (!password || typeof password !== "string" || password.trim().length < 4) {
        return NextResponse.json(
          { error: "New password must be at least 4 characters long" },
          { status: 400 }
        );
      }

      // If password was already set, old password is REQUIRED to change it
      if (existingConfig) {
        if (!currentPassword || typeof currentPassword !== "string") {
          return NextResponse.json(
            { error: "Current password is required to change the password" },
            { status: 400 }
          );
        }

        const isCurrentValid = verifyPasswordHash(
          currentPassword.trim(),
          existingConfig.hash,
          existingConfig.salt
        );
        if (!isCurrentValid) {
          return NextResponse.json(
            { error: "Incorrect current password. Please enter the current password to change it." },
            { status: 400 }
          );
        }
      }

      await setCommissionPassword(password.trim(), enabled !== false, author);
      return NextResponse.json({
        success: true,
        message: existingConfig
          ? "Commission password updated successfully"
          : "Commission password created and activated successfully",
      });
    }

    if (action === "toggle") {
      if (typeof enabled !== "boolean") {
        return NextResponse.json(
          { error: "The 'enabled' field must be a boolean" },
          { status: 400 }
        );
      }

      if (!existingConfig) {
        return NextResponse.json(
          { error: "No commission password has been configured yet" },
          { status: 400 }
        );
      }

      // Current password is REQUIRED to pause or enable protection
      if (!currentPassword || typeof currentPassword !== "string") {
        return NextResponse.json(
          { error: "Current password is required to change protection status" },
          { status: 400 }
        );
      }

      const isCurrentValid = verifyPasswordHash(
        currentPassword.trim(),
        existingConfig.hash,
        existingConfig.salt
      );
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Incorrect current password. Action unauthorized." },
          { status: 400 }
        );
      }

      await toggleCommissionPassword(enabled, author);
      return NextResponse.json({
        success: true,
        enabled,
        message: enabled
          ? "Commission password protection enabled"
          : "Commission password protection paused",
      });
    }

    if (action === "remove") {
      if (!existingConfig) {
        return NextResponse.json(
          { error: "No commission password is set" },
          { status: 400 }
        );
      }

      // Current password is REQUIRED to remove password protection
      if (!currentPassword || typeof currentPassword !== "string") {
        return NextResponse.json(
          { error: "Current password is required to remove password protection" },
          { status: 400 }
        );
      }

      const isCurrentValid = verifyPasswordHash(
        currentPassword.trim(),
        existingConfig.hash,
        existingConfig.salt
      );
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Incorrect current password. Action unauthorized." },
          { status: 400 }
        );
      }

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
