import { useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2, X, Search, AlertTriangle, Boxes } from 'lucide-react';
import { useEntityStore, makeInputEntry, makeOutputEntry, blocksOf } from '../../stores/useEntityStore';
import { SKILLS } from '../../utils/constants';
import InlineItemModal from '../shared/InlineItemModal';

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
 * Recipes have no global id, only a position in their skill's pool, because
 * they are owned by the skill rather than by any Token (CMS-39). So this is a
 * top-level screen rather than a fourth tab in the entity sidebar.
 */
export default function RecipeEditor() {
  const recipePools = useEntityStore((s) => s.recipePools);
  const tokens = useEntityStore((s) => s.tokens);
  const items = useEntityStore((s) => s.items);
  const addRecipe = useEntityStore((s) => s.addRecipe);
  const updateRecipe = useEntityStore((s) => s.updateRecipe);
  const deleteRecipe = useEntityStore((s) => s.deleteRecipe);
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);

  const [activeSkill, setActiveSkill] = useState(SKILLS[0]?.id || '');

  /** Which stations draw each pool — the review half of CMS-40. */
  const poolConsumers = useMemo(() => {
    const map = {};
    for (const t of Object.values(tokens)) {
      if (!t.recipePool) continue;
      (map[t.recipePool] ||= []).push(t);
    }
    return map;
  }, [tokens]);

  /**
   * Context tags anything actually provides.
   *
   * Read from the Tokens themselves and their effect blocks rather than a hardcoded list.
   */
  const availableContext = useMemo(() => {
    const tags = new Set();
    for (const t of Object.values(tokens)) {
      for (const tag of t.provides || []) tags.add(tag);
      for (const b of blocksOf(t)) {
        for (const tag of b.provides || []) tags.add(tag);
      }
    }
    return [...tags].sort();
  }, [tokens]);

  const pool = recipePools[activeSkill] || [];
  const skillName = (id) => SKILLS.find((s) => s.id === id)?.name || id;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Skill list — doubles as the cross-skill review */}
      <aside
        className="flex flex-col h-full border-r shrink-0 overflow-y-auto"
        style={{ width: 260, backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Skills
          </span>
        </div>

        {SKILLS.map((s) => {
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
      </aside>

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
            pool.map((recipe, index) => (
              <RecipeCard
                key={index}
                recipe={recipe}
                items={items}
                availableContext={availableContext}
                onChange={(patch) => updateRecipe(activeSkill, index, patch)}
                onDelete={() => deleteRecipe(activeSkill, index)}
              />
            ))
          )}
        </div>
      </main>
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

function RecipeCard({ recipe, items, availableContext, onChange, onDelete }) {
  const [tagDraft, setTagDraft] = useState('');
  const context = recipe.requiresContext || [];

  const addTag = (tag) => {
    const t = tag.trim();
    if (!t || context.includes(t)) { setTagDraft(''); return; }
    onChange({ requiresContext: [...context, t] });
    setTagDraft('');
  };

  const suggestions = availableContext.filter(
    (t) => !context.includes(t) && (!tagDraft || t.toLowerCase().includes(tagDraft.toLowerCase()))
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

      {/* CMS-6: N context tags, ALL of which must be present. This is the Tool ×
          Cookbook mechanic — a Pie Tin narrows to a category, a Cookbook picks
          the dish within it. */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
          Requires context (all of)
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {context.length === 0 && (
            <span className="text-[11px] text-gray-600">
              No context — runs whenever the station has inputs.
            </span>
          )}
          {context.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-white/5 border border-white/10 text-gray-300"
            >
              {t}
              <button
                onClick={() => onChange({ requiresContext: context.filter((x) => x !== t) })}
                className="text-gray-500 hover:text-red-400"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
              >
                <X size={10} />
              </button>
            </span>
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
            All {context.length} must be adjacent at once for this recipe to run.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <EntryList
          label="Inputs"
          entries={recipe.inputs || []}
          items={items}
          kind="input"
          onChange={(inputs) => onChange({ inputs })}
        />
        <EntryList
          label="Outputs"
          entries={recipe.outputs || []}
          items={items}
          kind="output"
          onChange={(outputs) => onChange({ outputs })}
        />
      </div>

      {/* CMS-70: timing belongs to the recipe, so a Feast can take longer than
          Bread on the same station. */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
            Cycle Time (ms)
          </label>
          <input
            type="number"
            min={0}
            step={500}
            value={recipe.cycleTimeMs ?? 12000}
            onChange={(e) => onChange({ cycleTimeMs: Number(e.target.value) })}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
            XP
          </label>
          <input
            type="number"
            min={0}
            value={recipe.xp ?? 0}
            onChange={(e) => onChange({ xp: Number(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>
      {(recipe.cycleTimeMs < 10000 || recipe.cycleTimeMs > 30000) && (
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
          ⚠️ Outside D-164's 10–30s band.
        </p>
      )}
    </section>
  );
}

function EntryList({ label, entries, items, kind, onChange }) {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const matches = query.trim()
    ? Object.values(items)
        .filter((i) => (i.name || '').toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 5)
    : [];
  const exactExists = Object.values(items).some(
    (i) => (i.name || '').toLowerCase() === query.trim().toLowerCase()
  );

  const add = (itemId) => {
    onChange([...entries, kind === 'input' ? makeInputEntry(itemId) : makeOutputEntry(itemId)]);
    setQuery('');
  };
  const patch = (i, p) => onChange(entries.map((e, idx) => (idx === i ? { ...e, ...p } : e)));

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
        {label}
      </label>
      <div className="space-y-1.5">
        {entries.length === 0 && <p className="text-[11px] text-gray-600">None.</p>}
        {entries.map((e, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="flex-1 text-[11px] truncate text-gray-300">
                {items[e.itemId]?.name || e.itemId}
              </span>
              <button
                onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
                className="text-gray-600 hover:text-red-400"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
              >
                <X size={11} />
              </button>
            </div>
            {kind === 'input' ? (
              <Num label="Qty" value={e.quantity ?? 1} onChange={(v) => patch(i, { quantity: v })} />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                <Num label="Min" value={e.minQty ?? 1} onChange={(v) => patch(i, { minQty: v, maxQty: Math.max(v, e.maxQty ?? 1) })} />
                <Num label="Max" value={e.maxQty ?? 1} onChange={(v) => patch(i, { maxQty: v, minQty: Math.min(v, e.minQty ?? 1) })} />
                <Num label="%" value={e.chance ?? 100} onChange={(v) => patch(i, { chance: Math.max(0, Math.min(100, v)) })} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="relative mt-1.5">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add an item…"
          className="w-full pl-6"
          style={{ fontSize: 11 }}
        />
      </div>
      {query.trim() && (
        <div className="mt-1 space-y-1">
          {matches.map((i) => (
            <button
              key={i.id}
              onClick={() => add(i.id)}
              className="w-full text-left px-2 py-1 rounded text-[11px] text-gray-300 hover:bg-white/5"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              {i.name}
            </button>
          ))}
          {!exactExists && (
            <button
              onClick={() => setModalOpen(true)}
              className="w-full flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold"
              style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={11} /> Create “{query.trim()}”
            </button>
          )}
        </div>
      )}

      <InlineItemModal
        isOpen={modalOpen}
        initialName={query.trim()}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => add(id)}
      />
    </div>
  );
}

function Num({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 block mb-0.5">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ fontSize: 11, padding: '3px 6px' }}
      />
    </label>
  );
}
