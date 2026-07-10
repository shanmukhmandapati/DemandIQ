import type { MockUser } from '../types.js';

// Mock login: three seeded users across different orgs / business units.
export const MOCK_USERS: MockUser[] = [
  {
    id: 'user-nadia',
    name: 'Nadia Okafor',
    role: 'Head of Claims Transformation',
    orgId: 'org-meridian',
    orgName: 'Meridian Insurance',
  },
  {
    id: 'user-tom',
    name: 'Tom Brandt',
    role: 'Director, Legal Operations',
    orgId: 'org-castellan',
    orgName: 'Castellan Legal Group',
  },
  {
    id: 'user-priya',
    name: 'Priya Raman',
    role: 'VP Supply Chain Analytics',
    orgId: 'org-northwind',
    orgName: 'Northwind Logistics',
  },
];

export function getUser(id: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}
