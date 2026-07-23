import { Router } from 'express';
import type { Repository } from '../store/repository.js';
import { MOCK_USERS, getUser } from '../auth/users.js';
import {
  buildView,
  createConversation,
  handleUserMessage,
  saveDraft,
  setRequestType,
  submit,
  SubmitError,
  VALID_REQUEST_TYPES,
} from '../engine/conversation.js';
import type { RequestType } from '../types.js';
import { logAction } from '../log/actionLog.js';
import { assistantReply, assistantSystem } from '../llm/assistant.js';
import { withScoring } from '../engine/scoring.js';

// One-shot simulated failure flag for demoing controlled error handling.
export const debugState = { failNextSubmit: false };

export function createApiRouter(repo: Repository): Router {
  const router = Router();

  // --- mock auth ---
  router.get('/users', (_req, res) => {
    res.json(MOCK_USERS);
  });

  // --- debug / simulate failure ---
  router.get('/debug', (_req, res) => res.json(debugState));
  router.post('/debug/simulate-failure', (req, res) => {
    debugState.failNextSubmit = Boolean(req.body?.enabled);
    res.json(debugState);
  });

  // --- conversations ---
  router.post('/conversations', (req, res) => {
    const user = getUser(req.body?.userId);
    if (!user) return res.status(400).json({ error: 'Unknown user' });
    const c = createConversation(repo, user);
    res.json(buildView(repo, c));
  });

  router.get('/conversations', (req, res) => {
    const userId = String(req.query.userId ?? '');
    if (!getUser(userId)) return res.status(400).json({ error: 'Unknown user' });
    const list = repo.listConversationsByUser(userId).map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      step: c.step,
      requestType: c.requestType,
      demandType: c.demandType,
      submittedItemId: c.submittedItemId,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }));
    res.json(list);
  });

  router.get('/conversations/:id', (req, res) => {
    const c = repo.getConversation(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(buildView(repo, c));
  });

  router.post('/conversations/:id/messages', async (req, res) => {
    const c = repo.getConversation(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const text = String(req.body?.text ?? '').trim();
    if (!text) return res.status(400).json({ error: 'Empty message' });
    try {
      await handleUserMessage(repo, c, text);
      res.json(buildView(repo, c));
    } catch (err) {
      logAction(repo, c, 'error', `message handling failed: ${(err as Error).message}`);
      res.status(500).json({ error: 'The agent hit a problem. Please try again.' });
    }
  });

  // Select a request type from the radio panel. Resets the conversation and
  // starts that type's question flow.
  router.post('/conversations/:id/request-type', async (req, res) => {
    const c = repo.getConversation(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const rt = String(req.body?.requestType ?? '');
    if (!(VALID_REQUEST_TYPES as string[]).includes(rt)) {
      return res.status(400).json({ error: 'Unknown request type' });
    }
    if (rt === 'cpq_approval') {
      return res.status(400).json({ error: 'CPQ Approval is not available yet.' });
    }
    try {
      await setRequestType(repo, c, rt as RequestType);
      res.json(buildView(repo, c));
    } catch (err) {
      logAction(repo, c, 'error', `set request type failed: ${(err as Error).message}`);
      res.status(500).json({ error: 'The agent hit a problem. Please try again.' });
    }
  });

  router.post('/conversations/:id/draft', (req, res) => {
    const c = repo.getConversation(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    saveDraft(repo, c);
    res.json(buildView(repo, c));
  });

  router.post('/conversations/:id/submit', (req, res) => {
    const c = repo.getConversation(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });

    if (debugState.failNextSubmit) {
      debugState.failNextSubmit = false; // one-shot
      logAction(repo, c, 'error', 'simulated submission failure (debug toggle)');
      return res.status(503).json({
        error: 'Submission failed — the demand service is temporarily unavailable. Please retry.',
      });
    }

    try {
      const item = submit(repo, c, {
        edits: req.body?.edits,
        consent: Boolean(req.body?.consent),
        idempotencyKey: String(req.body?.idempotencyKey ?? c.id),
      });
      res.json({ item, view: buildView(repo, c) });
    } catch (err) {
      if (err instanceof SubmitError) {
        return res.status(400).json({ error: err.message });
      }
      logAction(repo, c, 'error', `submit failed: ${(err as Error).message}`);
      res.status(500).json({ error: 'Unexpected error creating the demand.' });
    }
  });

  // --- assistant (free-form Q&A grounded in the user's org demands) ---
  router.post('/assistant', async (req, res) => {
    const user = getUser(req.body?.userId);
    if (!user) return res.status(400).json({ error: 'Unknown user' });
    const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const messages = raw
      .filter((m: any) => m && typeof m.text === 'string' && m.text.trim())
      // client uses 'agent' for the assistant; Claude wants 'assistant'
      .map((m: any) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: String(m.text),
      }));
    // Claude requires the first message to be a user turn — drop any leading greeting.
    while (messages.length && messages[0].role === 'assistant') messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Expected a conversation ending with a user message.' });
    }
    try {
      const system = assistantSystem(user, repo.listDemandsByOrg(user.orgId));
      const reply = await assistantReply(system, messages);
      res.json({ reply });
    } catch (err) {
      res.status(500).json({ error: 'The assistant hit a problem. Please try again.' });
    }
  });

  // --- demand tracker (org-scoped to the logged-in user) ---
  router.get('/demands', (req, res) => {
    const userId = String(req.query.userId ?? '');
    const user = getUser(userId);
    if (!user) return res.status(400).json({ error: 'Unknown user' });
    res.json(repo.listDemandsByOrg(user.orgId).map(withScoring));
  });

  router.get('/demands/:id', (req, res) => {
    const item = repo.getDemand(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(withScoring(item));
  });

  // --- agent action log (debug view) ---
  router.get('/action-log', (req, res) => {
    const conversationId = String(req.query.conversationId ?? '');
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
    res.json(repo.listLog(conversationId));
  });

  return router;
}
