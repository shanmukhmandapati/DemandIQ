import { randomUUID } from 'node:crypto';
import type {
  ChatMessage,
  Conversation,
  DemandItem,
  DemandType,
  MockUser,
  RequestType,
} from '../types.js';
import type { Repository } from '../store/repository.js';
import { candidateSummaries } from '../store/seed.js';
import { classify } from '../llm/classify.js';
import { phraseQuestion } from '../llm/phraseQuestion.js';
import { duplicateCheck } from '../llm/duplicateCheck.js';
import { logAction } from '../log/actionLog.js';
import { getUser } from '../auth/users.js';
import { findField, isComplete, missingMandatory, nextField, orderedFields } from './fields.js';

export const TYPE_LABELS: Record<DemandType, string> = {
  new_ai_use_case: 'New AI use case',
  enhancement: 'Enhancement',
  capacity_request: 'Capacity request',
  exploratory: 'Exploratory',
};

const VALID_TYPES = Object.keys(TYPE_LABELS) as DemandType[];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  deal_intake: 'Deal Intake',
  cpq_approval: 'Cost, Price, Quote (CPQ) Approval',
  sow_approval: 'Deal Assurance (SOW) Approval',
  staff_augmentation: 'Staff Augmentation',
};

export const VALID_REQUEST_TYPES = Object.keys(REQUEST_TYPE_LABELS) as RequestType[];

// Radio-selected request types are stored on the DemandItem via a legacy
// DemandType so the (unchanged) Tracker and heatmap still render submitted items.
const REQUEST_TO_DEMAND: Record<RequestType, DemandType> = {
  deal_intake: 'new_ai_use_case',
  cpq_approval: 'exploratory',
  sow_approval: 'enhancement',
  staff_augmentation: 'capacity_request',
};

/** The label to show the user: request type when set, else the legacy demand type. */
function typeLabel(c: Conversation): string {
  if (c.requestType) return REQUEST_TYPE_LABELS[c.requestType];
  return c.demandType ? TYPE_LABELS[c.demandType] : 'request';
}

export interface QuickReply {
  label: string;
  value: string;
}

export interface ConversationView {
  conversation: Conversation;
  quickReplies: QuickReply[];
  missingMandatory: string[];
  canSubmit: boolean;
  summary?: SummarySection[];
  editableFields?: {
    key: string;
    label: string;
    value: string;
    type: 'text' | 'choice';
    options?: string[];
    group: string;
  }[];
  duplicateCandidate?: {
    id: string;
    title: string;
    demandType: string;
    businessArea: string;
    description: string;
  };
}

export interface SummarySection {
  group: string;
  fields: { label: string; value: string }[];
}

const now = () => new Date().toISOString();

function agent(text: string): ChatMessage {
  return { id: randomUUID(), role: 'agent', text, ts: now() };
}
function userMsg(text: string): ChatMessage {
  return { id: randomUUID(), role: 'user', text, ts: now() };
}

function contextSummary(c: Conversation): string {
  const parts = orderedFields(c)
    .filter((f) => c.captured[f.key])
    .map((f) => `${f.label}: ${c.captured[f.key]}`);
  return parts.join('; ');
}

// ---- creation ----

export function createConversation(repo: Repository, user: MockUser): Conversation {
  const c: Conversation = {
    id: randomUUID(),
    userId: user.id,
    orgId: user.orgId,
    status: 'Active',
    step: 'classify',
    mentionsSensitiveData: false,
    captured: {},
    messages: [
      agent(
        `Hi ${user.name.split(' ')[0]}, I'm the Demand Intake assistant. To get started, pick a request type from the panel on the right and I'll ask a few quick questions for ${user.orgName}.`,
      ),
    ],
    title: 'New demand',
    createdAt: now(),
    updatedAt: now(),
  };
  return repo.saveConversation(c);
}

// ---- message handling (state machine) ----

export async function handleUserMessage(
  repo: Repository,
  c: Conversation,
  text: string,
): Promise<Conversation> {
  c.messages.push(userMsg(text));

  switch (c.step) {
    case 'classify':
      // Entry is now radio-driven: nudge the user to pick a request type.
      c.messages.push(
        agent('Please pick a request type from the panel on the right to get started.'),
      );
      break;
    case 'confirm_type':
      await doConfirmType(repo, c, text);
      break;
    case 'questioning':
      await doAnswer(repo, c, text);
      break;
    case 'duplicate_decision':
      doDuplicateDecision(repo, c, text);
      pushConfirmation(repo, c);
      break;
    case 'confirmation':
    case 'submitted':
      c.messages.push(
        agent('Please use the buttons below to submit or save this demand.'),
      );
      break;
  }

  c.updatedAt = now();
  return repo.saveConversation(c);
}

