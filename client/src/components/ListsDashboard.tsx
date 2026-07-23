import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DemandItem, RequestType } from '../types';

/**
 * A stakeholder-demo "Agentic AI Deal Intake and Assurance" board (Microsoft
 * Lists style). Live-backed: submitted requests appear at the top. Rows are
 * clickable and open a detail drawer with a "schedule a call" option.
 */

type PillColor = 'green' | 'red' | 'blue' | 'amber' | 'gray';

const PILL: Record<PillColor, { bg: string; fg: string }> = {
  green: { bg: '#dff6dd', fg: '#0b6a0b' },
  red: { bg: '#fdd8d8', fg: '#a4262c' },
  blue: { bg: '#cfe4fb', fg: '#1b5fb0' },
  amber: { bg: '#fdeecd', fg: '#8a5a00' },
  gray: { bg: '#edebe9', fg: '#3b3a39' },
};

function Pill({ label, color }: { label: string; color: PillColor }) {
  const c = PILL[color];
  return (
    <span
      className="inline-block max-w-full truncate rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}
      title={label}
    >
      {label}
    </span>
  );
}

const REQUEST_PILL: Record<string, PillColor> = {
  'Deal Intake': 'green',
  'Staff Augmentation': 'red',
  'Deal Assurance': 'blue',
  CPQ: 'amber',
};

const STATUS_OPTIONS = ['Submitted', 'New', 'In Progress', 'Under Review', 'Approved', 'On Hold', 'Rejected', 'Completed'];

function statusColor(status: string): PillColor {
  switch (status) {
    case 'Approved':
    case 'Completed':
    case 'Submitted':
      return 'green';
    case 'In Progress':
      return 'amber';
    case 'Under Review':
      return 'blue';
    case 'Rejected':
      return 'red';
    default:
      return 'gray';
  }
}

interface Slot {
  label: string;
  color: PillColor;
}

interface Row {
  client: string;
  salesforceId: string;
  requestType: keyof typeof REQUEST_PILL;
  dealIntakeSlot?: Slot;
  dealAssuranceSlot?: Slot;
  cpqSlot?: Slot;
  submittedBy: string;
  created: string;
  status?: string;
  assignedResource?: string;
  attachment?: boolean;
  documentLink?: string;
  isNew?: boolean; // freshly submitted this session — subtly highlighted
  item?: DemandItem; // source demand for live rows (full captured detail)
}

const REQUEST_TYPE_TO_PILL: Record<RequestType, keyof typeof REQUEST_PILL> = {
  deal_intake: 'Deal Intake',
  sow_approval: 'Deal Assurance',
  staff_augmentation: 'Staff Augmentation',
  cpq_approval: 'CPQ',
};

