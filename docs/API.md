# DemandIQ — API Reference

Backend for the Demand Intake Agent prototype. Single Node + Express process
(run via `tsx`). All routes are JSON and mounted under **`/api`**.

> **Prototype notes**
> - **In-memory store** — restarting the server wipes all conversations/demands. It sits behind a `Repository` interface, so it can be swapped for a real DB.
> - **No real auth / RBAC** — a request identifies its user by passing `userId` (in the body or query). Personas are display-only. Data is **org-scoped** by that user's `orgId`.
> - The `/debug*` routes are demo scaffolding — remove them for a real integration.
> - Canonical response shapes live in `server/src/types.ts` and `client/src/types.ts`. Hand those to integrators as the contract.

## Base URL

```
http://localhost:4000/api
```

Port defaults to `4000`; override with the `PORT` env var. LLM calls require
`ANTHROPIC_API_KEY` set server-side (never exposed to the browser).

---

## Endpoint summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/users` | List seeded users (personas) |
| POST | `/conversations` | Start a new intake conversation |
| GET | `/conversations?userId=` | List a user's conversations |
| GET | `/conversations/:id` | Get one conversation (full view) |
| POST | `/conversations/:id/messages` | Send a user message; advances the agent |
| POST | `/conversations/:id/draft` | Save the conversation as a Draft |
| POST | `/conversations/:id/submit` | Confirm & submit → creates a Demand Item |
| POST | `/assistant` | Free-form Q&A grounded in the user's demands |
| GET | `/demands?userId=` | List demands for the user's org (with scoring) |
| GET | `/demands/:id` | Get one demand (with scoring) |
| GET | `/action-log?conversationId=` | Agent action log for a conversation |
| GET | `/health` | Health check |
| GET | `/debug` | Read the simulate-failure flag *(demo only)* |
| POST | `/debug/simulate-failure` | Toggle one-shot submit failure *(demo only)* |

---

## Auth (mock)

### `GET /users`
Returns the seeded users. Use one of these `id`s as the `userId` in later calls.

**200** → `MockUser[]`
```json
[
  {
    "id": "user-nadia",
    "name": "Nadia Okafor",
    "role": "Head of Claims Transformation",
    "persona": "Customer submitter",
    "orgId": "org-meridian",
    "orgName": "Meridian Insurance"
  }
]
```

---

## Intake conversations

### `POST /conversations`
Create a new conversation. Returns the initial `ConversationView` (includes the agent greeting).

**Body**
```json
{ "userId": "user-nadia" }
```
**200** → `ConversationView` · **400** `{ "error": "Unknown user" }`

### `GET /conversations?userId=`
List the user's conversations (lightweight summaries).

**200** → `ConversationSummary[]`
```json
[
  {
    "id": "…",
    "title": "AI Contract Review",
    "status": "Draft",
    "step": "questioning",
    "demandType": "new_ai_use_case",
    "submittedItemId": null,
    "updatedAt": "2026-07-10T08:39:00.000Z",
    "messageCount": 6
  }
]
```

### `GET /conversations/:id`
**200** → `ConversationView` · **404** `{ "error": "Not found" }`

### `POST /conversations/:id/messages`
Send the user's next message. The orchestrator runs classify → question
selection → phrase → duplicate-check as appropriate and returns the updated view.

**Body**
```json
{ "text": "We want an AI tool to review legal contracts." }
```
**200** → `ConversationView` · **400** `{ "error": "Empty message" }` · **404** Not found · **500** agent error

### `POST /conversations/:id/draft`
Mark the conversation as a Draft (progress saved, not submitted).

**200** → `ConversationView` · **404** Not found

### `POST /conversations/:id/submit`
Confirm and create the Demand Item. **Idempotent** on `idempotencyKey` (the
client sends the conversation id), so a double-submit returns the same item.

**Body**
```json
{
  "edits": { "title": "AI Contract Review Assistant" },
  "consent": true,
  "idempotencyKey": "<conversationId>"
}
```
- `edits` *(optional)* — field overrides applied at submit time.
- `consent` *(required)* — must be `true` or the submit is rejected.

