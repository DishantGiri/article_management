import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "LINKER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Only Admins, Super Admins, and Linkers can manage affiliates." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Affiliate name is required" },
        { status: 400 }
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
