# Walkthru

> **An interactive AI code companion, visual execution trace engine, and Socratic code-defense simulator.**

[![License: MIT](https://img.shields.io/badge/License-MIT-burgundy.svg)](LICENSE)
[![Node: v20+](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![AI: Google Gemini](https://img.shields.io/badge/AI-Gemini%20Flash--Lite-blue.svg)](https://aistudio.google.com/)
[![Deployment: Vercel Ready](https://img.shields.io/badge/Deployment-Vercel%20Ready-black.svg)](https://vercel.com/)

---

## Overview

**Walkthru** is an educational developer workspace designed to replace passive "black-box" AI code generation with active conceptual learning. Rather than simply supplying rewritten code, Walkthru acts as an interactive computer science tutor and execution tracer:

* **Traces Variable Flows:** Visualizes step-by-step mutations on concrete inputs to expose logic bugs.
* **Guides with Socratic Hints:** Identifies suspicious code boundaries and offers nudges without immediately spoiling the solution.
* **Audits Adversarial Corner Cases:** Synthesizes boundary inputs (empty lists, overflow, precision anomalies, negative values).
* **Simulates Viva Defense:** Drills developers on time complexity ($O(n)$, $O(\sqrt{n})$, $O(n \log n)$), space tradeoffs, and design choices.

---

## Core Operational Modes

| Mode | Objective | Sample Output Format |
| :--- | :--- | :--- |
| **Visual Dry-Run Flow** | Step-by-step state trace on concrete inputs | `Input -> Init -> Step -> Result` |
| **Socratic Debugging** | Hint-only lab instructor guidance | Clue on suspicious line + 1 guiding question |
| **Edge-Case Table** | Adversarial boundary condition audit | 4 corner inputs with expected behavior & risks |
| **Viva Defense Drill** | CS oral exam simulation & complexity grading | 3 defense questions evaluated and scored /10 |

---

## Key Features

* **Sub-2-Second Live Streaming:** Built on Google Gemini's low-latency streaming Interactions API with Server-Sent Events (SSE).
* **Rich Math & Typography Engine:** Zero-dependency client parser translating raw LaTeX into clean Unicode notation ($\sqrt{n}$, $n^2$, $2^n$, $\le$, $\ge$) and monospaced code badges.
* **Zero Runtime Dependencies:** Pure Node.js standard library on the backend; vanilla ES Modules and custom CSS on the frontend.
* **Dual-Target Architecture:** Runs as a standalone HTTP server locally or on container platforms (Render, Railway, VPS), and functions out of the box as a serverless application on Vercel.

---

## Tech Stack

* **Frontend:** Semantic HTML5, CSS3 (Obsidian & Deep Burgundy palette), Vanilla JavaScript (ESM)
* **Backend:** Node.js (`http`, `fs`, `path`), Server-Sent Events (SSE)
* **AI Model:** Google Gemini (`gemini-3.5-flash-lite`, `gemini-flash-lite-latest`)
* **Deployment:** Vercel Serverless Functions (`/api/chat.js`) & Node.js (`server.js`)

---

## Project Structure

```
Walkthru/
├── index.html         # Application interface & semantic controls
├── style.css          # Design system, responsive layout & typography
├── app.js             # Client controller, SSE accumulator & Markdown parser
├── server.js          # Native Node.js HTTP server & routing pipeline
├── package.json       # ES Module package definition & scripts
├── vercel.json        # Zero-config Vercel deployment configuration
├── .gitignore         # Ignores credentials (.env.local) and dependencies
├── .env.example       # Template for environment variables
├── api/
│   └── chat.js        # AI Gateway & Gemini streaming handler
├── REPORT.md          # Comprehensive technical report & architecture specs
└── README.md          # Project showcase and developer documentation
```

---

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (version 20.6.0 or higher)
* A [Google AI Studio API Key](https://aistudio.google.com/)

### Local Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/walkthru.git
   cd walkthru
   ```

2. **Configure environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   GEMINI_API_KEY=your_google_ai_studio_api_key_here
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## Deployment

### Deploying to Vercel (1-Click)

1. Push this repository to GitHub.
2. Go to [Vercel](https://vercel.com/new) and click **Import** on your `walkthru` repository.
3. Under **Environment Variables**, add:
   * **Key:** `GEMINI_API_KEY`
   * **Value:** *(your Gemini API key)*
4. Click **Deploy**. Vercel detects `/api/chat.js` and deploys both static assets and serverless routes automatically.

### Deploying to Render / Railway / Docker
Run with standard Node.js:
* **Start Command:** `npm start`
* **Port:** Binds automatically to `$PORT` or defaults to `3000` on `0.0.0.0`.
* **Health Check Endpoint:** `GET /health` (returns `{"status":"ok"}`).

---

## License

This project is licensed under the [MIT License](LICENSE).
