import type { MockUser } from '../types.js';

// Mock login: one seeded user per persona (see spec §4). The two customer
// personas share an org so the approver sees the submitter's org-level demand;
// the two NTT DATA personas are internal (their portfolio view is org-agnostic).
export const MOCK_USERS: MockUser[] = [
  {
    id: 'user-nadia',
    name: 'Nadia Okafor',
    role: 'Head of Claims Transformation',
    persona: 'Customer submitter',
    orgId: 'org-meridian',
    orgName: 'Meridian Insurance',
  },
  {
    id: 'user-david',
    name: 'David Osei',
    role: 'VP Claims & Operations',
    persona: 'Customer approver / sponsor',
    orgId: 'org-meridian',
    orgName: 'Meridian Insurance',
  },
  {
    id: 'user-marco',
    name: 'Marco Rossi',
    role: 'Solution Lead',
    persona: 'NTT DATA Solution Lead',
    orgId: 'org-nttdata',
    orgName: 'NTT DATA',
  },
  {
    id: 'user-sasha',
    name: 'Sasha Ivanova',
    role: 'Platform Administrator',
    persona: 'Platform Administrator',
    orgId: 'org-nttdata',
    orgName: 'NTT DATA',
  },
];

export function getUser(id: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}
