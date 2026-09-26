import { useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2, X, AlertTriangle, Boxes, Hammer } from 'lucide-react';
import {
  useEntityStore, makeInputEntry, makeOutputEntry, makeTokenOutputEntry,
} from '../../stores/useEntityStore';
import { SKILLS, skillsByLayer, KEYWORD, statementsOf, stationSkillOf, expandBearer, FOUNDATION_KINDS } from '../../utils/constants';
import { NumberCell } from '../shared/IOEntryList';
import SupplyChainColumn from '../layout/SupplyChainColumn';
import { Field } from '../shared/EditorLayout';
import SimIntentControls from '../shared/SimIntentControls';
import SimAnswer from '../shared/SimAnswer';

/**
 * Pooled recipes — authoring and review on one screen (CMS-40).
 *
 * Rather than splitting "where recipes are edited" from "where gaps get
 * reviewed", one screen does both: the skill list on the left doubles as the
 * cross-skill review, showing how many recipes each pool holds and how many
 * stations actually draw it. A pool with recipes and no stations is authored
 * content nothing can ever make, and a station pooling from an empty skill is a
 * station that makes nothing — both are visible here without switching views.
 *
 * ## Not a sidebar entity
 * A recipe is owned by its skill rather than by any Token (CMS-39), so this is
 * a top-level screen rather than a fourth tab in the entity sidebar. It does
 * carry a stable global `id` — a placed station saves the recipe the player
 * picked — but the id is minted on create and never edited here.
 */
