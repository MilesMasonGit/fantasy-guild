import { useMemo, useState } from 'react';
import { Plus, X, Target, Zap, Dices, Gift, Coins, ChevronDown, ChevronRight, Trash2, Search, Wrench } from 'lucide-react';
import { useEntityStore, makeModifier, blocksOf, BLOCK_PRESETS } from '../../stores/useEntityStore';
import {
  MODIFIER_PALETTE, MODIFIER_BUCKETS, TARGET_MODES, getPaletteEntry, TOKEN_TYPES,
  TRIGGER_EVENTS, getTriggerEvent, modifierValueRange, clampModifierValue,
  describeModifierDirection
} from '../../utils/constants';
import { Field } from '../shared/EditorLayout';
import InlineItemModal from '../shared/InlineItemModal';

/**
 * A Token's stack of effect blocks (CMS-59/61/64/65).
 *
 * ## Why a stack rather than one buff
 * Tokens are **not single-purpose** (CMS-58) — a Token can produce and carry an
 * aura at once, or carry two auras aimed at different neighbours. Production
 * stays in the sidebars (CMS-59); everything else stacks here in the centre.
 *
 * ## One flexible container, not named module types (CMS-61)
 * A block has optional sections — target, cost, modifiers — any of which can be
 * filled or left blank. Presets (CMS-64) only decide which start populated; they
 * do not lock the block into a category, because underneath it is the same
 * container. Blocks are freely repeatable, with no one-per-type limit (CMS-65).
 *
 * ## Triggers are Phase 6
 * CMS-61 also lists a `trigger` section (event + scope). Triggered Tokens are a
 * whole new runtime category (CMS-29), so that section — and its presets —
 * arrive with the engine that can run them, rather than being offered hollow.
 */