/**
 * Set the request type from the radio selection. Per the chosen UX this RESETS
 * the conversation: prior answers and the message thread are cleared and a fresh
 * question flow for the new type begins.
 */
export async function setRequestType(
  repo: Repository,
  c: Conversation,
  requestType: RequestType,
): Promise<Conversation> {
  c.requestType = requestType;
  c.demandType = REQUEST_TO_DEMAND[requestType]; // legacy value for Tracker/heatmap/DemandItem
  c.captured = {};
  c.mentionsSensitiveData = false;
  c.pendingField = undefined;
  c.duplicate = undefined;
  c.duplicateDecision = undefined;
  c.submittedItemId = undefined;
  c.status = 'Active';
  c.title = REQUEST_TYPE_LABELS[requestType];
  c.step = 'questioning';
  c.messages = [
    agent(
      `Let's capture your ${REQUEST_TYPE_LABELS[requestType]} request. I'll ask a few quick questions — you can switch the request type on the right at any time.`,
    ),
  ];
  logAction(repo, c, 'classification', `request_type selected: ${requestType}`);
  await askNextOrAdvance(repo, c);
  c.updatedAt = now();
  return repo.saveConversation(c);
}

async function doClassify(repo: Repository, c: Conversation, text: string): Promise<void> {
  const result = await classify(text);
  c.demandType = result.demandType;
  c.mentionsSensitiveData = result.mentionsSensitiveData;
  for (const [k, v] of Object.entries(result.extracted)) c.captured[k] = v;
  if (c.captured.title) c.title = c.captured.title;
  else c.title = text.slice(0, 48);

  logAction(
    repo,
    c,
    'classification',
    `type=${result.demandType}; sensitive=${result.mentionsSensitiveData}; ${result.rationale}`,
  );

  c.step = 'confirm_type';
  c.messages.push(
    agent(
      `Thanks. This sounds like a "${TYPE_LABELS[result.demandType]}". Is that right? You can confirm or pick a different category below.`,
    ),
  );
}

