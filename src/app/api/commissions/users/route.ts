import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const roleFilter = searchParams.get("role"); // "WRITER" | "LINKER" | "TEAM_LEAD" | "ALL"
    const statusFilter = searchParams.get("paymentStatus"); // "PAID" | "PENDING" | "PARTIAL" | "ALL"
    const siteIdParam = searchParams.get("siteId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const sortBy = searchParams.get("sortBy") || "totalDesc";

    // 1. Fetch all sites for filter dropdown
    const sites = await prisma.site.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // 2. Fetch all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        teamLeadId: true,
        teamLead: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    // 3. Build sale date filter if provided
    const saleWhere: any = {};
    if (siteIdParam && siteIdParam !== "ALL") {
      saleWhere.siteId = parseInt(siteIdParam);
    }
    if (startDateParam || endDateParam) {
      saleWhere.saleDate = {};
      if (startDateParam) {
        saleWhere.saleDate.gte = new Date(startDateParam);
      }
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        saleWhere.saleDate.lte = end;
      }
    }

    // 4. Fetch all sales matching the site/date filters
    const allSales = await prisma.commissionSale.findMany({
      where: saleWhere,
      include: {
        product: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { saleDate: "desc" },
    });

    // 5. Aggregate commission data for each user
    let userCommissions = users.map((user) => {
      // Find all sales credited to this user based on their roles
      const userSales: Array<{
        saleId: number;
        productId: number;
        productName: string;
        siteId: number;
        siteName: string;
        saleType: "FIRST_SALE" | "RESALE";
        saleDate: string;
        roleEarnedAs: string;
        amount: number;
        paymentStatus: "PENDING" | "PAID";
        notes: string | null;
      }> = [];

      let firstSalesCount = 0;
      let firstSalesAmount = 0;
      let resalesCount = 0;
      let resalesAmount = 0;
      let paidAmount = 0;
      let pendingAmount = 0;

      allSales.forEach((sale) => {
        let earned = 0;
        const roles: string[] = [];

        // Check if user was the Writer
        if (sale.writerId === user.id && sale.writerAmount > 0) {
          earned += sale.writerAmount;
          roles.push("Writer");
        }
        // Check if user was the Linker
        if (sale.linkerId === user.id && sale.linkerAmount > 0) {
          earned += sale.linkerAmount;
          roles.push("Linker");
        }
        // Check if user was the Team Lead
        if (sale.teamLeadId === user.id && sale.tlAmount > 0) {
          earned += sale.tlAmount;
          roles.push("Team Lead");
        }

        if (earned > 0) {
          const type = sale.saleType as "FIRST_SALE" | "RESALE";
          if (type === "FIRST_SALE") {
            firstSalesCount += 1;
            firstSalesAmount += earned;
          } else {
            resalesCount += 1;
            resalesAmount += earned;
          }

          if (sale.paymentStatus === "PAID") {
            paidAmount += earned;
          } else {
            pendingAmount += earned;
          }

          userSales.push({
            saleId: sale.id,
            productId: sale.productId,
            productName: sale.product.name,
            siteId: sale.siteId,
            siteName: sale.site.name,
            saleType: type,
            saleDate: sale.saleDate.toISOString(),
            roleEarnedAs: roles.join(" & "),
            amount: parseFloat(earned.toFixed(2)),
            paymentStatus: sale.paymentStatus as "PENDING" | "PAID",
            notes: sale.notes,
          });
        }
      });

      const totalSalesCount = firstSalesCount + resalesCount;
      const totalAmount = firstSalesAmount + resalesAmount;

      // Determine payment status badge
      let paymentStatus: "PAID" | "PENDING" | "PARTIAL" | "NO_SALES" = "NO_SALES";
      if (totalAmount > 0) {
        if (pendingAmount === 0) paymentStatus = "PAID";
        else if (paidAmount > 0) paymentStatus = "PARTIAL";
        else paymentStatus = "PENDING";
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "WRITER",
        image: user.image,
        teamLeadName: user.teamLead?.name || null,
        firstSalesCount,
        firstSalesAmount: parseFloat(firstSalesAmount.toFixed(2)),
        resalesCount,
        resalesAmount: parseFloat(resalesAmount.toFixed(2)),
        totalSalesCount,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        paidAmount: parseFloat(paidAmount.toFixed(2)),
        pendingAmount: parseFloat(pendingAmount.toFixed(2)),
        paymentStatus,
        sales: userSales,
      };
    });

    // 6. Apply search and filters
    if (search) {
      userCommissions = userCommissions.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search)
      );
    }

    if (roleFilter && roleFilter !== "ALL") {
      userCommissions = userCommissions.filter((u) => u.role === roleFilter);
    }

    if (statusFilter && statusFilter !== "ALL") {
      userCommissions = userCommissions.filter((u) => u.paymentStatus === statusFilter);
    }

    // 7. Apply Sorting
    userCommissions.sort((a, b) => {
      switch (sortBy) {
        case "totalDesc":
          return b.totalAmount - a.totalAmount;
        case "totalAsc":
          return a.totalAmount - b.totalAmount;
        case "pendingDesc":
          return b.pendingAmount - a.pendingAmount;
        case "firstSalesDesc":
          return b.firstSalesCount - a.firstSalesCount;
        case "resalesDesc":
          return b.resalesCount - a.resalesCount;
        case "nameAsc":
          return a.name.localeCompare(b.name);
        default:
          return b.totalAmount - a.totalAmount;
      }
    });

    // 8. Overall Metrics
    const totalEarnings = userCommissions.reduce((acc, u) => acc + u.totalAmount, 0);
    const totalPaid = userCommissions.reduce((acc, u) => acc + u.paidAmount, 0);
    const totalPending = userCommissions.reduce((acc, u) => acc + u.pendingAmount, 0);
    const totalFirstSales = userCommissions.reduce((acc, u) => acc + u.firstSalesCount, 0);
    const totalResales = userCommissions.reduce((acc, u) => acc + u.resalesCount, 0);
    const activeUsersCount = userCommissions.filter((u) => u.totalAmount > 0).length;

    return NextResponse.json({
      sites,
      users: userCommissions,
      metrics: {
        totalUsers: userCommissions.length,
        activeUsersCount,
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        totalPending: parseFloat(totalPending.toFixed(2)),
        totalFirstSales,
        totalResales,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/commissions/users]", err);
    return NextResponse.json(
      { error: err.message || "Failed to load user commissions" },
      { status: 500 }
    );
  }
}

// POST /api/commissions/users/payout — Batch mark all pending sales as PAID for a user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Restrict payout action to Admins or Super Admins
    if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Admin can authorize commission payouts" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const targetUserId = parseInt(userId);

    // Update all pending sales where this user is writer, linker, or team lead
    const result = await prisma.commissionSale.updateMany({
      where: {
        paymentStatus: "PENDING",
        OR: [
          { writerId: targetUserId },
          { linkerId: targetUserId },
          { teamLeadId: targetUserId },
        ],
      },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `Successfully settled ${result.count} commission items!`,
      count: result.count,
    });
  } catch (err: any) {
    console.error("[POST /api/commissions/users/payout]", err);
    return NextResponse.json(
      { error: err.message || "Payout processing failed" },
      { status: 500 }
    );
  }
}
