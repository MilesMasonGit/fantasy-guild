import { DAMAGE_TYPES, DAMAGE_GROUPS, damageTypeLabel, isTypeOrGroupId, SKILLS, ENEMY_STYLES, isGearResistLine, isDamageCut, GEAR_RESIST_LINE_MAX } from '../../utils/constants';

const styleName = (id) => SKILLS.find((s) => s.id === id)?.name || id;
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** `map` with `id` set to `value`, or without `id` when `value` is blank; undefined when nothing is left. */
function withLine(map, id, value) {
  const next = { ...(isPlainObject(map) ? map : {}) };
  if (value === '' || value == null) delete next[id]; else next[id] = value;
  return Object.keys(next).length ? next : undefined;
}

/**
 * A worn piece's defence (`gearDefence.js`): what it resists, in free percents by damage type or
 * group (`resistances: { physical: 20, ice: -10 }`, a negative a weakness; lines add, a group's
 * counting on each of its types), and what it costs: a damage cut to named styles
 * (`damageCut: { magic: 30 }`, shown red in the game's tooltip). Removing the last line drops the key.
 */
export default function GearDefenceFields({ item, onChange }) {
  const resistances = isPlainObject(item.resistances) ? item.resistances : {};
  const cuts = isPlainObject(item.damageCut) ? item.damageCut : {};
  const ids = [...DAMAGE_GROUPS, ...DAMAGE_TYPES].map((x) => x.id);
  const rows = Object.keys(resistances);
  const free = ids.filter((id) => resistances[id] == null);
  const cutRows = Object.keys(cuts);
  const freeStyles = ENEMY_STYLES.filter((id) => cuts[id] == null);

  const setResist = (id, raw) => {
    const n = raw === '' ? '' : Math.trunc(Number(raw));
    onChange({ resistances: withLine(resistances, id, n === '' || !Number.isFinite(n) || n === 0 ? '' : n) });
  };
  const setCut = (id, raw) => {
    const n = raw === '' ? '' : Math.trunc(Number(raw));
    onChange({ damageCut: withLine(cuts, id, n === '' || !Number.isFinite(n) || n <= 0 ? '' : n) });
  };

  return (
    <div className="col-span-2 grid grid-cols-2 gap-4" data-field="gear-defence">
      <div className="col-span-1" data-field="gear-resistances">
        <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">Resists (%)</span>
        <div className="flex flex-col gap-1.5">
          {rows.map((id) => {
            const known = isTypeOrGroupId(id);
            const ok = known && isGearResistLine(resistances[id]);
            return (
              <div key={id} className="flex items-center gap-2" data-field={`gear-resist-${id}`}>
                <span className="text-[11px] text-gray-300 w-20" style={known ? undefined : { color: 'var(--color-warning)' }}>
                  {known ? damageTypeLabel(id) : `"${id}"?`}
                </span>
                <input
                  type="number"
                  min={-GEAR_RESIST_LINE_MAX}
                  max={GEAR_RESIST_LINE_MAX}
                  aria-label={`${damageTypeLabel(id)} resistance`}
                  data-field={`gear-resist-${id}-value`}
                  value={resistances[id] ?? ''}
                  onChange={(e) => setResist(id, e.target.value)}
                  className="w-20"
                  style={ok ? undefined : { borderColor: 'var(--color-warning)' }}
                />
                <button type="button" className="text-[11px] text-gray-500 hover:text-white" onClick={() => setResist(id, '')}>Remove</button>
              </div>
            );
          })}
          {free.length > 0 && (
            <select
              aria-label="Add a resistance"
              data-field="gear-resist-add"
              value=""
              onChange={(e) => e.target.value && setResist(e.target.value, '10')}
              className="w-full text-gray-400"
            >
              <option value="">Add a resistance or weakness…</option>
              {DAMAGE_GROUPS.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {free.includes(g.id) && <option value={g.id}>{g.label} (the whole group)</option>}
                  {DAMAGE_TYPES.filter((t) => t.group === g.id && free.includes(t.id)).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          Percent off hits of that type the wearer takes; negative is a weakness. A group&apos;s line counts on each of its types, beside a type&apos;s own. Keep numbers small: no hero&apos;s best stack may reach 100 % in any type (the audit checks).
        </p>
      </div>

      <div className="col-span-1" data-field="gear-cuts">
        <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">Damage cut (%)</span>
        <div className="flex flex-col gap-1.5">
          {cutRows.map((id) => {
            const known = ENEMY_STYLES.includes(id);
            const ok = known && isDamageCut(cuts[id]);
            return (
              <div key={id} className="flex items-center gap-2" data-field={`gear-cut-${id}`}>
                <span className="text-[11px] w-20" style={{ color: known ? 'var(--color-error)' : 'var(--color-warning)' }}>
                  {known ? styleName(id) : `"${id}"?`}
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  aria-label={`${styleName(id)} damage cut`}
                  data-field={`gear-cut-${id}-value`}
                  value={cuts[id] ?? ''}
                  onChange={(e) => setCut(id, e.target.value)}
                  className="w-20"
                  style={ok ? undefined : { borderColor: 'var(--color-warning)' }}
                />
                <button type="button" className="text-[11px] text-gray-500 hover:text-white" onClick={() => setCut(id, '')}>Remove</button>
              </div>
            );
          })}
          {freeStyles.length > 0 && (
            <select
              aria-label="Add a damage cut"
              data-field="gear-cut-add"
              value=""
              onChange={(e) => e.target.value && setCut(e.target.value, '15')}
              className="w-full text-gray-400"
            >
              <option value="">Add a damage cut…</option>
              {freeStyles.map((id) => <option key={id} value={id}>{styleName(id)}</option>)}
            </select>
          )}
        </div>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          The trade-off: percent off the wearer&apos;s hits while they fight in that style (an iron chestplate: Magic 30, Stealth 15). Cuts from several pieces add. Shown red in the game.
        </p>
      </div>
    </div>
  );
}
