import { ClipboardList } from 'lucide-react';
import { Section, Field } from './EditorLayout';
import {
  LEDGER_STATUSES, LEDGER_TIERS, LEDGER_TEXT, ledgerOf, cleanLedger, tierLabel, tierOrNull,
} from '../../../../src/systems/atlas/ledger.js';

/**
 * The plan for one record (`src/systems/atlas/ledger.js`): its status, the tier the owner says it
 * belongs to, and a note. `onChange` gets the whole new block, or undefined once it is empty, for
 * the editor to write as `{ ledger }`.
 */
export default function LedgerFields({ record, onChange }) {
  const { status, tier, note } = ledgerOf(record);
  const set = (patch) => onChange(cleanLedger({ ...(record?.ledger || {}), ...patch }));
  const tiers = tier !== null && !LEDGER_TIERS.includes(tier) ? [...LEDGER_TIERS, tier] : LEDGER_TIERS;

  return (
    <Section title="Plan" icon={<ClipboardList size={14} />}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <select value={status} onChange={(e) => set({ status: e.target.value })} className="w-full" aria-label="Status">
            {LEDGER_STATUSES.map((s) => <option key={s} value={s}>{LEDGER_TEXT.status[s]}</option>)}
          </select>
          <p className="text-[10px] text-gray-500 mt-1">{LEDGER_TEXT.statusHelp[status]}</p>
        </Field>
        <Field label="Tier">
          <select value={tier ?? ''} onChange={(e) => set({ tier: tierOrNull(e.target.value) })} className="w-full" aria-label="Tier">
            <option value="">{LEDGER_TEXT.noTier}</option>
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
