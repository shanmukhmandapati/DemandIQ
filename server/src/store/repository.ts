import type { AgentActionLogEntry, Conversation, DemandItem } from '../types.js';

// Repository interface — swap the in-memory impl for a real DB later without
// touching callers. Everything the app persists goes through this.
export interface Repository {
  // Demand items
  createDemand(item: DemandItem): DemandItem;
  getDemand(id: string): DemandItem | undefined;
  listDemandsByOrg(orgId: string): DemandItem[];
  nextDemandId(): string;

  // Conversations
  saveConversation(c: Conversation): Conversation;
  getConversation(id: string): Conversation | undefined;
  listConversationsByUser(userId: string): Conversation[];

  // Action log
  appendLog(entry: AgentActionLogEntry): void;
  listLog(conversationId: string): AgentActionLogEntry[];
}

export class InMemoryRepository implements Repository {
  private demands = new Map<string, DemandItem>();
  private conversations = new Map<string, Conversation>();
  private logs: AgentActionLogEntry[] = [];
  // Start well above the seeded IDs (DEM-0001xx) so newly created demands
  // (DEM-001001+) never collide with / overwrite historical seed items.
  private demandCounterSeed = 1000;

  createDemand(item: DemandItem): DemandItem {
    this.demands.set(item.id, item);
    return item;
  }
  getDemand(id: string): DemandItem | undefined {
    return this.demands.get(id);
  }
  listDemandsByOrg(orgId: string): DemandItem[] {
    return [...this.demands.values()]
      .filter((d) => d.customerOrgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  nextDemandId(): string {
    this.demandCounterSeed += 1;
    return `DEM-${String(this.demandCounterSeed).padStart(6, '0')}`;
  }

  saveConversation(c: Conversation): Conversation {
    this.conversations.set(c.id, c);
    return c;
  }
  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }
  listConversationsByUser(userId: string): Conversation[] {
    return [...this.conversations.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  appendLog(entry: AgentActionLogEntry): void {
    this.logs.push(entry);
  }
  listLog(conversationId: string): AgentActionLogEntry[] {
    return this.logs.filter((l) => l.conversationId === conversationId);
  }
}
