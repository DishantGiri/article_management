import { createServer, IncomingMessage } from "http";
import { UrlWithParsedQuery } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { getToken } from "next-auth/jwt";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3022", 10);

const parseUrl = (urlStr: string): UrlWithParsedQuery => {
  const isAbsolute = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(urlStr) || urlStr.startsWith("//");
  if (isAbsolute) {
    const url = new URL(urlStr.startsWith("//") ? `http:${urlStr}` : urlStr);
    return {
      query: Object.fromEntries(url.searchParams),
      pathname: url.pathname,
      search: url.search || null,
      hash: url.hash || null,
      href: url.href,
      port: url.port || null,
      hostname: url.hostname || null,
      host: url.host || null,
      protocol: url.protocol || null,
      auth: url.username ? `${url.username}:${url.password}` : null,
      slashes: true,
      path: url.pathname + url.search,
    };
  } else {
    const url = new URL(urlStr, "http://localhost");
    return {
      query: Object.fromEntries(url.searchParams),
      pathname: url.pathname,
      search: url.search || null,
      hash: url.hash || null,
      href: urlStr,
      port: null,
      hostname: null,
      host: null,
      protocol: null,
      auth: null,
      slashes: null,
      path: url.pathname + url.search,
    };
  }
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<number, Set<WebSocket>>();

  const server = createServer((req, res) => {
    const parsedUrl = parseUrl(req.url || "");
    const { pathname } = parsedUrl;

    // Handle WebSocket notification triggers via HTTP POST /notify
    if (req.method === "POST" && pathname === "/notify") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const authHeader = req.headers["authorization"];
          const secret = process.env.NEXTAUTH_SECRET;
          
          if (!authHeader || authHeader !== `Bearer ${secret}`) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
          }

          const payload = JSON.parse(body);
          const { recipientId, senderId, message, id, createdAt, type, broadcast, data } = payload;
          const payloadStr = JSON.stringify({ id, senderId, message, createdAt, type, data });

          if (broadcast) {
            let broadcastCount = 0;
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(payloadStr);
                broadcastCount++;
              }
            });
            console.log(`Broadcasted real-time notification: "${message || type}" to ${broadcastCount} connected client sockets`);
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
    const parsedUrl = parseUrl(request.url || "");
    const { pathname } = parsedUrl;

    if (pathname === "/ws" || pathname === "/ws/" || pathname?.startsWith("/ws")) {
      try {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } catch (err) {
        console.error("WebSocket upgrade error:", err);
        socket.destroy();
      }
    } else if (!pathname?.startsWith("/_next")) {
      socket.destroy();
    }
  });

  wss.on("connection", async (ws: WebSocket, request: IncomingMessage) => {
    let registeredUserId: number | null = null;
    let authenticatedUserId: number | null = null;

    try {
      // Parse cookies from raw header so NextAuth getToken can inspect them
      const cookieHeader = request.headers["cookie"] || "";
      const parsedCookies: Record<string, string> = {};
      if (cookieHeader) {
        cookieHeader.split(";").forEach((pair) => {
          const [k, ...v] = pair.trim().split("=");
          if (k) parsedCookies[k] = decodeURIComponent(v.join("="));
        });
      }
      (request as any).cookies = parsedCookies;

      const forwardedProto = request.headers["x-forwarded-proto"];
      const isSecure =
        forwardedProto === "https" ||
        (Array.isArray(forwardedProto) && forwardedProto.includes("https")) ||
        (process.env.NEXTAUTH_URL || "").startsWith("https://") ||
        (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://");

      // Try with secureCookie matching protocol first
      let token = await getToken({
        req: request as any,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: isSecure,
      });

      // Fallback: try alternate secureCookie setting if first attempt returns null
      if (!token || !token.id) {
        token = await getToken({
          req: request as any,
          secret: process.env.NEXTAUTH_SECRET,
          secureCookie: !isSecure,
        });
      }

      if (token && token.id) {
        authenticatedUserId = Number(token.id);
      }
    } catch (e) {
      console.error("Failed to decode token on WebSocket connection:", e);
    }

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "register") {
          // If authenticated session exists, always bind to authenticated user ID
          if (authenticatedUserId !== null) {
            registeredUserId = authenticatedUserId;
          } else if (data.userId) {
            // Fallback to client-provided userId
            registeredUserId = Number(data.userId);
          } else {
            console.warn("Rejected unauthenticated WebSocket registration attempt");
            ws.close(1008, "Authentication required");
            return;
          }

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
