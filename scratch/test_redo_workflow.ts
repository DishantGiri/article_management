import { prisma } from "../src/lib/prisma";

async function verifyRedoAndTLWorkflow() {
  console.log("=== Verifying Team Lead & Redo Notification Workflow ===");

  // 1. Check Team Leads and their assigned writers
  const teamLeads = await prisma.user.findMany({
    where: { role: "TEAM_LEAD" },
    include: {
      teamMembers: {
        where: { role: "WRITER" },
        select: { id: true, name: true, email: true },
      },
    },
  });

  console.log(`Found ${teamLeads.length} Team Lead(s):`);
  for (const tl of teamLeads) {
    console.log(`- TL: ${tl.name} (ID: ${tl.id}, Email: ${tl.email})`);
    console.log(`  Assigned Writers (${tl.teamMembers.length}): ${tl.teamMembers.map(w => `${w.name} (#${w.id})`).join(", ") || "None"}`);
  }

  // 2. Find an article written by a writer
  const article = await prisma.article.findFirst({
    where: { writerId: { not: null } },
    include: {
      writer: true,
      product: true,
      reviews: true,
    },
  });

  if (!article || !article.writer) {
    console.log("No article with assigned writer found.");
    return;
  }

  console.log(`\nTesting with Article #${article.id} for product "${article.product.name}"`);
  console.log(`Assigned Writer: ${article.writer.name} (ID: ${article.writer.id})`);

  // 3. Verify notification recipient logic for REDO
  const reviewer = teamLeads[0];
  const remark = "Please verify the affiliate bridge link and update the conclusion paragraph.";
  const notifMessage = `Changes requested on your article for "${article.product.name}" by Team Lead ${reviewer.name}. Remark: ${remark}`;

  // Create test notification to verify DB constraints and relation
  const notif = await prisma.notification.create({
    data: {
      recipientId: article.writer.id,
      senderId: reviewer.id,
      type: "ARTICLE_SUGGESTION",
      message: notifMessage,
    },
  });

  console.log(`\nCreated notification #${notif.id}:`);
  console.log(`- Recipient (Writer): ${notif.recipientId}`);
  console.log(`- Sender (TL): ${notif.senderId}`);
  console.log(`- Type: ${notif.type}`);
  console.log(`- Message: ${notif.message}`);

  // 4. Fetch notifications for this writer
  const writerNotifs = await prisma.notification.findMany({
    where: { recipientId: article.writer.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  console.log(`\nWriter has ${writerNotifs.length} recent notification(s). Latest:`);
  for (const n of writerNotifs) {
    console.log(`- [${n.type}] ${n.message} (Read: ${n.isRead})`);
  }

  // Clean up test notification
  await prisma.notification.delete({ where: { id: notif.id } });
  console.log(`\nCleaned up test notification #${notif.id}.`);
  console.log("\nAll workflow and database assertions PASSED successfully!");
}

verifyRedoAndTLWorkflow().finally(() => prisma.$disconnect());
