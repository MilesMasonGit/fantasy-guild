import { useMemo, useState } from 'react';
import { Plus, X, Target, Zap, Dices } from 'lucide-react';
import { useEntityStore, makeBuff, makeModifier } from '../../stores/useEntityStore';
import { MODIFIER_PALETTE, MODIFIER_BUCKETS, TARGET_MODES, getPaletteEntry } from '../../utils/constants';
import { TOKEN_TYPES } from '../../utils/constants';
import { Field } from '../shared/EditorLayout';

/**
 * Authoring for a Token's adjacency buff: who it targets, and what it changes.
 *
 * ## Only axes the board actually reads
 * The palette comes from the game (`modifierPalette.js`), not from a list kept
 * here. `EFFECT_TYPES` contains several axes with no consumer at all; offering
 * those would let an author build a Token whose effect silently does nothing —
 * exactly the old CMS's placeholder-Effects problem.
 *
 * ## Two shapes, two forms (CMS-25)
 * A deterministic modifier picks a bucket and a value. A **proc** modifier is a
 * percentage chance rolled once per cycle, so it gets a single chance field and
 * no bucket selector — the ambiguity CMS-25 exists to remove.
 *
 * ## Targeting changes the effect budget (CMS-17/19)
 * Untargeted buffs must stay tiny because they touch everything nearby
 * (D-119/D-120). Naming a target makes the buff narrow enough to afford real
 * weight — and large targeted buffs default to not stacking (CMS-19), because
 * eight stacked "double Shrimp" buffs would be +800%.
 */
