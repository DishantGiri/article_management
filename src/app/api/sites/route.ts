import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProductType } from "@/generated/prisma/client";

// GET /api/sites?productType=NUTRA  or  GET /api/sites  (all)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productType = searchParams.get("productType") as ProductType | null;

  const sites = await prisma.site.findMany({
    where: productType ? { productType } : undefined,
    select: { id: true, name: true, productType: true, url: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(sites);
}