async function doConfirmType(repo: Repository, c: Conversation, text: string): Promise<void> {
  const t = text.trim().toLowerCase();
  let chosen: DemandType | undefined;
  if ((VALID_TYPES as string[]).includes(text.trim())) chosen = text.trim() as DemandType;
  else chosen = VALID_TYPES.find((v) => TYPE_LABELS[v].toLowerCase() === t);

  const confirmed = /\b(yes|yep|correct|right|confirm|that'?s? right|looks good)\b/.test(t);
  if (chosen) c.demandType = chosen;
  else if (!confirmed) {
    // Couldn't interpret; keep current type but acknowledge.
  }

  logAction(repo, c, 'confirmation', `demand_type confirmed as ${c.demandType}`);
  c.step = 'questioning';
  c.messages.push(agent(`Great — a ${TYPE_LABELS[c.demandType!].toLowerCase()}. Let me ask a few quick questions.`));
  await askNextOrAdvance(repo, c);
}

async function doAnswer(repo: Repository, c: Conversation, text: string): Promise<void> {
  if (c.pendingField) {
    c.captured[c.pendingField] = text.trim();
    const f = findField(c, c.pendingField);
    logAction(repo, c, 'answer_captured', `${c.pendingField} = ${text.trim()}`);
    if (c.pendingField === 'title') c.title = text.trim();
    if (f && !c.captured.title && f.key === 'description') c.title = text.slice(0, 48);
    // Scripted flows (e.g. Deal Intake) title the demand by the client name.
    if (c.pendingField === 'client_name' && !c.captured.title) c.title = text.trim();
  }
  await askNextOrAdvance(repo, c);
}

async function askNextOrAdvance(repo: Repository, c: Conversation): Promise<void> {
  const field = nextField(c);
  if (field) {
    c.pendingField = field.key;
    // A field may carry exact wording; otherwise phrase it via the LLM.
    const question =
      field.question ??
      (await phraseQuestion({
        fieldLabel: field.label,
        hint: field.hint,
        demandType: c.requestType || c.demandType ? typeLabel(c) : undefined,
        contextSummary: contextSummary(c),
      }));
    c.messages.push(agent(question));
    logAction(repo, c, 'question_asked', `${field.key}: "${question}"`);
    return;
  }
  c.pendingField = undefined;
  await runDuplicateCheck(repo, c);
}

async function runDuplicateCheck(repo: Repository, c: Conversation): Promise<void> {
  const draft = `Type: ${typeLabel(c)}\nTitle: ${c.captured.title ?? ''}\nBusiness area: ${
    c.captured.business_area ?? ''
  }\nProblem: ${c.captured.business_problem ?? ''}\nDescription: ${c.captured.description ?? ''}`;

  const result = await duplicateCheck(draft, candidateSummaries(repo));
  c.duplicate = {
    matchType: result.matchType,
    candidateId: result.candidateId,
    rationale: result.rationale,
  };
  logAction(
    repo,
    c,
    'duplicate_check',
    `match=${result.matchType}; candidate=${result.candidateId ?? 'none'}; ${result.rationale}`,
  );

  if ((result.matchType === 'exact' || result.matchType === 'likely') && result.candidateId) {
    const candidate = repo.getDemand(result.candidateId);
    c.step = 'duplicate_decision';
    c.messages.push(
      agent(
        `Before we finish — this looks ${result.matchType === 'exact' ? 'like an exact match' : 'very similar'} to an existing demand${
          candidate ? ` ("${candidate.title}")` : ''
        }. ${result.rationale} Is this the same request, or something distinct?`,
      ),
    );
    return;
  }

  if (result.matchType === 'related' && result.candidateId) {
    const candidate = repo.getDemand(result.candidateId);
    c.messages.push(
      agent(
        `Heads up: there's a related existing demand${candidate ? ` ("${candidate.title}")` : ''}, but it looks distinct so I won't block you. ${result.rationale}`,
      ),
    );
  }

  pushConfirmation(repo, c);
}

function doDuplicateDecision(repo: Repository, c: Conversation, text: string): void {
  const t = text.trim().toLowerCase();
  const decision =
    t === '__dup_same' || /\bsame\b/.test(t) ? 'same' : t === '__dup_distinct' || /\bdistinct|different|new\b/.test(t) ? 'distinct' : 'distinct';
  c.duplicateDecision = decision;
  logAction(repo, c, 'duplicate_decision', `user marked as ${decision} (no auto-merge)`);
  c.messages.push(
    agent(
      decision === 'same'
        ? "Understood — I've noted this references the existing demand. I won't merge them automatically; your team can decide. Here's your summary."
        : "Got it — treating this as a distinct demand. Here's your summary.",
    ),
  );
}

function pushConfirmation(repo: Repository, c: Conversation): void {
  c.step = 'confirmation';
  c.messages.push(
    agent(
      'Here is the summary of your demand. Review it below (you can edit any field), tick the consent box, then Confirm and submit.',
    ),
  );
  logAction(repo, c, 'confirmation', 'summary presented to user');
}

// ---- draft / submit ----

export function saveDraft(repo: Repository, c: Conversation): Conversation {
  c.status = 'Draft';
  c.updatedAt = now();
  logAction(repo, c, 'draft_saved', `draft saved at step=${c.step}`);
  c.messages.push(agent('Saved as a draft. You can resume this any time from Chat History.'));
  return repo.saveConversation(c);
}

export class SubmitError extends Error {}

export function submit(
  repo: Repository,
  c: Conversation,
  opts: { edits?: Record<string, string>; consent: boolean; idempotencyKey: string },
): DemandItem {
  // Idempotency: a second submit for the same conversation returns the same item.
  if (c.submittedItemId) {
    const existing = repo.getDemand(c.submittedItemId);
    if (existing) return existing;
  }
  if (!opts.consent) throw new SubmitError('Consent is required before submitting.');

  if (opts.edits) {
    for (const [k, v] of Object.entries(opts.edits)) {
      if (findField(c, k)) c.captured[k] = v;
    }
  }
  if (c.captured.title) c.title = c.captured.title;

  const missing = missingMandatory(c);
  if (missing.length) throw new SubmitError(`Missing required fields: ${missing.join(', ')}`);

  const conditionalKeys = orderedFields(c)
    .filter((f) => f.group === 'conditional' || f.group === 'sensitivity')
    .map((f) => f.key);
  const conditionalFields: Record<string, string> = {};
  for (const k of conditionalKeys) if (c.captured[k]) conditionalFields[k] = c.captured[k];

  const confMap: Record<string, 'low' | 'medium' | 'high'> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
  };

  const item: DemandItem = {
    id: repo.nextDemandId(),
    title: c.captured.title || c.captured.client_name || c.title,
    demandType: c.demandType!,
    requestType: c.requestType,
    submitterName: getUser(c.userId)?.name,
    description: c.captured.description || '',
    businessArea: c.captured.business_area || '',
    businessProblem: c.captured.business_problem || '',
    expectedValue: c.captured.expected_value || '',
    proposedTimeline: c.captured.proposed_timeline || '',
    submitterId: c.userId,
    customerOrgId: c.orgId,
    sourceChannel: 'webchat',
    status: 'Submitted',
    duplicateReferences: c.duplicate?.candidateId
      ? [
          {
            candidateId: c.duplicate.candidateId,
            matchType: c.duplicate.matchType,
            userDecision: c.duplicateDecision ?? 'n/a',
          },
        ]
      : [],
    conditionalFields,
    roi: {
      benefitCategory: c.captured.benefit_category,
      estimatedValue: c.captured.estimated_annual_value_or_proxy,
      confidence: confMap[(c.captured.confidence_level || '').toLowerCase()],
    },
    createdAt: now(),
    updatedAt: now(),
  };

  repo.createDemand(item);
  c.submittedItemId = item.id;
  c.status = 'Submitted';
  c.step = 'submitted';
  c.updatedAt = now();
  logAction(repo, c, 'record_created', `created ${item.id} (${item.title})`);
  c.messages.push(
    agent(`Done — your demand has been submitted as ${item.id}. You can track it in the Demand Tracker.`),
  );
  repo.saveConversation(c);
  return item;
}

