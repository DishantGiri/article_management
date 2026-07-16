export async function sendRealtimeNotification(
  recipientId: number,
  notification: { id: number; message: string; type: string; createdAt: Date }
) {
  try {
    const port = process.env.PORT || "3022";
    const secret = process.env.NEXTAUTH_SECRET;
    await fetch(`http://localhost:${port}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify({
        recipientId,
        id: notification.id,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
      }),
    });
  } catch (err) {
    console.error("Failed to forward notification to WebSocket server:", err);
  }
}
