import { useState } from 'react';
import { DAMAGE_GROUPS, DAMAGE_TYPES } from '../../utils/constants';

const typesLine = (groupId) => DAMAGE_TYPES.filter((t) => t.group === groupId).map((t) => t.label).join(', ');

/**
 * The fill-in under a resistances block: a value, then one button per group that sets that group's
 * three types to it (Set all Physical fills Slash, Crush and Stab). Only types carry numbers, so the
 * buttons write three type lines, never a group line. `steps` (with `stepWords`) makes the value a
 * pick of fixed steps (an enemy's); without it the value is a whole number from `min` to `max`.
 */
export default function SetAllTypes({ onFill, steps = null, stepWords = {}, min, max, initial, dataField }) {
  const [value, setValue] = useState(String(initial));
  const n = Number(value);
  const ok = value !== '' && Number.isInteger(n) && n !== 0 && (steps ? steps.includes(n) : n >= min && n <= max);

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1" data-field={dataField}>
      <span className="text-[10px] text-gray-500">Set all to</span>
      {steps ? (
        <select aria-label="Set all value" data-field={`${dataField}-value`} value={value} onChange={(e) => setValue(e.target.value)}>
          {steps.map((step) => (
            <option key={step} value={String(step)}>{stepWords[step] ?? step}</option>
          ))}
        </select>
      ) : (
        <input
          type="number"
          min={min}
          max={max}
          aria-label="Set all value"
          data-field={`${dataField}-value`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-16"
        />
      )}
      {DAMAGE_GROUPS.map((g) => (
        <button
          key={g.id}
          type="button"
          title={`Sets ${typesLine(g.id)} to this value`}
          data-field={`${dataField}-${g.id}`}
          disabled={!ok}
          className="text-[11px] text-gray-400 hover:text-white disabled:opacity-40"
          onClick={() => onFill(g.id, n)}
        >
          {`Set all ${g.label}`}
        </button>
      ))}
    </div>
  );
}
