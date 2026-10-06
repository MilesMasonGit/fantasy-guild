import { useState, useMemo } from 'react';
import { Settings2, Tag as TagIcon, Timer, HelpCircle, Swords, Lock, BookOpen, Sparkles, X, Plus, Gauge } from 'lucide-react';
import { useEntityStore, makeTokenConfig } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { TOKEN_RARITIES, SKILLS, skillsByLayer, deriveTokenType, stationSkillOf, ENEMY_STYLES, enemyCombatBudget, expandBearer, isWorkedWithoutSkill, WORK_SKILL_WHY } from '../../utils/constants';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';
import SimIntentControls from '../shared/SimIntentControls';
import SimAnswer from '../shared/SimAnswer';
import SpritePickerModal from './SpritePickerModal';
import Statements from './Statements';
import LifecycleBlocks from './LifecycleBlocks';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

/** The Token editor. */
export default function TokenEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const token = useEntityStore((s) => s.tokens[activeId]);
  const updateToken = useEntityStore((s) => s.updateToken);
  const deleteToken = useEntityStore((s) => s.deleteToken);
  const setTokenPooling = useEntityStore((s) => s.setTokenPooling);
  const recipePools = useEntityStore((s) => s.recipePools);
  const effects = useEntityStore((s) => s.effects);

  const [isPickerOpen, setPickerOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

  const update = (key, value) => updateToken(activeId, { [key]: value });
  const updateConfig = (patch) =>
    updateToken(activeId, { config: { ...(token.config || makeTokenConfig()), ...patch } });
  // Merged rather than replaced so the per-output intent in the IO list and the Tempo/Purpose here cannot clobber one another.
  const updateSim = (patch) => updateToken(activeId, { sim: { ...(token.sim || {}), ...patch } });

  const config = token?.config;
  const stationSkill = stationSkillOf(expandBearer(token, effects));
  const isPooled = !!stationSkill;
  const pooledRecipes = isPooled ? (recipePools[stationSkill] || []) : [];
  const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;
  const isUnlimited = token?.uses == null;
  const spritePath = token?.sprite ? resolveSpritePath(token.sprite) : null;

  // ⚠️ The type and the rules text are DERIVED, never typed: a picker can disagree with what it classifies. Both read the Token's statements, which are references to the effect library, so the Token is expanded first; an unexpanded Token would show every station as an untyped resource and every rules panel as empty.
  const expanded = useMemo(() => expandBearer(token, effects), [token, effects]);
  const derived = useMemo(() => deriveTokenType(expanded), [expanded]);

  // ⚠️ Read the DERIVED type, not the stored `tokenType`: the stored one is only rewritten by Recalculate, so ticking a hero can fight this would change nothing until a recalculation, and the section that sets the field would be hidden behind it.
  const isEnemy = derived.type === 'enemy';
  const enemy = token?.enemy || null;
  const enemyBudget = useMemo(
    () => (enemy?.level != null ? enemyCombatBudget(enemy.level, enemy.budgetScale ?? 1) : null),
    [enemy]
  );

  if (!token) return <Empty text="Select a Token from the sidebar to edit" />;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <Header name={token.name} id={token.id} sprite={token.sprite} size={token.size} onDelete={() => deleteToken(activeId)} />

      {/* Read-only summary of what the simulator decided. ⚠️ Renders nothing at all when there is nothing to say, heading included. */}
      <TokenSummary token={token} derived={derived} needsSkill={isWorkedWithoutSkill(expanded)} />

      <Section title="Identity" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name" className="col-span-2">
            <input type="text" value={token.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>

          {/* ⚠️ There is no Entity ID field: ids are automatic. The store slugs the id from the name on rename, de-duplicates collisions (`uniqueId`) and rewrites references (`performRename`). `autoSyncId` is deliberately not forced to true on load, because that would rename an entity whose id carries a collision suffix and churn every reference to it. */}

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

          <Field label="Rarity">
            <select
              value={token.rarity ?? ''}
              onChange={(e) => update('rarity', e.target.value || undefined)}
              className="w-full"
              disabled={token.tokenType === 'map'}
              title={token.tokenType === 'map' ? 'Maps sit outside the rarity system entirely' : undefined}
            >
              {token.tokenType === 'map' && <option value="">n/a</option>}
              {TOKEN_RARITIES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {/* Rarity is drop frequency, not power. */}
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              How often it drops — not how strong it is.
            </p>
          </Field>

          {/* The Map link is authored from the Map editor, not here; a Map Token still carries `mapId`. */}
          <Field label="Grid Size">
            <select
              value={token.size ?? 1}
              onChange={(e) => {
                const size = Number(e.target.value);
                // Only a 1×1 may be small, so going 2×2 clears it.
                updateToken(activeId, size === 1 ? { size } : { size, artSize: undefined });
              }}
              className="w-full"
            >
              <option value={1}>1×1 (Standard — 128px)</option>
              <option value={2}>2×2 (Large — 256px)</option>
            </select>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              1 tile slot, or 4 tile slots on the playmat.
            </p>
          </Field>

          {/* Standard (64 px art at 128 px) or small (32 px art at 64 px); the game reads `artSize` (`matGeometry.isSmallToken`). Written ONLY when Small, so every standard Token's record stays unchanged. 1×1 only; disabled on a 2×2. */}
          <Field label="Token Size">
            <select
              aria-label="Token Size"
              value={(token.size ?? 1) === 1 && token.artSize === 'small' ? 'small' : 'standard'}
              onChange={(e) => update('artSize', e.target.value === 'small' ? 'small' : undefined)}
              className="w-full"
              disabled={(token.size ?? 1) !== 1}
              title={(token.size ?? 1) !== 1 ? 'Only a 1×1 Token can be small' : undefined}
            >
              <option value="standard">Standard (64px art at 128px)</option>
              <option value="small">Small (32px art at 64px)</option>
            </select>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              Small: half-size art, hit area and spacing. Its rings stay full size.
            </p>
          </Field>
        </div>
      </Section>

      <Section title={isEnemy ? 'Fight' : 'Work Cycle'} icon={<Timer size={14} />}>
        {/* A Token is not single-purpose. */}
        {!config ? (
          <p className="text-[11px] text-gray-500 leading-relaxed">
            No production. Add an input or output in the sidebars to give this Token a
            work cycle. A pure context, buff or manager Token has none at all, which is
            fine — a Token can do more than one job, or none.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Skill">
                <select value={config.skill || ''} onChange={(e) => updateConfig({ skill: e.target.value })} className="w-full">
                  <option value="">—</option>
                  {skillsByLayer().map(([label, group]) => (
                    <optgroup key={label} label={label}>
                      {group.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
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
              {/* A private station carries flat timing here; a pooled one has none, because each recipe defines its own. */}
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
                <Field label="Cycle Time (ms)" derived>
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
                <Field label="XP per cycle" derived>
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
                ⚠️ Outside the 10–30s band. That band keeps the board at roughly one
                completion every few seconds across eight heroes — an unhurried rhythm
                where every drop still registers.
              </p>
            )}
            <div className="pt-4 mt-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <SimIntentControls
                sim={token.sim}
                onChange={updateSim}
                cycleMs={isPooled ? undefined : config.cycleTimeMs}
                level={config.skillRequired ?? 1}
              />
            </div>
          </>
        )}
      </Section>

      <Section title="Lifecycle" icon={<Timer size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          {/* ⚠️ The label is Charges and the field is `uses`, deliberately: Charges is the game's own word (the TokenInspection badge, `Charges.js`). Not the retired top-level `charges` field, which is stripped on every Recalculate (`RETIRED_TOKEN_FIELDS`). */}
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
            ⚠️ An unstaffed Token must be strictly worse per tile than the staffed
            equivalent. If it out-produces one, the test suite fails.
          </p>
        )}
      </Section>

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
            Targeting labels — a rule can say “to nearby Coast Tokens”. They
            match <strong>exactly</strong>, including case.
          </p>
        </Field>
      </Section>

      <Section title="Rules" icon={<Sparkles size={14} />}>
        <Statements token={token} />
      </Section>

      {/* Station-ness is a `Works as` statement. This checkbox is a shortcut that writes it using the config's skill; the Rules list edits the same sentence and can name a different skill. */}
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

      {/* Always present, never conditional on `isEnemy`: it is what makes a Token an enemy, so hiding it would hide the only control that sets it. */}
      <Section title="Enemy" icon={<Swords size={14} />}>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isEnemy}
            onChange={(e) =>
              update('enemy', e.target.checked ? { level: 1, style: 'melee' } : undefined)
            }
          />
          <span className="text-[11px] text-gray-300">A hero can fight this</span>
        </label>

        {!isEnemy ? (
          <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
            An enemy is a Token like any other (D-104). Tick this and it gains a level;
            everything else about it — its sprite, its charges, what it drops — is
            authored exactly the way a Forest is.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <Field label="Level">
                <input
                  type="number"
                  min={1}
                  value={enemy?.level ?? 1}
                  onChange={(e) =>
                    update('enemy', { ...enemy, level: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="w-full"
                />
              </Field>
              <Field label="Style">
                <select
                  value={enemy?.style || 'melee'}
                  onChange={(e) => update('enemy', { ...enemy, style: e.target.value })}
                  className="w-full"
                >
                  {ENEMY_STYLES.map((st) => (
                    <option key={st} value={st}>
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Budget scale">
                <input
                  type="number"
                  step={0.05}
                  min={0.05}
                  value={enemy?.budgetScale ?? 1}
                  onChange={(e) =>
                    update('enemy', { ...enemy, budgetScale: Number(e.target.value) || 1 })
                  }
                  className="w-full"
                />
              </Field>
            </div>

            {/* A hostile enemy attacks a hero who comes inside the flag radius around its spawner; a peaceful one fights only when attacked. Written ONLY when ticked; missing means peaceful, which is what the game reads. */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none mt-3">
              <input
                type="checkbox"
                aria-label="Hostile"
                checked={enemy?.hostile === true}
                onChange={(e) => {
                  const next = { ...enemy };
                  if (e.target.checked) next.hostile = true;
                  else delete next.hostile;
                  update('enemy', next);
                }}
              />
              <span className="text-[11px] text-gray-300">Hostile</span>
              <span className="text-[10px] text-gray-600">
                attacks heroes who come near its spawner; otherwise it fights only when attacked
              </span>
            </label>

            {/* Read-only, and derived by the GAME's own curve rather than a copy
                of it here — so what the author is shown is what the fight uses. */}
            {enemyBudget && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                <div className="flex items-center gap-1.5 mb-2 text-gray-500">
                  <Lock size={11} />
                  <span className="text-[10px] gi-caps tracking-wider">Derived from level</span>
                </div>
                <div className="grid grid-cols-4 gap-3 text-[11px]">
                  <div><div className="text-gray-600 text-[10px]">HP</div><div className="text-gray-200 font-semibold">{enemyBudget.hp}</div></div>
                  <div><div className="text-gray-600 text-[10px]">Damage</div><div className="text-gray-200 font-semibold">{enemyBudget.minDamage}–{enemyBudget.maxDamage}</div></div>
                  <div><div className="text-gray-600 text-[10px]">Attacks every</div><div className="text-gray-200 font-semibold">{(enemyBudget.attackIntervalMs / 1000).toFixed(1)}s</div></div>
                  <div><div className="text-gray-600 text-[10px]">XP</div><div className="text-gray-200 font-semibold">{enemyBudget.xp}</div></div>
                </div>
                <p className="text-[10px] text-gray-600 mt-2.5 leading-relaxed">
                  Attack and defence both equal the level, the same way a hero's one combat
                  skill supplies both halves — so a level {enemy?.level ?? 1} enemy is an even
                  match for a Melee {enemy?.level ?? 1} hero before gear.
                  What it <strong>drops</strong> is authored as its outputs, in the Drops column.
                </p>
              </div>
            )}
          </>
        )}
      </Section>

      <LifecycleBlocks token={token} onChange={update} />

      <SpritePickerModal
        isOpen={isPickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(spriteId) => update('sprite', spriteId)}
      />
    </div>
  );
}

/** What the last Recalculate decided about this Token: a derivation warning when its shape is broken (no rules and no work cycle, or a Market paying no currency), the simulator's answer, and the derived scrap value. ⚠️ Returns null when it has nothing to say, heading included. */
function TokenSummary({ token, derived, needsSkill }) {
  const answer = useSimulationStore((s) => s.simAnswers[token.id]);
  const scrap = token.scrapValue;
  const hasScrap = Number.isFinite(scrap);

  if (!answer && !derived?.warn && !needsSkill && !hasScrap) return null;

  return (
    <Section title="What the simulator decided" icon={<Gauge size={14} />}>
      {derived?.warn && (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
          ⚠️ {derived.why}.
        </p>
      )}
      {/* The game's own rule, read live, so it clears the moment a skill is picked; no Recalculate needed. */}
      {needsSkill && (
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
          ⚠️ This Token is worked by a hero but names no skill. {WORK_SKILL_WHY}
        </p>
      )}

      <SimAnswer entityId={token.id} record={token} />

      {hasScrap && (
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Scraps for</span>
          <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {scrap}g
          </span>
        </div>
      )}
    </Section>
  );
}
