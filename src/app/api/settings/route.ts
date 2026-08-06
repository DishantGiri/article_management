import { NextResponse } from "next/server";

// GET /api/settings
export async function GET() {
  return NextResponse.json({});
}

// POST /api/settings
export async function POST() {
  return NextResponse.json({ success: true });
}
