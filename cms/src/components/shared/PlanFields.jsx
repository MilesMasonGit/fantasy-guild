import { ClipboardList } from 'lucide-react';
import { Section, Field } from './EditorLayout';
import {
  PLAN_STATUSES, PLAN_TIERS, PLAN_TEXT, planOf, cleanPlan, tierLabel, tierOrNull,
} from '../../../../src/systems/progression/ledger/plan.js';

/**
 * The plan for one record (`src/systems/progression/ledger/plan.js`): its status, the tier the
 * owner says it belongs to, and a note. `onChange` gets the whole new block (any other field in it
 * kept), or undefined once it is empty, for the editor to write as `{ plan }`.
 */
export default function PlanFields({ record, onChange }) {
  const { status, tier, note } = planOf(record);
  const set = (patch) => onChange(cleanPlan({ ...(record?.plan || {}), ...patch }));
  const tiers = tier !== null && !PLAN_TIERS.includes(tier) ? [...PLAN_TIERS, tier] : PLAN_TIERS;

  return (
    <Section title="Plan" icon={<ClipboardList size={14} />}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <select value={status} onChange={(e) => set({ status: e.target.value })} className="w-full" aria-label="Status">
            {PLAN_STATUSES.map((s) => <option key={s} value={s}>{PLAN_TEXT.status[s]}</option>)}
          </select>
          <p className="text-[10px] text-gray-500 mt-1">{PLAN_TEXT.statusHelp[status]}</p>
        </Field>
        <Field label="Tier">
          <select value={tier ?? ''} onChange={(e) => set({ tier: tierOrNull(e.target.value) })} className="w-full" aria-label="Tier">
            <option value="">{PLAN_TEXT.noTier}</option>
            {tiers.map((t) => <option key={t} value={t}>{tierLabel(t)}</option>)}
          </select>
        </Field>
        <Field label="Note" className="col-span-2">
          <textarea
            value={note}
            onChange={(e) => set({ note: e.target.value })}
            rows={2}
            className="w-full resize-y"
            placeholder="Why it is planned here, what it is for."
            aria-label="Note"
          />
        </Field>
      </div>
    </Section>
  );
}
