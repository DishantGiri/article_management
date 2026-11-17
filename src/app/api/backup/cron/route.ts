import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkCronInstalled, ensureCronInstalled } from "@/lib/backupService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const installed = await checkCronInstalled();
    return NextResponse.json({
      success: true,
      installed,
      message: installed ? "Automated cron backups are active" : "Crontab is not configured",
    });
  } catch (err: any) {
    console.error("[GET /api/backup/cron]", err);
    return NextResponse.json({ error: err.message || "Failed to check cron status" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const result = await ensureCronInstalled();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[POST /api/backup/cron]", err);
    return NextResponse.json({ error: err.message || "Failed to configure cron" }, { status: 500 });
  }
}
