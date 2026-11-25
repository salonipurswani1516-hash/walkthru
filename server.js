import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import handler from "./api/chat.js";

// Auto-load environment variables from .env.local or .env
try {
  if (fs.existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  } else if (fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }
} catch (err) {
  console.warn("Notice: could not auto-load env file:", err.message);
}

const PORT = process.env.PORT || 3000;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // Health check endpoint for container orchestrators and cloud load balancers
  if (parsedUrl.pathname === "/health" || parsedUrl.pathname === "/api/health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ status: "ok", uptime: Math.floor(process.uptime()) }));
  }

  // Handle HEAD requests gracefully
  if (req.method === "HEAD") {
    res.statusCode = 200;
    return res.end();
  }

  if (parsedUrl.pathname === "/api/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try { req.body = body ? JSON.parse(body) : {}; } catch { req.body = {}; }
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (obj) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
      try {
        await handler(req, res);
      } catch (err) {
        console.error("Chat handler error:", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      }
    });
    return;
  }

  const rawPath = parsedUrl.pathname === "/" ? "index.html" : parsedUrl.pathname.slice(1);
  const filePath = path.normalize(path.join(process.cwd(), rawPath));
  if (!filePath.startsWith(process.cwd())) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }

  const ext = path.extname(filePath);
  if (MIME[ext] && fs.existsSync(filePath)) {
    res.setHeader("Content-Type", MIME[ext]);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.statusCode = 404;
    res.end("Not found");
  }
}).listen(PORT, "0.0.0.0", () => console.log(`Walkthru running at http://localhost:${PORT}`));
