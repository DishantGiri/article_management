import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Super Admin access required." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const type = body.type === "hourly" ? "--hourly" : "--daily";

    const scriptPath = path.join(process.cwd(), "scripts", "backup-to-gdrive.sh");

    const { stdout, stderr } = await execAsync(`bash "${scriptPath}" ${type}`, {
      timeout: 120000, // 2 minutes max
    });

    return NextResponse.json({
      success: true,
      message: `${body.type === "hourly" ? "Hourly" : "Daily"} backup completed successfully!`,
      output: stdout,
    });
  } catch (err: any) {
    console.error("[POST /api/backup/run]", err);
    return NextResponse.json(
      {
        error: err.stderr || err.message || "Failed to run backup",
      },
      { status: 500 }
    );
  }
}
