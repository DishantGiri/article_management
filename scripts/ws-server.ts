import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/notify") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { recipientId, message, id, createdAt, type, broadcast, data } = payload;
        
        const payloadStr = JSON.stringify({ id, message, createdAt, type, data });

        if (broadcast) {
          clients.forEach((client, userId) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(payloadStr);
            }
          });
          console.log(`Broadcasted real-time notification: "${message || type}" to ${clients.size} users`);
        } else {
          const client = clients.get(Number(recipientId));
          if (client && client.readyState === WebSocket.OPEN) {
            client.send(payloadStr);
            console.log(`Pushed real-time notification to user ${recipientId}: "${message}"`);
          } else {
            console.log(`User ${recipientId} is offline. Live notification skipped.`);
          }
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid payload" }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ noServer: true });
const clients = new Map<number, WebSocket>();

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws) => {
  let registeredUserId: number | null = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === "register" && data.userId) {
        registeredUserId = Number(data.userId);
        clients.set(registeredUserId, ws);
        console.log(`User ${registeredUserId} registered for WebSocket notifications.`);
      }
    } catch (err) {
      console.error("WebSocket message parsing error:", err);
    }
  });

  ws.on("close", () => {
    if (registeredUserId !== null) {
      clients.delete(registeredUserId);
      console.log(`User ${registeredUserId} disconnected.`);
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`WebSocket notification server running on http://localhost:${PORT}`);
});
