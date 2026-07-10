import express from 'express';
import cors from 'cors';
import { InMemoryRepository } from './store/repository.js';
import { seed } from './store/seed.js';
import { createApiRouter } from './routes/api.js';

const PORT = Number(process.env.PORT ?? 4000);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[warn] ANTHROPIC_API_KEY is not set — LLM calls will fail.');
}

const repo = new InMemoryRepository();
seed(repo);

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', createApiRouter(repo));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Demand Intake Agent API listening on http://localhost:${PORT}`);
});
