import { useState, useMemo } from 'react';
import { Settings2, Tag as TagIcon, Timer, HelpCircle, Swords, Lock, BookOpen, Sparkles, X, Plus, ScrollText } from 'lucide-react';
import { useEntityStore, makeTokenConfig } from '../../stores/useEntityStore';
import { TOKEN_RARITIES, SKILLS, deriveTokenType, rulesLinesOf, stationSkillOf } from '../../utils/constants';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import Statements from './Statements';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

/**
 * The Token editor — CMS-71's header clusters (Phase 2).
 */
export default function TokenEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const token = useEntityStore((s) => s.tokens[activeId]);
  const tokens = useEntityStore((s) => s.tokens);
  const updateToken = useEntityStore((s) => s.updateToken);
  const deleteToken = useEntityStore((s) => s.deleteToken);
  const setTokenPooling = useEntityStore((s) => s.setTokenPooling);
  const recipePools = useEntityStore((s) => s.recipePools);
  const items = useEntityStore((s) => s.items);
  const maps = useEntityStore((s) => s.maps);

  const [isPickerOpen, setPickerOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

  const update = (key, value) => updateToken(activeId, { [key]: value });
  const updateConfig = (patch) =>
    updateToken(activeId, { config: { ...(token.config || makeTokenConfig()), ...patch } });

  const config = token?.config;
  const isEnemy = token?.tokenType === 'enemy';
  const stationSkill = stationSkillOf(token);
  const isPooled = !!stationSkill;
  const pooledRecipes = isPooled ? (recipePools[stationSkill] || []) : [];
  const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;
  const isUnlimited = token?.uses == null;
  const spritePath = token?.sprite ? resolveSpritePath(token.sprite) : null;

  // ⚠️ The type is DERIVED, and so is the rules text. Neither is typed by hand
  // any more (§1.2, owner decision Q3): a picker can disagree with the thing it
  // classifies, and a hand-written description can disagree with the effect it
  // describes. Both disagreements were live bugs.
  const derived = useMemo(() => deriveTokenType(token), [token]);
  const rulesLines = useMemo(
    () => rulesLinesOf(token, {
      token: (id) => tokens[id]?.name || id,
      item: (id) => items[id]?.name || id,
    }),
    [token, tokens, items]
  );

  if (!token) return <Empty text="Select a Token from the sidebar to edit" />;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <Header name={token.name} id={token.id} sprite={token.sprite} size={token.size} onDelete={() => deleteToken(activeId)} />

      <Section title="Identity" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name" className="col-span-2">
            <input type="text" value={token.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>

          <div className="col-span-2 grid grid-cols-2 gap-4">
            <IdSyncField entity={token} entityType="token" onUpdate={update} />
          </div>

          {/* The derived type, with its reason. If it says something you did
              not expect, your rules say something you did not mean — the same
              validation loop as the rules text below. */}
          <Field label="What this Token is" className="col-span-2">
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-1 rounded text-[11px] font-medium"
                style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)' }}
              >
                {derived.type}
              </span>
              <span className="text-[10px] text-gray-500">— because {derived.why}</span>
            </div>
            {derived.warn && (
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-warning)' }}>
                ⚠️ Read that sentence carefully — it is what the game will treat this Token as.
              </p>
            )}
          </Field>

          <Field label="Sprite" className="col-span-2">
            <div className="flex gap-2 items-center">
              <div className="w-10 h-10 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {spritePath ? (
                  <img
                    src={spritePath.startsWith('/') ? spritePath : `/${spritePath}`}
                    className="w-8 h-8 object-contain pixel-art"
                    alt=""
                    onError={(e) => { e.target.style.visibility = 'hidden'; }}
                  />
                ) : (
                  <HelpCircle size={16} className="text-gray-600" />
                )}
              </div>
              <input
                type="text"
                value={token.sprite || ''}
                onChange={(e) => update('sprite', e.target.value)}
                placeholder="sprite_id or assets/..."
                className="flex-1 min-w-0"
              />
              <button onClick={() => setPickerOpen(true)} className="btn-ghost text-xs" style={{ padding: '6px 10px' }}>
                Browse
              </button>
            </div>
          </Field>

          {/* Rarity and Grid Size used to sit in a separate "Classification"
              section. They are part of what a Token *is* — how often it drops
              and how much board it takes — so they live with the rest of its
              identity. */}
          <Field label="Rarity">
            <select
              value={token.rarity ?? ''}
              onChange={(e) => update('rarity', e.target.value || undefined)}
              className="w-full"
              disabled={token.tokenType === 'map'}
              title={token.tokenType === 'map' ? 'Maps sit outside the rarity system entirely (D-132)' : undefined}
            >
              {token.tokenType === 'map' && <option value="">n/a</option>}
              {TOKEN_RARITIES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              How often it drops (D-175) — not how strong it is.
            </p>
          </Field>

          {/* A Map Token is a Token only so it can sit in the Tray and on a
              tile; `mapId` points at the catalogue entry it bursts into (D-155).
              It is what a Map Token *is*, so it belongs with its identity. */}
          <Field label="Bursts into a Map" className="col-span-2">
            <select
              value={token.mapId || ''}
              onChange={(e) => update('mapId', e.target.value || undefined)}
              className="w-full"
            >
              <option value="">— not a Map Token —</option>
              {Object.values(maps).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Grid Size">
            <select
              value={token.size ?? 1}
              onChange={(e) => update('size', Number(e.target.value))}
              className="w-full"
            >
              <option value={1}>1×1 (Standard — 128px)</option>
              <option value={2}>2×2 (Large — 256px)</option>
            </select>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              1 tile slot, or 4 tile slots on the playmat.
            </p>
          </Field>
        </div>
      </Section>

      {/* ⚠️ Token tags ARE mechanical, unlike item tags (CMS-91): a rule can
          name one, so these are read at runtime. The owner's point that "tags
          are how effects know what they're applying to" is why they are their
          own section now rather than classification trivia. */}
      <Section title="Tags" icon={<TagIcon size={14} />}>
        <Field label="Tags">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(token.tags || []).length === 0 && (
              <span className="text-[11px] text-gray-600">No tags.</span>
            )}
            {(token.tags || []).map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-white/5 border border-white/10 text-gray-300"
              >
                {t}
                <button
                  onClick={() => update('tags', (token.tags || []).filter((x) => x !== t))}
                  className="text-gray-500 hover:text-red-400"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = tagDraft.trim();
                  if (t && !(token.tags || []).includes(t)) update('tags', [...(token.tags || []), t]);
                  setTagDraft('');
                }
              }}
              placeholder="Add a tag and press Enter"
              className="flex-1"
              style={{ fontSize: 12 }}
            />
            <button
              onClick={() => {
                const t = tagDraft.trim();
                if (t && !(token.tags || []).includes(t)) update('tags', [...(token.tags || []), t]);
                setTagDraft('');
              }}
              className="btn-ghost flex items-center"
              style={{ padding: '4px 10px' }}
            >
              <Plus size={13} />
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
            Targeting labels — a rule can say “to adjacent Coast Tokens”. They
            match <strong>exactly</strong>, including case.
          </p>
        </Field>
      </Section>

      {/* Effect Blocks, Accepted Tokens and Context Provision were three
          separate sections describing one thing: what this Token does to the
          board around it. They are one list of sentences now. */}
      <Section title="Rules" icon={<Sparkles size={14} />}>
        <Statements token={token} />
      </Section>

      {/* The rules text: generated, read-only, and the ONLY text a Token has
          (owner decision Q3). There is no description field and no override,
          because an override is how a description drifts from the effect it
          describes. */}
      <Section title="Rules Text" icon={<ScrollText size={14} />}>
        <div
          className="rounded-lg p-3 space-y-1"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {rulesLines.length === 0 ? (
            <p className="text-[11px] text-gray-600 italic">
              This Token has no rules. It can still produce, but it does nothing to its neighbours.
            </p>
          ) : (
            rulesLines.map((line, i) => (
              <p key={i} className="text-xs text-gray-200 leading-relaxed">{line}</p>
            ))
          )}
        </div>
        <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
          Written by the game, from the rules above — the same sentence the
          in-game tooltip shows. Read it: if it says something you did not mean,
          a rule says something you did not mean.
        </p>
      </Section>

      <Section title="Lifecycle" icon={<Timer size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Charges">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={isUnlimited ? '' : token.uses}
                disabled={isUnlimited}
                placeholder={isUnlimited ? 'unlimited' : ''}
                onChange={(e) => update('uses', Math.max(1, Number(e.target.value)))}
                className="w-full"
              />
            </div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isUnlimited}
                onChange={(e) => update('uses', e.target.checked ? null : 100)}
                className="rounded border-white/10 text-emerald-500 cursor-pointer"
              />
              <span className="text-[11px] text-gray-400">Never depletes</span>
            </label>
          </Field>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={token.requiresHero !== false}
                onChange={(e) => update('requiresHero', e.target.checked)}
                className="rounded border-white/10 text-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-gray-300">Requires a hero</span>
            </label>
          </div>
        </div>
        {token.requiresHero === false && (
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
            ⚠️ Unstaffed Tokens must be strictly worse per tile than the staffed
            equivalent (D-116). <code>ContentRules.test.js</code> asserts this — if it
            out-produces a staffed Token, the suite fails.
          </p>
        )}
      </Section>

      <Section title={isEnemy ? 'Fight' : 'Work Cycle'} icon={<Timer size={14} />}>
        {!config ? (
          <p className="text-[11px] text-gray-500 leading-relaxed">
            No production. Add an input or output in the sidebars to give this Token a
            work cycle — Tokens are not single-purpose (CMS-58), and a pure context,
            buff or manager Token has none at all.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Skill">
                <select value={config.skill || ''} onChange={(e) => updateConfig({ skill: e.target.value })} className="w-full">
                  <option value="">—</option>
                  {SKILLS.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Skill Required (Access)">
                <input
                  type="number"
                  min={1}
                  value={config.skillRequired ?? 1}
                  onChange={(e) => updateConfig({ skillRequired: Math.max(1, Number(e.target.value)) })}
                  className="w-full"
                />
              </Field>
              {/* CMS-79 vs CMS-70: a private station carries flat timing here;
                  a pooled one has none, because each recipe defines its own. */}
              {isPooled ? (
                <Field label="Cycle Time">
                  <div
                    className="w-full px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-text-muted)' }}
                  >
                    set per recipe
                  </div>
                </Field>
              ) : (
                <Field label="Cycle Time (ms)">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={config.cycleTimeMs ?? 12000}
                    onChange={(e) => updateConfig({ cycleTimeMs: Number(e.target.value) })}
                    className="w-full"
                  />
                </Field>
              )}
              {isPooled ? (
                <Field label="XP per cycle">
                  <div
                    className="w-full px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-text-muted)' }}
                  >
                    set per recipe
                  </div>
                </Field>
              ) : (
                <Field label="XP per cycle">
                  <input
                    type="number"
                    min={0}
                    value={config.xp ?? 0}
                    onChange={(e) => updateConfig({ xp: Number(e.target.value) })}
                    className="w-full"
                  />
                </Field>
              )}
            </div>
            {!isPooled && (config.cycleTimeMs < 10000 || config.cycleTimeMs > 30000) && (
              <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
                ⚠️ Outside D-164's 10–30s band. That band is what keeps the board at
                roughly one completion every few seconds across eight heroes — an
                unhurried rhythm where every drop still registers.
              </p>
            )}
          </>
        )}
      </Section>

      {/* Station-ness is a `Works as` statement (R-14/R-15). This checkbox is a
          shortcut that writes that statement using the config's skill; the Rules
          list edits the same sentence and can name a different skill. */}
      {config && (
        <Section title="Recipes" icon={<BookOpen size={14} />}>
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPooled}
              disabled={!config.skill}
              onChange={(e) => setTokenPooling(activeId, e.target.checked ? config.skill : null)}
              className="rounded border-white/10 text-emerald-500 cursor-pointer mt-0.5"
            />
            <span className="text-xs text-gray-300">
              Works as a{' '}
              <strong>{stationSkill ? skillName(stationSkill) : (config.skill ? skillName(config.skill) : '…')}</strong>{' '}
              station, drawing that skill's whole recipe pool
              {!config.skill && !stationSkill && (
                <span className="text-gray-500"> — pick a skill first</span>
              )}
            </span>
          </label>

          {isPooled ? (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                This station can run anything in the {skillName(stationSkill)} pool. The
                player picks which one; its neighbours decide whether the pick can run
                right now. A station has no recipes of its own.
              </p>
              {pooledRecipes.length === 0 ? (
                <p className="text-[11px] text-gray-600">
                  The pool is empty. Author recipes in the Recipes screen.
                </p>
              ) : (
                <div className="space-y-1">
                  {pooledRecipes.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <span className="flex-1 truncate text-gray-300">{r.name}</span>
                      <span className="text-[10px] text-gray-600">
                        {(r.requiresContext || []).map((c) => c.tag).join(' + ') || 'no context'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Private station: its inputs and outputs are the ones in the sidebars, and it
              makes the same thing regardless of what sits beside it. Turn pooling on for a
              station that should make many things depending on its context.
            </p>
          )}
        </Section>
      )}

      {/* CMS-69: scaffolded and visible, never editable, so it reads as coming
          rather than forgotten — without the CMS pretending to author numbers
          for a combat engine that is still moving (CMS-2). */}
      {isEnemy && (
        <Section title="Combat Stats" icon={<Swords size={14} />}>
          <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)' }}>
            <Lock size={13} className="text-gray-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 flex-1 opacity-50 pointer-events-none">
              <div className="grid grid-cols-3 gap-3">
                <Field label="HP"><input type="number" disabled value="" className="w-full" /></Field>
                <Field label="Damage"><input type="number" disabled value="" className="w-full" /></Field>
                <Field label="Defense"><input type="number" disabled value="" className="w-full" /></Field>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Pending the combat balance pass. Combat balancing is deferred as its own
            project (CMS-2) because the 7-stat engine is still in flux — the section is
            scaffolded so it is clear the field is coming, not forgotten. An enemy's
            <strong> loot</strong> economy is authorable now, in the Drops sidebar.
          </p>
        </Section>
      )}

      <SpritePickerModal
        isOpen={isPickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(spriteId) => update('sprite', spriteId)}
      />
    </div>
  );
}
