export async function sendRealtimeNotification(
  recipientId: number,
  notification: { id: number; message: string; type: string; createdAt: Date; senderId?: number | null }
) {
  // Always call /notify on localhost directly - never through the public domain/Nginx.
  // Fire-and-forget with a short timeout so API responses are never blocked.
  const baseUrl = (
    process.env.INTERNAL_SERVER_URL ||
    `http://localhost:${process.env.PORT || "3022"}`
  ).replace(/\/$/, "");
  const secret = process.env.NEXTAUTH_SECRET;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  fetch(`${baseUrl}/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      recipientId,
      senderId: notification.senderId,
      id: notification.id,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt,
    }),
  })
    .catch((err) => {
      console.error("Failed to forward notification to WebSocket server:", err);
    })
    .finally(() => clearTimeout(timeout));
}

export async function broadcastRealtimeNotification(
  notification: { id?: number; message: string; type: string; createdAt?: Date; senderId?: number | null; data?: any }
) {
  // Always call /notify on localhost directly - never through the public domain/Nginx.
  // Fire-and-forget with a short timeout so API responses are never blocked.
  const baseUrl = (
    process.env.INTERNAL_SERVER_URL ||
    `http://localhost:${process.env.PORT || "3022"}`
  ).replace(/\/$/, "");
  const secret = process.env.NEXTAUTH_SECRET;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  fetch(`${baseUrl}/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      broadcast: true,
      senderId: notification.senderId ?? null,
      id: notification.id,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt || new Date(),
      data: notification.data,
    }),
  })
    .catch((err) => {
      console.error("Failed to broadcast notification to WebSocket server:", err);
    })
    .finally(() => clearTimeout(timeout));
}
