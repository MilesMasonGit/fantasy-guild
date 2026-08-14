import { useState } from 'react';
import { Settings2, Tag as TagIcon, Timer, HelpCircle, Swords, Lock, BookOpen, Sparkles, X, Plus } from 'lucide-react';
import { useEntityStore, makeTokenConfig } from '../../stores/useEntityStore';
import { TOKEN_TYPES, TOKEN_RARITIES, TOKEN_THEMES, SKILLS } from '../../utils/constants';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import BuffEditor from './BuffEditor';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

/**
 * The Token editor — CMS-71's header clusters (Phase 2).
 *
 * ## What lives where
 * **Production inputs and outputs are NOT here** — they are the left and right
 * sidebars (CMS-59), so the centre column stays free for the stackable effect
 * blocks Phase 5 adds. What is here is everything true of the Token itself.
 *
 * ## Three clusters (CMS-71)
 * * **Identity** — name, auto-generated id, sprite, description.
 * * **Classification** — `tokenType`, theme, rarity.
 * * **Lifecycle** — charges, `requiresHero`, `noStackDuplicates`.
 *
 * ⚠️ `tokenType` is a **secondary** field (CMS-62). It no longer drives the
 * editor's layout — which sidebars and blocks are populated does that — but it
 * is load-bearing at runtime: `BoardCombat` reads it to know a Token should
 * start a fight at all, and `RecipeResolver` reads it too. Hence a plain
 * required dropdown tucked into Classification rather than a screen-defining
 * choice.
 *
 * ## Not here yet
 * Recipe pooling and per-recipe cycle time arrive in Phase 3 (CMS-70/76/79), so
 * every Token is currently "private" and carries a flat header `cycleTimeMs` —
 * which is exactly the shape CMS-79 keeps for private stations anyway, so this
 * is not throwaway. Effect blocks are Phase 5.
 */
export default function TokenEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const token = useEntityStore((s) => s.tokens[activeId]);
  const updateToken = useEntityStore((s) => s.updateToken);
  const deleteToken = useEntityStore((s) => s.deleteToken);
  const setTokenPooling = useEntityStore((s) => s.setTokenPooling);
  const recipePools = useEntityStore((s) => s.recipePools);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <Header name={token.name} id={token.id} sprite={token.sprite} onDelete={() => deleteToken(activeId)} />

      <Section title="Identity" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name" className="col-span-2">
            <input type="text" value={token.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>

          <div className="col-span-2 grid grid-cols-2 gap-4">
            <IdSyncField entity={token} entityType="token" onUpdate={update} />
          </div>

          <Field label="Description" className="col-span-2">
            <textarea
              value={token.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              className="w-full resize-y"
              placeholder="Generated from the Token's mechanics in Phase 9; hand-written until then."
            />
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
        </div>
      </Section>

      <Section title="Classification" icon={<TagIcon size={14} />}>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Token Type">
            <select value={token.tokenType} onChange={(e) => update('tokenType', e.target.value)} className="w-full">
              {TOKEN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field label="Theme">
            <select value={token.theme || ''} onChange={(e) => update('theme', e.target.value)} className="w-full">
              <option value="">—</option>
              {TOKEN_THEMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

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
          </Field>
        </div>
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Rarity is drop frequency and nothing more (D-175) — it is not a power tier.
          How long a Token lasts is charges, and how strong it is, is theme.
        </p>

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

      <Section title="Adjacency Effect" icon={<Sparkles size={14} />}>
        <BuffEditor token={token} onChange={(patch) => updateToken(activeId, patch)} />
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
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!token.noStackDuplicates}
                onChange={(e) => update('noStackDuplicates', e.target.checked)}
                className="rounded border-white/10 text-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-gray-300">Duplicates don't stack</span>
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
