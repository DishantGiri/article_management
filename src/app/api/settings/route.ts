import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/settings — fetch global settings
export async function GET() {
  try {
    const settingsList = await prisma.globalSetting.findMany();
    const settings: Record<string, string> = {};
    settingsList.forEach((s) => {
      settings[s.key] = s.value || "";
    });

    return NextResponse.json({
      defaultSubId: settings.defaultSubId || "",
      defaultBridgeUrl: settings.defaultBridgeUrl || "",
      ...settings,
    });
  } catch (err: any) {
    console.error("[GET /api/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/settings — update global settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const updates: Promise<any>[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string" || value === null) {
        updates.push(
          prisma.globalSetting.upsert({
            where: { key },
            update: { value: value as string },
            create: { key, value: value as string },
          })
        );
      }
    }

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[POST /api/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
