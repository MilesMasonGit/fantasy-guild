import { useMemo } from 'react';
import { Sparkles, Gauge, X, Plus } from 'lucide-react';
import { Section, Field } from '../shared/EditorLayout';
import { SKILLS, isGatheringSkill, summonOf, circleChargeSetting, circleChargesAt, DEFAULT_CIRCLE_CHARGES, SUMMONING_SKILL } from '../../utils/constants';

/**
 * The Token editor's Summoning fields: a Summoned worker's kind (`summon`), and a Summoning
 * Circle's charges a cycle (`summonCircle`). The game reads both through `summonRules.js`; what a
 * Summoned worker does in play is `src/systems/board/Summons.js`.
 */

const byName = (a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id));

/**
 * Always present: ticking it is what makes a Token a Summoned worker's kind, so hiding it would hide
 * the only control that sets it. A summon is never a Token on the mat; a Summoning recipe whose
 * output names it calls it.
 */
export function SummonedWorkerSection({ token, tokens = {}, effects = {}, onChange }) {
  const block = token?.summon && typeof token.summon === 'object' ? token.summon : null;
  const read = summonOf(token);
  const enemies = useMemo(
    () => Object.values(tokens || {}).filter((t) => t?.id && t.enemy?.level != null).sort(byName),
    [tokens]
  );
  const effectList = useMemo(() => Object.values(effects || {}).filter((e) => e?.id).sort(byName), [effects]);
  const skillRows = Object.entries(block?.skills && typeof block.skills === 'object' ? block.skills : {});
  const write = (patch) => onChange({ ...(block || {}), ...patch });
  const setSkills = (rows) => write({ skills: Object.fromEntries(rows.filter(([id]) => id)) });
  const unused = SKILLS.filter((s) => !skillRows.some(([id]) => id === s.id));

  return (
    <Section title="Summoned worker" icon={<Sparkles size={14} />}>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          data-field="summon-on"
          checked={!!block}
          onChange={(e) => onChange(e.target.checked ? { of: '', skills: {}, trait: null } : undefined)}
        />
        <span className="text-[11px] text-gray-300">A Summoning Circle calls this as a Summoned worker</span>
      </label>

      {!block ? (
        <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
          A Summoned worker is a recolour of an enemy that works like a hero: it is ordered with its flag, but holds only
          its own skills at fixed levels, never gains XP, never fights, and carries one trait. A Summoning recipe whose
          output is this Token calls it at a Circle; each cycle adds charges, each cycle it works spends one, and at none it leaves.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <Field label="A recolour of">
              <select
                aria-label="A recolour of"
                data-field="summon-of"
                value={block.of || ''}
                onChange={(e) => write({ of: e.target.value })}
                className="w-full"
              >
                <option value="">Choose an enemy</option>
                {enemies.map((t) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
              </select>
            </Field>
            <Field label="Trait">
              <div className="flex gap-2">
                <select
                  aria-label="Trait"
                  data-field="summon-trait"
                  value={read?.trait?.effectId || ''}
                  onChange={(e) => write({ trait: e.target.value ? { effectId: e.target.value, scale: read?.trait?.scale || 1 } : null })}
                  className="flex-1 min-w-0"
                >
                  <option value="">No trait</option>
                  {effectList.map((fx) => <option key={fx.id} value={fx.id}>{fx.name || fx.id}</option>)}
                </select>
                {read?.trait && (
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    aria-label="Trait scale"
                    data-field="summon-trait-scale"
                    value={read.trait.scale}
                    onChange={(e) => write({ trait: { effectId: read.trait.effectId, scale: Math.max(0.1, Number(e.target.value) || 1) } })}
                    className="w-16"
                  />
                )}
              </div>
            </Field>
          </div>

          <div className="mt-3" data-field="summon-skills">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Skills, at fixed levels</div>
            {skillRows.map(([skillId, level], i) => (
              <div key={skillId || i} className="flex items-center gap-2 mb-1.5">
                <select
                  aria-label="Skill"
                  value={skillId}
                  onChange={(e) => setSkills(skillRows.map((row, j) => (j === i ? [e.target.value, row[1]] : row)))}
                  className="flex-1"
                >
                  {[SKILLS.find((s) => s.id === skillId) || { id: skillId, name: skillId }, ...unused].map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{isGatheringSkill(s.id) ? '' : ' (not gathering)'}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={99}
                  aria-label="Level"
                  value={level}
                  onChange={(e) => setSkills(skillRows.map((row, j) => (j === i ? [row[0], Math.min(99, Math.max(1, Math.floor(Number(e.target.value) || 1)))] : row)))}
                  className="w-20"
                />
                <button type="button" aria-label="Remove skill" onClick={() => setSkills(skillRows.filter((_, j) => j !== i))} className="text-gray-500 hover:text-white">
                  <X size={12} />
                </button>
              </div>
            ))}
            {unused.length > 0 && (
              <button
                type="button"
                data-field="summon-add-skill"
                onClick={() => setSkills([...skillRows, [(unused.find((s) => isGatheringSkill(s.id)) || unused[0]).id, 1]])}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white"
              >
                <Plus size={12} /> Add a skill
              </button>
            )}
          </div>

          <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
            It works only these skills, at these levels, and needs no tool; at water it fishes with the water&apos;s first
            kind of tool and spends Bait from the Bank. Its trait reaches the Token it works, as a hero&apos;s perk does.
            Summons work gathering skills only (Mining, Forestry, Fishing, Farming): the audit names any other.
          </p>
        </>
      )}
    </Section>
  );
}

/**
 * Shown on a Token that works as Summoning (`stationSkill`, its Works as skill): how many charges
 * each finished cycle adds to the Circle's Summoned worker, growing with its hero's Summoning level.
 */
export function SummoningCircleFields({ token, stationSkill, onChange }) {
  if (stationSkill !== SUMMONING_SKILL) return null;
  const setting = circleChargeSetting(token);
  const authored = token?.summonCircle && typeof token.summonCircle === 'object' ? token.summonCircle : {};
  const write = (patch) => onChange({ ...authored, ...patch });
  const preview = [1, 25, 50, 75, 99].map((lv) => `${lv}: ${circleChargesAt(token, lv)}`).join(' · ');
  return (
    <Section title="Summoning Circle" icon={<Gauge size={14} />}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Charges a cycle">
          <input
            type="number"
            min={0}
            aria-label="Charges a cycle"
            data-field="circle-charges"
            value={authored.charges ?? ''}
            placeholder={String(DEFAULT_CIRCLE_CHARGES.charges)}
            onChange={(e) => write({ charges: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })}
            className="w-full"
          />
        </Field>
        <Field label="Per Summoning level">
          <input
            type="number"
            min={0}
            step={0.05}
            aria-label="Per Summoning level"
            data-field="circle-per-level"
            value={authored.perLevel ?? ''}
            placeholder={String(DEFAULT_CIRCLE_CHARGES.perLevel)}
            onChange={(e) => write({ perLevel: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })}
            className="w-full"
          />
        </Field>
      </div>
      <p className="text-[10px] text-gray-600 leading-relaxed" data-field="circle-preview">
        Each finished cycle adds {setting.charges} charges plus {setting.perLevel} for every Summoning level of its hero, rounded
        down, to the Circle&apos;s one Summoned worker (calling it first). At Summoning {preview}.
      </p>
    </Section>
  );
}