**200** → `{ "item": DemandItem, "view": ConversationView }`
**400** `{ "error": "<validation message>" }` (missing mandatory field / no consent)
**404** Not found · **503** simulated failure (if the debug flag is set) · **500** unexpected

---

## Assistant

### `POST /assistant`
Free-form Q&A grounded in the user's org demands. The message list must end on
a `user` turn (leading agent greetings are stripped server-side).

**Body**
```json
{
  "userId": "user-nadia",
  "messages": [
    { "role": "user", "text": "How many demands do we have and what types?" }
  ]
}
```
`role` is `"user"` or `"agent"` (the client's label for the assistant).

**200** → `{ "reply": "You currently have 3 demands…" }`
**400** unknown user / bad message list · **500** assistant error

---

## Demands (tracker — org-scoped)

### `GET /demands?userId=`
All demands for the user's org, each enriched with a `scoring` block.

**200** → `DemandItem[]` · **400** Unknown user

### `GET /demands/:id`
**200** → `DemandItem` · **404** Not found

---

## Agent action log

### `GET /action-log?conversationId=`
Ordered log of what the agent did (classification, questions, duplicate checks,
record creation, errors) for one conversation.

**200** → `AgentActionLogEntry[]` · **400** `{ "error": "conversationId required" }`

---

## Health & demo-only

### `GET /health` → `{ "ok": true }`

### `GET /debug` → `{ "failNextSubmit": false }`

### `POST /debug/simulate-failure`
Forces the **next** `/submit` to return `503` once, to demo the error/retry path.
```json
{ "enabled": true }
```
**200** → `{ "failNextSubmit": true }`

---

## Core types

Abbreviated — see `server/src/types.ts` for the authoritative definitions.

```ts
type DemandType = 'new_ai_use_case' | 'enhancement' | 'capacity_request' | 'exploratory';

type ConversationStep =
  | 'classify' | 'confirm_type' | 'questioning'
  | 'duplicate_decision' | 'confirmation' | 'submitted';

interface ConversationView {
  conversation: Conversation;      // id, status, step, demandType, messages[], …
  quickReplies: { label: string; value: string }[];
  missingMandatory: string[];      // field keys still required
  canSubmit: boolean;
  summary?: { group: string; fields: { label: string; value: string }[] }[];
  editableFields?: { key: string; label: string; value: string; type: 'text' | 'choice'; options?: string[]; group: string }[];
  duplicateCandidate?: { id: string; title: string; demandType: string; businessArea: string; description: string };
}

interface DemandItem {
  id: string;                      // e.g. "DEM-000123"
  title: string;
  demandType: DemandType;
  description: string;
  businessArea: string;
  businessProblem: string;
  expectedValue: string;
  proposedTimeline: string;
  submitterId: string;
  customerOrgId: string;
  sourceChannel: 'webchat';
  status: 'Draft' | 'Submitted';
  duplicateReferences: { candidateId: string; matchType: string; userDecision: string }[];
  conditionalFields: Record<string, string>;
  roi: { benefitCategory?: string; estimatedValue?: string; confidence?: 'low' | 'medium' | 'high' };
  scoring?: object;                // added by /demands endpoints only
  createdAt: string;
  updatedAt: string;
}

interface MockUser {
  id: string; name: string; role: string;
  persona: 'Customer submitter' | 'Customer approver / sponsor' | 'NTT DATA Solution Lead' | 'Platform Administrator';
  orgId: string; orgName: string;
}
```

---

## Quick smoke test (curl)

```bash
# 1. who can I log in as?
curl http://localhost:4000/api/users

# 2. start a conversation
curl -X POST http://localhost:4000/api/conversations \
  -H 'content-type: application/json' \
  -d '{"userId":"user-nadia"}'

# 3. send a message (use the id from step 2)
curl -X POST http://localhost:4000/api/conversations/<ID>/messages \
  -H 'content-type: application/json' \
  -d '{"text":"We want an AI tool to review legal contracts."}'

# 4. list demands for the org
curl "http://localhost:4000/api/demands?userId=user-nadia"
```
