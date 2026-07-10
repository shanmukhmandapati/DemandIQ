import type { AgentActionLogEntry, Conversation } from '../types.js';
import type { Repository } from '../store/repository.js';

let counter = 0;

export function logAction(
  repo: Repository,
  conversation: Conversation,
  actionType: AgentActionLogEntry['actionType'],
  detail: string,
): void {
  counter += 1;
  repo.appendLog({
    id: `LOG-${String(counter).padStart(6, '0')}`,
    conversationId: conversation.id,
    actionType,
    detail,
    timestamp: new Date().toISOString(),
    userId: conversation.userId,
  });
}
