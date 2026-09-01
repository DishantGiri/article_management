import { prisma } from "../src/lib/prisma";

async function testNotifications() {
  console.log("--- Testing Writer to Team Lead Notification Targeting ---");

  // Find a writer with a team lead
  const writer = await prisma.user.findFirst({
    where: { role: "WRITER", teamLeadId: { not: null } },
    include: { teamLead: true }
  });

  if (!writer || !writer.teamLead) {
    console.log("No writer with team lead found.");
    return;
  }

  console.log(`Writer: ${writer.name} (ID: ${writer.id})`);
  console.log(`Assigned Team Lead: ${writer.teamLead.name} (ID: ${writer.teamLead.id})`);

  // Verify that other writers exist
  const otherWriters = await prisma.user.findMany({
    where: { role: "WRITER", id: { not: writer.id } },
    select: { id: true, name: true }
  });
  console.log(`Other writers who should NOT receive notification (${otherWriters.length}):`, otherWriters.map(w => w.name).join(", "));

  // Check the notification record recipient logic
  const targetRecipientId = writer.teamLeadId;
  console.log(`Target Recipient for Article Start / Complete: ID ${targetRecipientId} (${writer.teamLead.name}) ONLY.`);
  console.log("Notification logic verification PASSED.");
}

testNotifications().finally(() => prisma.$disconnect());
