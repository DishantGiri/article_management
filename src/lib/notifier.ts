export async function sendRealtimeNotification(
  recipientId: number,
  notification: { id: number; message: string; type: string; createdAt: Date }
) {
  try {
    await fetch("http://localhost:3001/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
