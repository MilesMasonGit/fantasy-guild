import { useEffect, useMemo, useState } from 'react';
import { Star, Plus, Trash2, Pencil, Library } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Section } from '../shared/EditorLayout';
import { editorRows, perkCount } from '../../engine/skillPerks';
import {
  skillsByLayer, SKILLS, rulesLinesOf, scaleStatement, getPaletteEntry, getKeyword, MAX_SCALE,
  perkFindings, DEFAULT_PERK_LEVELS, MIN_PERK_LEVEL,
} from '../../utils/constants';

/**
 * The Skill Perks page: each skill's milestone perks. Every hero who reaches a perk's level gains
 * it and keeps it; a perk is a library effect, its rules reaching the hero as a carried item's do,
 * and it spends nothing. The five default levels show as empty rows until an effect is picked.
 * Sync to Game writes the tables to `data/skillPerks.json`.
 */

const MAX_LEVEL = 99;

const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;

/** Whether an effect has a number a scale would multiply. */
const scalable = (effect) => (effect?.statements || []).some((st) =>
  getPaletteEntry(st?.payload?.type)?.scales || getKeyword(st?.keyword)?.scales);

export default function SkillPerksPage({ setCurrentView }) {
  const skillPerks = useEntityStore((s) => s.skillPerks);
  const effects = useEntityStore((s) => s.effects);
  const tokens = useEntityStore((s) => s.tokens);
  const items = useEntityStore((s) => s.items);
  const setRow = useEntityStore((s) => s.setSkillPerkRow);
  const removeRow = useEntityStore((s) => s.removeSkillPerkRow);
  const addEffect = useEntityStore((s) => s.addEffect);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const focus = useEntityStore((s) => s.perkFocus);
  const focusPerks = useEntityStore((s) => s.focusPerks);
  const [skillId, setSkillId] = useState(focus || SKILLS[0]?.id);

  // The change-pack review's Open in editor lands on its skill.
  useEffect(() => {
    if (!focus) return;
    setSkillId(focus);
    focusPerks(null);
  }, [focus, focusPerks]);

  const names = useMemo(() => ({
    token: (id) => tokens[id]?.name || id,
    item: (id) => items[id]?.name || id,
    effect: (id) => effects?.[id]?.name || id,
  }), [tokens, items, effects]);

  const record = skillPerks?.[skillId] || null;
  const rows = editorRows(record);
  const library = useMemo(
    () => Object.values(effects || {}).filter((e) => e?.id).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)),
    [effects]
  );
  const findings = perkFindings({ skillPerks: record ? { [skillId]: record } : {}, effects });

  const pick = (row, effectId) => setRow(skillId, row.index, { ...row, effectId });
  const openEffect = (effectId) => {
    setActiveEntity(effectId, 'effect');
    setCurrentView?.('editor');
  };
  const newEffect = (row) => {
    const effectId = addEffect({ name: `${skillName(skillId)} ${row.level} Perk`, statements: [] });
    setRow(skillId, row.index, { ...row, effectId });
    openEffect(effectId);
  };
  const addLevel = () => {
    const taken = new Set(rows.filter((r) => !r.virtual).map((r) => r.level));
    const free = [...DEFAULT_PERK_LEVELS, ...Array.from({ length: MAX_LEVEL - MIN_PERK_LEVEL + 1 }, (_, i) => MIN_PERK_LEVEL + i)]
      .find((level) => !taken.has(level)) ?? MAX_LEVEL;
    setRow(skillId, -1, { level: free, effectId: '', scale: 1 });
  };

  return (
    <div className="flex h-full gap-4 p-4" data-testid="skill-perks-page">
      <aside className="w-56 shrink-0 overflow-y-auto space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <Star size={15} /> Skill Perks
        </h2>
        {skillsByLayer().map(([label, group]) => (
          <div key={label} className="space-y-0.5">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
            {group.map((s) => {
              const count = perkCount(skillPerks?.[s.id]);
              return (
                <button
                  key={s.id}
                  type="button"
                  data-perk-skill={s.id}
                  onClick={() => setSkillId(s.id)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded text-xs text-left"
                  style={{
                    background: s.id === skillId ? 'var(--color-accent-muted)' : 'transparent',
                    color: 'var(--color-text-primary)', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span>{s.name}</span>
                  {count > 0 && <span className="text-[10px]" style={{ color: 'var(--color-accent-hover)' }}>{count}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto space-y-4">
        <Section title={`${skillName(skillId)} perks`} icon={<Star size={14} />}>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Every hero who reaches a perk&rsquo;s level gains it and keeps it, with no choice. A perk is a library
            effect: its rules reach the hero as a carried item&rsquo;s do (the Token they work, the enemy they fight,
            the hero themselves), and it spends nothing. Narrow a work rule to {skillName(skillId)} unless it is meant
            for every skill&rsquo;s work.
          </p>

          <div className="space-y-2" data-perk-rows={skillId}>
            {rows.map((row) => {
              const effect = row.effectId ? effects?.[row.effectId] : null;
              const lines = effect
                ? rulesLinesOf({ statements: (effect.statements || []).map((st) => scaleStatement(st, row.scale)) }, names)
                : [];
              const key = row.virtual ? `v${row.level}` : `r${row.index}`;
              return (
                <div key={key} data-perk-row={row.level} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                      Level
                      {row.virtual ? (
                        <span className="w-12 text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{row.level}</span>
                      ) : (
                        <input
                          type="number"
                          min={MIN_PERK_LEVEL}
                          max={MAX_LEVEL}
                          step={1}
                          value={row.level}
                          data-perk-level
                          onChange={(e) => setRow(skillId, row.index, { ...row, level: e.target.value })}
                          className="w-14"
                          style={{ fontSize: 11, padding: '1px 4px' }}
                        />
                      )}
                    </label>
                    <select
                      value={row.effectId}
                      data-perk-effect
                      onChange={(e) => pick(row, e.target.value)}
                      className="text-xs flex-1 min-w-40"
                    >
                      <option value="">{row.virtual ? 'No perk at this level' : 'No effect picked'}</option>
                      {row.effectId && !effect && <option value={row.effectId}>{row.effectId} (missing)</option>}
                      {library.map((e) => <option key={e.id} value={e.id}>{e.name || e.id}</option>)}
                    </select>
                    {effect && scalable(effect) && (
                      <label className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }} title="How strong this perk's version is, 1-5; the effect itself is unchanged.">
                        x
                        <input
                          type="number"
                          min={1}
                          max={MAX_SCALE}
                          step={1}
                          value={row.scale}
                          onChange={(e) => setRow(skillId, row.index, { ...row, scale: e.target.value })}
                          className="w-11"
                          style={{ fontSize: 10, padding: '1px 4px' }}
                        />
                      </label>
                    )}
                    {effect ? (
                      <button type="button" onClick={() => openEffect(effect.id)} className="btn-ghost flex items-center gap-1 text-[10px]" style={{ padding: '2px 6px' }} title="Open this effect in the Effect editor">
                        <Pencil size={11} /> Edit effect
                      </button>
                    ) : (
                      <button type="button" data-perk-new-effect onClick={() => newEffect(row)} className="btn-ghost flex items-center gap-1 text-[10px]" style={{ padding: '2px 6px' }} title="Make a new library effect for this perk and open it">
                        <Library size={11} /> New effect
                      </button>
                    )}
                    {!row.virtual && (
                      <button type="button" onClick={() => removeRow(skillId, row.index)} className="btn-ghost" style={{ padding: '2px 6px' }} title="Remove this perk (the effect itself is kept)">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  {lines.map((line, i) => (
                    <p key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{line}</p>
                  ))}
                  {effect && lines.length === 0 && (
                    <p className="text-[11px] italic" style={{ color: 'var(--color-warning)' }}>This effect has no rule yet: open it to add one.</p>
                  )}
                </div>
              );
            })}
          </div>

          {findings.length > 0 && (
            <ul data-perk-findings className="mt-3 text-[11px] list-disc pl-4 space-y-0.5" style={{ color: 'var(--color-warning)' }}>
              {findings.map((f, i) => <li key={i}>{f.message}</li>)}
            </ul>
          )}

          <button type="button" onClick={addLevel} className="btn-ghost flex items-center gap-1 text-xs mt-3">
            <Plus size={13} /> Add a level
          </button>
        </Section>
      </main>
    </div>
  );
}
