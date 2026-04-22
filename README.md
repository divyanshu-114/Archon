# ARCHON — AI-Powered Digital Agency

**ARCHON** is a multi-agent AI system that autonomously researches, writes, reviews, schedules, and posts content to a Telegram channel. You give it a single plain-English prompt. Six AI agents then talk to each other, pass work between themselves, and eventually publish polished posts — all without you writing a single word of copy.

---

## Table of Contents

1. [What Does It Actually Do?](#1-what-does-it-actually-do)
2. [The Big Idea — Why Multi-Agent?](#2-the-big-idea--why-multi-agent)
3. [Tech Stack at a Glance](#3-tech-stack-at-a-glance)
4. [Core Concept — LangGraph](#4-core-concept--langgraph)
5. [The Shared Brain — AgentState](#5-the-shared-brain--agentstate)
6. [The Six Agents](#6-the-six-agents)
7. [How the Nodes Are Connected](#7-how-the-nodes-are-connected)
8. [The Revision Loop — Critic ↔ Content Creator](#8-the-revision-loop--critic--content-creator)
9. [Tools Used by the Agents](#9-tools-used-by-the-agents)
10. [Project Structure](#10-project-structure)
11. [Three Ways to Run ARCHON](#11-three-ways-to-run-archon)
12. [Setup & Installation](#12-setup--installation)
13. [Environment Variables](#13-environment-variables)
14. [A Full Pipeline Walkthrough](#14-a-full-pipeline-walkthrough)

---

## 1. What Does It Actually Do?

You type something like:

```
Create 3 posts for a fintech startup that helps college students save money
```

ARCHON then:

1. **Understands** your task — extracts the company, the audience, the tone
2. **Researches** the topic — runs real Google searches for trends and engagement patterns
3. **Writes** the posts — crafts long-form, story-driven Telegram messages (800–3500 characters each)
4. **Reviews** the posts — a Critic agent scores them on 6 criteria and rejects weak ones
5. **Revises** if needed — the Content Creator rewrites based on the Critic's feedback
6. **Schedules** the posts — picks optimal posting times (9am, 12pm, 3pm, 6pm, 8pm)
7. **Posts** to Telegram — sends the final approved messages to your channel

---

## 2. The Big Idea — Why Multi-Agent?

If you just send a prompt to a single LLM, you get one response. There is no quality check, no research phase, no revision. You get whatever the model produces in a single pass.

ARCHON is different. It has **six specialized agents**, each doing one job well, each checking the work of the previous one. This is how a real agency works:

| Step | Who Does It | What They Contribute |
|------|-------------|----------------------|
| Planning | Manager Agent | Understands your brief, creates a content strategy |
| Research | Researcher Agent | Pulls real-world data, trends, competitor insights |
| Writing | Content Creator | Turns research into compelling posts |
| Quality Control | Critic Agent | Rejects mediocre work, demands revisions |
| Scheduling | Scheduler Agent | Picks the best time to post for maximum reach |
| Publishing | Poster Agent | Sends the final content to Telegram |

This separation means each agent can be given a very specific, focused system prompt. The Critic has no incentive to be nice — it is only told to be ruthless. The Content Creator has no access to posting — it only writes. No agent is trying to do everything.

---

## 3. Tech Stack at a Glance

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Agent Orchestration | **LangGraph** | Connects agents into a graph, routes between them |
| LLM | **Groq + Llama 3.3 70B** | Runs the agents' thinking (fast inference) |
| Fast LLM | **Groq + Llama 3.1 8B** | Used for lightweight tasks like scheduling |
| Web Search | **googlesearch-python** | Researcher fetches live Google results |
| Telegram Posting | **Telegram Bot API** | Sends messages to a Telegram channel |
| Telegram Bot | **python-telegram-bot** | Lets you interact via Telegram commands |
| Job Scheduling | **APScheduler** | Schedules posts to fire at a specific datetime |
| Web Dashboard | **Flask + Next.js** | Browser UI to trigger and monitor pipelines |
| State Management | **TypedDict (Python)** | Shared state object passed between all agents |

---

## 4. Core Concept — LangGraph

LangGraph is the backbone of ARCHON. Understanding it is the key to understanding how this entire system works.

### What is a Graph?

A graph is a set of **nodes** connected by **edges**.

- A **node** is a function. In ARCHON, each agent is one node.
- An **edge** tells the graph which node to visit next.
- A **conditional edge** chooses the next node based on logic — for example, "if the Critic approves, go to Scheduler; if not, go back to Content Creator."

### What is a State Machine?

ARCHON's graph is a **state machine**. This means:

1. There is a shared piece of data called the **state**.
2. Every node receives the current state as input.
3. Every node returns an updated state as output.
4. The graph reads a field in the state (`current_agent`) to decide where to go next.

Think of it like a relay race. Each runner (agent) picks up the baton (state), runs their leg, and hands it to the next runner. The baton carries everything that has been done so far.

### How LangGraph Works in Code

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(AgentState)       # create a graph that carries AgentState
graph.add_node("manager", manager_agent)       # add each agent as a node
graph.add_node("researcher", researcher_agent)
graph.set_entry_point("manager")               # start here
graph.add_conditional_edges("manager", route_agent)  # after manager, call route_agent to decide next
app = graph.compile()                          # compile to a runnable app
final_state = app.invoke(initial_state)        # run the whole pipeline
```

The `route_agent` function simply reads `state["current_agent"]` and returns the name of the next node to visit.

---

## 5. The Shared Brain — AgentState

Every agent in ARCHON reads from and writes to one shared object: `AgentState`. This is defined in `utils/state.py`.

```python
class AgentState(TypedDict):
    task: str                          # the original user prompt
    company_info: str                  # extracted by Manager
    research_results: str              # compiled by Researcher
    messages: List[str]                # written by Content Creator
    feedback: str                      # written by Critic when rejecting
    approved: bool                     # set to True by Critic when passing
    scheduled_times: List[str]         # set by Scheduler
    posted_message_ids: List[str]      # set by Poster after publishing
    current_agent: str                 # tells the graph who goes next
    error: Optional[str]               # if something goes wrong
    revision_count: int                # how many revision cycles happened
```

### Why This Design Matters

No agent talks directly to another agent. They do not call each other's functions. Instead, every agent:

1. **Reads** what it needs from the state
2. **Does its job** (calls the LLM, runs a search, posts a message)
3. **Writes its output** back into the state
4. **Sets `current_agent`** to the name of who should run next

This design means agents are completely decoupled. You could swap out the Researcher agent entirely and the rest of the system would not need to change — as long as the new agent still writes `research_results` into the state.

---

## 6. The Six Agents

### Agent 1 — Manager (`agents/manager.py`)

**What it does:** Receives the raw user task and makes sense of it.

**Its job:**
- Extracts the company name, what the company does, the target audience, and the brand tone
- Creates a structured content brief that the rest of the team will use
- Identifies what research is needed

**Model used:** Llama 3.3 70B (the powerful model — this analysis matters)

**System prompt highlights:** The Manager is told to respond in a rigid format with three sections: `COMPANY_INFO`, `CONTENT_BRIEF`, and `RESEARCH_NEEDED`. The code then parses these sections to extract structured data.

**What it writes to state:**
- `company_info` — the extracted company details
- `task` — updated with the content brief appended
- `current_agent` → `"researcher"` (hands off to Researcher)

---

### Agent 2 — Researcher (`agents/researcher.py`)

**What it does:** Searches the web and builds a research brief.

**Its job:**
- Runs 3 Google searches automatically:
  1. Industry trends for the company's sector
  2. Best content strategies for the given task
  3. Telegram engagement tips relevant to the brand
- Compiles the search results and sends them to the LLM
- Produces a structured research brief covering: key themes, trending topics, content angles, tone guidance, and audience insights

**Tool used:** `googlesearch-python` — this is a real live web search, not a simulated one. Results include the page title and description from Google.

**Model used:** Llama 3.3 70B

**What it writes to state:**
- `research_results` — the full research brief
- `current_agent` → `"content_creator"`

---

### Agent 3 — Content Creator (`agents/content_creator.py`)

**What it does:** The copywriter. Turns research into actual Telegram posts.

**Its job:**
- Reads the task, company info, and research brief
- Writes multiple Telegram messages following a strict structure:
  1. **Hook** — a bold statement or question that stops the scroll (first 2 lines)
  2. **Story/Insight** — a mini-story, framework, or insider perspective
  3. **Value** — an actionable takeaway or mindset shift
  4. **CTA** — a closing question or powerful one-liner
- Each message must be 800–3500 characters (under Telegram's 4096 character hard limit)
- Uses Telegram Markdown (`*bold*`, `_italic_`)

**Revision mode:** If the Critic rejected the previous draft, the Content Creator receives the Critic's feedback alongside the original messages and rewrites everything.

**Model used:** Llama 3.3 70B

**Output format:** The LLM wraps each message between `---MESSAGE START---` and `---MESSAGE END---` delimiters so the code can reliably parse them out.

**What it writes to state:**
- `messages` — the list of generated Telegram messages
- `feedback` → `""` (clears previous feedback)
- `current_agent` → `"critic"`

---

### Agent 4 — Critic (`agents/critic.py`)

**What it does:** The quality gatekeeper. Reviews every message against 6 criteria and decides whether to approve or send back for revision.

**Its job:**
- Scores each message on:
  1. Hook strength (would you stop scrolling?)
  2. Depth and value (does it teach something real?)
  3. Emotional impact (does it make you feel something?)
  4. Originality (have you read this 100 times before?)
  5. Engagement potential (would you forward this?)
  6. Length and formatting (800+ chars? Markdown used well?)
- Calculates an overall score
- On the **first review**: always rejects (first drafts always need work — this is hardcoded into the system prompt)
- On **second review**: approves if score is 8.0+ and all messages meet length requirements
- After **2 revision cycles**: auto-approves regardless (prevents infinite loops)

**Model used:** Llama 3.3 70B

**What it writes to state (if approving):**
- `approved` → `True`
- `current_agent` → `"scheduler"`

**What it writes to state (if rejecting):**
- `approved` → `False`
- `feedback` — specific, actionable notes on exactly what to fix
- `revision_count` — incremented by 1
- `current_agent` → `"content_creator"` (sends work back for revision)

---

### Agent 5 — Scheduler (`agents/scheduler.py`)

**What it does:** Decides when to post each message for maximum reach.

**Its job:**
- Takes the number of messages and creates a posting schedule
- Rules it follows:
  - Minimum 4 hours between posts
  - Never schedule between 11pm and 7am
  - Best slots: 9am, 12pm, 3pm, 6pm, 8pm
  - Spread messages across multiple days
- Uses APScheduler to register each post as a timed job
- If the LLM's JSON response is malformed, a fallback schedule is generated automatically

**Model used:** Llama 3.1 8B (the fast, lightweight model — schedule generation does not need heavy reasoning)

**What it writes to state:**
- `scheduled_times` — list of datetime strings for each post
- `current_agent` → `"poster"`

---

### Agent 6 — Poster (`agents/poster.py`)

**What it does:** The final step. Sends the approved messages to Telegram.

**Its job:**
- Iterates through the list of messages
- Cleans each message (removes any leftover delimiter strings like `---MESSAGE START---`)
- Truncates to 4096 characters if something slipped through
- Calls the Telegram Bot API via `send_telegram_message()` from `config.py`
- Waits 3 seconds between messages to avoid rate limiting
- Collects the Telegram message IDs for every successfully posted message

**What it writes to state:**
- `posted_message_ids` — list of Telegram message IDs
- `current_agent` → `"done"` (signals end of pipeline)

---

## 7. How the Nodes Are Connected

Here is the complete graph layout:

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   MANAGER   │  ← Analyzes task, extracts company info
                    └──────┬──────┘
                           │ current_agent = "researcher"
                           ▼
                    ┌─────────────┐
                    │ RESEARCHER  │  ← Googles 3 queries, builds research brief
                    └──────┬──────┘
                           │ current_agent = "content_creator"
                           ▼
               ┌───────────────────────┐
               │    CONTENT CREATOR    │  ← Writes Telegram messages
               └───────────┬───────────┘
                           │ current_agent = "critic"
                           ▼
               ┌───────────────────────┐
               │        CRITIC         │  ← Scores on 6 criteria
               └───────────┬───────────┘
                           │
              ┌────────────┴─────────────┐
              │ approved?                │
             YES                        NO (and revision_count < 2)
              │                          │
              │                current_agent = "content_creator"
              │                          │
              │                          └──────────► back to CONTENT CREATOR
              │
              ▼
     ┌─────────────────┐
     │    SCHEDULER    │  ← Picks posting times, registers jobs
     └────────┬────────┘
              │ current_agent = "poster"
              ▼
     ┌─────────────────┐
     │     POSTER      │  ← Sends to Telegram API
     └────────┬────────┘
              │ current_agent = "done"
              ▼
           ┌─────┐
           │ END │
           └─────┘
```

Every arrow in this diagram is a **conditional edge** in LangGraph. The router function (`route_agent`) reads `state["current_agent"]` after every node runs and returns the name of the next node to call.

---

## 8. The Revision Loop — Critic ↔ Content Creator

This is the most important design feature in ARCHON. Most AI pipelines run in a straight line. ARCHON has a **feedback loop**:

```
Content Creator → Critic → (reject) → Content Creator → Critic → (approve) → Scheduler
```

Here is exactly what happens:

**Round 1:**
- Content Creator writes the first draft
- Critic reviews it — hardcoded to ALWAYS reject the first draft
- Critic writes detailed feedback into `state["feedback"]`
- `revision_count` is incremented to 1
- `current_agent` is set back to `"content_creator"`

**Round 2:**
- Content Creator sees `feedback` is not empty, enters revision mode
- It rewrites every message incorporating the Critic's notes
- Critic reviews again — now evaluates fairly
- If score ≥ 8.0 and all messages are 800–4096 characters → APPROVED
- If not → reject again (but `revision_count` is now 2, which is `MAX_REVISION_CYCLES`)

**After 2 cycles:**
- The Critic auto-approves regardless of score
- This prevents the pipeline from looping forever if the LLM keeps producing mediocre work

---

## 9. Tools Used by the Agents

### Google Search (Researcher)

```python
from googlesearch import search
results = search(query, num_results=3, advanced=True)
```

The Researcher runs 3 separate queries and gets back the page title + description for each result. These are injected directly into the LLM prompt so the model can use real, current information rather than relying solely on its training data.

### Telegram Bot API (Poster + Bot)

```python
url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
requests.post(url, json={"chat_id": CHANNEL_ID, "text": message, "parse_mode": "Markdown"})
```

ARCHON posts to a Telegram channel using the Telegram HTTP API directly. If Markdown parsing fails (because of special characters), it retries as plain text automatically.

### APScheduler (Scheduler)

```python
from apscheduler.schedulers.background import BackgroundScheduler
scheduler.add_job(func=post_function, trigger="date", run_date=datetime_object)
```

APScheduler is a Python job scheduler that runs in a background thread. The Scheduler agent registers each post as a `date` trigger job, meaning it will fire once at the exact specified datetime.

### Groq API (All LLM agents)

All agents use LangChain's `ChatGroq` wrapper:

```python
from langchain_groq import ChatGroq
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.7)
response = llm.invoke([SystemMessage(...), HumanMessage(...)])
```

Groq provides extremely fast inference (often 500+ tokens/second) compared to standard APIs. Two models are used:
- **Llama 3.3 70B** — for all creative and analytical work (Manager, Researcher, Content Creator, Critic)
- **Llama 3.1 8B** — for the Scheduler (simpler JSON generation task, faster response)

---

## 10. Project Structure

```
ARCHON_AGENCY/
│
├── main.py                  # CLI entry point — run pipeline from terminal
├── bot.py                   # Telegram bot — run pipeline via /generate command
├── dashboard.py             # Flask web server — serves the dashboard UI
├── config.py                # LLM setup (Groq), Telegram API helper
│
├── agents/
│   ├── manager.py           # Agent 1 — task analysis & content brief
│   ├── researcher.py        # Agent 2 — web search & research brief
│   ├── content_creator.py   # Agent 3 — Telegram message writer
│   ├── critic.py            # Agent 4 — quality reviewer & gatekeeper
│   ├── scheduler.py         # Agent 5 — posting schedule planner
│   └── poster.py            # Agent 6 — Telegram API publisher
│
├── utils/
│   ├── state.py             # AgentState TypedDict — shared state schema
│   └── helpers.py           # Logging, parsing, formatting utilities
│
├── frontend/                # Next.js frontend (dashboard UI)
│   ├── app/
│   │   ├── page.js          # Landing page
│   │   ├── layout.js        # Root layout + metadata
│   │   ├── globals.css      # Global design system
│   │   └── dashboard/
│   │       └── page.js      # Dashboard page (pipeline trigger + activity feed)
│   └── components/
│       └── GlobeScene.js    # 3D globe component
│
├── templates/
│   ├── landing.html         # Flask-served landing page (alternative to Next.js)
│   └── index.html           # Flask-served dashboard (alternative to Next.js)
│
├── static/
│   └── css/
│       └── landing.css      # Styles for Flask-served pages
│
├── post_history.json        # Persisted record of all posted content
├── requirements.txt         # Python dependencies
└── .env                     # API keys (never commit this)
```

---

## 11. Three Ways to Run ARCHON

### Option A — Terminal (Quickest)

Runs the full pipeline including the Poster agent. Posts to Telegram immediately after approval.

```bash
python main.py
```

You will be prompted to enter a task. The pipeline runs synchronously and prints every agent's progress to the terminal.

### Option B — Telegram Bot (Recommended for Regular Use)

Run ARCHON as a Telegram bot. You interact with it via Telegram commands. The pipeline runs when you type `/generate <task>`. Messages are shown as previews with Approve / Reject / Regenerate buttons before anything gets posted.

```bash
python bot.py
```

In Telegram, send `/start` to your bot to begin.

**Commands:**
- `/start` — welcome message
- `/generate <task>` — trigger the full pipeline
- `/status` — check if the bot is online and if messages are pending
- `/help` — list all commands

### Option C — Web Dashboard (Best for Monitoring)

Runs a Flask backend + Next.js frontend. You can trigger pipelines from a browser, watch real-time activity logs, and see post history.

**Start the backend:**
```bash
python dashboard.py
```

**Start the frontend (in a separate terminal):**
```bash
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:3000`

---

## 12. Setup & Installation

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher (only needed for the Next.js frontend)
- A [Groq API key](https://console.groq.com/) — free tier is enough
- A Telegram Bot Token — create one by messaging [@BotFather](https://t.me/BotFather) on Telegram
- A Telegram Channel ID — the channel ARCHON will post to

### Install

```bash
# Python dependencies
pip install -r requirements.txt

# Frontend dependencies (only if using the web dashboard)
cd frontend
npm install
cd ..
```

---

## 13. Environment Variables

Create a `.env` file in the root of the project:

```env
GROQ_API_KEY=your_groq_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_channel_id_here
```

**How to get your Telegram Channel ID:**
1. Add your bot as an administrator to your Telegram channel
2. Send a message to the channel
3. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in your browser
4. Find the `chat.id` field in the response — this is your `TELEGRAM_CHAT_ID`

For public channels, the ID is typically a negative number (e.g., `-1001234567890`).

---

## 14. A Full Pipeline Walkthrough

Let us trace exactly what happens when you run:

```
Create 3 posts about our AI startup that helps small businesses automate invoicing
```

**Step 1 — Manager runs:**
- Sends the task to Llama 3.3 70B
- LLM extracts: company = AI invoicing startup, audience = small business owners, tone = professional but approachable
- Writes `company_info` and an updated task with content brief into state
- Sets `current_agent = "researcher"`

**Step 2 — Researcher runs:**
- Runs Google search: `"Telegram channel marketing trends AI invoicing startup"`
- Runs Google search: `"best Telegram content strategies Create 3 posts about our AI startup"`
- Runs Google search: `"Telegram channel engagement tips AI invoicing 2024"`
- Passes all search results + task to Llama 3.3 70B
- LLM synthesises a research brief: key themes, tone guidance, audience insights, content angles
- Sets `current_agent = "content_creator"`

**Step 3 — Content Creator runs (first draft):**
- Reads the task, company info, and research brief
- Sends everything to Llama 3.3 70B with a detailed copywriting system prompt
- LLM writes 3 Telegram messages, each 800–3500 characters, each with hook → story → value → CTA
- Parses the messages from `---MESSAGE START---` / `---MESSAGE END---` delimiters
- Sets `current_agent = "critic"`

**Step 4 — Critic runs (first review):**
- Scores each message on 6 criteria
- `revision_count` is 0, so it is hardcoded to reject (APPROVED = NO)
- Writes specific feedback into `state["feedback"]`
- Increments `revision_count` to 1
- Sets `current_agent = "content_creator"` — sends work back

**Step 5 — Content Creator runs (revision):**
- Detects that `feedback` is not empty and `messages` already exist → enters revision mode
- Sends the original messages + critic feedback to Llama 3.3 70B
- LLM rewrites all 3 messages addressing every point of feedback
- Sets `current_agent = "critic"`

**Step 6 — Critic runs (second review):**
- `revision_count` is now 1, so it evaluates fairly
- If average score ≥ 8.0 and all messages are 800–4096 chars → sets `approved = True`
- Sets `current_agent = "scheduler"`

**Step 7 — Scheduler runs:**
- Asks Llama 3.1 8B to generate an optimal schedule for 3 messages
- LLM returns a JSON array with datetimes and reasons (e.g., `"9am weekday — commute hours"`)
- Registers each post as an APScheduler job
- Sets `current_agent = "poster"`

**Step 8 — Poster runs:**
- Iterates through all 3 messages
- Cleans each one (removes any leftover delimiters)
- Calls `send_telegram_message()` for each one via the Telegram HTTP API
- Waits 3 seconds between each post
- Collects Telegram message IDs
- Sets `current_agent = "done"` → graph reaches END

The entire pipeline from prompt to published posts typically takes 30–90 seconds depending on Groq's response speed and how many Google searches complete successfully.
