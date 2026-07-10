export type DemandType =
  | 'new_ai_use_case'
  | 'enhancement'
  | 'capacity_request'
  | 'exploratory';

export type Persona =
  | 'Customer submitter'
  | 'Customer approver / sponsor'
  | 'NTT DATA Solution Lead'
  | 'Platform Administrator';

export interface MockUser {
  id: string;
  name: string;
  role: string;
  persona: Persona;
  orgId: string;
  orgName: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  ts: string;
}

export type ConversationStep =
  | 'classify'
  | 'confirm_type'
  | 'questioning'
  | 'duplicate_decision'
  | 'confirmation'
  | 'submitted';

export interface Conversation {
  id: string;
  userId: string;
  orgId: string;
  status: 'Active' | 'Draft' | 'Submitted';
  step: ConversationStep;
  demandType?: DemandType;
  pendingField?: string;
  messages: ChatMessage[];
  duplicate?: { matchType: string; candidateId?: string; rationale: string };
  duplicateDecision?: string;
  submittedItemId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickReply {
  label: string;
  value: string;
}

export interface SummarySection {
  group: string;
  fields: { label: string; value: string }[];
}

export interface EditableField {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'choice';
  options?: string[];
  group: string;
}

export interface DuplicateCandidate {
  id: string;
  title: string;
  demandType: string;
  businessArea: string;
  description: string;
}

export interface ConversationView {
  conversation: Conversation;
  quickReplies: QuickReply[];
  missingMandatory: string[];
  canSubmit: boolean;
  summary?: SummarySection[];
  editableFields?: EditableField[];
  duplicateCandidate?: DuplicateCandidate;
}

export type Band = 'Low' | 'Medium' | 'High';

export interface Scoring {
  priorityScore: number;
  priorityBand: Band;
  estAnnualValue: number;
  quickWin: boolean;
  strategicBet: boolean;
  roiPotential: number;
  ease: Band;
  businessValue: Band;
  strategicImpact: Band;
  strategicFit: Band;
  confidence: Band;
}

export interface DemandItem {
  id: string;
  title: string;
  demandType: DemandType;
  scoring?: Scoring;
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
  roi: { benefitCategory?: string; estimatedValue?: string; confidence?: string };
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  status: string;
  step: ConversationStep;
  demandType?: DemandType;
  submittedItemId?: string;
  updatedAt: string;
  messageCount: number;
}

export interface ActionLogEntry {
  id: string;
  conversationId: string;
  actionType: string;
  detail: string;
  timestamp: string;
  userId: string;
}

export const TYPE_LABELS: Record<DemandType, string> = {
  new_ai_use_case: 'New AI use case',
  enhancement: 'Enhancement',
  capacity_request: 'Capacity request',
  exploratory: 'Exploratory',
};

export function formatMoney(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${n}`;
}

export const TYPE_COLORS: Record<DemandType, string> = {
  new_ai_use_case: 'var(--cat-new)',
  enhancement: 'var(--cat-enh)',
  capacity_request: 'var(--cat-cap)',
  exploratory: 'var(--cat-exp)',
};
