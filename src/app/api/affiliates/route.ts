import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_AFFILIATES = [
  {
    name: "BuyGoods",
    defaultUrl: "https://chocotide.com/cho-aff-buy-dtc/?aff_id=779&subid=dhs",
    subIdPattern: "aff_id=779&subid=dhs",
  },
  {
    name: "Smashloud",
    defaultUrl: "https://www.premierdiscountlink.com/JD2XQCJ/H8NGJ5Z/?sub1=mag&sub2=mag2",
    subIdPattern: "sub1=mag&sub2=mag2",
  },
  {
    name: "Smartadv",
    defaultUrl: "https://www.knownwalk.com/2QFN9TCF/212FPSJB/?uid=4274&source_id=dhs1&sub1=dhs2",
    subIdPattern: "uid=4274&source_id=dhs1&sub1=dhs2",
  },
  {
    name: "Clickhunts",
    defaultUrl: "https://www.ch8gs4fh.com/FLMK4B3/J2P2QXJ/?sub1=dhs&sub2=dhs2",
    subIdPattern: "sub1=dhs&sub2=dhs2",
  },
  {
    name: "Mediascalers",
    defaultUrl: "https://www.clickrtrckr.com/2L8CJN2/4G42Q1R/?uid=6377&sub1=tbr1&sub2=tbr2",
    subIdPattern: "uid=6377&sub1=tbr1&sub2=tbr2",
  },
  {
    name: "SellHealth",
    defaultUrl: "https://www.testosil.com/ct/842851?t1=dhs&t2=dhs2",
    subIdPattern: "t1=dhs&t2=dhs2",
  },
  {
    name: "ClickBank",
    defaultUrl: "https://a4efdmw8q9umqp3ksmu9393vc1.hop.clickbank.net/?&aff_sub1=dhs&aff_sub2=dhs2",
    subIdPattern: "aff_sub1=dhs&aff_sub2=dhs2",
  },
  {
    name: "TerraLeads",
    defaultUrl: "https://tl-track.com/tracker/vWtB?subid=dhs1&subid2=dhs2",
    subIdPattern: "subid=dhs1&subid2=dhs2",
  },
  {
    name: "MaxWeb",
    defaultUrl: "https://mwebtrackerhq.com/11329/5919/7/?subid1=hsb1&subid2=hsb2",
    subIdPattern: "subid1=hsb1&subid2=hsb2",
  },
  {
    name: "Clickadv",
    defaultUrl: "https://www.chffn8trk.com/7WD8LKP/36GN49FC/?sub1=dhs&sub2=dhs2",
    subIdPattern: "sub1=dhs&sub2=dhs2",
  },
  {
    name: "Traffic Light",
    defaultUrl: "https://arthrovia.xcartpro.com/r1sdff/?lnk=100655&s=kNgTVD5m&sub1=mag2&sub2=mag2",
    subIdPattern: "lnk=100655&s=kNgTVD5m&sub1=mag2&sub2=mag2",
  },
  {
    name: "Lead Bit",
    defaultUrl: "https://keonv.com/Ql0S?sub1=mag&sub2=mag2",
    subIdPattern: "sub1=mag&sub2=mag2",
  },
];

async function hasPermission(userId?: number) {
  if (!userId) return true; // allow if no userId passed for backward compatibility, or check DB
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
export async function GET(req: NextRequest) {
  try {
    let affiliates = await prisma.affiliateName.findMany({
      orderBy: { name: "asc" },
    });

    // Seed defaults if table is empty or missing details
    if (affiliates.length === 0) {
      for (const item of DEFAULT_AFFILIATES) {
        await prisma.affiliateName.create({
          data: item,
        });
      }
      affiliates = await prisma.affiliateName.findMany({
        orderBy: { name: "asc" },
      });
    } else {
      // Ensure defaults exist or are populated if not present
      for (const item of DEFAULT_AFFILIATES) {
        const found = affiliates.find(
          (a) => a.name.toLowerCase() === item.name.toLowerCase()
        );
        if (!found) {
          await prisma.affiliateName.create({ data: item });
        } else if (!found.defaultUrl || !found.subIdPattern) {
          await prisma.affiliateName.update({
            where: { id: found.id },
            data: {
              defaultUrl: found.defaultUrl || item.defaultUrl,
              subIdPattern: found.subIdPattern || item.subIdPattern,
            },
          });
        }
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

// POST /api/affiliates — add new affiliate with URL and Sub ID pattern
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, defaultUrl, subIdPattern, callerId } = body;

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
      const updated = await prisma.affiliateName.update({
        where: { id: existing.id },
        data: {
          defaultUrl: defaultUrl?.trim() || existing.defaultUrl,
          subIdPattern: subIdPattern?.trim() || existing.subIdPattern,
        },
      });
      return NextResponse.json(updated);
    }

    const created = await prisma.affiliateName.create({
      data: {
        name: trimmedName,
        defaultUrl: defaultUrl?.trim() || null,
        subIdPattern: subIdPattern?.trim() || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to save affiliate" },
      { status: 500 }
    );
  }
}
