# DemandIQ — Intake Progress: the 8 steps

The Demand Intake chat shows an **Intake Progress** rail (right side) with 8 steps.
This is the customer-facing map of what the agent is capturing. This doc defines
each step, the fields it captures, what the agent does, and when the step is "done".

> **How it actually works under the hood**
> The 8 labels are a *presentation layer*. What's genuinely mandatory is decided by
> the deterministic question engine (`server/src/engine/fields.ts`), not the LLM. The
> agent moves through a state machine (`classify → confirm_type → questioning →
> duplicate_decision → confirmation → submitted`) and the rail's highlighted step is
> derived from that state (see *Progress mapping* at the bottom). So the rail is a
> friendly summary; the field engine is the source of truth.

Fields come from the intake spec: **mandatory** (always), **conditional** (depend on
demand type), a **data-sensitivity** flag, and a light **ROI** check.

---

## The steps

### 1. Business Objective
**Definition:** What the customer is ultimately trying to achieve, in one or two sentences.
**Captured:** the opening free-text need → the agent **classifies** it into a demand type
and drafts a `title`.
- Demand type ∈ `new_ai_use_case · enhancement · capacity_request · exploratory`
- Also sets a `mentions_sensitive_data` flag if the text hints at sensitive/regulated data.
**Agent does:** LLM classification (returns JSON: type + implied fields + sensitive flag).
**Done when:** the demand type is confirmed by the customer.

### 2. Need Overview
**Definition:** A clear, plain-language description of the need in the customer's own words.
**Captured:** `description` (mandatory).
**Agent does:** asks a single natural phrasing question if the description isn't already clear.
**Done when:** a usable description is captured.

### 3. Business Context
**Definition:** Where this demand sits in the organisation.
**Captured:** `business_area` (function/department, mandatory). `submitter` and
`customer_org` are taken automatically from the logged-in user — not asked.
**Agent does:** asks which business area/function this belongs to.
**Done when:** business area is captured.

### 4. Scope & Requirements
**Definition:** The type-specific detail that scopes the work. **These questions change
based on the demand type** (this is the conditional block).
**Captured — by type:**
- **New AI use case:** `target_process`, `data_sources`, `expected_users`, `desired_outcome`
- **Enhancement:** `existing_solution_name`, `current_limitation`, `affected_users`, `urgency` (Low/Med/High)
- **Capacity request:** `role_type`, `skill_requirements`, `headcount_or_effort`, `start_date`, `duration`, `location_preference`
- **Exploratory:** no mandatory conditional fields — kept lightweight.
**Agent does:** asks only the fields that apply to the classified type, one at a time.
**Done when:** the type's conditional fields are captured.

### 5. Value & Impact
**Definition:** The problem being solved and the value expected — plus a light ROI read.
**Captured:** `business_problem` (mandatory), `expected_value` (mandatory), and the ROI trio:
`benefit_category` (Cost savings / Revenue growth / Risk reduction / Productivity / Other),
`estimated_annual_value_or_proxy` (a number or a proxy like hours saved), `confidence_level` (Low/Med/High).
**Agent does:** captures the pain point + expected outcome, then a 2–3 question ROI check.
**Done when:** problem, expected value, and ROI basics are captured.

### 6. Constraints & Dependencies
**Definition:** Timing, and anything that limits or gates the work.
**Captured:** `proposed_timeline` (mandatory), and `data_sensitivity_flag` if sensitive/regulated
data was mentioned (No sensitive data / Contains sensitive data / Not sure).
**Agent does:** confirms the timeline and, if flagged, asks about data sensitivity.
**Done when:** timeline captured (and sensitivity resolved if raised).

### 7. Additional Information
**Definition:** A catch-all for anything else, and where the agent checks for overlap.
**Captured:** any free-text clarifications or **attachments** the customer adds.
**Agent does:** runs the **duplicate check** against existing demands and returns a match verdict:
- `exact` / `likely` → shows a customer-safe summary and asks *same vs distinct* (never auto-merges)
- `related` → shown as an FYI, does not block
- `none` → proceeds straight to review
**Done when:** the duplicate decision (if any) is made.

### 8. Review & Confirm
**Definition:** Final review of everything captured, then submit.
**Captured:** `consent_to_submit` (required at submit).
**Agent does:** renders a **summary from the captured state** (not the LLM) for the customer
to review/edit.
- **Save draft** at any point → status **Draft** (resumable).
- **Confirm & submit** (with consent) → creates a tracked **Demand Item** (status **Submitted**).
- Submission is **idempotent** (keyed on the conversation id) so a double-click can't create duplicates.
**Done when:** the demand is submitted.

---

## Fields at a glance

| Group | Fields |
|---|---|
| **Mandatory** | `title`, `demand_type`, `description`, `business_area`, `business_problem`, `expected_value`, `proposed_timeline`, `submitter`*, `customer_org`*, `consent_to_submit`** |
| **Conditional — new AI use case** | `target_process`, `data_sources`, `expected_users`, `desired_outcome` |
| **Conditional — enhancement** | `existing_solution_name`, `current_limitation`, `affected_users`, `urgency` |
| **Conditional — capacity request** | `role_type`, `skill_requirements`, `headcount_or_effort`, `start_date`, `duration`, `location_preference` |
| **Sensitivity** | `data_sensitivity_flag` (only if sensitive data is mentioned) |
| **ROI (light)** | `benefit_category`, `estimated_annual_value_or_proxy`, `confidence_level` |

\* from login, not asked · \** captured only at submit

---

## Progress mapping (state → highlighted step)

The rail's active step is derived from the conversation's state machine
(`client/src/components/ChatView.tsx` → `computeStep`):

| Conversation step | Rail step |
|---|---|
| `classify` (start) | 1 · Business Objective |
| `confirm_type` | 2 · Need Overview |
| `questioning` | 3–6, interpolated by how many mandatory fields remain |
| `duplicate_decision` | 7 · Additional Information |
| `confirmation` | 8 · Review & Confirm |
| `submitted` | 8 · complete (all steps ✓) |

Because steps 3–6 are interpolated from remaining mandatory fields, the rail advances
smoothly as the customer answers rather than jumping — it's an indicator, not a strict gate.
