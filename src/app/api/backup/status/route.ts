import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBackupStatus } from "@/lib/backupService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const status = await getBackupStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("[GET /api/backup/status]", err);
    return NextResponse.json({ error: err.message || "Failed to fetch backup status" }, { status: 500 });
  }
}
