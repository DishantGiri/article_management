import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCommissionPasswordConfig,
  verifyPasswordHash,
} from "@/lib/commission-password";

// POST /api/settings/commission-password/verify - Verify access password
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getCommissionPasswordConfig();

    // If password is not set or not enabled, access is open
    if (!config || !config.enabled) {
      return NextResponse.json({ valid: true, message: "Password protection is not enabled" });
    }

    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { valid: false, error: "Please enter a password" },
        { status: 400 }
      );
    }

    const isValid = verifyPasswordHash(password.trim(), config.hash, config.salt);

    if (!isValid) {
      return NextResponse.json(
        { valid: false, error: "Incorrect commission password" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: "Password verified successfully",
    });
  } catch (err: any) {
    console.error("[POST /api/settings/commission-password/verify]", err);
    return NextResponse.json(
      { error: err.message || "Failed to verify password" },
      { status: 500 }
    );
  }
}

