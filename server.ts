import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3022", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<number, Set<WebSocket>>();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "", true);
    const { pathname } = parsedUrl;

    // Handle WebSocket notification triggers via HTTP POST /notify
    if (req.method === "POST" && pathname === "/notify") {
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
      // Forward all other HTTP requests to Next.js
      handle(req, res, parsedUrl);
    }
  });

  server.on("upgrade", (request, socket, head) => {
    const parsedUrl = parse(request.url || "", true);
    const { pathname } = parsedUrl;

    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else if (!pathname?.startsWith("/_next")) {
      socket.destroy();
    }
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
          console.log(`User ${registeredUserId} registered for WebSocket. Total connections: ${clients.get(registeredUserId)!.size}`);
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

  server.listen(port, () => {
    console.log(`> Web Application and WebSocket server running on http://${hostname}:${port}`);
  });
});