export default function BuffEditor({ token, onChange }) {
  const tokens = useEntityStore((s) => s.tokens);
  const [tagDraft, setTagDraft] = useState('');

  const buff = token.buff;
  const modifiers = buff?.modifiers || [];
  const targetToken = buff?.targetToken || null;

  /** Every Token tag in use, so targeting offers real values (CMS-5's spirit). */
  const knownTags = useMemo(() => {
    const all = new Set();
    for (const t of Object.values(tokens)) for (const tag of t.tags || []) all.add(tag);
    return [...all].sort();
  }, [tokens]);

  const patchBuff = (patch) => onChange({ buff: { ...(buff || makeBuff()), ...patch } });

  const addModifier = (type) => {
    const entry = getPaletteEntry(type);
    patchBuff({ modifiers: [...modifiers, makeModifier(type, entry?.shape)] });
  };
  const patchModifier = (i, patch) =>
    patchBuff({ modifiers: modifiers.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });
  const removeModifier = (i) =>
    patchBuff({ modifiers: modifiers.filter((_, idx) => idx !== i) });

  const setMode = (mode) => {
    if (!mode) return patchBuff({ targetToken: null });
    patchBuff({ targetToken: { mode, value: '' } });
  };

  const grouped = MODIFIER_PALETTE.reduce((acc, e) => {
    (acc[e.group] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* --- Targeting ----------------------------------------------------- */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500 flex items-center gap-1.5">
          <Target size={11} /> Target
        </label>
        <select
          value={targetToken?.mode || ''}
          onChange={(e) => setMode(e.target.value)}
          className="w-full"
        >
          <option value="">Everything adjacent (untargeted)</option>
          {TARGET_MODES.map((m) => (
            <option key={m.mode} value={m.mode}>{m.label}</option>
          ))}
        </select>

        {targetToken?.mode === 'tag' && (
          <TagPicker
            value={targetToken.value}
            known={knownTags}
            onChange={(v) => patchBuff({ targetToken: { mode: 'tag', value: v } })}
          />
        )}

        {targetToken?.mode === 'id' && (
          <select
            value={targetToken.value}
            onChange={(e) => patchBuff({ targetToken: { mode: 'id', value: e.target.value } })}
            className="w-full mt-1.5"
          >
            <option value="">— pick a Token —</option>
            {Object.values(tokens)
              .filter((t) => t.id !== token.id)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
        )}

        {targetToken?.mode === 'tokenType' && (
          <select
            value={targetToken.value}
            onChange={(e) => patchBuff({ targetToken: { mode: 'tokenType', value: e.target.value } })}
            className="w-full mt-1.5"
          >
            <option value="">— pick a category —</option>
            {TOKEN_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          {targetToken?.mode
            ? TARGET_MODES.find((m) => m.mode === targetToken.mode)?.hint
            : 'Untargeted buffs reach every adjacent Token, so their effects must stay small (D-119/D-120).'}
        </p>

        {targetToken?.mode && !targetToken.value && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-warning)' }}>
            ⚠️ No target chosen — this buff will reach nothing at all.
          </p>
        )}

        {targetToken?.mode && !token.noStackDuplicates && (
          <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'var(--color-warning)' }}>
            ⚠️ Targeted buffs default to not stacking (CMS-19). Eight copies of a large
            targeted buff would multiply, not add. Consider ticking “Duplicates don't
            stack” in Lifecycle.
          </p>
        )}
      </div>

      {/* --- Modifiers ----------------------------------------------------- */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
          Modifiers
        </label>

        <div className="space-y-2">
          {modifiers.length === 0 && (
            <p className="text-[11px] text-gray-600">
              No modifiers — this Token has no adjacency effect.
            </p>
          )}

          {modifiers.map((m, i) => {
            const entry = getPaletteEntry(m.type);
            const isProc = entry?.shape === 'proc';
            return (
              <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-2.5 space-y-2">
                <div className="flex items-center gap-1.5">
                  {isProc ? <Dices size={12} className="text-amber-400" /> : <Zap size={12} className="text-emerald-400" />}
                  <span className="flex-1 text-xs text-gray-200">{entry?.label || m.type}</span>
                  <button
                    onClick={() => removeModifier(i)}
                    className="text-gray-600 hover:text-red-400"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                  >
                    <X size={12} />
                  </button>
                </div>

                {isProc ? (
                  <Field label="Chance %">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={m.value ?? 0}
                      onChange={(e) =>
                        patchModifier(i, { value: Math.max(0, Math.min(100, Number(e.target.value))), bucket: 'flat' })
                      }
                      className="w-full"
                      style={{ fontSize: 11 }}
                    />
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Bucket">
                      <select
                        value={m.bucket || 'percentage'}
                        onChange={(e) => patchModifier(i, { bucket: e.target.value })}
                        className="w-full"
                        style={{ fontSize: 11 }}
                      >
                        {MODIFIER_BUCKETS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label={m.bucket === 'percentage' ? 'Value (0.05 = +5%)' : 'Value'}>
                      <input
                        type="number"
                        step={m.bucket === 'percentage' ? 0.01 : 1}
                        value={m.value ?? 0}
                        onChange={(e) => patchModifier(i, { value: Number(e.target.value) })}
                        className="w-full"
                        style={{ fontSize: 11 }}
                      />
                    </Field>
                  </div>
                )}

                <p className="text-[10px] text-gray-600 leading-relaxed">{entry?.hint}</p>

                {/* D-120's guard rail, stated where the number is typed. */}
                {!targetToken?.mode && m.bucket === 'percentage' && Math.abs(m.value) > 0.15 && (
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
                    ⚠️ Large for an untargeted buff. D-119/D-120 keep these to a few percent
                    because they touch everything nearby; power should come from better
                    Tokens, not stacked modifiers. Give it a target to justify real weight.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 space-y-1.5">
          {Object.entries(grouped).map(([group, entries]) => (
            <div key={group} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-gray-600 w-16">{group}</span>
              {entries.map((e) => (
                <button
                  key={e.type}
                  onClick={() => addModifier(e.type)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}
                  title={e.hint}
                >
                  <Plus size={10} /> {e.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TagPicker({ value, known, onChange }) {
  return (
    <div className="mt-1.5">
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tag to target, e.g. seafood"
        className="w-full"
        style={{ fontSize: 11 }}
      />
      {known.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {known
            .filter((t) => t !== value)
            .slice(0, 8)
            .map((t) => (
              <button
                key={t}
                onClick={() => onChange(t)}
                className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                style={{ border: 'none', cursor: 'pointer' }}
              >
                {t}
              </button>
            ))}
        </div>
      )}
      {known.length === 0 && (
        <p className="text-[10px] text-gray-600 mt-1">
          No Token carries a tag yet. Add one in a Token's Classification section.
        </p>
      )}
    </div>
  );
}
