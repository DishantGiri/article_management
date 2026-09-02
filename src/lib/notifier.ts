export async function sendRealtimeNotification(
  recipientId: number,
  notification: { id: number; message: string; type: string; createdAt: Date; senderId?: number | null }
) {
  try {
    // Always call /notify on localhost directly — never through the public domain/Nginx.
    // This avoids TLS issues and unnecessary round-trips in production.
    const baseUrl = (
      process.env.INTERNAL_SERVER_URL ||
      `http://localhost:${process.env.PORT || "3022"}`
    ).replace(/\/$/, "");
    const secret = process.env.NEXTAUTH_SECRET;
    await fetch(`${baseUrl}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify({
        recipientId,
        senderId: notification.senderId,
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

export async function broadcastRealtimeNotification(
  notification: { id?: number; message: string; type: string; createdAt?: Date; senderId?: number | null; data?: any }
) {
  try {
    // Always call /notify on localhost directly — never through the public domain/Nginx.
    const baseUrl = (
      process.env.INTERNAL_SERVER_URL ||
      `http://localhost:${process.env.PORT || "3022"}`
    ).replace(/\/$/, "");
    const secret = process.env.NEXTAUTH_SECRET;
    await fetch(`${baseUrl}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify({
        broadcast: true,
        senderId: notification.senderId ?? null,
        id: notification.id,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt || new Date(),
        data: notification.data,
      }),
    });
  } catch (err) {
    console.error("Failed to broadcast notification to WebSocket server:", err);
  }
}
