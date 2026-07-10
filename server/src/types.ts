export type DemandType =
  | 'new_ai_use_case'
  | 'enhancement'
  | 'capacity_request'
  | 'exploratory';

export type DemandStatus = 'Draft' | 'Submitted';

export interface DemandItem {
  id: string; // e.g. "DEM-000123"
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
  status: DemandStatus;
  duplicateReferences: { candidateId: string; matchType: string; userDecision: string }[];
  conditionalFields: Record<string, string>;
  roi: { benefitCategory?: string; estimatedValue?: string; confidence?: 'low' | 'medium' | 'high' };
  createdAt: string;
  updatedAt: string;
}

export interface AgentActionLogEntry {
  id: string;
  conversationId: string;
  actionType:
    | 'classification'
    | 'question_asked'
    | 'answer_captured'
    | 'duplicate_check'
    | 'duplicate_decision'
    | 'draft_saved'
    | 'confirmation'
    | 'record_created'
    | 'error';
  detail: string;
  timestamp: string;
  userId: string;
}

export interface MockUser {
  id: string;
  name: string;
  role: string;
  orgId: string;
  orgName: string;
}

// ---- Conversation (orchestrator state machine) ----

export type ConversationStep =
  | 'classify' // awaiting the first free-text description
  | 'confirm_type' // confirm/correct the classified demand type
  | 'questioning' // walking the deterministic question list
  | 'duplicate_decision' // waiting on same-vs-distinct choice
  | 'confirmation' // summary shown, awaiting submit/draft
  | 'submitted';

export type ConversationStatus = 'Active' | 'Draft' | 'Submitted';

export type ChatRole = 'user' | 'agent';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  ts: string;
}

export interface Conversation {
  id: string;
  userId: string;
  orgId: string;
  status: ConversationStatus;
  step: ConversationStep;
  demandType?: DemandType;
  mentionsSensitiveData: boolean;
  captured: Record<string, string>; // flat: mandatory + conditional + roi + sensitivity keys
  pendingField?: string; // the field key the last question asked for
  messages: ChatMessage[];
  duplicate?: { matchType: string; candidateId?: string; rationale: string };
  duplicateDecision?: string;
  submittedItemId?: string;
  title: string; // short label for chat history
  createdAt: string;
  updatedAt: string;
}
