import { useEffect, useState } from 'react';
import { api } from './api';
import type { MockUser } from './types';
import { ChatView } from './components/ChatView';
import { AssistantChat } from './components/AssistantChat';
import { Tracker } from './components/Tracker';
import { PrioritisationDashboard } from './prioritisation/PrioritisationDashboard';
import { ChatHistory } from './components/ChatHistory';
import { ActionLog } from './components/ActionLog';

type View = 'new' | 'history' | 'tracker' | 'log';
type IntakeTab = 'intake' | 'assistant';
type TrackerTab = 'tracker' | 'prioritisation';

export default function App() {
  const [users, setUsers] = useState<MockUser[]>([]);
  const [userId, setUserId] = useState('');
  const [view, setView] = useState<View>('new');
  const [intakeTab, setIntakeTab] = useState<IntakeTab>('intake');
  const [trackerTab, setTrackerTab] = useState<TrackerTab>('tracker');
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

        <div className="ml-2 border-l border-[var(--grid)] pl-4">
          <h1 className="text-sm font-semibold leading-tight">{viewTitle(view)}</h1>
          <p className="text-[11px] text-muted leading-tight">AI-assisted demand intake</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
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
        <TabItem label="Demand Intake" icon="＋" active={view === 'new'} onClick={startNew} />
        <TabItem label="Chat History" icon="🗨" active={view === 'history'} onClick={() => setView('history')} />
        <TabItem label="Demand Tracker" icon="▦" active={view === 'tracker'} onClick={() => setView('tracker')} />
        <TabItem label="Agent Action Log" icon="◔" active={view === 'log'} onClick={() => setView('log')} muted />
        <div
          className="ml-1 flex cursor-not-allowed items-center gap-2 px-3 py-3 text-sm text-muted opacity-60"
          title="Coming soon"
        >
          <span>⧉</span>
          <span>Microsoft Teams</span>
          <span className="rounded-full bg-[var(--grid)] px-2 py-0.5 text-[10px] font-medium text-ink-2">
            Soon
          </span>
        </div>
      </nav>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden bg-page">
          {user && view === 'new' && (
            <>
              <SubTabs
                value={intakeTab}
                onChange={setIntakeTab}
                options={[
                  { value: 'intake', label: 'Intake' },
                  { value: 'assistant', label: 'Assistant' },
                ]}
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                {intakeTab === 'intake' ? (
                  <ChatView
                    key={`${userId}:${activeConv ?? 'fresh'}:${refresh}`}
                    user={user}
                    conversationId={activeConv}
                    refreshKey={refresh}
                    onConversationCreated={setActiveConv}
                    onNewConversation={startNew}
                    onOpenConversation={(id) => {
                      setActiveConv(id);
                      setView('new');
                      setIntakeTab('intake');
                    }}
                    onSubmitted={() => {
                      setRefresh((r) => r + 1);
                      setView('tracker');
                      setTrackerTab('tracker');
                    }}
                  />
                ) : (
                  <AssistantChat key={userId} user={user} />
                )}
              </div>
            </>
          )}
          {user && view === 'history' && (
            <ChatHistory
              user={user}
              refreshKey={refresh}
              onOpen={(id) => {
                setActiveConv(id);
                setView('new');
                setIntakeTab('intake');
              }}
            />
          )}
          {user && view === 'tracker' && (
            <>
              <SubTabs
                value={trackerTab}
                onChange={setTrackerTab}
                options={[
                  { value: 'tracker', label: 'Tracker' },
                  { value: 'prioritisation', label: 'Prioritisation' },
                ]}
              />
              <div className="min-h-0 flex-1 overflow-auto">
                {trackerTab === 'tracker' ? (
                  <Tracker user={user} refreshKey={refresh} />
                ) : (
                  <PrioritisationDashboard onExit={() => setTrackerTab('tracker')} />
                )}
              </div>
            </>
          )}
          {user && view === 'log' && <ActionLog user={user} activeConversationId={activeConv} />}
        </main>
      </div>
    </div>
  );
}

function SubTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 border-b border-[var(--grid)] bg-surface px-4 py-2">
      <div className="inline-flex rounded-lg border border-[var(--grid)] bg-page p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              value === o.value ? 'bg-brand text-white shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function viewTitle(v: View): string {
  return v === 'new'
    ? 'Demand Intake'
    : v === 'history'
    ? 'Chat History'
    : v === 'tracker'
    ? 'Demand Tracker'
    : 'Agent Action Log';
}

function TabItem({
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
      className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm transition ${
        active
          ? 'border-brand font-semibold text-brand'
          : muted
          ? 'border-transparent text-muted hover:text-ink-2'
          : 'border-transparent text-ink-2 hover:text-ink'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
