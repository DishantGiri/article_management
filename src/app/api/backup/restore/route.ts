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

    const body = await req.json();
    const filePath = body.file;

    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json({ error: "Backup file path is required" }, { status: 400 });
    }

    // Security check: ensure path does not contain malicious traversal
    if (filePath.includes("..") || filePath.startsWith("/")) {
      return NextResponse.json({ error: "Invalid backup file path" }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), "scripts", "restore-from-backup.sh");

    const { stdout, stderr } = await execAsync(`bash "${scriptPath}" --file="${filePath}" --yes`, {
      timeout: 180000, // 3 minutes max
    });

    return NextResponse.json({
      success: true,
      message: `Database restored successfully from ${filePath}!`,
      output: stdout,
    });
  } catch (err: any) {
    console.error("[POST /api/backup/restore]", err);
    return NextResponse.json(
      {
        error: err.stderr || err.message || "Failed to restore backup",
      },
      { status: 500 }
    );
  }
}
