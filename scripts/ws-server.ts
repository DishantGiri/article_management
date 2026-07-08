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
          clients.forEach((sockets) => {
            sockets.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(payloadStr);
              }
            });
          });
          console.log(`Broadcasted real-time notification: "${message || type}" to ${clients.size} users`);
        } else {
          const sockets = clients.get(Number(recipientId));
          if (sockets && sockets.size > 0) {
            let sentCount = 0;
            sockets.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(payloadStr);
                sentCount++;
              }
            });
            console.log(`Pushed real-time notification to user ${recipientId} (${sentCount} tabs active): "${message}"`);
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
const clients = new Map<number, Set<WebSocket>>();

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
        if (!clients.has(registeredUserId)) {
          clients.set(registeredUserId, new Set());
        }
        clients.get(registeredUserId)!.add(ws);
        console.log(`User ${registeredUserId} registered for WebSocket notifications. Total connections: ${clients.get(registeredUserId)!.size}`);
      }
    } catch (err) {
      console.error("WebSocket message parsing error:", err);
    }
  });

  ws.on("close", () => {
    if (registeredUserId !== null) {
      const sockets = clients.get(registeredUserId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          clients.delete(registeredUserId);
        }
      }
      console.log(`User ${registeredUserId} disconnected.`);
    }
  });
});

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3021;
server.listen(PORT, () => {
  console.log(`WebSocket notification server running on http://localhost:${PORT}`);
});