export default function EffectBlocks({ token }) {
  const setEffectBlocks = useEntityStore((s) => s.setEffectBlocks);
  const blocks = blocksOf(token);

  const write = (next) => setEffectBlocks(token.id, next);
  const patchBlock = (i, patch) => write(blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeBlock = (i) => write(blocks.filter((_, idx) => idx !== i));
  const addBlock = (preset) => write([...blocks, preset.make()]);

  return (
    <div className="space-y-3">
      {blocks.length === 0 && (
        <p className="text-[11px] text-gray-500 leading-relaxed">
          No effect blocks. A pure producer needs none — blocks are for Tokens that
          change what happens <em>around</em> them.
        </p>
      )}

      {blocks.map((block, i) => (
        <Block
          key={i}
          index={i}
          block={block}
          token={token}
          onChange={(patch) => patchBlock(i, patch)}
          onRemove={() => removeBlock(i)}
        />
      ))}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[9px] uppercase tracking-wider text-gray-600">Add block</span>
        {BLOCK_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => addBlock(p)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}
            title={p.hint}
          >
            <Plus size={10} /> {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One block: a collapsed summary line, expanding into its sections. */
function Block({ index, block, token, onChange, onRemove }) {
  const [open, setOpen] = useState(true);
  const tokens = useEntityStore((s) => s.tokens);
  const items = useEntityStore((s) => s.items);

  const knownTags = useMemo(() => {
    const all = new Set();
    for (const t of Object.values(tokens)) for (const tag of t.tags || []) all.add(tag);
    return [...all].sort();
  }, [tokens]);

  const modifiers = block.modifiers || [];
  const targetToken = block.targetToken || null;

  const addModifier = (type) => {
    const entry = getPaletteEntry(type);
    onChange({ modifiers: [...modifiers, makeModifier(type, entry?.shape)] });
  };
  const patchModifier = (i, patch) =>
    onChange({ modifiers: modifiers.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });
  const removeModifier = (i) => onChange({ modifiers: modifiers.filter((_, idx) => idx !== i) });

  // CMS-99: an action that needs a firing moment is hidden until the block has
  // one, so the CMS can never offer something the runtime would never run.
  const grouped = MODIFIER_PALETTE
    .filter((e) => !e.triggeredOnly || block.trigger?.event)
    .reduce((acc, e) => {
      (acc[e.group] ||= []).push(e);
      return acc;
    }, {});

  return (
    <div className="rounded-lg border border-white/10 bg-black/20">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen(!open)}
          className="text-gray-500 hover:text-gray-300"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {/* An auto-generated summary line. Phase 9 replaces this with the shared
            description dictionary that also writes the in-game tooltip (CMS-66). */}
        <span className="flex-1 text-xs text-gray-300 truncate">{summarise(block, tokens, items)}</span>
        <button
          onClick={onRemove}
          className="text-gray-600 hover:text-red-400"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
          title="Remove block"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-3.5 border-t border-white/5 pt-3">
          {/* --- Target --- */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 flex items-center gap-1.5">
              <Target size={11} /> Target
            </label>
            <select
              value={targetToken?.mode || ''}
              onChange={(e) =>
                onChange({ targetToken: e.target.value ? { mode: e.target.value, value: '' } : null })
              }
              className="w-full"
              style={{ fontSize: 12 }}
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
                onChange={(v) => onChange({ targetToken: { mode: 'tag', value: v } })}
              />
            )}
            {targetToken?.mode === 'id' && (
              <select
                value={targetToken.value}
                onChange={(e) => onChange({ targetToken: { mode: 'id', value: e.target.value } })}
                className="w-full mt-1.5"
                style={{ fontSize: 12 }}
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
                onChange={(e) => onChange({ targetToken: { mode: 'tokenType', value: e.target.value } })}
                className="w-full mt-1.5"
                style={{ fontSize: 12 }}
              >
                <option value="">— pick a category —</option>
                {TOKEN_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            {targetToken?.mode && !targetToken.value && (
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-warning)' }}>
                ⚠️ No target chosen — this block will reach nothing at all.
              </p>
            )}
            {targetToken?.mode && !token.noStackDuplicates && (
              <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: 'var(--color-warning)' }}>
                ⚠️ Targeted buffs default to not stacking (CMS-19). Consider ticking
                “Duplicates don't stack” in Lifecycle.
              </p>
            )}
          </div>

          {/* --- Context / Tool Provision --- */}
          <ProvidesSection block={block} onChange={onChange} />

          {/* --- Trigger (CMS-29/30/33) --- */}
          <TriggerSection block={block} tokens={tokens} items={items} onChange={onChange} />

          {/* --- Upkeep (CMS-60) --- */}
          <UpkeepSection block={block} items={items} onChange={onChange} />

          {/* --- Modifiers --- */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
              Modifiers
            </label>
            <div className="space-y-2">
              {modifiers.length === 0 && (
                <p className="text-[11px] text-gray-600">No modifiers — this block does nothing yet.</p>
              )}
              {modifiers.map((m, i) => (
                <ModifierRow
                  key={i}
                  modifier={m}
                  items={items}
                  untargeted={!targetToken?.mode}
                  onChange={(patch) => patchModifier(i, patch)}
                  onRemove={() => removeModifier(i)}
                />
              ))}
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
      )}
    </div>
  );
}

/**
 * What this block reacts to (CMS-29/30/33).
 *
 * A block with a trigger is **event-driven and never ambient** — its modifiers
 * fire when something happens rather than applying continuously. That is a real
 * runtime distinction, not a label: `TileModifiers` skips triggered blocks
 * entirely, and `TriggerSystem` owns them.
 */
function TriggerSection({ block, tokens, items, onChange }) {
  const trigger = block.trigger;

  if (!trigger) {
    return (
      <button
        onClick={() => onChange({ trigger: { event: TRIGGER_EVENTS[0].id, scope: TRIGGER_EVENTS[0].scopes[0] }, cooldownMs: 5000 })}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}
      >
        <Plus size={10} /> Make this a reaction
      </button>
    );
  }

  const definition = getTriggerEvent(trigger.event);
  const isGlobal = trigger.scope === 'global';

  const setEvent = (id) => {
    const def = getTriggerEvent(id);
    onChange({ trigger: { event: id, scope: def?.scopes[0] || 'adjacent' } });
  };

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 flex items-center gap-1.5">
        <Zap size={11} /> Reacts to
        <button
          onClick={() => onChange({ trigger: null })}
          className="ml-auto text-gray-600 hover:text-red-400 normal-case tracking-normal font-normal"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}
        >
          remove
        </button>
      </label>

      <select
        value={trigger.event}
        onChange={(e) => setEvent(e.target.value)}
        className="w-full"
        style={{ fontSize: 12 }}
      >
        {TRIGGER_EVENTS.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
      <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">{definition?.hint}</p>

      {/* Adjacency-scoped triggers may name WHICH neighbour they listen to
          (CMS-30) — the Wheelbarrow watches its Ore Vein, not anything. */}
      {!isGlobal && (
        <div className="mt-2">
          <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
            From which neighbour
          </label>
          <select
            value={trigger.source?.mode || ''}
            onChange={(e) =>
              onChange({
                trigger: { ...trigger, source: e.target.value ? { mode: e.target.value, value: '' } : null },
              })
            }
            className="w-full"
            style={{ fontSize: 12 }}
          >
            <option value="">Any neighbour</option>
            {TARGET_MODES.map((m) => (
              <option key={m.mode} value={m.mode}>{m.label}</option>
            ))}
          </select>

          {trigger.source?.mode === 'id' && (
            <select
              value={trigger.source.value}
              onChange={(e) => onChange({ trigger: { ...trigger, source: { mode: 'id', value: e.target.value } } })}
              className="w-full mt-1.5"
              style={{ fontSize: 12 }}
            >
              <option value="">— pick a Token —</option>
              {Object.values(tokens).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          {trigger.source?.mode === 'tokenType' && (
            <select
              value={trigger.source.value}
              onChange={(e) => onChange({ trigger: { ...trigger, source: { mode: 'tokenType', value: e.target.value } } })}
              className="w-full mt-1.5"
              style={{ fontSize: 12 }}
            >
              <option value="">— pick a category —</option>
              {TOKEN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          {trigger.source?.mode === 'tag' && (
            <input
              type="text"
              value={trigger.source.value || ''}
              onChange={(e) => onChange({ trigger: { ...trigger, source: { mode: 'tag', value: e.target.value } } })}
              placeholder="Tag the neighbour carries"
              className="w-full mt-1.5"
              style={{ fontSize: 11 }}
            />
          )}
        </div>
      )}

      {/* Global item-threshold triggers (CMS-35) watch the Bank instead. */}
      {isGlobal && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Field label="Watch item">
            <select
              value={trigger.watchItemId || ''}
              onChange={(e) => onChange({ trigger: { ...trigger, watchItemId: e.target.value } })}
              className="w-full"
              style={{ fontSize: 11 }}
            >
              <option value="">— pick an item —</option>
              {Object.values(items).map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </Field>
          <Field label="At least">
            <input
              type="number"
              min={1}
              value={trigger.threshold ?? 1}
              onChange={(e) => onChange({ trigger: { ...trigger, threshold: Math.max(1, Number(e.target.value)) } })}
              className="w-full"
              style={{ fontSize: 11 }}
            />
          </Field>
          {!trigger.watchItemId && (
            <p className="col-span-2 text-[10px]" style={{ color: 'var(--color-warning)' }}>
              ⚠️ No item chosen — this trigger will never fire.
            </p>
          )}
        </div>
      )}

      <Field label="Cooldown (ms)" className="mt-2">
        <input
          type="number"
          min={0}
          step={500}
          value={block.cooldownMs ?? 0}
          onChange={(e) => onChange({ cooldownMs: Math.max(0, Number(e.target.value)) })}
          className="w-full"
          style={{ fontSize: 11 }}
        />
      </Field>
      <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
        A Triggered Token is rate-limited by a cooldown rather than a cycle time
        (CMS-29). {isGlobal && 'Without one, a condition that stays true would fire on every Bank change.'}
      </p>
      {isGlobal && !block.cooldownMs && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--color-warning)' }}>
          ⚠️ A global trigger with no cooldown fires on every inventory change.
        </p>
      )}
    </div>
  );
}

/** Upkeep: items on their own cadence, independent of the production cycle. */
function UpkeepSection({ block, items, onChange }) {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const cost = block.cost;

  const setCost = (next) => onChange({ cost: next });
  const addItem = (itemId) => {
    setCost({ ...cost, items: [...(cost?.items || []), { itemId, quantity: 1 }] });
    setQuery('');
  };

  if (!cost) {
    return (
      <button
        onClick={() => setCost({ items: [], cadenceMs: 30000 })}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px]"
        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-secondary)', border: 'none', cursor: 'pointer' }}
      >
        <Plus size={10} /> Add upkeep cost
      </button>
    );
  }

  const matches = query.trim()
    ? Object.values(items).filter((i) => (i.name || '').toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : [];
  const exactExists = Object.values(items).some(
    (i) => (i.name || '').toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 flex items-center gap-1.5">
        <Coins size={11} /> Upkeep
        <button
          onClick={() => setCost(null)}
          className="ml-auto text-gray-600 hover:text-red-400 normal-case tracking-normal font-normal"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}
        >
          remove
        </button>
      </label>

      <div className="space-y-1.5">
        {(cost.items || []).map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="flex-1 text-[11px] text-gray-300 truncate">
              {items[it.itemId]?.name || it.itemId}
            </span>
            <input
              type="number"
              min={1}
              value={it.quantity ?? 1}
              onChange={(e) =>
                setCost({
                  ...cost,
                  items: cost.items.map((x, idx) => (idx === i ? { ...x, quantity: Number(e.target.value) } : x)),
                })
              }
              className="w-16"
              style={{ fontSize: 11, padding: '3px 6px' }}
            />
            <button
              onClick={() => setCost({ ...cost, items: cost.items.filter((_, idx) => idx !== i) })}
              className="text-gray-600 hover:text-red-400"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="relative mt-1.5">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add an upkeep item…"
          className="w-full pl-6"
          style={{ fontSize: 11 }}
        />
      </div>
      {query.trim() && (
        <div className="mt-1 space-y-1">
          {matches.map((i) => (
            <button
              key={i.id}
              onClick={() => addItem(i.id)}
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

      <Field label="Every (ms)" className="mt-2">
        <input
          type="number"
          min={1000}
          step={1000}
          value={cost.cadenceMs ?? 30000}
          onChange={(e) => setCost({ ...cost, cadenceMs: Number(e.target.value) })}
          className="w-full"
          style={{ fontSize: 11 }}
        />
      </Field>
      <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
        Its own clock, independent of any production cycle (CMS-60). When the Bank
        cannot pay, this block switches off until stock returns — it is not destroyed,
        and no debt accrues.
      </p>

      <InlineItemModal
        isOpen={modalOpen}
        initialName={query.trim()}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => addItem(id)}
      />
    </div>
  );
}

function ModifierRow({ modifier, items, untargeted, onChange, onRemove }) {
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const entry = getPaletteEntry(modifier.type);
  const shape = entry?.shape;

  // Bounds and direction both come from the palette entry, so a new effect
  // type gets the right form with no change here.
  const range = modifierValueRange(entry);
  const direction = describeModifierDirection(entry, modifier.value, modifier.bucket || 'percentage');
  const valueLabel = modifier.bucket === 'percentage'
    ? (entry?.inverted ? 'Value (−0.05 = 5% less)' : 'Value (0.05 = +5%)')
    : 'Value';

  const Icon = shape === 'proc' ? Dices : shape === 'item' ? Gift : Zap;
  const colour = shape === 'proc' ? 'text-amber-400' : shape === 'item' ? 'text-sky-400' : 'text-emerald-400';

  const matches = query.trim()
    ? Object.values(items).filter((i) => (i.name || '').toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : [];
  const exactExists = Object.values(items).some(
    (i) => (i.name || '').toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={colour} />
        <span className="flex-1 text-xs text-gray-200">{entry?.label || modifier.type}</span>
        <button
          onClick={onRemove}
          className="text-gray-600 hover:text-red-400"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
        >
          <X size={12} />
        </button>
      </div>

      {shape === 'convert' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ItemList
              label="Consumes (from Bank)"
              entries={modifier.consumes || []}
              items={items}
              onChange={(consumes) => onChange({ consumes })}
            />
            <ItemList
              label="Produces (onto board)"
              entries={modifier.produces || []}
              items={items}
              onChange={(produces) => onChange({ produces })}
            />
          </div>
          <Field label="Chance %">
            <input
              type="number"
              min={0}
              max={100}
              value={modifier.chance ?? 100}
              onChange={(e) => onChange({ chance: Math.max(0, Math.min(100, Number(e.target.value))) })}
              className="w-full"
              style={{ fontSize: 11 }}
            />
          </Field>
          {!(modifier.consumes || []).length && (
            <p className="text-[10px]" style={{ color: 'var(--color-warning)' }}>
              ⚠️ Consumes nothing — this is a free grant, not a conversion. Use Bonus Drop
              unless that is deliberate.
            </p>
          )}
        </>
      ) : shape === 'item' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Chance %">
              <input
                type="number"
                min={0}
                max={100}
                value={modifier.chance ?? 100}
                onChange={(e) => onChange({ chance: Math.max(0, Math.min(100, Number(e.target.value))) })}
                className="w-full"
                style={{ fontSize: 11 }}
              />
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                min={1}
                value={modifier.quantity ?? 1}
                onChange={(e) => onChange({ quantity: Math.max(1, Number(e.target.value)) })}
                className="w-full"
                style={{ fontSize: 11 }}
              />
            </Field>
          </div>
          <Field label="Item">
            {modifier.itemId ? (
              <div className="flex items-center gap-1.5">
                <span className="flex-1 text-[11px] text-gray-300 truncate">
                  {items[modifier.itemId]?.name || modifier.itemId}
                </span>
                <button
                  onClick={() => onChange({ itemId: '' })}
                  className="text-gray-600 hover:text-red-400"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                >
                  <X size={11} />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for an item…"
                  className="w-full"
                  style={{ fontSize: 11 }}
                />
                {query.trim() && (
                  <div className="mt-1 space-y-1">
                    {matches.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => { onChange({ itemId: i.id }); setQuery(''); }}
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
                <p className="text-[10px] mt-1" style={{ color: 'var(--color-warning)' }}>
                  ⚠️ No item chosen — this grant will drop nothing.
                </p>
              </>
            )}
          </Field>
          <InlineItemModal
            isOpen={modalOpen}
            initialName={query.trim()}
            onClose={() => setModalOpen(false)}
            onCreated={(id) => { onChange({ itemId: id }); setQuery(''); }}
          />
        </>
      ) : shape === 'proc' ? (
        <Field label="Chance %">
          <input
            type="number"
            min={range.min ?? undefined}
            max={range.max ?? undefined}
            value={modifier.value ?? 0}
            onChange={(e) => onChange({ value: clampModifierValue(entry, e.target.value), bucket: 'flat' })}
            className="w-full"
            style={{ fontSize: 11 }}
          />
        </Field>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Bucket">
              <select
                value={modifier.bucket || 'percentage'}
                onChange={(e) => onChange({ bucket: e.target.value })}
                className="w-full"
                style={{ fontSize: 11 }}
              >
                {MODIFIER_BUCKETS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </Field>
            <Field label={valueLabel}>
              {/* No `min`: on a signed axis the sign IS the direction, and for
                  an inverted effect like Work Time the negative side is the
                  buff. Bounds come from the palette's shape, not from here. */}
              <input
                type="number"
                min={range.min ?? undefined}
                max={range.max ?? undefined}
                step={modifier.bucket === 'percentage' ? 0.01 : 1}
                value={modifier.value ?? 0}
                onChange={(e) => onChange({ value: clampModifierValue(entry, e.target.value) })}
                className="w-full"
                style={{ fontSize: 11 }}
              />
            </Field>
          </div>

          {/* Which way is good? `inverted` already knows; say it out loud so
              "−5% Work Time" reads as the buff it is. */}
          {direction && (
            <p
              className="text-[10px] leading-relaxed"
              style={{ color: direction.isBuff ? 'var(--color-accent-hover, #34d399)' : 'var(--color-warning)' }}
            >
              {direction.isBuff ? '▲' : '▼'} {direction.text}
            </p>
          )}
          {!direction && entry?.inverted && (
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Lower is better on {entry.label} — enter a <strong>negative</strong> value for a buff.
            </p>
          )}
        </>
      )}

      <p className="text-[10px] text-gray-600 leading-relaxed">{entry?.hint}</p>

      {untargeted && modifier.bucket === 'percentage' && Math.abs(modifier.value) > 0.15 && (
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-warning)' }}>
          ⚠️ Large for an untargeted buff. D-119/D-120 keep these to a few percent because
          they touch everything nearby. Give the block a target to justify real weight.
        </p>
      )}
    </div>
  );
}

/** A simple {itemId, quantity} list, used by CONVERT's two sides. */
function ItemList({ label, entries, items, onChange }) {
  const [query, setQuery] = useState('');
  const matches = query.trim()
    ? Object.values(items).filter((i) => (i.name || '').toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : [];

  return (
    <div>
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 block mb-1">{label}</span>
      <div className="space-y-1">
        {entries.length === 0 && <p className="text-[10px] text-gray-600">None.</p>}
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="flex-1 text-[10px] text-gray-300 truncate">{items[e.itemId]?.name || e.itemId}</span>
            <input
              type="number"
              min={1}
              value={e.quantity ?? 1}
              onChange={(ev) => onChange(entries.map((x, idx) => (idx === i ? { ...x, quantity: Math.max(1, Number(ev.target.value)) } : x)))}
              className="w-12"
              style={{ fontSize: 10, padding: '2px 4px' }}
            />
            <button
              onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
              className="text-gray-600 hover:text-red-400"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add…"
        className="w-full mt-1"
        style={{ fontSize: 10 }}
      />
      {matches.map((i) => (
        <button
          key={i.id}
          onClick={() => { onChange([...entries, { itemId: i.id, quantity: 1 }]); setQuery(''); }}
          className="w-full text-left px-1.5 py-0.5 rounded text-[10px] text-gray-300 hover:bg-white/5"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          {i.name}
        </button>
      ))}
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
          {known.filter((t) => t !== value).slice(0, 8).map((t) => (
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

function ProvidesSection({ block, onChange }) {
  const [draft, setDraft] = useState('');
  const provides = block.provides || [];

  const addTag = (tag) => {
    const t = tag.trim().toLowerCase();
    if (!t || provides.includes(t)) {
      setDraft('');
      return;
    }
    onChange({ provides: [...provides, t] });
    setDraft('');
  };

  const removeTag = (t) => {
    onChange({ provides: provides.filter((x) => x !== t) });
  };

  const quickPicks = ['pickaxe', 'axe', 'hammer', 'anvil', 'saw', 'furnace', 'pie_tin', 'cookbook']
    .filter((p) => !provides.includes(p));

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-gray-500 flex items-center gap-1.5">
        <Wrench size={11} /> Context / Tool Provision
      </label>
      <p className="text-[10px] text-gray-600 mb-2 leading-relaxed">
        Tools and context tags this block provides to adjacent stations (e.g. <code>pickaxe</code> for mining, <code>axe</code> for woodcutting).
      </p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {provides.length === 0 && (
          <span className="text-[11px] text-gray-600">Provides no context/tool tags.</span>
        )}
        {provides.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono"
          >
            {t}
            <button
              onClick={() => removeTag(t)}
              className="text-gray-500 hover:text-red-400"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
              title={`Remove ${t}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(draft);
            }
          }}
          placeholder="e.g. pickaxe"
          className="flex-1"
          style={{ fontSize: 11 }}
        />
        <button
          onClick={() => addTag(draft)}
          className="btn-ghost flex items-center"
          style={{ padding: '4px 10px' }}
        >
          <Plus size={12} />
        </button>
      </div>

      {quickPicks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[9px] text-gray-600 uppercase">Quick Add:</span>
          {quickPicks.slice(0, 5).map((qp) => (
            <button
              key={qp}
              onClick={() => addTag(qp)}
              className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200"
              style={{ border: 'none', cursor: 'pointer' }}
            >
              +{qp}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A one-line description of what a block does, for its collapsed header. */
function summarise(block, tokens, items) {
  const parts = [];
  const mods = block.modifiers || [];
  const provides = block.provides || [];

  if (provides.length > 0) {
    parts.push(`Provides [${provides.join(', ')}]`);
  }

  if (mods.length === 0) {
    if (provides.length === 0) parts.push('Empty block');
  } else {
    parts.push(
      mods
        .map((m) => {
          const entry = getPaletteEntry(m.type);
          const label = entry?.label || m.type;
          if (entry?.shape === 'item') {
            const name = items[m.itemId]?.name || m.itemId || '(no item)';
            return `${m.chance ?? 100}% ${name} ×${m.quantity ?? 1}`;
          }
          if (entry?.shape === 'proc') return `${label} ${m.value ?? 0}%`;
          const v = m.value ?? 0;
          const shown = m.bucket === 'percentage' ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` : `${v > 0 ? '+' : ''}${v}`;
          return `${label} ${shown}`;
        })
        .join(', ')
    );
  }

  const t = block.targetToken;
  if (t?.mode === 'tag') parts.push(`to “${t.value || '…'}” Tokens`);
  else if (t?.mode === 'id') parts.push(`to ${tokens[t.value]?.name || t.value || '…'}`);
  else if (t?.mode === 'tokenType') parts.push(`to all ${t.value || '…'}`);
  else parts.push('to everything adjacent');

  if (block.cost?.items?.length) {
    parts.push(`· costs ${block.cost.items.length} item${block.cost.items.length > 1 ? 's' : ''} every ${(block.cost.cadenceMs || 0) / 1000}s`);
  }

  return parts.join(' ');
}
