import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const product = await prisma.trendmapProduct.findUnique({
      where: { id: numericId },
      include: {
        addedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch Trendmap product", details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const body = await req.json();

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.productUrl !== undefined) data.productUrl = body.productUrl;
    if (body.competitor !== undefined) data.competitor = body.competitor;
    if (body.searchDemand !== undefined) data.searchDemand = body.searchDemand;
    if (body.demandScore !== undefined) data.demandScore = body.demandScore;
    if (body.demandLevel !== undefined) data.demandLevel = body.demandLevel;
    if (body.category !== undefined) data.category = body.category;
    if (body.market !== undefined) data.market = body.market;
    if (body.researchedBy !== undefined) data.researchedBy = body.researchedBy;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.status !== undefined) data.status = body.status;
    if (body.addedToCatalog !== undefined) data.addedToCatalog = Boolean(body.addedToCatalog);
    if (body.catalogProductId !== undefined) data.catalogProductId = body.catalogProductId;

    const updated = await prisma.trendmapProduct.update({
      where: { id: numericId },
      data,
    });

    return NextResponse.json({
      success: true,
      product: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update Trendmap product", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Product deletion is disabled. Added products cannot be deleted because it affects multiple places." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}