export default function RecipeEditor() {
  const recipePools = useEntityStore((s) => s.recipePools);
  const tokens = useEntityStore((s) => s.tokens);
  const effects = useEntityStore((s) => s.effects);
  const addRecipe = useEntityStore((s) => s.addRecipe);
  const updateRecipe = useEntityStore((s) => s.updateRecipe);
  const deleteRecipe = useEntityStore((s) => s.deleteRecipe);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

  const [activeSkill, setActiveSkill] = useState(SKILLS[0]?.id || '');
  // Which recipe the side columns are editing. Index rather than id because a
  // pool is an array and `updateRecipe` addresses it that way.
  const [activeIdx, setActiveIdx] = useState(0);

  /**
   * Which stations draw each pool — the review half of CMS-40.
   *
   * A Foundation counts as drawing its `foundation.skill` pool (Token Lifecycle
   * §3.1): it is the station a building recipe runs on, even though it has no
   * `Works as` statement. Without this the Construction pool would read
   * "nothing can make these" while Stone Foundations exist.
   */
  const poolConsumers = useMemo(() => {
    const map = {};
    for (const t of Object.values(tokens)) {
      const skill = t.foundation?.skill || stationSkillOf(expandBearer(t, effects));
      if (!skill) continue;
      (map[skill] ||= []).push(t);
    }
    return map;
  }, [tokens, effects]);

  /**
   * Context tags anything actually provides.
   *
   * Read from the Tokens' own `Acts as` rules rather than a hardcoded list —
   * the pattern the rest of the CMS now copies.
   */
  const availableContext = useMemo(() => {
    const tags = new Set();
    for (const t of Object.values(tokens)) {
      for (const s of statementsOf(expandBearer(t, effects))) {
        if (s?.keyword === KEYWORD.ACTS_AS && s.payload?.tag) tags.add(s.payload.tag);
      }
      // Legacy: a top-level list, from before capabilities were statements.
      for (const p of t.provides || []) tags.add(typeof p === 'string' ? p : p?.tag);
    }
    tags.delete(undefined);
    return [...tags].sort();
  }, [tokens, effects]);

  const pool = recipePools[activeSkill] || [];
  // Clamped rather than reset in an effect: switching to a shorter pool would
  // otherwise leave `activeIdx` pointing past its end for one render.
  const idx = Math.min(activeIdx, Math.max(0, pool.length - 1));
  const activeRecipe = pool[idx];
  const building = buildsOnFoundation(activeRecipe);

  /** Edit one side of the selected recipe's production. */
  const editSide = (key, mutate) =>
    updateRecipe(activeSkill, idx, { [key]: mutate([...(activeRecipe?.[key] || [])]) });
  const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Skill list — doubles as the cross-skill review */}
      <aside
        className="flex flex-col h-full border-r shrink-0 overflow-y-auto"
        style={{ width: 200, backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Skills
          </span>
        </div>

        {/*
          Grouped by the game's skill layers. The list was already in this
          order — Foundation first — but 27 rows of which most read
          "no stations · 0" scan as one undifferentiated wall, and the six a
          designer actually authors against are the first six.
        */}
        {skillsByLayer().map(([layer, group]) => (
        <div key={layer}>
        <div
          className="px-3 py-1 text-[9px] font-black uppercase tracking-widest"
          style={{ color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.02)' }}
        >
          {layer}
        </div>
        {group.map((s) => {
          const count = (recipePools[s.id] || []).length;
          const stations = poolConsumers[s.id] || [];
          const orphanRecipes = count > 0 && stations.length === 0;
          const emptyPool = stations.length > 0 && count === 0;

          return (
            <button
              key={s.id}
              onClick={() => setActiveSkill(s.id)}
              className="w-full text-left px-3 py-2 border-b transition-colors hover:bg-white/5"
              style={{
                borderColor: 'rgba(255,255,255,0.04)',
                background: activeSkill === s.id ? 'var(--color-bg-hover)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="flex-1 text-sm truncate"
                  style={{ color: activeSkill === s.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                >
                  {s.name}
                </span>
                {(orphanRecipes || emptyPool) && (
                  <AlertTriangle size={11} style={{ color: 'var(--color-warning)' }} />
                )}
                <span className="text-[10px] text-gray-600">{count}</span>
              </div>
              <div className="text-[10px] text-gray-600 mt-0.5">
                {stations.length === 0 ? 'no stations' : `${stations.length} station${stations.length > 1 ? 's' : ''}`}
              </div>
            </button>
          );
        })}
        </div>
        ))}
      </aside>

      {/*
        Inputs and Outputs in side columns, the same shape and the same
        `SupplyChainColumn` the Token editor uses (owner, 2026-09-05). They were
        inline here and in the sidebars there, so the same idea had two homes
        depending on which editor you happened to be in.

        ⚠️ No currency button, unlike a Token's Outputs: a recipe paying gold is
        not something the game reads — a Market is a Token config.
      */}
      {activeRecipe && (
        <SupplyChainColumn
          side="left"
          title={building ? 'Building cost' : 'Inputs'}
          editable
          entries={activeRecipe.inputs || []}
          emptyHint={building ? 'Free to build (beyond the Foundation’s shop price).' : 'No inputs.'}
          onAdd={(itemId) => editSide('inputs', (list) => [...list, makeInputEntry(itemId)])}
          onUpdate={(i, p) => editSide('inputs', (list) => list.map((e, n) => (n === i ? { ...e, ...p } : e)))}
          onRemove={(i) => editSide('inputs', (list) => list.filter((_, n) => n !== i))}
        />
      )}

      {/* Pool editor */}
      <main className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar" style={{ background: '#0f0f12' }}>
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen size={18} style={{ color: 'var(--color-accent)' }} />
                {skillName(activeSkill)} recipes
              </h2>
              <p className="text-[11px] text-gray-500 mt-1">
                Shared by every station that opts into this pool.
              </p>
            </div>
            <button
              onClick={() => addRecipe(activeSkill)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={14} /> New Recipe
            </button>
          </div>

          <PoolReview
            stations={poolConsumers[activeSkill] || []}
            recipeCount={pool.length}
            skillLabel={skillName(activeSkill)}
            onOpenToken={(id) => setActiveEntity(id, 'token')}
          />

          {pool.length === 0 ? (
            <p className="text-sm text-gray-600 py-8 text-center">
              No {skillName(activeSkill)} recipes yet.
            </p>
          ) : (
            <>
              {/*
                One recipe at a time, chosen here.

                The pool used to render every recipe as a stack of cards. Side
                columns need a single subject — the Token editor has one because
                the sidebar selects one Token — so the pool becomes a row of
                chips and the chosen recipe is the one being edited.
              */}
              {pool.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {pool.map((r, i) => (
                    <button
                      key={r.id || i}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-bold"
                      style={{
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: i === idx ? 'var(--color-accent)' : 'rgba(255,255,255,0.10)',
                        background: i === idx ? 'var(--color-accent-muted)' : 'rgba(255,255,255,0.03)',
                        color: i === idx ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {r.name || 'Untitled'}
                    </button>
                  ))}
                </div>
              )}

              <RecipeCard
                key={activeRecipe?.id || idx}
                recipe={activeRecipe}
                tokens={tokens}
                skillName={skillName}
                availableContext={availableContext}
                onChange={(patch) => updateRecipe(activeSkill, idx, patch)}
                onDelete={() => { deleteRecipe(activeSkill, idx); setActiveIdx(0); }}
              />
            </>
          )}
        </div>
      </main>

      {activeRecipe && building && (
        <BuildsColumn
          recipe={activeRecipe}
          tokens={tokens}
          onPick={(tokenId) => updateRecipe(activeSkill, idx, { outputs: tokenId ? [makeTokenOutputEntry(tokenId)] : [] })}
          onOpenToken={(id) => setActiveEntity(id, 'token')}
        />
      )}

      {activeRecipe && !building && (
        <SupplyChainColumn
          side="right"
          title="Outputs"
          editable
          entries={activeRecipe.outputs || []}
          emptyHint="No outputs yet."
          onAdd={(itemId) => editSide('outputs', (list) => [...list, makeOutputEntry(itemId)])}
          onAddToken={(tokenId) => editSide('outputs', (list) => [...list, makeTokenOutputEntry(tokenId)])}
          onUpdate={(i, p) => editSide('outputs', (list) => list.map((e, n) => (n === i ? { ...e, ...p } : e)))}
          onRemove={(i) => editSide('outputs', (list) => list.filter((_, n) => n !== i))}
        />
      )}
    </div>
  );
}

/**
 * Whether a recipe builds on a Foundation: a non-empty `foundationKinds`.
 * Mirrors `buildsOnFoundation` in the game's `recipePoolRegistry.js`, which the
 * CMS cannot import (it loads the data files through Vite globs).
 */
function buildsOnFoundation(recipe) {
  return Array.isArray(recipe?.foundationKinds) && recipe.foundationKinds.length > 0;
}

/**
 * The right-hand column for a recipe that builds (Token Lifecycle §3.1, slice
 * 4.3): one Token picker in place of the Outputs list, because a building
 * recipe outputs exactly one Token — the thing the Foundation becomes.
 *
 * Picking writes `outputs: [makeTokenOutputEntry(id)]`, replacing whatever was
 * there. Outputs that do not fit that shape (left over from before the recipe
 * was ticked as a building) are shown, not silently dropped, until the author
 * picks.
 */
function BuildsColumn({ recipe, tokens, onPick, onOpenToken }) {
  const outputs = recipe.outputs || [];
  const tokenOutputs = outputs.filter((o) => o?.tokenId);
  const current = tokenOutputs[0]?.tokenId || '';
  const wellFormed = outputs.length === 1 && tokenOutputs.length === 1;
  // Foundations are not something one builds onto another Foundation.
  const choices = Object.values(tokens)
    .filter((t) => !t.foundation)
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

  return (
    <div
      className="flex flex-col h-full bg-[#16161a] border-x border-white/5 w-80 shrink-0 overflow-hidden"
      data-testid="builds-column"
    >
      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <Hammer size={12} /> Builds
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          When a hero finishes one cycle, the Foundation <strong>becomes</strong> this Token
          where it stands.
        </p>
        <select
          aria-label="Builds Token"
          value={current}
          onChange={(e) => onPick(e.target.value)}
          className="w-full"
          style={{ fontSize: 12 }}
        >
          <option value="">— pick a Token —</option>
          {current && !tokens[current] && <option value={current}>{current} (missing)</option>}
          {choices.map((t) => (
            <option key={t.id} value={t.id}>{t.name || t.id}</option>
          ))}
        </select>
        {current && tokens[current] && (
          <button
            onClick={() => onOpenToken(current)}
            className="flex items-center gap-1.5 text-[11px] text-gray-300 hover:text-white"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Boxes size={12} style={{ color: 'var(--color-accent)' }} /> Open {tokens[current].name || current}
          </button>
        )}
        {!wellFormed && outputs.length > 0 && (
          <Callout tone="warning">
            <strong>A building recipe outputs exactly one Token.</strong> This one has{' '}
            {outputs.length} output{outputs.length > 1 ? 's' : ''}
            {outputs.length > tokenOutputs.length ? `, ${outputs.length - tokenOutputs.length} of them items` : ''}.
            Picking a Token above replaces them.
          </Callout>
        )}
      </div>
    </div>
  );
}

/** The review half: who draws this pool, and the two ways it can be wrong. */
function PoolReview({ stations, recipeCount, skillLabel, onOpenToken }) {
  if (recipeCount > 0 && stations.length === 0) {
    return (
      <Callout tone="warning">
        <strong>{recipeCount} recipe{recipeCount > 1 ? 's' : ''} nothing can make.</strong> No
        station draws the {skillLabel} pool, so none of these can ever run. Turn on pooling
        for a {skillLabel} station in its Token editor.
      </Callout>
    );
  }

  if (stations.length > 0 && recipeCount === 0) {
    return (
      <Callout tone="warning">
        <strong>
          {stations.length} station{stations.length > 1 ? 's draw' : ' draws'} this pool, and it
          is empty.
        </strong>{' '}
        They will make nothing until a recipe is authored here.
      </Callout>
    );
  }

  if (stations.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
      <span>Drawn by:</span>
      {stations.map((t) => (
        <button
          key={t.id}
          onClick={() => onOpenToken(t.id)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md"
          style={{ background: 'rgba(255,255,255,0.04)', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
        >
          <Boxes size={10} /> {t.name}
        </button>
      ))}
    </div>
  );
}

function Callout({ tone, children }) {
  const color = tone === 'warning' ? 'var(--color-warning)' : 'var(--color-info)';
  return (
    <div
      className="flex items-start gap-2 p-3 rounded-lg text-[11px] leading-relaxed"
      style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}33`, color: 'var(--color-text-secondary)' }}
    >
      <AlertTriangle size={13} style={{ color, flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}

/**
 * "Builds on Foundation" — the switch between an ordinary recipe and one that
 * builds (Token Lifecycle §3.1, slices 4.1 and 4.3).
 *
 * Ticking any kind makes the recipe a building: it leaves every ordinary
 * station's pool, joins the pool of each ticked kind's Foundations of this
 * recipe's skill, and the editor swaps Outputs for a single Token picker.
 * None ticked removes the field, so an ordinary recipe syncs exactly as before.
 *
 * A Foundation's pool is filtered by its `foundation.skill` as well as its
 * kind, so a ticked kind whose Foundations are built with another skill would
 * never show this recipe. That is said here, where it is authored.
 */
function FoundationKindsRow({ recipe, tokens, skillName, onChange }) {
  const kinds = Array.isArray(recipe.foundationKinds) ? recipe.foundationKinds : [];
  const foundations = Object.values(tokens).filter((t) => t.foundation && kinds.includes(t.foundation.kind));
  const mismatched = foundations.filter((t) => t.foundation.skill !== recipe.skill);
  const withoutFoundation = kinds.filter((k) => !foundations.some((t) => t.foundation.kind === k));

  return (
    <div data-testid="foundation-kinds">
      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-gray-500">
        Builds on Foundation
      </label>
      <p className="text-[10px] text-gray-600 mb-1.5 leading-relaxed">
        Tick a kind to make this a building recipe: a {skillName(recipe.skill)} hero builds its one
        Token output on that kind of Foundation, and ordinary stations no longer see it.
      </p>
      <div className="flex flex-wrap gap-3">
        {FOUNDATION_KINDS.map((kind) => (
          <label key={kind} className="flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={kinds.includes(kind)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...kinds, kind]
                  : kinds.filter((k) => k !== kind);
                onChange({ foundationKinds: next.length > 0 ? next : undefined });
              }}
            />
            {kind.charAt(0).toUpperCase() + kind.slice(1)}
          </label>
        ))}
      </div>
      {mismatched.length > 0 && (
        <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'var(--color-warning)' }}>
          ⚠️ {mismatched.map((t) => t.name || t.id).join(', ')}{' '}
          {mismatched.length > 1 ? 'are' : 'is'} built with{' '}
          {[...new Set(mismatched.map((t) => skillName(t.foundation.skill)))].join(' / ')}, not{' '}
          {skillName(recipe.skill)}, so this recipe will not appear on {mismatched.length > 1 ? 'them' : 'it'}.
        </p>
      )}
      {withoutFoundation.length > 0 && (
        <p className="text-[10px] mt-1 text-gray-600 leading-relaxed">
          No Token is a {withoutFoundation.join(' or ')} Foundation yet.
        </p>
      )}
    </div>
  );
}

function RecipeCard({ recipe, tokens, skillName, availableContext, onChange, onDelete }) {
  const building = buildsOnFoundation(recipe);
  const [tagDraft, setTagDraft] = useState('');
  // A context requirement is `{ tag, minTier, chargeCost }`, not a bare tag:
  // the minimum tool tier it needs, and what a cycle costs that adjacent Token.
  const context = recipe.requiresContext || [];
  const contextTags = context.map((c) => c.tag);

  const patchContext = (i, p) =>
    onChange({ requiresContext: context.map((c, idx) => (idx === i ? { ...c, ...p } : c)) });

  const addTag = (tag) => {
    const t = tag.trim();
    if (!t || contextTags.includes(t)) { setTagDraft(''); return; }
    onChange({ requiresContext: [...context, { tag: t, minTier: 1, chargeCost: 0 }] });
    setTagDraft('');
  };

  const suggestions = availableContext.filter(
    (t) => !contextTags.includes(t) && (!tagDraft || t.toLowerCase().includes(tagDraft.toLowerCase()))
  );

  return (
    <section className="rounded-xl p-4 border bg-[#1a1a1e] border-white/10 space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={recipe.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="flex-1 font-bold"
          style={{ fontSize: 14 }}
        />
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          title="Delete recipe"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/*
        SECTION ONE — what the simulator decided, at the top of the card.

        Matches the Token editor (owner, 2026-09-05): the sim's answer is a
        verdict on the whole recipe, so it reads before the fields rather than
        after them. `SimAnswer` renders nothing until a Recalculate has run, so
        an un-run recipe shows no panel at all.
      */}
      <SimAnswer entityId={recipe.id} record={recipe} />

      <FoundationKindsRow recipe={recipe} tokens={tokens} skillName={skillName} onChange={onChange} />

      {/* CMS-6: N context requirements, ALL of which must be present. Each is
          `{ tag, minTier, chargeCost }` — the tag says what kind of Token, the
          tier says how good it has to be (a higher tier satisfies a lower
          requirement, R-17), and the charge cost is what running this recipe
          takes off that adjacent Token per cycle. Separate from the station's
          own charge cost below: both apply (R-8). */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
          Requires context (all of)
        </label>
        <div className="space-y-1.5 mb-2">
          {context.length === 0 && (
            <span className="text-[11px] text-gray-600">
              No context — runs whenever the station has inputs.
            </span>
          )}
          {context.map((c, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-2">
              <div className="flex items-center gap-1.5">
                <Boxes size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                <span className="flex-1 text-xs truncate text-gray-200">{c.tag}</span>
                <button
                  onClick={() => onChange({ requiresContext: context.filter((_, idx) => idx !== i) })}
                  className="text-gray-600 hover:text-red-400"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <NumberCell
                  label="Min tier"
                  value={c.minTier ?? 1}
                  min={1}
                  onChange={(v) => patchContext(i, { minTier: Math.max(1, v) })}
                />
                <NumberCell
                  label="Charge cost"
                  value={c.chargeCost ?? 0}
                  min={0}
                  onChange={(v) => patchContext(i, { chargeCost: Math.max(0, v) })}
                />
              </div>
            </div>
          ))}
        </div>
        <input
          type="text"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagDraft); } }}
          placeholder="Add a context tag…"
          className="w-full"
          style={{ fontSize: 11 }}
        />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {suggestions.slice(0, 8).map((t) => (
              <button
                key={t}
                onClick={() => addTag(t)}
                className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                style={{ border: 'none', cursor: 'pointer' }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {context.length > 1 && (
          <p className="text-[10px] text-gray-600 mt-1.5">
            All {context.length} must be nearby at once for this recipe to run.
          </p>
        )}
      </div>

      {/*
        Inputs and Outputs are in the side columns now, the same as a Token's
        (owner, 2026-09-05). They were inline here and in the sidebars there,
        which meant the same idea had two homes depending on which editor you
        were in. `setInputs` / `setOutputs` stay — the columns call them.
      */}

      {/* CMS-70: timing belongs to the recipe, so a Feast can take longer than
          Bread on the same station. */}
      <div className="grid grid-cols-2 gap-4">
        <Field label={building ? 'Build Time (ms)' : 'Cycle Time (ms)'} derived>
          <input
            type="number"
            min={0}
            step={500}
            value={recipe.durationMs ?? 12000}
            onChange={(e) => onChange({ durationMs: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
        <Field label="XP" derived>
          <input
            type="number"
            min={0}
            value={recipe.xp ?? 0}
            onChange={(e) => onChange({ xp: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
        {/* The worker's level in this recipe's skill. It gates this recipe
            alone, not the whole station. */}
        <Field label="Level Requirement">
          <input
            type="number"
            min={1}
            value={recipe.levelRequirement ?? 1}
            onChange={(e) => onChange({ levelRequirement: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
        {/* Charges the station spends per cycle. Separate from any charge cost
            a context requirement puts on an adjacent Token. */}
        <Field label="Station Charge Cost">
          <input
            type="number"
            min={0}
            value={recipe.stationChargeCost ?? 1}
            onChange={(e) => onChange({ stationChargeCost: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
      </div>

      {/*
        Tempo and Purpose sit with the timing they set, not in a section named
        for the simulator (owner, 2026-09-05) — the same move as the Token
        editor, so the two do not drift apart again.

        ⚠️ A recipe states its level as `levelRequirement`; a Token states it as
        `config.skillRequired` (finding B5). The two field names are not
        interchangeable.
      */}
      <div className="pt-3 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <SimIntentControls
          sim={recipe.sim}
          onChange={(patch) => onChange({ sim: { ...(recipe.sim || {}), ...patch } })}
          cycleMs={recipe.durationMs}
          level={recipe.levelRequirement ?? 1}
        >
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!recipe.downcycle}
              onChange={(e) => onChange({ downcycle: e.target.checked })}
              className="rounded border-white/10 text-emerald-500 cursor-pointer mt-0.5"
            />
            <span className="text-[11px] text-gray-300 leading-relaxed">
              <strong>Downcycle</strong>
              <span className="block text-gray-500">
                a return leg — breaks things back into ingredients; priced by the
                recovery dial, never an anchor
              </span>
            </span>
          </label>
        </SimIntentControls>
      </div>
      {(recipe.durationMs < 10000 || recipe.durationMs > 30000) && (
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
          ⚠️ Outside the 10–30s band.
        </p>
      )}

    </section>
  );
}