// ---- view builder (derived state for the client) ----

export function buildView(repo: Repository, c: Conversation): ConversationView {
  const quickReplies: QuickReply[] = [];

  if (c.step === 'confirm_type') {
    for (const t of VALID_TYPES) {
      quickReplies.push({ label: TYPE_LABELS[t] + (c.demandType === t ? ' ✓' : ''), value: t });
    }
  } else if (c.step === 'questioning' && c.pendingField) {
    const f = findField(c, c.pendingField);
    if (f?.type === 'choice' && f.options) {
      for (const o of f.options) quickReplies.push({ label: o, value: o });
    }
  } else if (c.step === 'duplicate_decision') {
    quickReplies.push({ label: 'Same as existing', value: '__dup_same' });
    quickReplies.push({ label: 'This is distinct', value: '__dup_distinct' });
  }

  let summary: SummarySection[] | undefined;
  let editableFields: ConversationView['editableFields'];
  if (c.step === 'confirmation' || c.step === 'submitted') {
    summary = buildSummary(c);
    editableFields = orderedFields(c).map((f) => ({
      key: f.key,
      label: f.label,
      value: c.captured[f.key] ?? '',
      type: f.type,
      options: f.options,
      group: f.group,
    }));
  }

  let duplicateCandidate: ConversationView['duplicateCandidate'];
  if (c.duplicate?.candidateId) {
    const cand = repo.getDemand(c.duplicate.candidateId);
    if (cand) {
      duplicateCandidate = {
        id: cand.id,
        title: cand.title,
        demandType: cand.demandType,
        businessArea: cand.businessArea,
        description: cand.description,
      };
    }
  }

  return {
    conversation: c,
    quickReplies,
    missingMandatory: missingMandatory(c),
    canSubmit: isComplete(c) && c.step === 'confirmation',
    summary,
    editableFields,
    duplicateCandidate,
  };
}

function buildSummary(c: Conversation): SummarySection[] {
  const sections: SummarySection[] = [];
  const byGroup: Record<string, { label: string; value: string }[]> = {};
  for (const f of orderedFields(c)) {
    const v = c.captured[f.key];
    if (!v) continue;
    (byGroup[f.group] ??= []).push({ label: f.label, value: v });
  }
  const order: { group: string; title: string }[] = [
    { group: 'mandatory', title: 'Core details' },
    { group: 'conditional', title: 'Details for this request type' },
    { group: 'sensitivity', title: 'Data sensitivity' },
    { group: 'roi', title: 'Value (light ROI)' },
  ];
  for (const { group, title } of order) {
    if (byGroup[group]?.length) sections.push({ group: title, fields: byGroup[group] });
  }
  return sections;
}
