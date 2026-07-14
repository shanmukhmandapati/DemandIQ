# DemandIQ — Demand Intake Agent (prototype)

A conversational AI "front door" for an AI Studio Delivery Command Center. A customer
describes an AI need in plain language; the agent classifies it, asks only the relevant
follow-up questions, checks for duplicates, and creates a structured, trackable **Demand
Item** — which then populates a **demand portfolio heatmap**.

Prototype for stakeholder demo. See `CLAUDE.md` for the full spec and design decisions.

## Prerequisites
- Node 20+ (built on 24)
- `ANTHROPIC_API_KEY` in your environment (used **server-side only**; model `claude-sonnet-4-6`)

## Run
```bash
npm run install:all   # installs root + server + client deps
npm run dev           # starts API (:4000) and web (:5173) together
```
Open http://localhost:5173. (Server reads `ANTHROPIC_API_KEY` from the environment.)

Individually: `npm --prefix server run dev` and `npm --prefix client run dev`.
Typecheck everything: `npm run typecheck`.

## What's here
- **/server** — Express + TypeScript orchestrator: mock auth, in-memory store (behind a
  `Repository` interface) with seeded demands, the 3 Claude call modules (classify /
  phrase-question / duplicate-check), the deterministic question engine, the conversation
  state machine, the action log, and the REST API.
- **/client** — React + Vite + Tailwind: shell nav, mock user switcher, chat UI, duplicate
  card, editable confirmation card, Demand Tracker with the portfolio heatmap, Chat
  History, and the Agent Action Log debug view.

## Docs
- **[`docs/API.md`](docs/API.md)** — REST endpoint reference: base URL, request/response shapes, examples, curl smoke test.
- **[`docs/INTAKE-STEPS.md`](docs/INTAKE-STEPS.md)** — the 8-step Intake Progress explained: definition, captured fields, agent behavior, and how progress is derived.

## Demo script (≈2 min)
1. **Happy path + duplicate** — sign in as *Tom Brandt — Castellan Legal Group*. New Demand →
   "We want an AI tool to review inbound vendor contracts and flag risky clauses." Confirm
   the classified type, answer the questions. The agent flags the seeded **AI Contract
   Review Assistant** as a duplicate — pick "This is distinct", review the summary, tick
   consent, **Confirm & submit**. You land on the Tracker and the heatmap lights up.
2. **Capacity request + draft** — sign in as *Priya Raman — Northwind Logistics*. Start a
   capacity request ("I need two ML engineers for four months…"), answer a couple of
   questions, then **Save draft**. It appears in Chat History as a resumable draft.
3. **Controlled failure** — Settings → toggle **Simulate API failure**, then submit a demand:
   you get a controlled error with a working retry (the toggle is one-shot).
4. **Auditability** — Agent Action Log → pick a conversation to see every step the agent took.

## Notes / scope
- Out of scope and stubbed: Microsoft Teams (disabled "Soon" nav), real Azure AI Foundry,
  real RBAC, downstream scoring/CPQ/routing. No score/margin/rate fields in the UI.
- The heatmap encodes demand **volume** (counts) by business area × demand type — a
  portfolio view, not a score.
