import { useEffect, useState } from 'react';
import { api } from './api';
import type { MockUser, RequestType } from './types';
import { ChatView } from './components/ChatView';
import { PrioritisationDashboard } from './prioritisation/PrioritisationDashboard';
import { ListsDashboard } from './components/ListsDashboard';

type View = 'new' | 'tracker';

export default function App() {
  const [users, setUsers] = useState<MockUser[]>([]);
  const [userId, setUserId] = useState('');
  const [view, setView] = useState<View>('new');
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [simFail, setSimFail] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  // The request type currently in play; a new conversation inherits it so the
  // relevant questions start immediately.
  const [currentRequestType, setCurrentRequestType] = useState<RequestType | undefined>(undefined);

  useEffect(() => {
    api.users().then((u) => {
      setUsers(u);
      setUserId(u[0]?.id ?? '');
    });
    api.getDebug().then((d) => setSimFail(d.failNextSubmit));
  }, []);

  const user = users.find((u) => u.id === userId);

  function switchUser(id: string) {
    setUserId(id);
    setActiveConv(null);
    setView('new');
    setRefresh((r) => r + 1);
  }

  function startNew() {
    setActiveConv(null);
    setView('new');
    setRefresh((r) => r + 1);
  }

  async function toggleSimFail() {
    const next = !simFail;
    setSimFail(next);
    await api.setSimulateFailure(next);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: brand · page title · user switcher · settings */}
      <header className="flex items-center gap-4 border-b border-[var(--grid)] bg-surface px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
            DIQ
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">DemandIQ</div>
            <div className="text-[11px] text-muted leading-tight">Delivery Command Center</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-semibold text-white hover:bg-brand-deep"
              title={user?.name ?? 'Account'}
              aria-label="Account"
            >
              {initials(user?.name)}
            </button>
            {profileOpen && (
              <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-[var(--grid)] bg-surface p-2 shadow-lg">
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
                    {initials(user?.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{user?.name}</div>
                    <div className="truncate text-xs text-muted">{user?.orgName}</div>
                  </div>
                </div>
                <div className="my-1 border-t border-[var(--grid)]" />
                <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Switch user
                </div>
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      switchUser(u.id);
                      setProfileOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-page ${
                      u.id === userId ? 'font-medium text-brand' : 'text-ink-2'
                    }`}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_12%,white)] text-[10px] font-semibold text-brand">
                      {initials(u.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {u.name} <span className="text-muted">· {u.orgName}</span>
                    </span>
                    {u.id === userId && <span className="text-brand">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setSettingsOpen((o) => !o)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--grid)] bg-page text-ink-2 hover:bg-surface"
              title="Settings"
              aria-label="Settings"
            >
              ⚙
            </button>
            {settingsOpen && (
              <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-[var(--grid)] bg-surface p-3 shadow-lg">
                <label className="flex items-center justify-between gap-2 text-xs text-ink-2">
                  <span>Simulate API failure</span>
                  <button
                    onClick={toggleSimFail}
                    className={`relative h-5 w-9 rounded-full transition ${
                      simFail ? 'bg-[var(--critical)]' : 'bg-[var(--baseline)]'
                    }`}
                    aria-pressed={simFail}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                        simFail ? 'left-4' : 'left-0.5'
                      }`}
                    />
                  </button>
                </label>
                <p className="mt-2 text-[11px] leading-snug text-muted">
                  Forces the next “Confirm &amp; submit” to fail once, to demo the error/retry path.
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs row (was the left sidebar) */}
      <nav className="flex items-center gap-1 border-b border-[var(--grid)] bg-surface px-4">
        <TabItem label="New Request" icon="＋" active={view === 'new'} onClick={startNew} />
        <TabItem label="Demand Tracker" icon="▦" active={false} onClick={() => {}} disabled />
        <div className="ml-auto">
          <TabItem label="Dashboard" icon="▤" active={dashboardOpen} onClick={() => setDashboardOpen(true)} />
        </div>
      </nav>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden bg-page">
          {user && view === 'new' && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <ChatView
                key={`${userId}:${activeConv ?? 'fresh'}:${refresh}`}
                user={user}
                conversationId={activeConv}
                initialRequestType={currentRequestType}
                onRequestTypeChange={setCurrentRequestType}
                onConversationCreated={setActiveConv}
                onNewConversation={startNew}
                onOpenConversation={(id) => {
                  setActiveConv(id);
                  setView('new');
                }}
                refreshKey={refresh}
                onSubmitted={() => {
                  setRefresh((r) => r + 1);
                  setDashboardOpen(true);
                }}
              />
            </div>
          )}
          {user && view === 'tracker' && (
            <div className="min-h-0 flex-1 overflow-auto">
              <PrioritisationDashboard onExit={() => setView('new')} />
            </div>
          )}
        </main>
      </div>

      <ListsDashboard
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        userId={userId}
        refreshKey={refresh}
      />
    </div>
  );
}

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

function TabItem({
  label,
  icon,
  active,
  onClick,
  muted,
  disabled,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? 'Coming soon' : undefined}
      className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm transition ${
        disabled
          ? 'cursor-not-allowed border-transparent text-muted opacity-50'
          : active
          ? 'border-brand font-semibold text-brand'
          : muted
          ? 'border-transparent text-muted hover:text-ink-2'
          : 'border-transparent text-ink-2 hover:text-ink'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {disabled && <span className="ml-1 text-[10px] text-muted">(soon)</span>}
    </button>
  );
}
