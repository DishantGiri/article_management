import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_AFFILIATES = [
  "Admitad",
  "Amazon Associates",
  "BuyGoods",
  "CJ Affiliate",
  "Clickadv",
  "ClickBank",
  "Clickhunts",
  "Lead Bit",
  "MaxWeb",
  "Mediascalers",
  "SellHealth",
  "Smartadv",
  "Smashloud",
  "TerraLeads",
  "Traffic Light",
];

async function hasPermission(userId?: number) {
  if (!userId) return true;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return (
    user?.role === "LINKER" ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN"
  );
}

// GET /api/affiliates — retrieve all affiliates (and seed defaults if missing)
export async function GET() {
  try {
    let affiliates = await prisma.affiliateName.findMany({
      orderBy: { name: "asc" },
    });

    if (affiliates.length === 0) {
      for (const name of DEFAULT_AFFILIATES) {
        await prisma.affiliateName.create({
          data: { name },
        });
      }
      affiliates = await prisma.affiliateName.findMany({
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json(affiliates);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch affiliates" },
      { status: 500 }
    );
  }
}

// POST /api/affiliates — add new affiliate name
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, callerId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Affiliate name is required" },
        { status: 400 }
      );
    }

    if (callerId && !(await hasPermission(Number(callerId)))) {
      return NextResponse.json(
        { error: "Access Denied: Only Admins, Super Admins, and Linkers can manage affiliates." },
        { status: 403 }
      );
    }

    const trimmedName = name.trim();

    const existing = await prisma.affiliateName.findUnique({
      where: { name: trimmedName },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    const created = await prisma.affiliateName.create({
      data: { name: trimmedName },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save affiliate" },
      { status: 500 }
    );
  }
}
