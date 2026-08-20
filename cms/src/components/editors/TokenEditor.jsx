import { useState, useMemo } from 'react';
import { Settings2, Tag as TagIcon, Timer, HelpCircle, Swords, Lock, BookOpen, Sparkles, X, Plus, Wand2, RotateCcw, Wrench } from 'lucide-react';
import { useEntityStore, makeTokenConfig } from '../../stores/useEntityStore';
import { TOKEN_TYPES, TOKEN_RARITIES, SKILLS } from '../../utils/constants';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import EffectBlocks from './EffectBlocks';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';
import { composeTokenDescription } from '../../engine/descriptionDictionary';

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

  if (!token) return <Empty text="Select a Token from the sidebar to edit" />;

  const update = (key, value) => updateToken(activeId, { [key]: value });
  const updateConfig = (patch) =>
    updateToken(activeId, { config: { ...(token.config || makeTokenConfig()), ...patch } });

  const config = token.config;
  const isEnemy = token.tokenType === 'enemy';
  const isPooled = !!token.recipePool;
  const pooledRecipes = isPooled ? (recipePools[token.recipePool] || []) : [];
  const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;
  const isUnlimited = token.uses == null;
  const spritePath = token.sprite ? resolveSpritePath(token.sprite) : null;

  // Auto-compose description from token mechanics (CMS-66, CMS-81, CMS-87)
  const autoDescription = useMemo(
    () => composeTokenDescription({ ...token, descriptionOverride: false }, items, recipePools),
    [token, items, recipePools]
  );
  const isAuto = !token.descriptionOverride;

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

          <Field label="Description" className="col-span-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 select-none">
                  <input
                    type="checkbox"
                    checked={isAuto}
                    onChange={(e) => {
                      const willBeAuto = e.target.checked;
                      update('descriptionOverride', !willBeAuto);
                      if (willBeAuto) {
                        update('description', autoDescription);
                      }
                    }}
                    className="accent-emerald-400"
                  />
                  <span className="flex items-center gap-1">
                    <Wand2 size={12} className={isAuto ? 'text-emerald-400' : 'text-gray-500'} />
                    Auto-compose from mechanics (CMS-66)
                  </span>
                </label>
                {!isAuto && (
                  <button
                    type="button"
                    onClick={() => {
                      update('descriptionOverride', false);
                      update('description', autoDescription);
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <RotateCcw size={10} /> Reset to Auto
                  </button>
                )}
              </div>

              <textarea
                value={isAuto ? autoDescription : (token.description || '')}
                onChange={(e) => {
                  if (isAuto) {
                    update('descriptionOverride', true);
                  }
                  update('description', e.target.value);
                }}
                rows={2}
                className={`w-full resize-y text-xs ${isAuto ? 'text-emerald-300 bg-black/40 border-emerald-500/20' : ''}`}
                placeholder="Description of token..."
              />
              {isAuto && (
                <span className="text-[10px] text-gray-500 italic">
                  Composed live from gathering yields, recipes, and effect blocks. Type above to switch to manual override.
                </span>
              )}
            </div>
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

      <Section title="Classification" icon={<TagIcon size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Token Type">
            <select value={token.tokenType} onChange={(e) => update('tokenType', e.target.value)} className="w-full">
              {TOKEN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          {/* ⚠️ Tier is NOT decoration, despite reading like it. It is the
              tier a tool provides its context tags at: `getProvidedTagsWithTiers`
              falls back to it, and `RecipeResolver.checkAcceptedTokens` gates on
              it, so a Copper Pickaxe at tier 1 cannot satisfy a requirement for
              a tier 2 tool. `AcceptedTokens.test.js` pins that behaviour. */}
          <Field label="Tier / Quality">
            <input
              type="number"
              min={1}
              value={token.tier ?? 1}
              onChange={(e) => update('tier', Math.max(1, Number(e.target.value)))}
              className="w-full"
            />
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              The tier this Token's tools count as. A station asking for a tier 2
              tool will not accept a tier 1 one.
            </p>
          </Field>
        </div>

        {/* A Map Token is a Token only so it can sit in the Tray and on a tile;
            `mapId` points at the catalogue entry it bursts into (D-155). */}
        {token.tokenType === 'map' && (
          <Field label="Bursts into">
            <select
              value={token.mapId || ''}
              onChange={(e) => update('mapId', e.target.value || undefined)}
              className="w-full"
            >
              <option value="">— pick a Map —</option>
              {Object.values(maps).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {!token.mapId && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-warning)' }}>
                ⚠️ No Map chosen — buying this would burst into nothing.
              </p>
            )}
          </Field>
        )}

        {/* ⚠️ Token tags ARE mechanical, unlike item tags (CMS-91): a targeted
            buff can name one, so these are read at runtime. */}
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
            Targeting labels — a buff can say “boost all adjacent seafood”. These are
            read by the board, unlike item tags.
          </p>
        </Field>
      </Section>

      <Section title="Accepted Tokens / Tools" icon={<Wrench size={14} />}>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
          Requirements this station looks for on adjacent tiles (e.g. Copper Vein needing a Pickaxe, Fishing Hole needing a Rod or Net).
        </p>

        <div className="space-y-2.5">
          {(!token.acceptedTokens || token.acceptedTokens.length === 0) && (
            <p className="text-xs text-gray-600">No adjacent tool requirements — operates freely or with hero.</p>
          )}

          {(token.acceptedTokens || []).map((req, i) => {
            const matchingTokens = Object.values(tokens).filter((t) => {
              const provides = t.provides || [];
              const hasTag = provides.some((p) => (typeof p === 'string' ? p === req.tag : p.tag === req.tag));
              const hasBlockTag = (t.effectBlocks || []).some((b) => (b.provides || []).includes(req.tag));
              const tier = t.tier || 1;
              return (hasTag || hasBlockTag) && tier >= (req.minTier || 1);
            });

            return (
              <div key={i} className="p-2.5 rounded-lg border border-white/10 bg-black/20 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Field label="Accepted Tag / Capability" className="flex-1">
                    <input
                      type="text"
                      value={req.tag || ''}
                      placeholder="e.g. pickaxe, axe"
                      onChange={(e) => {
                        const next = [...(token.acceptedTokens || [])];
                        next[i] = { ...next[i], tag: e.target.value.trim().toLowerCase() };
                        update('acceptedTokens', next);
                      }}
                      className="w-full"
                      style={{ fontSize: 12 }}
                    />
                  </Field>

                  <Field label="Min Tier" className="w-24">
                    <input
                      type="number"
                      min={1}
                      value={req.minTier ?? 1}
                      onChange={(e) => {
                        const next = [...(token.acceptedTokens || [])];
                        next[i] = { ...next[i], minTier: Math.max(1, Number(e.target.value)) };
                        update('acceptedTokens', next);
                      }}
                      className="w-full"
                      style={{ fontSize: 12 }}
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={() => {
                      const next = (token.acceptedTokens || []).filter((_, idx) => idx !== i);
                      update('acceptedTokens', next);
                    }}
                    className="text-gray-500 hover:text-red-400 self-end mb-2 p-1"
                    title="Remove requirement"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <span>Satisfied by in project:</span>
                  {matchingTokens.length === 0 ? (
                    <span className="text-amber-400 font-medium">None yet</span>
                  ) : (
                    matchingTokens.map((t) => (
                      <span key={t.id} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                        {t.name} (T{t.tier || 1})
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          <span className="text-[9px] uppercase tracking-wider text-gray-600">Quick Add:</span>
          {['pickaxe', 'axe', 'fishing_tool', 'hammer', 'anvil', 'saw', 'furnace'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                const current = token.acceptedTokens || [];
                if (!current.some((c) => c.tag === tag)) {
                  update('acceptedTokens', [...current, { tag, minTier: 1 }]);
                }
              }}
              className="px-2 py-1 rounded text-[10px] bg-white/5 hover:bg-white/10 text-gray-300"
              style={{ border: 'none', cursor: 'pointer' }}
            >
              +{tag}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const current = token.acceptedTokens || [];
              update('acceptedTokens', [...current, { tag: '', minTier: 1 }]);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            style={{ border: 'none', cursor: 'pointer' }}
          >
            <Plus size={10} /> Custom
          </button>
        </div>
      </Section>

      <Section title="Effect Blocks" icon={<Sparkles size={14} />}>
        <EffectBlocks token={token} />
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

      {/* CMS-76: pooling is opt-in per station, not a skill-wide rule. Smithing
          already has four stations and only two want multi-recipe behaviour. */}
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
              Draw from the shared{' '}
              <strong>{config.skill ? skillName(config.skill) : '…'}</strong> recipe pool
              {!config.skill && (
                <span className="text-gray-500"> — pick a skill first</span>
              )}
            </span>
          </label>

          {isPooled ? (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                This station makes anything in the {skillName(token.recipePool)} pool whose
                context is satisfied by its neighbours. It declares no recipes of its own —
                a station is pooled <strong>or</strong> private, never both (CMS-77).
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
                        {(r.requiresContext || []).join(' + ') || 'no context'}
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
