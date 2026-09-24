import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { testGoogleDriveConnection } from "@/lib/backupService";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const result = await testGoogleDriveConnection();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[POST /api/backup/test]", err);
    return NextResponse.json({ success: false, message: err.message || "Failed to test connection" }, { status: 500 });
  }
}
