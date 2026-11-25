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
  ".js": "application/javascript; charset=utf-8"
};

// Strict whitelist of public files that clients are allowed to request
const ALLOWED_PUBLIC_FILES = new Set(["index.html", "style.css", "app.js"]);

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:;"
  );
}

http.createServer((req, res) => {
  setSecurityHeaders(res);
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // Health check endpoint for cloud load balancers
  if (parsedUrl.pathname === "/health" || parsedUrl.pathname === "/api/health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ status: "ok", uptime: Math.floor(process.uptime()) }));
  }

  // Handle HEAD requests
  if (req.method === "HEAD") {
    res.statusCode = 200;
    return res.end();
  }

  // API Route
  if (parsedUrl.pathname === "/api/chat") {
    let body = "";
    let isTooLarge = false;

    // Guard against oversized payload attacks (max 50KB)
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 50000) {
        isTooLarge = true;
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Payload exceeds 50KB limit" }));
        req.destroy();
      }
    });

    req.on("end", async () => {
      if (isTooLarge) return;
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

  // Static File Serving with strict whitelisting
  const rawPath = parsedUrl.pathname === "/" ? "index.html" : parsedUrl.pathname.slice(1);
  if (!ALLOWED_PUBLIC_FILES.has(rawPath)) {
    res.statusCode = 404;
    return res.end("Not found");
  }

  const filePath = path.normalize(path.join(process.cwd(), rawPath));
  const ext = path.extname(filePath);
  if (MIME[ext] && fs.existsSync(filePath)) {
    res.setHeader("Content-Type", MIME[ext]);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.statusCode = 404;
    res.end("Not found");
  }
}).listen(PORT, "0.0.0.0", () => console.log(`Walkthru running at http://localhost:${PORT}`));
