# Demand Intake Agent — Prototype (CLAUDE.md / project memory)

A conversational AI "front door" for NTT DATA's AI Studio Delivery Command Center.
A customer describes an AI project need in plain language; the agent classifies it,
asks only the relevant follow-up questions, checks for duplicates, and creates a
structured, trackable **Demand Item**. This is a **stakeholder-demo prototype**, not
production. Optimize for believable conversation, correct data-capture logic, clean UI.

## Tech stack (fixed — do not substitute without asking)
- Frontend: React + Vite + TypeScript + Tailwind CSS v3
- Backend: Node + Express (TypeScript), single process, run via `tsx`
- LLM: Anthropic API (`@anthropic-ai/sdk`), model **`claude-sonnet-4-6`**, server-side only
  (API key never reaches the browser). Adaptive-thinking-family model: no `budget_tokens`.
- Data store: in-memory `Map`, behind a `Repository` interface (swap for a real DB later).
- Auth: mock login — pick one of 3 seeded fake users (different orgs).

## Repo layout
- `/server` — Express API + orchestrator (LLM calls, question engine, state machine, store)
- `/client` — React chat UI + Tracker + Chat History + Action Log
- root `npm run dev` runs both concurrently.

## Agent design (orchestrator, not one big prompt)
1. **Classify** (LLM, JSON): free text → `new_ai_use_case | enhancement | capacity_request | exploratory`,
   plus any implied fields + a `mentions_sensitive_data` flag.
2. **Question selection** (deterministic TS, `engine/fields.ts`): given demandType + captured
   fields, returns the next field to ask. Rule-based and inspectable — the LLM never decides
   what is mandatory.
3. **Phrase question** (LLM, plain text): turns a field spec + context into one natural question.
4. **Duplicate check** (LLM, JSON): draft summary + seeded items → `{match_type: exact|likely|related|none, candidate_id, rationale}`.
5. **Confirmation** (deterministic): summary rendered from captured state, not the LLM.

## Fields
Mandatory (all): title, demand_type, description, business_area, business_problem,
expected_value, proposed_timeline, submitter (login), customer_org (login), consent_to_submit (at submit).
Conditional:
- capacity_request: role_type, skill_requirements, headcount_or_effort, start_date, duration, location_preference
- enhancement: existing_solution_name, current_limitation, affected_users, urgency
- new_ai_use_case: target_process, data_sources, expected_users, desired_outcome
Sensitive data mentioned → data_sensitivity_flag.
Light ROI (2–3 Qs only): benefit_category, estimated_annual_value_or_proxy, confidence_level (low/med/high).

## Duplicate handling
- exact/likely → show customer-safe summary, ask same-vs-distinct, never auto-merge
- related → FYI only, do not block
- none → straight to confirmation

## Draft vs Submitted
- Abandoned / explicit save before all mandatory filled → **Draft**
- Explicit "Confirm and submit" only → **Submitted**
- Submission is **idempotent**: client disables button + server keys on conversation id.

## Out of scope (stub/fake only)
Teams channel (disabled "Coming soon" nav), real Azure AI Foundry, real RBAC,
downstream scoring/governance/CPQ/routing/allocation, real vector search.
No score/CPQ/rate/margin/capacity fields anywhere in customer-facing UI.

## Build order & status
1. [done] scaffold  2. [done] types/store/seed/auth  3. [done] 3 Claude call modules
4. [done] question engine + state machine  5. [done] REST endpoints
6. [done] frontend shell + user switcher  7. [done] chat UI wired to API
8. [done] confirmation card + duplicate card + error/retry states
9. [done] Demand Tracker (+ portfolio heatmap) + Chat History + Action Log
10. [done] verified full happy/duplicate/draft/failure paths end-to-end in-browser

## Heatmap
Demand Tracker shows a "Demand portfolio" heatmap: rows = business area, cols = the 4
demand types, cell = demand **count** (sequential single-hue blue ramp, counts printed
in-cell, scale legend). Org-scoped; repopulates on submit (submit auto-navigates to Tracker).
Counts only — no score/margin (stays within the no-scoring UI constraint).

## Key decisions / assumptions
- `claude-sonnet-4-6` not on the structured-outputs list → classify/duplicate calls prompt
  for JSON and parse defensively (fenced-block tolerant), with safe fallbacks so the demo
  never hard-crashes on a model hiccup.
- Simulated failure is a one-shot server flag that fails the next `/submit` only.
- Org-scoping: Tracker returns only items for the logged-in user's `customerOrgId`.
