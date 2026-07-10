import { useMemo, useState } from 'react';
import type { ConversationView } from '../types';

const GROUP_TITLES: Record<string, string> = {
  mandatory: 'Core details',
  conditional: 'Details for this demand type',
  sensitivity: 'Data sensitivity',
  roi: 'Value (light ROI)',
};
const GROUP_ORDER = ['mandatory', 'conditional', 'sensitivity', 'roi'];

export function ConfirmationCard({
  view,
  submitting,
  submitError,
  onSubmit,
  onSaveDraft,
}: {
  view: ConversationView;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (edits: Record<string, string>, consent: boolean) => void;
  onSaveDraft: () => void;
}) {
  const fields = view.editableFields ?? [];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );
  const [consent, setConsent] = useState(false);
  const [editing, setEditing] = useState(false);

  const grouped = useMemo(() => {
    const by: Record<string, typeof fields> = {};
    for (const f of fields) (by[f.group] ??= []).push(f);
    return GROUP_ORDER.filter((g) => by[g]?.length).map((g) => ({ group: g, fields: by[g] }));
  }, [fields]);

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-[var(--grid)] bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--grid)] px-5 py-3">
        <div className="font-semibold">Review your demand</div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-xs font-medium text-brand hover:underline"
        >
          {editing ? 'Done editing' : 'Edit fields'}
        </button>
      </div>

      <div className="max-h-[42vh] space-y-5 overflow-y-auto px-5 py-4 thread">
        {grouped.map(({ group, fields }) => (
          <div key={group}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {GROUP_TITLES[group] ?? group}
            </div>
            <div className="space-y-2">
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-[9rem_1fr] items-start gap-3">
                  <div className="pt-1.5 text-sm text-ink-2">{f.label}</div>
                  {editing ? (
                    f.type === 'choice' && f.options ? (
                      <select
                        value={values[f.key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        className="rounded-lg border border-[var(--grid)] bg-page px-2 py-1.5 text-sm"
                      >
                        {f.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <textarea
                        rows={1}
                        value={values[f.key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        className="w-full resize-y rounded-lg border border-[var(--grid)] bg-page px-2 py-1.5 text-sm"
                      />
                    )
                  ) : (
                    <div className="pt-1.5 text-sm">{values[f.key] || <span className="text-muted">—</span>}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-[var(--grid)] px-5 py-4">
        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--critical)_40%,white)] bg-[color-mix(in_srgb,var(--critical)_8%,white)] px-3 py-2 text-sm text-[var(--critical)]">
            <span>⚠</span>
            <span>{submitError}</span>
          </div>
        )}
        <label className="flex items-start gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I confirm this information is accurate and consent to submitting this demand to the AI
            Studio delivery team.
          </span>
        </label>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onSaveDraft}
            disabled={submitting}
            className="rounded-lg border border-[var(--grid)] px-4 py-2 text-sm font-medium text-ink-2 hover:bg-page disabled:opacity-50"
          >
            Save as draft
          </button>
          <button
            onClick={() => onSubmit(values, consent)}
            disabled={submitting || !consent}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Confirm & submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
