import { useEffect, useState } from 'react';
import { api } from './api';
import type { MockUser } from './types';
import { ChatView } from './components/ChatView';
import { AssistantChat } from './components/AssistantChat';
import { Tracker } from './components/Tracker';
import { PrioritisationDashboard } from './prioritisation/PrioritisationDashboard';
import { ChatHistory } from './components/ChatHistory';
import { ActionLog } from './components/ActionLog';

type View = 'new' | 'assistant' | 'history' | 'tracker' | 'prioritisation' | 'log';

export default function App() {
  const [users, setUsers] = useState<MockUser[]>([]);
  const [userId, setUserId] = useState('');
  const [view, setView] = useState<View>('new');
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [simFail, setSimFail] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Full-screen module (its own shell) — the reference prioritisation dashboard.
  if (user && view === 'prioritisation') {
    return <PrioritisationDashboard onExit={() => setView('tracker')} />;
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-[var(--grid)] bg-surface">
        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
              DIQ
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">DemandIQ</div>
              <div className="text-[11px] text-muted leading-tight">Delivery Command Center</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          <NavItem label="Demand Intake" icon="＋" active={view === 'new'} onClick={startNew} />
          <NavItem label="Assistant" icon="✦" active={view === 'assistant'} onClick={() => setView('assistant')} />
          <NavItem label="Chat History" icon="🗨" active={view === 'history'} onClick={() => setView('history')} />
          <NavItem label="Demand Tracker" icon="▦" active={view === 'tracker'} onClick={() => setView('tracker')} />
          <NavItem label="Prioritisation" icon="◆" active={view === 'prioritisation'} onClick={() => setView('prioritisation')} />
          <NavItem label="Agent Action Log" icon="◔" active={view === 'log'} onClick={() => setView('log')} muted />
          <div
            className="mt-1 flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted opacity-60"
            title="Coming soon"
          >
            <span className="w-5 text-center">⧉</span>
            <span className="flex-1">Microsoft Teams</span>
            <span className="rounded-full bg-[var(--grid)] px-2 py-0.5 text-[10px] font-medium text-ink-2">
              Soon
            </span>
          </div>
        </nav>

        <div className="border-t border-[var(--grid)] p-3">
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-page"
          >
            <span className="w-5 text-center">⚙</span> Settings
          </button>
          {settingsOpen && (
            <div className="mt-2 rounded-lg border border-[var(--grid)] bg-page p-3">
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
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-[var(--grid)] bg-surface px-6 py-3">
          <div>
            <h1 className="text-base font-semibold">{viewTitle(view)}</h1>
            <p className="text-xs text-muted">AI-assisted demand intake</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted">Signed in as</div>
              <div className="text-sm font-medium">{user?.orgName}</div>
            </div>
            <select
              value={userId}
              onChange={(e) => switchUser(e.target.value)}
              className="rounded-lg border border-[var(--grid)] bg-page px-3 py-2 text-sm"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.orgName}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-hidden bg-page">
          {user && view === 'new' && (
            <ChatView
              key={`${userId}:${activeConv ?? 'fresh'}:${refresh}`}
              user={user}
              conversationId={activeConv}
              onConversationCreated={setActiveConv}
              onSubmitted={() => {
                setRefresh((r) => r + 1);
                setView('tracker');
              }}
            />
          )}
          {user && view === 'assistant' && <AssistantChat key={userId} user={user} />}
          {user && view === 'history' && (
            <ChatHistory
              user={user}
              refreshKey={refresh}
              onOpen={(id) => {
                setActiveConv(id);
                setView('new');
              }}
            />
          )}
          {user && view === 'tracker' && <Tracker user={user} refreshKey={refresh} />}
          {user && view === 'log' && <ActionLog user={user} activeConversationId={activeConv} />}
        </main>
      </div>
    </div>
  );
}

function viewTitle(v: View): string {
  return v === 'new'
    ? 'Demand Intake'
    : v === 'assistant'
    ? 'Assistant'
    : v === 'history'
    ? 'Chat History'
    : v === 'tracker'
    ? 'Demand Prioritisation'
    : 'Agent Action Log';
}

function NavItem({
  label,
  icon,
  active,
  onClick,
  muted,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? 'bg-brand text-white'
          : muted
          ? 'text-muted hover:bg-page'
          : 'text-ink-2 hover:bg-page'
      }`}
    >
      <span className="w-5 text-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}
