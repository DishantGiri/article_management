import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/affiliates
export async function GET(req: NextRequest) {
  try {
    const affiliates = await prisma.affiliateName.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(affiliates);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch affiliates" }, { status: 500 });
  }
}

// POST /api/affiliates
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Affiliate name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if it already exists
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
    return NextResponse.json({ error: err.message || "Failed to save affiliate" }, { status: 500 });
  }
}
