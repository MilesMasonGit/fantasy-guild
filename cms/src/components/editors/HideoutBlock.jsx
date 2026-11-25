import { VenetianMask } from 'lucide-react';
import { Section } from '../shared/EditorLayout';
import { NumberCell } from '../shared/IOEntryList';
import { CAUGHT_DEFAULTS, caughtCurveOf, caughtChance } from '../../utils/constants';

/**
 * A Hideout's caught curve (`hideout: { evenChance, perLevel, minChance, maxChance }`, every number
 * optional): how often its thief is caught, by their Crime level against the robbed camp's. The
 * game's reader is `src/config/registries/crime.js`; Quiet (an effect) takes points off on top.
 *
 * Written only while a number differs from the default: a Hideout left at the defaults carries no
 * block, so its record stays byte-identical.
 */

const FIELDS = Object.freeze([
  { key: 'evenChance', label: 'Caught at even level %', help: 'A thief of the camp\'s own Crime level.' },
  { key: 'perLevel', label: 'Points per level', help: 'More for each level the camp is above the thief, less below.' },
  { key: 'minChance', label: 'Never under %', help: 'However far above the camp; Quiet never goes past it either.' },
  { key: 'maxChance', label: 'Never over %', help: 'However far below the camp.' }
]);

/** The block with only the numbers that differ from the defaults, or undefined. */
function tidy(block) {
  const out = {};
  for (const { key } of FIELDS) {
    const v = block?.[key];
    if (typeof v === 'number' && Number.isFinite(v) && v !== CAUGHT_DEFAULTS[key]) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export default function HideoutBlock({ token, onPatch }) {
  const block = token?.hideout && typeof token.hideout === 'object' ? token.hideout : {};
  const curve = caughtCurveOf(token);
  const set = (key, v) => onPatch({ hideout: tidy({ ...block, [key]: Number.isFinite(v) ? v : undefined }) });
  const sample = (gap) => Math.round(caughtChance(10, 10 + gap, curve) * 10) / 10;

  return (
    <Section title="Hideout (Crime)" icon={<VenetianMask size={14} />}>
      <div data-field="hideout" className="space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          A Hideout runs no recipe. The player picks, on its card, one enemy camp within its reach to
          rob; each cycle its Crime hero rolls that camp&apos;s enemy&apos;s steal table, and the enemy
          stays where it stands. Caught means a guard on the camp, past its cap, and nobody robs it
          until the guard is beaten. Bosses are never robbed. Speed, XP, Lucky and Quiet effects on a
          variant work as on any building.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(({ key, label, help }) => (
            <div key={key} data-hideout-field={key}>
              <NumberCell label={label} value={block[key] ?? CAUGHT_DEFAULTS[key]} min={0} max={100} step={0.5} onChange={(v) => set(key, v)} />
              <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">{help}</p>
            </div>
          ))}
        </div>
        <p data-hideout-sample className="text-[11px] text-gray-400 leading-relaxed">
          Caught: {sample(5)}% five levels below the camp, {sample(0)}% at its level, {sample(-5)}% five
          above, {sample(-20)}% twenty above.
        </p>
      </div>
    </Section>
  );
}
