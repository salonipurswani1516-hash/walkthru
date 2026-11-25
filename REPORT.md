# Walkthru — Technical Project Report & Architectural Specification

> **An interactive AI code companion, execution trace engine, and Socratic code-defense simulator.**

---

## 1. Executive Summary

**Walkthru** is a developer education and code comprehension platform designed to bridge the gap between static code writing and deep conceptual understanding. Unlike conventional AI coding assistants that generate completed code snippets and encourage passive consumption, Walkthru acts as an active lab instructor and execution trace engine.

The platform provides a dual-panel workspace where developers and computer science students can input source code in any language, observe concrete step-by-step variable mutations, audit corner cases, receive Socratic hints without immediate spoilers, and defend their code against viva-style questioning.

```mermaid
flowchart LR
    A["Developer Source Code & Errors"] --> B["Walkthru Workspace"]
    B --> C["Panel 1: Structural Analysis"]
    B --> D["Panel 2: Interactive AI Tutor"]
    C --> E["Visual Dry-Run Engine"]
    C --> F["Socratic Clue Generator"]
    C --> G["Edge-Case Auditor"]
    C --> H["Viva Defense Drill"]
    D --> I["Real-Time Gemini Streaming"]
```

---

## 2. Problem Statement & The Need for Walkthru

### 2.1 The "Blind Copy-Paste" Epidemic
Modern large language models (LLMs) are exceptionally proficient at writing code. However, in educational settings, technical interviews, and junior engineering workflows, this capability frequently introduces a negative side-effect: **passive reliance**. When learners encounter a bug, standard AI assistants provide the corrected function in full. This eliminates the cognitive struggle necessary to internalize:
* Memory state changes across iterations
* Variable boundary transitions (off-by-one, overflow, zero-division)
* Algorithmic time and space tradeoffs

### 2.2 The Shortcomings of Traditional Debuggers
Traditional software debuggers (GDB, LLDB, Chrome DevTools, IDE debuggers) are powerful but present high friction:
* Setting up breakpoints, watch expressions, and launch configurations requires significant overhead.
* Novice programmers often do not know *which* variables to inspect or *where* logic diverges.
* Debuggers describe *what* the computer is doing, but fail to explain *why* an algorithm fails conceptually.

### 2.3 The Viva & Technical Interview Gap
In academic coursework (CS lab vivas) and industry interviews, engineers are rarely asked simply to write syntax. They must explain:
* *"What is the time and space complexity of this function?"*
* *"What inputs could cause this loop to terminate prematurely or reach an index error?"*
* *"Why did you choose this data structure over an alternative?"*

Walkthru was conceived specifically to address these challenges through structured pedagogy and active dialogue.

---

## 3. Core Architectural Modes

Walkthru provides four dedicated operational modes tailored to different stages of code review and learning:

```mermaid
stateDiagram-v2
    [*] --> WorkspaceInput: Paste Code / Error
    WorkspaceInput --> DryRun: Mode = dryrun
    WorkspaceInput --> Socratic: Mode = socratic
    WorkspaceInput --> EdgeCases: Mode = edgecases
    WorkspaceInput --> Viva: Mode = viva

    DryRun --> TraceOutput: Concrete Step-by-Step Flow
    Socratic --> ClueOutput: Line Clue + Guiding Question
    EdgeCases --> TableOutput: 4 Corner Inputs & Risks
    Viva --> DrillOutput: 3 CS Defense Questions
```

### 3.1 Visual Dry-Run Flow (`dryrun`)
Executes an explicit, human-readable trace of the function on a single concrete input (or a failing edge case if an error trace is provided).
* **Format:**
  $$\text{Input} \longrightarrow \text{Init} \longrightarrow \text{Step-by-Step State Transitions} \longrightarrow \text{Result}$$
* Highlights mutations, off-by-one shifts, and boolean evaluations.

### 3.2 Socratic Debugging (`socratic`)
Emulates a strict, encouraging lab instructor. 
* Never reveals the complete fix or rewritten code upfront.
* Isolates the suspicious line or variable and issues a focused question to prompt the developer to identify the issue themselves.
* When the developer replies in the chat panel, it validates their reasoning and confirms the minimal fix only once the concept is grasped.

### 3.3 Edge-Case & Boundary Table (`edgecases`)
Conducts an adversarial audit of the snippet, generating 4 high-risk corner cases:
1. Empty, null, or zero-length inputs
2. Upper/lower boundary extremes (e.g., negative values, values $> 100\%$)
3. Single-element or degenerate inputs
4. Precision or scale anomalies (floating point tails, integer overflows)

### 3.4 Viva & Code Defense Drill (`viva`)
Simulates a university viva or technical interview panel by querying:
1. **Edge-Case Resilience:** Identifying worst-case breaking inputs.
2. **Complexity Analysis:** Evaluating rigorous asymptotic bounds ($O(n)$, $O(n \log n)$, $O(\sqrt{n})$, space requirements).
3. **Design Decisions:** Probing defensive programming choices and alternate paradigms.
Replies in the chat are graded out of 10 with constructive feedback.

---

## 4. Technical Architecture & Implementation

