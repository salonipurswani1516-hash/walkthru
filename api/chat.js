import fs from "node:fs";

// Load environment variables if not already present
try {
  if (!process.env.GEMINI_API_KEY) {
    if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
    else if (fs.existsSync(".env")) process.loadEnvFile(".env");
  }
} catch {}

const MODE_RULES = {
  dryrun: `Be concise and fast. Trace on 1 concrete input (use a failing edge case if an error is given):
Input -> ...
Init -> ...
Step -> ... -> ⚠️/❌ if bug
Result -> ...`,

  socratic: `Be concise. Strict lab instructor—DO NOT reveal the fix or full answer yet.
- Initial: 1 short clue on the suspicious line/variable + 1 question for the chat.
- Chat: Grade reply briefly; give 1 small nudge or confirm + minimal fix if solved.`,

  edgecases: `Be concise and structured:
- List 4 key edge cases with Input, Expected, and Risk (no pipe tables).
- Show only the broken vs fixed lines.
- End with 3 short checklist bullets.`,

  viva: `Be concise. Strict CS viva examiner:
- Initial: Ask 3 short questions (1: edge cases, 2: time/space complexity, 3: design choice). Reply Q1, Q2, Q3 in chat.
- Chat: Score /10 per answer + brief fix/follow-up.`
};

function extractDeltaText(evt) {
  if (evt?.delta?.type === "text" && typeof evt.delta.text === "string") return evt.delta.text;
  if (typeof evt?.delta?.text === "string") return evt.delta.text;
  if (typeof evt?.text === "string") return evt.text;
  return "";
}

function sendSSE(res, text) {
  if (!res.headersSent) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
  }
  res.write(`data: ${JSON.stringify({ text })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { type, language = "Python", mode = "dryrun", code = "", error = "", message = "", history = [] } = req.body || {};
  if (type !== "chat" && !code.trim() && !error.trim()) {
    return res.status(400).json({ error: "Paste a code snippet or error message first." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendSSE(res, "GEMINI_API_KEY is not configured. Please set your API key in .env.local to enable live AI analysis.");
  }

  let prompt = "";
  if (type === "chat") {
    let role = "You are Walkthru, an interactive CS code companion and debugging tutor.";
    if (mode === "socratic") {
      role += " The student is responding to a Socratic clue. Give a brief, helpful nudge or confirmation. Do not give away the whole solution unless they have found it.";
    } else if (mode === "viva") {
      role += " The student is in a viva code defense drill. Grade their answers briefly out of 10 and give concise feedback.";
    } else {
      role += " Answer the student's question directly, clearly, and concisely as a friendly CS mentor. Do NOT use the 'Input -> Init -> Step -> Result' dry-run template for general chat questions. Use standard notation like O(n) without LaTeX dollar signs.";
    }

    prompt = `${role}\nLanguage: ${language}\n`;
    if (code.trim()) prompt += `Editor Code:\n\`\`\`\n${code}\n\`\`\`\n`;
    if (error.trim()) prompt += `Editor Error: ${error}\n`;
    if (history.length) {
      const recent = history.slice(-6).map((m) => `${m.role === "user" ? "Student" : "Walkthru"}: ${m.text}`).join("\n");
      prompt += `\nRecent Chat:\n${recent}\n`;
    }
    prompt += `\nStudent: ${message}\nWalkthru:`;
  } else {
    const rule = MODE_RULES[mode] || MODE_RULES.dryrun;
    prompt = `${rule}\nLang: ${language}\n`;
    if (code.trim()) prompt += `Code:\n\`\`\`\n${code}\n\`\`\`\n`;
    if (error.trim()) prompt += `Error: ${error}\n`;
    prompt += `\nRun ${mode} now.`;
  }

  try {
    const configuredModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const candidateModels = [
      configuredModel,
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest"
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let upstream = null;
    for (const modelCandidate of candidateModels) {
      try {
        const candidateResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            model: modelCandidate,
            input: prompt,
            stream: true,
            store: false
          })
        });

        if (candidateResponse.ok) {
          upstream = candidateResponse;
          break;
        } else {
          console.warn(`Model ${modelCandidate} returned status ${candidateResponse.status}`);
        }
      } catch (candidateErr) {
        console.warn(`Model ${modelCandidate} request failed:`, candidateErr.message);
      }
    }

    if (!upstream || !upstream.ok) {
      throw new Error(`Upstream unavailable (tried ${candidateModels.join(", ")})`);
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sentAny = false;
    let clientDisconnected = false;

    req.on("close", () => {
      clientDisconnected = true;
      try { reader.cancel(); } catch {}
    });

    while (!clientDisconnected) {
      const { done, value } = await reader.read();
      if (done || clientDisconnected) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const parsed = JSON.parse(raw);
          const chunk = extractDeltaText(parsed);
          if (chunk) {
            sentAny = true;
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          }
        } catch {}
      }
    }

    if (!sentAny && !clientDisconnected) {
      res.write(`data: ${JSON.stringify({ text: "No response generated by model." })}\n\n`);
    }

    if (!clientDisconnected) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (err) {
    console.error("AI service error:", err.message);
    sendSSE(res, "The AI service is temporarily unavailable. Please verify your GEMINI_API_KEY and connection.");
  }
}
