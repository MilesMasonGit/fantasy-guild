import { useState, useMemo } from 'react';
import { Settings2, Tag as TagIcon, Timer, HelpCircle, Swords, Lock, BookOpen, Sparkles, X, Plus, Gauge } from 'lucide-react';
import { useEntityStore, makeTokenConfig } from '../../stores/useEntityStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { TOKEN_RARITIES, SKILLS, skillsByLayer, deriveTokenType, stationSkillOf, stationKindOf, STATION_KINDS, stationKindLabel, stationKindOffers, recipeStationKinds, ENEMY_STYLES, enemyProfileOf, enemyFilledStats, ENEMY_KINDS, MAX_ENEMY_KINDS, kindsClash, enemyKindsOf, ATTACK_SPEED_MS, expandBearer, isWorkedWithoutSkill, WORK_SKILL_WHY, STANDS_ON_CHOICES, TOOL_KINDS, tierValue, neverWearsReason, NEVER_WEARS_WHY, neededToolOf, toolNeedPhrase, hasCatchPools } from '../../utils/constants';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';
import SimIntentControls from '../shared/SimIntentControls';
import SimAnswer from '../shared/SimAnswer';
import SpritePickerModal from './SpritePickerModal';
import Statements from './Statements';
import LifecycleBlocks from './LifecycleBlocks';
import CatchPoolsBlock from './CatchPoolsBlock';
import PlanFields from '../shared/PlanFields';
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

  // Which field the sprite picker fills: 'sprite', 'cardArt', or null when closed.
  const [pickerFor, setPickerFor] = useState(null);
  const [tagDraft, setTagDraft] = useState('');

  const update = (key, value) => updateToken(activeId, { [key]: value });
  // Kept in the game's order; none ticked drops the key, which means anywhere dry.
  const toggleStandsOn = (word) => {
    const current = token.standsOn || [];
    const next = current.includes(word) ? current.filter((w) => w !== word) : [...current, word];
    const ordered = STANDS_ON_CHOICES.map((c) => c.id).filter((id) => next.includes(id));
    update('standsOn', ordered.length ? ordered : undefined);
  };
  const updateConfig = (patch) =>
    updateToken(activeId, { config: { ...(token.config || makeTokenConfig()), ...patch } });
  // Merged rather than replaced so the per-output intent in the IO list and the Tempo/Purpose here cannot clobber one another.
  const updateSim = (patch) => updateToken(activeId, { sim: { ...(token.sim || {}), ...patch } });

  const config = token?.config;
  const stationSkill = stationSkillOf(expandBearer(token, effects));
  const isPooled = !!stationSkill;
  const stationKind = stationKindOf(expandBearer(token, effects));
  const pooledRecipes = isPooled ? (recipePools[stationSkill] || []).filter((r) => stationKindOffers(stationKind, r)) : [];
  const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;
  const isUnlimited = token?.uses == null;
  const spritePath = token?.sprite ? resolveSpritePath(token.sprite) : null;
  const cardArtPath = token?.cardArt ? resolveSpritePath(token.cardArt) : null;

  // ⚠️ The type and the rules text are DERIVED, never typed: a picker can disagree with what it classifies. Both read the Token's statements, which are references to the effect library, so the Token is expanded first; an unexpanded Token would show every station as an untyped resource and every rules panel as empty.
  const expanded = useMemo(() => expandBearer(token, effects), [token, effects]);
  const derived = useMemo(() => deriveTokenType(expanded), [expanded]);
  // The game's own rule: a station or a support is unlimited whatever its Charges say, so the field is not offered on one.
  const neverWears = useMemo(() => neverWearsReason(expanded), [expanded]);

  // ⚠️ Read the DERIVED type, not the stored `tokenType`: the stored one is only rewritten by Recalculate, so ticking a hero can fight this would change nothing until a recalculation, and the section that sets the field would be hidden behind it.
  const isEnemy = derived.type === 'enemy';
  const enemy = token?.enemy || null;
  const enemyStats = useMemo(
    () => (enemy?.level != null ? enemyProfileOf({ enemy }) : null),
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
              <button onClick={() => setPickerFor('sprite')} className="btn-ghost text-xs" style={{ padding: '6px 10px' }}>
                Browse
              </button>
            </div>
          </Field>

          <Field label="Rarity">
            <select
              value={token.rarity ?? ''}
              onChange={(e) => update('rarity', e.target.value || undefined)}
              className="w-full"
            >
              {TOKEN_RARITIES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {/* Rarity is drop frequency, not power. */}
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              How often it drops — not how strong it is.
            </p>
          </Field>

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

          {/* The picture behind this Token's card in the game (`tokenCard.cardArtOf`). Empty: the scene for its activity, or a plain card. Written only when set, so every other Token's record stays unchanged. */}
          <Field label="Card art" className="col-span-2">
            <div className="flex gap-2 items-center">
              <div className="w-10 h-10 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {cardArtPath ? (
                  <img
                    data-card-art-preview
                    src={cardArtPath.startsWith('/') ? cardArtPath : `/${cardArtPath}`}
                    className="w-10 h-10 object-cover pixel-art"
                    alt=""
                    onError={(e) => { e.target.style.visibility = 'hidden'; }}
                  />
                ) : (
                  <HelpCircle size={16} className="text-gray-600" />
                )}
              </div>
              <input
                type="text"
                aria-label="Card art"
                value={token.cardArt || ''}
                onChange={(e) => update('cardArt', e.target.value.trim() ? e.target.value : undefined)}
                placeholder="Empty: the scene for its activity"
                className="flex-1 min-w-0"
              />
              <button onClick={() => setPickerFor('cardArt')} className="btn-ghost text-xs" style={{ padding: '6px 10px' }}>
                Browse
              </button>
              {token.cardArt && (
                <button data-card-art-clear onClick={() => update('cardArt', undefined)} className="btn-ghost text-xs" style={{ padding: '6px 10px' }}>
                  Clear
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              A 256 px picture from backgrounds/, shown behind this Token's card. Empty uses its activity's scene.
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
            {/* `needsTool: { kind, minTier }`, written only when a kind is picked: a hero must hold a tool of that kind, at that tier or better, in hand to work this Token. Water's need is set by its catch pools instead. */}
            {hasCatchPools(token) ? (
              <div className="mt-4" data-field="needs-tool-pools">
                <Field label="Needs tool">
                  <div className="text-[11px] text-gray-400 leading-relaxed">
                    Set by the catch pools: a {toolNeedPhrase(neededToolOf(token))}, at any tier.
                  </div>
                  {token.needsTool && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
                        Its own Needs tool is ignored.
                      </span>
                      <button type="button" data-clear-needs-tool onClick={() => update('needsTool', undefined)} className="btn-ghost text-xs" style={{ padding: '2px 8px' }}>
                        Clear
                      </button>
                    </div>
                  )}
                </Field>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="Needs tool">
                <select
                  aria-label="Needs tool"
                  data-field="needs-tool"
                  value={token.needsTool?.kind || ''}
                  onChange={(e) => update('needsTool', e.target.value
                    ? { kind: e.target.value, minTier: tierValue(token.needsTool?.minTier) }
                    : undefined)}
                  className="w-full"
                >
                  <option value="">No tool</option>
                  {TOOL_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                  Only a hero holding this kind of tool in hand may work it.
                </p>
              </Field>
              {token.needsTool?.kind && (
                <Field label="Lowest tool tier">
                  <input
                    type="number"
                    min={1}
                    aria-label="Lowest tool tier"
                    data-field="needs-tool-tier"
                    value={tierValue(token.needsTool.minTier)}
                    onChange={(e) => update('needsTool', { ...token.needsTool, minTier: tierValue(Number(e.target.value)) })}
                    className="w-full"
                  />
                  <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                    A tool of this tier or higher (an item's Tool Tier) will do.
                  </p>
                </Field>
              )}
            </div>
            )}
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

      <CatchPoolsBlock token={token} onPatch={(patch) => updateToken(activeId, patch)} />

      <Section title="Lifecycle" icon={<Timer size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          {/* ⚠️ The label is Charges and the field is `uses`, deliberately: Charges is the game's own word (the TokenInspection badge, `Charges.js`). Not the retired top-level `charges` field, which is stripped on every Recalculate (`RETIRED_TOKEN_FIELDS`). */}
          {neverWears ? (
            <Field label="Charges">
              <div data-field="never-wears" className="text-[11px] text-gray-400 leading-relaxed">
                Never wears out. {NEVER_WEARS_WHY[neverWears]}
              </div>
              {!isUnlimited && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
                    Its {token.uses} Charges are ignored.
                  </span>
                  <button type="button" data-clear-charges onClick={() => update('uses', null)} className="btn-ghost text-xs" style={{ padding: '2px 8px' }}>
                    Clear
                  </button>
                </div>
              )}
            </Field>
          ) : (
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
          )}

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
            <label
              className="flex items-center gap-2 cursor-pointer select-none"
              title="An endgame site: it counts toward the Token cap, and the player cannot move or demolish it"
            >
              <input
                type="checkbox"
                checked={token.landmark === true}
                onChange={(e) => update('landmark', e.target.checked ? true : undefined)}
                className="rounded border-white/10 text-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-gray-300">Landmark (endgame site)</span>
            </label>
            {token.landmark === true && (
              <p className="text-[10px] leading-relaxed text-gray-500">
                Counts toward the Token cap; never moved, pushed or demolished. Its inspection shows
                the skill, level and items from the Work Cycle.
              </p>
            )}
            {/* `staysPut: true`, written ONLY when ticked: the game's `FixedTokens.isFixed` reads it, so every copy of this Token is fixed wherever it came from (a map, the Shop, a spawner, an old save). */}
            <label
              className="flex items-center gap-2 cursor-pointer select-none"
              title="Trees, fruit trees and veins: the player can't drag it, wherever it came from. It can still be demolished."
            >
              <input
                type="checkbox"
                aria-label="Stays where it stands"
                data-field="stays-put"
                checked={token.staysPut === true}
                onChange={(e) => update('staysPut', e.target.checked ? true : undefined)}
                className="rounded border-white/10 text-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-gray-300">Stays where it stands</span>
            </label>
            {token.staysPut === true && (
              <p className="text-[10px] leading-relaxed text-gray-500">
                The player can&apos;t drag it, wherever it came from (a map, the Shop, a spawner); nothing
                pushes it. It can still be demolished.
              </p>
            )}
            {/* `clearable: true`, written ONLY when ticked: the game's `Demolition.isClearable` reads it. */}
            <label
              className="flex items-center gap-2 cursor-pointer select-none"
              title="Wild Forests and Stumps: the player may demolish one even where a map placed it. The Starter Camp's own Tokens stay as laid."
            >
              <input
                type="checkbox"
                aria-label="Can be cleared where a map placed it"
                data-field="clearable"
                checked={token.clearable === true}
                onChange={(e) => update('clearable', e.target.checked ? true : undefined)}
                className="rounded border-white/10 text-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-gray-300">Can be cleared where a map placed it</span>
            </label>
            <div data-field="stands-on" title="The ground the cell under the Token's centre must be. Shore is dry land touching water. None ticked: anywhere dry.">
              <span className="text-xs text-gray-300">Stands on</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {STANDS_ON_CHOICES.map((choice) => {
                  const on = (token.standsOn || []).includes(choice.id);
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      data-stands-on={choice.id}
                      aria-pressed={on}
                      onClick={() => toggleStandsOn(choice.id)}
                      className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors ${on
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200'}`}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] leading-relaxed text-gray-500 mt-1">
                {(token.standsOn || []).length ? 'Only on the ticked ground. Shore is dry land touching water.' : 'None ticked: anywhere dry.'}
              </p>
            </div>
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
              onChange={(e) => setTokenPooling(activeId, e.target.checked ? config.skill : null, stationKind)}
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
              {/* The kind narrows the pool to the recipes that name it (and those naming no station). It is written on the same Works as rule. */}
              <label className="flex items-center gap-2 text-xs text-gray-300" data-testid="station-kind">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Station kind</span>
                <select
                  aria-label="Station kind"
                  value={stationKind || ''}
                  onChange={(e) => setTokenPooling(activeId, stationSkill, e.target.value || null)}
                  style={{ fontSize: 12 }}
                >
                  <option value="">Any station (every {skillName(stationSkill)} recipe)</option>
                  {stationKind && !STATION_KINDS.includes(stationKind) && <option value={stationKind}>{stationKind} (unknown)</option>}
                  {STATION_KINDS.map((k) => <option key={k} value={k}>{stationKindLabel(k)}</option>)}
                </select>
              </label>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {stationKind
                  ? <>This station runs the {skillName(stationSkill)} recipes marked {stationKindLabel(stationKind)}, and those marked for no station.</>
                  : <>This station can run anything in the {skillName(stationSkill)} pool.</>}{' '}
                The player picks which one; its neighbours decide whether the pick can run
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
                      {recipeStationKinds(r).length > 0 && (
                        <span className="text-[10px] text-gray-500">{recipeStationKinds(r).map(stationKindLabel).join(', ')}</span>
                      )}
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
                  aria-label="Level"
                  data-field="enemy-level"
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
              {/* Older content only: before the level table an enemy's numbers were a budget times this scale. Shown while an enemy still carries one, so it can be read and cleared; new enemies type their numbers below instead. */}
              {enemy?.budgetScale != null && (
                <Field label="Budget scale (older)">
                  <input
                    type="number"
                    step={0.05}
                    min={0.05}
                    aria-label="Budget scale"
                    value={enemy.budgetScale}
                    onChange={(e) =>
                      update('enemy', { ...enemy, budgetScale: Number(e.target.value) || 1 })
                    }
                    className="w-full"
                  />
                  <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                    Scales the level&apos;s HP, hit and XP. Typing those numbers below is clearer.
                  </p>
                </Field>
              )}
            </div>

            <EnemyKinds enemy={enemy} onChange={(next) => update('enemy', next)} />

            <EnemyNumbers enemy={enemy} onChange={(next) => update('enemy', next)} />

            {/* A hostile enemy attacks a hero whose flag stands inside the flag radius around its spawner (or itself); a peaceful one fights only when attacked. Written ONLY when ticked; missing means peaceful, which is what the game reads. A boss never attacks first, so the box is off and greyed for one. */}
            <label className={`flex items-center gap-2.5 select-none mt-3 ${enemy?.boss === true ? 'opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                aria-label="Hostile"
                disabled={enemy?.boss === true}
                checked={enemy?.hostile === true && enemy?.boss !== true}
                onChange={(e) => {
                  const next = { ...enemy };
                  if (e.target.checked) next.hostile = true;
                  else delete next.hostile;
                  update('enemy', next);
                }}
              />
              <span className="text-[11px] text-gray-300">Hostile</span>
              <span className="text-[10px] text-gray-600">
                attacks heroes whose flag is planted near it (or its spawner); otherwise it fights only when attacked
              </span>
            </label>

            {/* A boss fights only the heroes the player sends: never hostile, never spawned by a rule (no ambush). It comes from a camp of its own (a spawner that keeps one) or a Summoning Circle (a Token whose work uses up a summon item and makes it). Boss moves hang on this mark. Written ONLY when ticked; ticking it clears Hostile. */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none mt-2">
              <input
                type="checkbox"
                aria-label="Boss"
                data-field="enemy-boss"
                checked={enemy?.boss === true}
                onChange={(e) => {
                  const next = { ...enemy };
                  if (e.target.checked) {
                    next.boss = true;
                    delete next.hostile;
                  } else delete next.boss;
                  update('enemy', next);
                }}
              />
              <span className="text-[11px] text-gray-300">Boss</span>
              <span className="text-[10px] text-gray-600">
                fights only heroes you send; comes from a camp of its own or a Summoning Circle; never ambushes
              </span>
            </label>

            {/* Read-only, and built by the GAME's own profile (level table, kinds, the numbers typed
                above) rather than a copy of it here — so what the author is shown is what the fight uses. */}
            {enemyStats && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                <div className="flex items-center gap-1.5 mb-2 text-gray-500">
                  <Lock size={11} />
                  <span className="text-[10px] gi-caps tracking-wider">What the fight uses</span>
                </div>
                <div className="grid grid-cols-5 gap-3 text-[11px]">
                  <div><div className="text-gray-600 text-[10px]">HP</div><div className="text-gray-200 font-semibold">{enemyStats.hp}</div></div>
                  <div><div className="text-gray-600 text-[10px]">Hit</div><div className="text-gray-200 font-semibold">{enemyStats.hit}</div></div>
                  <div><div className="text-gray-600 text-[10px]">Armour</div><div className="text-gray-200 font-semibold">{enemyStats.armor}</div></div>
                  <div><div className="text-gray-600 text-[10px]">Attacks every</div><div className="text-gray-200 font-semibold">{(enemyStats.attackSpeed / 1000).toFixed(1)}s</div></div>
                  <div><div className="text-gray-600 text-[10px]">XP</div><div className="text-gray-200 font-semibold">{enemyStats.xpAwarded}</div></div>
                </div>
                <div className="grid grid-cols-5 gap-3 text-[11px] mt-2">
                  <div><div className="text-gray-600 text-[10px]">Dodge</div><div className="text-gray-200 font-semibold">{enemyStats.dodge}</div></div>
                  <div><div className="text-gray-600 text-[10px]">Accuracy</div><div className="text-gray-200 font-semibold">{enemyStats.accuracy}</div></div>
                  <div><div className="text-gray-600 text-[10px]">Pierce</div><div className="text-gray-200 font-semibold">{enemyStats.pierce}</div></div>
                  <div><div className="text-gray-600 text-[10px]">Crit</div><div className="text-gray-200 font-semibold">{enemyStats.critChance}%</div></div>
                  <div><div className="text-gray-600 text-[10px]">On hit</div><div className="text-gray-200 font-semibold">{enemyStats.onHit?.length ? enemyStats.onHit.map((s) => effects[s.effectId]?.name || `${s.effectId} (missing)`).join(', ') : '—'}</div></div>
                </div>
                <p className="text-[10px] text-gray-600 mt-2.5 leading-relaxed">
                  A level {enemy?.level ?? 1} enemy with no kinds is an even fight for a level {enemy?.level ?? 1} hero
                  holding their tier's weapon: a duel of ten or more swings. A kind makes it harder.
                  What it <strong>drops</strong> is authored as its outputs, in the Drops column.
                </p>
              </div>
            )}
          </>
        )}
      </Section>

      <LifecycleBlocks token={token} onChange={update} />

      <PlanFields record={token} onChange={(plan) => update('plan', plan)} />

      <SpritePickerModal
        isOpen={pickerFor != null}
        onClose={() => setPickerFor(null)}
        onSelect={(spriteId) => update(pickerFor === 'cardArt' ? 'cardArt' : 'sprite', spriteId)}
      />
    </div>
  );
}

/**
 * The enemy kinds: none, one or two presets that twist what the level fills (`enemyKinds.js` says
 * how). Written in the order ticked; none ticked drops the key. A kind that would make a third, or
 * that sets a different swing speed from one already ticked, cannot be ticked.
 */
function EnemyKinds({ enemy, onChange }) {
  const ticked = enemyKindsOf(enemy).map((k) => k.id);
  const toggle = (id) => {
    const next = ticked.includes(id) ? ticked.filter((k) => k !== id) : [...ticked, id];
    const copy = { ...enemy };
    if (next.length) copy.kinds = next; else delete copy.kinds;
    onChange(copy);
  };

  return (
    <div className="mt-3">
      <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">Kinds (none, one or two)</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {ENEMY_KINDS.map((kind) => {
          const on = ticked.includes(kind.id);
          const clash = !on && ticked.find((k) => kindsClash(k, kind.id));
          const full = !on && ticked.length >= MAX_ENEMY_KINDS;
          const why = clash
            ? `Cannot go with ${ENEMY_KINDS.find((k) => k.id === clash)?.label}: both set the swing speed.`
            : full ? `An enemy has at most ${MAX_ENEMY_KINDS} kinds.` : kind.blurb;
          return (
            <label key={kind.id} title={why} className={`flex items-center gap-1.5 select-none ${clash || full ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                aria-label={kind.label}
                data-field={`enemy-kind-${kind.id}`}
                checked={on}
                disabled={!!clash || full}
                onChange={() => toggle(kind.id)}
              />
              <span className="text-[11px] text-gray-300">{kind.label}</span>
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
        {ticked.length
          ? enemyKindsOf(enemy).map((k) => `${k.label}: ${k.blurb}`).join(' ')
          : 'The player finds out its kinds by fighting it. A number typed below replaces whatever the level and kinds give.'}
      </p>
    </div>
  );
}

/** The numbers the level and kinds fill, each one the author may replace, in the order the fight card lists them. */
const ENEMY_NUMBER_FIELDS = [
  { field: 'hp', label: 'HP', min: 1 },
  { field: 'hit', label: 'Hit', min: 1 },
  { field: 'armor', label: 'Armour', min: 0 },
  { field: 'xp', label: 'XP', min: 0 },
  { field: 'speed', label: 'Speed', wide: true },
  { field: 'dodge', label: 'Dodge', min: 0 },
  { field: 'accuracy', label: 'Accuracy', min: 0 },
  { field: 'pierce', label: 'Pierce', min: 0 },
  { field: 'critChance', label: 'Crit %', min: 0 },
];
const SPEED_WORDS = { fast: 'Fast', normal: 'Normal', slow: 'Slow' };
const speedWords = (id) => `${SPEED_WORDS[id] || id} (${(ATTACK_SPEED_MS[id] || 0) / 1000} s)`;

/**
 * Every number the fight reads, shown filled from the level and kinds (greyed, "from level") until
 * the author types one, which is then written on the enemy and wins outright ("yours", with a
 * button back to the filled value). Changing the level moves every number the author has not typed.
 */
function EnemyNumbers({ enemy, onChange }) {
  const filled = enemyFilledStats(enemy);
  const hasKinds = enemyKindsOf(enemy).length > 0;
  const authored = (field) => enemy?.[field] !== undefined && enemy?.[field] !== null && enemy?.[field] !== '';
  const set = (field, value) => {
    const copy = { ...enemy };
    if (value === undefined) delete copy[field]; else copy[field] = value;
    onChange(copy);
  };

  return (
    <div className="mt-3">
      <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">Numbers (filled from the level and kinds; type to change)</span>
      <div className="grid grid-cols-4 gap-3">
        {ENEMY_NUMBER_FIELDS.map(({ field, label, min, wide }) => {
          const own = authored(field);
          const shown = own ? enemy[field] : filled[field];
          return (
            <div key={field} className={wide ? 'col-span-2' : undefined}>
              <span className="text-[10px] text-gray-500 block mb-1">{label}</span>
              {field === 'speed' ? (
                <select
                  aria-label={`Enemy ${label}`}
                  data-field={`enemy-${field}`}
                  value={own ? enemy.speed : ''}
                  onChange={(e) => set('speed', e.target.value || undefined)}
                  className={`w-full ${own ? '' : 'text-gray-500 italic'}`}
                >
                  <option value="">{speedWords(filled.speed)}</option>
                  {Object.keys(ATTACK_SPEED_MS).map((id) => (
                    <option key={id} value={id}>{speedWords(id)}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min={min}
                  aria-label={`Enemy ${label}`}
                  data-field={`enemy-${field}`}
                  value={shown}
                  onChange={(e) => {
                    const raw = e.target.value;
                    set(field, raw === '' ? undefined : Math.max(min, Math.floor(Number(raw) || 0)));
                  }}
                  className={`w-full ${own ? '' : 'text-gray-500 italic'}`}
                />
              )}
              <div className="text-[10px] mt-1 leading-tight" data-field={`enemy-${field}-source`}>
                {own ? (
                  <button type="button" className="text-amber-400 hover:underline" onClick={() => set(field, undefined)}>
                    yours · back to {field === 'speed' ? SPEED_WORDS[filled.speed] : filled[field]}
                  </button>
                ) : (
                  <span className="text-gray-600">{hasKinds ? 'from level + kinds' : 'from level'}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** What the last Recalculate decided about this Token: a derivation warning when its shape is broken (no rules and no work cycle, or a Market paying no currency), and the simulator's answer. ⚠️ Returns null when it has nothing to say, heading included. */
function TokenSummary({ token, derived, needsSkill }) {
  const answer = useSimulationStore((s) => s.simAnswers[token.id]);

  if (!answer && !derived?.warn && !needsSkill) return null;

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
    </Section>
  );
}