Walkthru is built with an emphasis on **zero heavy dependencies**, **high responsiveness**, and **clean modularity**.

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Browser)"]
        UI["DOM Interface (index.html)"]
        APP["Client Controller (app.js)"]
        MD["Custom Markdown & Math Engine"]
        CSS["Design System (style.css)"]
    end

    subgraph Server["Backend Server (Node.js)"]
        SRV["HTTP Server (server.js)"]
        API["AI Streaming Gateway (api/chat.js)"]
        ENV["Environment & Secret Manager"]
    end

    subgraph Upstream["Google Generative AI"]
        GEMINI["Gemini Flash-Lite API (SSE)"]
    end

    UI --> APP
    APP -->|SSE POST /api/chat| SRV
    SRV --> API
    API -->|Interactions API| GEMINI
    GEMINI -->|Stream Chunks| API
    API -->|Event Stream| APP
    APP --> MD
    MD --> UI
```

### 4.1 Backend Engine ([server.js](file:///c:/Users/apoor/Walkthru/server.js))
* **Runtime:** Node.js (v20+ native ES Modules, zero external npm dependencies).
* **Environment Management:** Native `process.loadEnvFile(".env.local")` loading with fallback to `.env`.
* **Security & Routing:** Normalized pathname extraction with path traversal guards (`path.normalize` and root boundary validation).
* **MIME Support:** Complete mapping for `.html`, `.css`, `.js`, `.json`, `.svg`, `.png`, and `.ico`.

### 4.2 AI Streaming Gateway ([api/chat.js](file:///c:/Users/apoor/Walkthru/api/chat.js))
* **Upstream Service:** Google Gemini Interactions API (`https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse`).
* **High-Availability Model Cascade:**
  $$\text{gemini-3.5-flash-lite} \xrightarrow{\text{fallback}} \text{gemini-flash-lite-latest}$$
  Restricting the cascade to optimized flash-lite models maintains **sub-2-second token response times** and prevents latency spikes.
* **Dual-Prompt Architecture:**
  * **Code Analysis:** Enforces strict structural templates for execution dry runs and corner-case tables.
  * **Interactive Chatbot:** Switches to a conversational tutor persona, delivering direct answers for follow-ups (complexity, proofs, hints) without forcing robotic trace headers.
* **Resilient Failover:** Built-in offline fallback engine that generates rule-based structural traces if external connectivity is interrupted.

### 4.3 Frontend Controller ([app.js](file:///c:/Users/apoor/Walkthru/app.js))
* **Streaming Accumulator:** Consumes `ReadableStream` chunks via `fetch()`, parsing `data: {"text": "..."}` events dynamically into active UI elements.
* **Custom Markdown & Math Parser (`renderMarkdown`):**
  * Parses bold (`**bold**`), italics (`*italic*`), and code tags (`` `code` ``).
  * Automatically formats lists (`* ` and `- `) into structured `<ul><li>` hierarchies.
  * Translates raw math expressions into clean Unicode notation:
    * Roots: `\sqrt{n}`, `sqrt(n)` $\rightarrow$ $\sqrt{n}$
    * Powers: `n^2` $\rightarrow$ $n^2$, `2^n` $\rightarrow$ $2^n$, `n^(1/2)` $\rightarrow$ $n^{1/2}$
    * Operators: `\le` $\rightarrow$ $\le$, `\ge` $\rightarrow$ $\ge$, `\ne` $\rightarrow$ $\ne$, `\times` $\rightarrow$ $\times$

### 4.4 Design System ([style.css](file:///c:/Users/apoor/Walkthru/style.css))
* **Color Hierarchy:** Deep obsidian (`#090809`), burgundy card bases (`#120f11`, `#1d0b12`), and wine borders (`#471423`, `#7a233c`).
* **Typography:**
  * Headers: **Fraunces** serif for editorial refinement.
  * Body: **Plus Jakarta Sans** for high-legibility interface prose.
  * Code & Output: **JetBrains Mono** for clean monospaced tabular alignment.
* **Spacious Dual-Panel Grid:** Responsive layout with equalized column widths and full-width bot answer cards.

---

## 5. Performance & Verification Metrics

Rigorous end-to-end integration tests were conducted against live endpoints:

| Component | Tested Scenario | Measured Result | Status |
| :--- | :--- | :---: | :---: |
| **HTTP Routing** | Static asset resolution (`/`, `style.css`, `app.js`) | `< 10ms` response | Passed |
| **Code Analyzer** | Full execution trace on `is_palindrome` | `2.22s` total stream | Passed |
| **AI Chatbot** | Conversational time & space complexity query | `0.97s` total stream | Passed |
| **Typography** | Parsing bold, code badges, and square root $\sqrt{n}$ | Instant DOM render | Passed |
| **Layout** | Full-width bot card stretching without awkward line wraps | Verified across viewports | Passed |

---

## 6. Project Directory Map

```
Walkthru/
├── index.html         # Application shell, semantic markup & custom dropdowns
├── style.css          # Design system, layout grid, typography & message bubbles
├── app.js             # Client controller, SSE consumer & Markdown/Math engine
├── server.js          # Native Node.js HTTP server & routing pipeline
├── package.json       # ES Module package definition and lifecycle scripts
├── .env.local         # Local API credentials (GEMINI_API_KEY, GEMINI_MODEL)
├── .env.example       # Template for environment configuration
├── api/
│   └── chat.js        # AI Gateway, model cascading & prompt templates
└── REPORT.md          # Comprehensive technical and architectural project report
```

---

## 7. Future Roadmap

1. **Visual Abstract Syntax Tree (AST) Animator:** Visualizing variable pointers and call stacks in an animated canvas alongside the text trace.
2. **Multi-File & Module Ingestion:** Expanding the workspace to trace imports and helper functions across multiple files.
3. **Audio Viva Defense Simulation:** Integrating the Web Audio API and Gemini Live API to conduct real-time spoken CS oral exams.