// Friendly labels for captured field keys (fallback prettifies the key).
const FIELD_LABELS: Record<string, string> = {
  salesforce_id: 'Salesforce ID',
  fdes_required: 'FDEs required',
  vendor_ai_model: 'Vendor / AI model',
  support_resources: 'Support / resources',
  estimated_acv_tcv: 'Estimated ACV/TCV',
  qualification_stage: 'Qualification stage',
  expected_timelines: 'Expected timelines',
  architect_aligned: 'Architect aligned',
  document_links: 'Document links',
  funded_status: 'Funded status',
  customer_jd: 'Customer JD',
  role_scope: 'Role scope',
  role_titles: 'Role title(s)',
  primary_skill: 'Primary skill',
  secondary_skill: 'Secondary skill',
  language_requirement: 'Language requirement',
  domain_expertise: 'Domain expertise',
  seniority_experience: 'Seniority / experience',
  job_grade: 'Job grade (NTT)',
  shore_model: 'Shore model',
  onshore_location_type: 'Onshore location',
  allshore_location: 'All-shore location',
  engagement_duration: 'Engagement duration',
  start_date: 'Start date',
  required_capacity: 'Required capacity',
  interview_process: 'Interview process',
  security_clearance: 'Security clearance',
  gogs_budget: 'GOGS budget',
  partner_resources_open: 'Open to partner resources',
  sow_type: 'SOW type',
  delivery_scope: 'Scope of work',
  commercial_model: 'Commercial model',
  sow_term: 'SOW term',
  resources_roles: 'Resources / roles',
  internal_approver: 'Internal NTT approver',
  sow_reference: 'SOW reference',
  contract_value: 'Contract value',
  delivery_dates: 'Delivery dates',
  key_risks: 'Key risks',
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Map a submitted demand onto a dashboard row.
function toRow(item: DemandItem): Row {
  const cf = item.conditionalFields ?? {};
  const created = (() => {
    const d = new Date(item.createdAt);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  })();
  return {
    client: item.title || '—',
    salesforceId: cf.salesforce_id || cf.sow_reference || '—',
    requestType: item.requestType ? REQUEST_TYPE_TO_PILL[item.requestType] : 'Deal Intake',
    submittedBy: item.submitterName || '—',
    created,
    status: 'Submitted',
    documentLink: cf.document_links,
    isNew: true,
    item,
  };
}

// Two illustrative existing entries (kept for demo context).
const ROWS: Row[] = [
  { client: 'Litware Health', salesforceId: '006Gh00000Bc3...', requestType: 'Staff Augmentation', submittedBy: 'Priya Shah', created: 'July 15', assignedResource: 'Ravi Patel' },
  { client: 'Proseware Retail', salesforceId: '006Gh00000De5...', requestType: 'Deal Assurance', dealAssuranceSlot: { label: 'Monday : 15:30', color: 'blue' }, submittedBy: 'Aisha Khan', created: 'July 17' },
];

const COLS = [
  'Client Name',
  'Salesforce ID',
  'Request Type',
  'Deal Intake Slot',
  'Deal Assurance Slot',
  'CPQ Slot',
  'Submitted By',
  'Created',
  'Status',
  'Assigned Resource',
  'Attachments',
  'Document Link',
];

const rowKey = (r: Row) => `${r.client}|${r.created}|${r.salesforceId}`;

interface Scheduled {
  date: string;
  time: string;
  note: string;
}

export function ListsDashboard({
  open,
  onClose,
  userId,
  refreshKey,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  refreshKey: number;
}) {
  const [live, setLive] = useState<Row[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [scheduled, setScheduled] = useState<Record<string, Scheduled>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const effStatus = (r: Row) => statuses[rowKey(r)] ?? r.status ?? 'In Progress';

  // Fetch submitted requests (org-scoped) whenever the board opens or a new
  // request is submitted. Only new-flow requests (with a requestType) are shown.
  useEffect(() => {
    if (!open || !userId) return;
    api
      .demands(userId)
      .then((items) => {
        const rows = items
          .filter((i) => i.requestType)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map(toRow);
        setLive(rows);
      })
      .catch(() => setLive([]));
  }, [open, userId, refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!open) return null;

  const rows = [...live, ...ROWS];

  function flash(msg: string) {
    setToast(msg);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash('Link copied to clipboard');
    } catch {
      flash('Copy failed — check clipboard permissions');
    }
  }

  async function share() {
    const url = window.location.href;
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'Agentic AI Deal Intake and Assurance', url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash('Shareable link copied to clipboard');
    } catch {
      flash('Unable to share');
    }
  }

  function exportCsv() {
    const cell = (r: Row) => [
      r.client,
      r.salesforceId,
      r.requestType,
      r.dealIntakeSlot?.label ?? '',
      r.dealAssuranceSlot?.label ?? '',
      r.cpqSlot?.label ?? '',
      r.submittedBy,
      r.created,
      r.status ?? 'In Progress',
      r.assignedResource ?? '',
      r.attachment ? 'Yes' : '',
      r.documentLink ?? '',
    ];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [COLS, ...rows.map(cell)].map((cols) => cols.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agentic-ai-deal-intake-and-assurance.csv';
    a.click();
    URL.revokeObjectURL(url);
    flash('Exported to CSV');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#f5f4f3]"
      style={{ fontFamily: '"Segoe UI", system-ui, sans-serif' }}
    >
        <div className="flex-1 overflow-auto px-5 pt-4">
          {/* Command bar */}
          <div className="mb-3 flex items-center gap-1 rounded-md bg-white px-2 py-1.5 shadow-sm">
            <ToolbarBtn icon="▦" label="Edit in grid view" onClick={() => flash('Grid view is read-only in this demo')} />
            <ToolbarBtn icon="↗" label="Share" onClick={share} />
            <ToolbarBtn icon="🔗" label="Copy link" onClick={copyLink} />
            <ToolbarBtn icon="⤓" label="Export" caret onClick={exportCsv} />
            <ToolbarBtn icon="⌘" label="Workflows" onClick={() => flash('Workflows — coming soon')} />
            <ToolbarBtn icon="⊞" label="Integrate" caret onClick={() => flash('Integrations — coming soon')} />
            <ToolbarBtn icon="⋯" label="" onClick={() => flash('More actions — coming soon')} />
            <div className="ml-auto">
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded text-lg text-[#605e5c] transition hover:bg-[#f3f2f1]"
                aria-label="Close dashboard"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* List card */}
          <div className="rounded-lg bg-white shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4">
              <h2 className="text-xl font-semibold text-[#242424]">Agentic AI Deal Intake and Assurance</h2>
              <span className="text-lg text-[#a19f9d]">☆</span>
              <div className="ml-auto flex items-center gap-3 text-[#605e5c]">
                <IconBtn label="Filter">⧩</IconBtn>
                <IconBtn label="Group">≣</IconBtn>
                <IconBtn label="Sort">⇅</IconBtn>
              </div>
              <div className="flex items-center gap-2 border-b-2 border-[#1b5fb0] pb-1.5 pl-4 text-[13px] font-medium text-[#242424]">
                <span className="text-[#605e5c]">☰</span>
                All Deal Intake and Assur…
                <span className="text-[#605e5c]">▾</span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#edebe9] text-[13px] font-semibold text-[#605e5c]">
                    {COLS.map((col, i) => (
                      <th
                        key={col}
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${
                          i === 0 ? 'sticky left-0 z-10 bg-white' : ''
                        }`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={`${r.client}-${i}`}
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer border-b border-[#f3f2f1] text-[14px] text-[#242424] hover:bg-[#eef4fd] ${r.isNew ? 'bg-[#f0f6ff]' : ''}`}
                    >
                      <td className={`sticky left-0 z-10 px-4 py-3.5 ${r.isNew ? 'bg-[#f0f6ff]' : 'bg-white'}`}>
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-0.5 shrink-0 rounded bg-[#d0cece]" />
                          <span className="truncate font-medium text-[#1b5fb0]">{r.client}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[#605e5c]">{r.salesforceId}</td>
                      <td className="px-4 py-3.5"><Pill label={r.requestType} color={REQUEST_PILL[r.requestType]} /></td>
                      <td className="px-4 py-3.5">{r.dealIntakeSlot && <Pill {...r.dealIntakeSlot} />}</td>
                      <td className="px-4 py-3.5">{r.dealAssuranceSlot && <Pill {...r.dealAssuranceSlot} />}</td>
                      <td className="px-4 py-3.5">{r.cpqSlot && <Pill {...r.cpqSlot} />}</td>
                      <td className="whitespace-nowrap px-4 py-3.5">{r.submittedBy}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[#605e5c]">{r.created}</td>
                      <td className="px-4 py-3.5"><Pill label={effStatus(r)} color={statusColor(effStatus(r))} /></td>
                      <td className="px-4 py-3.5">{r.assignedResource && <Pill label={r.assignedResource} color="gray" />}</td>
                      <td className="px-4 py-3.5 text-[#605e5c]">{r.attachment && <span title="1 attachment">📎</span>}</td>
                      <td className="px-4 py-3.5 text-[#1b5fb0]">
                        {r.documentLink && (
                          <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="inline-block max-w-[160px] truncate hover:underline" title={r.documentLink}>
                            {r.documentLink}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="h-4" />
        </div>

        {toast && (
          <div className="pointer-events-none absolute bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-[#242424] px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}

        {selected && (
          <DetailDrawer
            key={rowKey(selected)}
            row={selected}
            scheduled={scheduled[rowKey(selected)]}
            status={effStatus(selected)}
            onStatusChange={(s) => {
              setStatuses((prev) => ({ ...prev, [rowKey(selected)]: s }));
              flash(`Status updated to “${s}”`);
            }}
            onSchedule={(s) => {
              setScheduled((prev) => ({ ...prev, [rowKey(selected)]: s }));
              flash(`Call scheduled with ${selected.submittedBy}`);
            }}
            onClose={() => setSelected(null)}
          />
        )}
    </div>
  );
}

function DetailDrawer({
  row,
  scheduled,
  status,
  onStatusChange,
  onSchedule,
  onClose,
}: {
  row: Row;
  scheduled?: Scheduled;
  status: string;
  onStatusChange: (s: string) => void;
  onSchedule: (s: Scheduled) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(scheduled?.date ?? '');
  const [time, setTime] = useState(scheduled?.time ?? '');
  const [note, setNote] = useState(scheduled?.note ?? '');
  const [confirmed, setConfirmed] = useState<Scheduled | null>(scheduled ?? null);

  const summary: { label: string; value?: string; slot?: Slot; pill?: PillColor }[] = [
    { label: 'Request Type', value: row.requestType, pill: REQUEST_PILL[row.requestType] },
    { label: 'Salesforce ID', value: row.salesforceId },
    { label: 'Submitted By', value: row.submittedBy },
    { label: 'Created', value: row.created },
    { label: 'Assigned Resource', value: row.assignedResource },
    { label: 'Deal Intake Slot', slot: row.dealIntakeSlot },
    { label: 'Deal Assurance Slot', slot: row.dealAssuranceSlot },
    { label: 'CPQ Slot', slot: row.cpqSlot },
  ];

  const captured = row.item?.conditionalFields
    ? Object.entries(row.item.conditionalFields).filter(([, v]) => v && v.trim())
    : [];

  const prettyDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="absolute inset-0 z-[60] flex justify-end bg-black/25" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[440px] flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-[#edebe9] px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1"><Pill label={row.requestType} color={REQUEST_PILL[row.requestType]} /></div>
            <h3 className="truncate text-lg font-semibold text-[#242424]">{row.client}</h3>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-[#605e5c] hover:bg-black/5" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* status control */}
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#edebe9] bg-[#faf9f8] px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-[#242424]">Status</span>
              <Pill label={status} color={statusColor(status)} />
            </div>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="rounded-md border border-[#c8c6c4] bg-white px-2.5 py-1.5 text-sm text-[#242424] focus:border-[#1b5fb0] focus:outline-none"
              aria-label="Change status"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* summary */}
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#605e5c]">Details</h4>
          <dl className="space-y-2.5">
            {summary.map((s) => {
              if (s.slot) {
                return (
                  <Field key={s.label} label={s.label}>
                    <Pill {...s.slot} />
                  </Field>
                );
              }
              if (!s.value) return null;
              return (
                <Field key={s.label} label={s.label}>
                  {s.pill ? <Pill label={s.value} color={s.pill} /> : <span className="text-[#242424]">{s.value}</span>}
                </Field>
              );
            })}
          </dl>

          {captured.length > 0 && (
            <>
              <h4 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-[#605e5c]">Request information</h4>
              <dl className="space-y-2.5">
                {captured.map(([k, v]) => (
                  <Field key={k} label={fieldLabel(k)}>
                    <span className="text-[#242424]">{v}</span>
                  </Field>
                ))}
              </dl>
            </>
          )}

          {/* scheduling */}
          <div className="mt-6 rounded-lg border border-[#edebe9] bg-[#faf9f8] p-4">
            <h4 className="text-sm font-semibold text-[#242424]">Schedule a call</h4>
            <p className="mt-0.5 text-xs text-[#605e5c]">
              Set up a call with <span className="font-medium text-[#242424]">{row.submittedBy}</span> (requestor).
            </p>

            {confirmed ? (
              <div className="mt-3 rounded-md border border-[#c6e6c6] bg-[#dff6dd] px-3 py-2.5 text-sm text-[#0b6a0b]">
                ✓ Call scheduled with <span className="font-semibold">{row.submittedBy}</span> on{' '}
                <span className="font-semibold">{prettyDate(confirmed.date)}</span> at{' '}
                <span className="font-semibold">{confirmed.time}</span>.
                {confirmed.note && <div className="mt-1 text-[#3b3a39]">Note: {confirmed.note}</div>}
                <button
                  onClick={() => setConfirmed(null)}
                  className="mt-2 block text-xs font-medium text-[#1b5fb0] hover:underline"
                >
                  Reschedule
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                <div className="flex gap-2">
                  <label className="flex-1 text-xs text-[#605e5c]">
                    Date
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="mt-1 w-full rounded-md border border-[#c8c6c4] px-2.5 py-1.5 text-sm text-[#242424] focus:border-[#1b5fb0] focus:outline-none"
                    />
                  </label>
                  <label className="w-28 text-xs text-[#605e5c]">
                    Time
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="mt-1 w-full rounded-md border border-[#c8c6c4] px-2.5 py-1.5 text-sm text-[#242424] focus:border-[#1b5fb0] focus:outline-none"
                    />
                  </label>
                </div>
                <label className="block text-xs text-[#605e5c]">
                  Note (optional)
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Agenda or context for the call…"
                    className="mt-1 w-full resize-none rounded-md border border-[#c8c6c4] px-2.5 py-1.5 text-sm text-[#242424] focus:border-[#1b5fb0] focus:outline-none"
                  />
                </label>
                <button
                  disabled={!date || !time}
                  onClick={() => {
                    const s = { date, time, note };
                    setConfirmed(s);
                    onSchedule(s);
                  }}
                  className="w-full rounded-md bg-[#1b5fb0] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#164e91] disabled:cursor-not-allowed disabled:bg-[#c8c6c4]"
                >
                  Schedule call
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-xs text-[#605e5c]">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}

function ToolbarBtn({ icon, label, caret, onClick }: { icon: string; label: string; caret?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-[#242424] hover:bg-[#f3f2f1]">
      <span className="text-[#605e5c]">{icon}</span>
      {label && <span>{label}</span>}
      {caret && <span className="text-[#605e5c]">▾</span>}
    </button>
  );
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button className="grid h-7 w-7 place-items-center rounded text-base hover:bg-[#f3f2f1]" title={label} aria-label={label}>
      {children}
    </button>
  );
}
