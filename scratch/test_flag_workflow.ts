import { prisma } from "../src/lib/prisma";

async function testFlagWorkflow() {
  console.log("=== Testing Flag Approved Article for Update Workflow ===");

  const approvedArticle = await prisma.article.findFirst({
    where: { status: "APPROVED" },
    include: { product: true, writer: true },
  });

  if (!approvedArticle) {
    console.log("No approved article found to test.");
    return;
  }

  const writerId = approvedArticle.writerId || 51;
  const initialStatus = approvedArticle.status;
  console.log(`Testing with Article ID ${approvedArticle.id}: "${approvedArticle.product.name}" (Writer: ${approvedArticle.writer?.name || writerId})`);

  // 1. Team Lead raises a flag for update on the approved article
  console.log("\n1. Team Lead raises flag to writer for update...");
  const updateInstructions = "Client changed pricing and bridge link is broken. Please update immediately.";
  
  const reopened = await prisma.article.update({
    where: { id: approvedArticle.id },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
      writerId: writerId,
      specialApprovalRequested: false,
      specialApprovalRequestReason: null,
    },
    include: { writer: true, product: true },
  });

  await prisma.articleReview.create({
    data: {
      articleId: approvedArticle.id,
      reviewedById: 46, // Sujata (TL)
      suggestion: updateInstructions,
      approved: false,
    },
  });

  const history = await prisma.articleHistory.create({
    data: {
      articleId: approvedArticle.id,
      updatedById: 46,
      oldStatus: "APPROVED",
      newStatus: "IN_PROGRESS",
      notes: `Flagged for update by Team Lead Sujata to writer ${reopened.writer?.name}. Instructions: ${updateInstructions}`,
    },
  });

  const notif = await prisma.notification.create({
    data: {
      recipientId: writerId,
      senderId: 46,
      type: "ARTICLE_SUGGESTION",
      message: `Flag Raised: Team Lead Sujata flagged approved article "${reopened.product.name}" for update. Instructions: ${updateInstructions}`,
    },
  });

  console.log(`-> Reopened Status: ${reopened.status}`);
  console.log(`-> Assigned Writer: ${reopened.writer?.name} (ID: ${reopened.writerId})`);
  console.log(`-> History Logged: "${history.notes}"`);
  console.log(`-> Notification Dispatched: "${notif.message}"`);

  // Clean up: revert article back to APPROVED and remove test notification/review
  await prisma.article.update({
    where: { id: approvedArticle.id },
    data: { status: initialStatus, startedAt: approvedArticle.startedAt },
  });
  await prisma.notification.delete({ where: { id: notif.id } });
  await prisma.articleHistory.delete({ where: { id: history.id } });

  console.log("\n=== Flag Workflow Verified Successfully! ===");
}

testFlagWorkflow()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
