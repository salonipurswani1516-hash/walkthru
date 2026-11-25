# Walkthru — Deployment Guide

This guide covers step-by-step instructions for deploying **Walkthru** to popular hosting platforms. Walkthru is built with zero runtime dependencies and can run as either a **serverless application** (e.g., Vercel) or a **standalone Node.js server** (e.g., Render, Railway, Docker, VPS).

---

## Prerequisites & Required Secrets

Regardless of the deployment platform, the only required configuration is a Google Gemini API key:

| Variable | Description | Required? | Default (if omitted) |
| :--- | :--- | :---: | :--- |
| `GEMINI_API_KEY` | Your Google AI Studio API Key | **Yes** | Offline rule-based fallback |
| `GEMINI_MODEL` | Gemini Model Identifier | No | `gemini-3.5-flash-lite` |
| `PORT` | HTTP Server Port (Node runtime) | No | `3000` |

> Obtain an API key for free from the [Google AI Studio](https://aistudio.google.com/).

---

## Option 1: Vercel (Recommended — Serverless, Free & Fast)

Vercel provides native zero-config deployment for static assets with `/api` serverless routes.

1. Push your Walkthru codebase to a GitHub, GitLab, or Bitbucket repository.
2. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New** $\rightarrow$ **Project**.
3. Select your Walkthru repository.
4. Under **Environment Variables**, add:
   * **Key:** `GEMINI_API_KEY`
   * **Value:** `your_gemini_api_key`
5. Click **Deploy**. Vercel will build and assign an SSL-enabled `.vercel.app` URL immediately.

---

## Option 2: Render (Free Node.js Web Service)

Render runs Walkthru as an always-on Node.js HTTP server.

1. Create a repository on GitHub with your Walkthru project files.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New** $\rightarrow$ **Web Service**.
3. Connect your GitHub repository.
4. Configure the service settings:
   * **Environment:** `Node`
   * **Build Command:** *(leave empty)*
   * **Start Command:** `npm start`
5. Scroll down to **Environment Variables** and add:
   * `GEMINI_API_KEY`: `your_gemini_api_key`
   * `NODE_VERSION`: `20` (or `22`)
6. Click **Create Web Service**. Render binds to `$PORT` automatically and runs health checks at `/health`.

---

## Option 3: Railway / Fly.io

### Railway
1. Click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
2. Go to the project **Variables** tab and add `GEMINI_API_KEY`.
3. Railway automatically detects `npm start` and routes traffic to Walkthru.

### Fly.io
Run using the Fly CLI:
```bash
fly launch
fly secrets set GEMINI_API_KEY=your_gemini_api_key
fly deploy
```

---

## Option 4: Self-Hosted VPS (Ubuntu / Debian / Docker)

### Using PM2 (Production Process Manager)
```bash
# 1. Clone repository
git clone https://github.com/your-username/walkthru.git
cd walkthru

# 2. Configure credentials
cp .env.example .env.local
nano .env.local # Paste your GEMINI_API_KEY

# 3. Start process with PM2
npm install -g pm2
pm2 start server.js --name "walkthru"
pm2 save
pm2 startup
```

### Nginx Reverse Proxy Block
```nginx
server {
    listen 80;
    server_name walkthru.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # SSE Streaming headers
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_read_timeout 600s;
    }
}
```

---

## Pre-Deployment Verification Checklist

Before pushing to production, verify:
* [x] `.env.local` is listed in `.gitignore` (never commit private API keys).
* [x] `npm start` launches `node server.js` without errors.
* [x] Health check endpoint `/health` returns `200 OK` (`{"status":"ok"}`).
* [x] Server-Sent Events (SSE) streaming works without buffering or connection drops.
* [x] Client UI renders rich markdown, bold text, code pills, and math ($\sqrt{n}$, $n^2$) cleanly.
