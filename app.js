const el = (id) => document.getElementById(id);
const languageEl = el("language"), modeEl = el("mode"), codeEl = el("codeInput"), errorEl = el("errorInput");
const analyzeBtn = el("analyzeBtn"), clearBtn = el("clearBtn"), outputEl = el("analysisOutput"), analyzerErr = el("analyzerError");
const chatForm = el("chatForm"), chatInput = el("chatInput"), sendBtn = el("sendBtn"), chatBox = el("chatMessages"), chatErr = el("chatError");

let chatHistory = [];
let activeController = null;

const showErr = (node, msg) => { node.textContent = msg; node.classList.remove("hidden"); };
const hideErr = (node) => { node.textContent = ""; node.classList.add("hidden"); };

function renderMarkdown(raw) {
  if (!raw) return "";

  // 1. Escape HTML
  let s = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Math & symbol replacements (roots, superscripts, LaTeX symbols)
  s = s.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");
  s = s.replace(/\\sqrt\s*([a-zA-Z0-9]+)/g, "√$1");
  s = s.replace(/\bsqrt\(([^)]+)\)/g, "√($1)");
  s = s.replace(/\\le(?!a-zA-Z)/g, "≤");
  s = s.replace(/\\ge(?!a-zA-Z)/g, "≥");
  s = s.replace(/\\ne(?!a-zA-Z)/g, "≠");
  s = s.replace(/\\times(?!a-zA-Z)/g, "×");
  s = s.replace(/\\cdot(?!a-zA-Z)/g, "·");
  s = s.replace(/\\(?:to|rightarrow)(?!a-zA-Z)/g, "→");
  s = s.replace(/\\log(?!a-zA-Z)/g, "log");

  // Superscripts (e.g., n^2 -> n², 2^n -> 2ⁿ, n^(1/2) -> n¹ᐟ²)
  const supers = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "n": "ⁿ", "k": "ᵏ", "m": "ᵐ", "x": "ˣ", "+": "⁺",
    "-": "⁻", "/": "ᐟ", "(": "⁽", ")": "⁾"
  };
  s = s.replace(/\^([0-9nkmx+-])/g, (_, ch) => supers[ch] || "^" + ch);
  s = s.replace(/\^\{([0-9nkmx+-\/()]+)\}/g, (_, seq) => seq.split("").map((c) => supers[c] || c).join(""));
  s = s.replace(/\^\(([0-9nkmx+-\/]+)\)/g, (_, seq) => seq.split("").map((c) => supers[c] || c).join(""));

  // Strip math delimiters: $...$ or $$...$$
  s = s.replace(/\$\$([^$]+)\$\$/g, '<span class="math-block">$1</span>');
  s = s.replace(/\$([^$]+)\$/g, '<span class="math">$1</span>');

  // 3. Code blocks (```lang ... ```)
  s = s.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>');

  // 4. Inline code (`code`)
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // 5. Bold & Italic
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  // 6. Headings & Lists
  const lines = s.split("\n");
  let inList = false;
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)(?:[*+-]|\d+\.)\s+(.*)$/);
    if (bulletMatch) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push("<li>" + bulletMatch[2] + "</li>");
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (line.trim().length > 0) {
        if (/^###\s+(.*)$/.test(line)) {
          out.push("<h4>" + line.replace(/^###\s+/, "") + "</h4>");
        } else if (/^##\s+(.*)$/.test(line)) {
          out.push("<h3>" + line.replace(/^##\s+/, "") + "</h3>");
        } else {
          out.push("<p>" + line + "</p>");
        }
      }
    }
  }
  if (inList) out.push("</ul>");

  return out.join("\n");
}

function appendMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  if (role === "user") {
    div.textContent = text;
  } else {
    div.innerHTML = renderMarkdown(text);
  }
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

async function streamApi(payload, onChunk, signal) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const raw = await res.text();
    let msg = raw || "Request failed";
    try { msg = JSON.parse(raw).error || msg; } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const dataStr = line.slice(6).trim();
      if (!dataStr || dataStr === "[DONE]") continue;
      const parsed = JSON.parse(dataStr);
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.text) {
        fullText += parsed.text;
        onChunk(fullText);
      }
    }
  }
  return fullText || "No response generated.";
}

analyzeBtn.addEventListener("click", async () => {
  hideErr(analyzerErr);
  const code = codeEl.value.trim(), error = errorEl.value.trim();
  if (!code && !error) return showErr(analyzerErr, "Paste a code snippet or an error message first.");

  if (activeController) activeController.abort();
  activeController = new AbortController();
  const timeout = setTimeout(() => activeController.abort(), 35000);

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  outputEl.textContent = "Connecting to Walkthru...";

  try {
    const reply = await streamApi(
      { type: "analyze", language: languageEl.value, mode: modeEl.value, code, error },
      (partial) => { outputEl.innerHTML = renderMarkdown(partial); },
      activeController.signal
    );
    outputEl.innerHTML = renderMarkdown(reply);
    chatHistory.push({ role: "bot", text: reply });
  } catch (err) {
    outputEl.innerHTML = "<p>Analysis stopped due to an error.</p>";
    showErr(analyzerErr, err.name === "AbortError" ? "Timed out after 35s. Try again." : err.message);
  } finally {
    clearTimeout(timeout);
    activeController = null;
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Code";
  }
});

clearBtn.addEventListener("click", () => {
  if (activeController) activeController.abort();
  codeEl.value = "";
  errorEl.value = "";
  outputEl.innerHTML = "Select a mode above and click Analyze Code to generate a step-by-step dry run, Socratic clue, edge-case table, or viva drill.";
  hideErr(analyzerErr);
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideErr(chatErr);
  const message = chatInput.value.trim();
  if (!message) return;

  appendMsg("user", message);
  chatInput.value = "";
  sendBtn.disabled = true;
  sendBtn.textContent = "...";
  const botBubble = appendMsg("bot", "Thinking...");

  try {
    const reply = await streamApi(
      {
        type: "chat",
        language: languageEl.value,
        mode: modeEl.value,
        code: codeEl.value.trim(),
        error: errorEl.value.trim(),
        message,
        history: chatHistory
      },
      (partial) => {
        botBubble.innerHTML = renderMarkdown(partial);
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    );
    botBubble.innerHTML = renderMarkdown(reply);
    chatHistory.push({ role: "user", text: message }, { role: "bot", text: reply });
  } catch (err) {
    botBubble.remove();
    showErr(chatErr, err.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  }
});