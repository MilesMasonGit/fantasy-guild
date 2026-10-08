import { useMemo } from 'react';
import { Plus, X, Sprout } from 'lucide-react';
import { useEntityStore, makeLifecycleBlock, makeWeightedTokenEntry, makeTrickleEntry, TOKEN_LIFECYCLE_BLOCKS } from '../../stores/useEntityStore';
import { FOUNDATION_KINDS, TURN_DEFAULTS, skillsByLayer } from '../../utils/constants';
import { Section, Field } from '../shared/EditorLayout';
import { ItemPicker, ItemList } from './Statements';

/**
 * The Token Lifecycle blocks: spawner, grows, turns, foundation, shop and trickle, each added or removed as a whole.
 * ⚠️ Removing a block writes `undefined`, which JSON.stringify omits, so an absent block stays absent in the file.
 */

const BLOCK_INFO = {
  spawner: { title: 'Spawner', what: 'Adds new Tokens to the mat on a clock, up to its family’s cap.' },
  grows: { title: 'Grows', what: 'Becomes another Token after a time (Sapling → Tree).' },
  turns: { title: 'Turns', what: 'Rolls a chance every cycle to turn into one of a list, and the same to turn back (Coast ↔ Shrimp Coast).' },
  foundation: { title: 'Foundation', what: 'Bought at the Shop and built on with a recipe.' },
  shop: { title: 'Shop', what: 'Sold at the Shop, priced in items.' },
  trickle: { title: 'Trickle', what: 'Pays items into the Bank on a clock, no hero needed (Guild Hall only, for now).' },
};

export default function LifecycleBlocks({ token, onChange }) {
  const tokens = useEntityStore((s) => s.tokens);
  const items = useEntityStore((s) => s.items);

  const tokenOptions = useMemo(
    () => Object.values(tokens)
      .filter(Boolean)
      .map((t) => ({ id: t.id, name: t.name || t.id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [tokens]
  );

  const shopGroupNames = useMemo(
    () => [...new Set(Object.values(tokens).map((t) => t?.shop?.group).filter(Boolean))].sort(),
    [tokens]
  );

  const set = (key, value) => onChange(key, value);

  return (
    <Section title="Spawning and Building" icon={<Sprout size={14} />}>
      <div className="space-y-3">
        {TOKEN_LIFECYCLE_BLOCKS.map((key) => {
          const present = token[key] !== undefined && token[key] !== null;
          return (
            <div
              key={key}
              data-block={key}
              className="p-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-200">{BLOCK_INFO[key].title}</span>
                <span className="flex-1 text-[10px] text-gray-600 truncate">{BLOCK_INFO[key].what}</span>
                {present ? (
                  <button className="btn-ghost text-[10px]" style={{ padding: '2px 8px' }} onClick={() => set(key, undefined)}>
                    Remove
                  </button>
                ) : (
                  <button className="btn-ghost text-[10px] flex items-center gap-1" style={{ padding: '2px 8px' }} onClick={() => set(key, makeLifecycleBlock(key))}>
                    <Plus size={10} /> Add
                  </button>
                )}
              </div>

              {present && (
                <div className="mt-3">
                  {key === 'spawner' && (
                    <SpawnerBlock block={token.spawner} tokenOptions={tokenOptions} items={items} onChange={(v) => set('spawner', v)} />
                  )}
                  {key === 'grows' && (
                    <GrowsBlock block={token.grows} tokenOptions={tokenOptions} onChange={(v) => set('grows', v)} />
                  )}
                  {key === 'turns' && (
                    <TurnsBlock block={token.turns} tokenOptions={tokenOptions} onChange={(v) => set('turns', v)} />
                  )}
                  {key === 'foundation' && (
                    <FoundationBlock block={token.foundation} onChange={(v) => set('foundation', v)} />
                  )}
                  {key === 'shop' && (
                    <ShopBlock block={token.shop} items={items} groupNames={shopGroupNames} onChange={(v) => set('shop', v)} />
                  )}
                  {key === 'trickle' && (
                    <TrickleBlock lines={token.trickle} items={items} onChange={(v) => set('trickle', v)} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function SpawnerBlock({ block, tokenOptions, items, onChange }) {
  const patch = (p) => onChange({ ...block, ...p });
  return (
    <div className="space-y-3">
      <WeightedTokenList
        label="Spawns"
        entries={block.spawns || []}
        tokenOptions={tokenOptions}
        onChange={(spawns) => patch({ spawns })}
      />
      <div className="grid grid-cols-2 gap-3">
        <IntField label="Allowance" min={1} value={block.allowance} onChange={(allowance) => patch({ allowance })} />
        <IntField label="Interval (ms)" min={1000} step={1000} value={block.intervalMs} onChange={(intervalMs) => patch({ intervalMs })} />
      </div>
      <ItemList
        label="Upkeep (per spawn)"
        entries={block.upkeep || []}
        items={items}
        canCreate={false}
        onChange={(upkeep) => patch({ upkeep })}
      />
    </div>
  );
}

function GrowsBlock({ block, tokenOptions, onChange }) {
  const patch = (p) => onChange({ ...block, ...p });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Grows into">
        <TokenSelect value={block.into} tokenOptions={tokenOptions} onChange={(into) => patch({ into })} />
      </Field>
      <IntField label="After (ms)" min={1000} step={1000} value={block.afterMs} onChange={(afterMs) => patch({ afterMs })} />
    </div>
  );
}

/** Once per cycle the Token rolls its chance to turn; the turned Token rolls the same cycle and chance to turn back. A block without a cycle or chance runs on the game's defaults. */
function TurnsBlock({ block, tokenOptions, onChange }) {
  const rest = { ...block };
  delete rest.lastsMs;
  const patch = (p) => onChange({ ...rest, ...p });
  return (
    <div className="space-y-3">
      <WeightedTokenList
        label="Turns into"
        entries={block.into || []}
        tokenOptions={tokenOptions}
        onChange={(into) => patch({ into })}
      />
      <div className="grid grid-cols-2 gap-3">
        <IntField
          label="Roll every (ms)" min={1000} step={1000}
          value={block.everyMs ?? TURN_DEFAULTS.everyMs}
          onChange={(everyMs) => patch({ everyMs })}
        />
        <IntField
          label="Chance to turn (%)" min={1} max={100}
          value={block.chance ?? TURN_DEFAULTS.chance}
          onChange={(chance) => patch({ chance })}
        />
      </div>
      <p className="text-[10px] text-gray-600">
        The same cycle and chance turn it back.
      </p>
    </div>
  );
}

function FoundationBlock({ block, onChange }) {
  const patch = (p) => onChange({ ...block, ...p });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Kind">
        <select value={block.kind || ''} onChange={(e) => patch({ kind: e.target.value })} className="w-full">
          {!FOUNDATION_KINDS.includes(block.kind) && <option value={block.kind || ''}>{block.kind || '— pick —'}</option>}
          {FOUNDATION_KINDS.map((k) => (
            <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
          ))}
        </select>
      </Field>
      <Field label="Built with skill">
        <SkillSelect value={block.skill} onChange={(skill) => patch({ skill })} />
      </Field>
    </div>
  );
}

function ShopBlock({ block, items, groupNames = [], onChange }) {
  const patch = (p) => onChange({ ...block, ...p });
  return (
    <div className="space-y-3">
      <ItemList
        label="Price"
        entries={block.price || []}
        items={items}
        canCreate={false}
        onChange={(price) => patch({ price })}
      />
      <Field label="Shop section">
        <SkillSelect value={block.section} onChange={(section) => patch({ section })} general />
      </Field>
      <Field label="Shop group (optional)">
        <input
          type="text" list="shop-group-names" data-field="shop-group"
          value={block.group || ''} placeholder="Tokens sharing a label are one Shop row with a dropdown"
          onChange={(e) => {
            const group = e.target.value;
            const { group: _drop, ...rest } = block;
            onChange(group.trim() ? { ...rest, group } : rest);
          }}
          className="w-full" style={{ fontSize: 11 }}
        />
        <datalist id="shop-group-names">
          {groupNames.map((g) => <option key={g} value={g} />)}
        </datalist>
      </Field>
    </div>
  );
}

function TrickleBlock({ lines, items, onChange }) {
  const list = Array.isArray(lines) ? lines : [];
  const patchLine = (i, p) => onChange(list.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-2">
      {list.map((line, i) => (
        <div key={i} className="grid grid-cols-[1fr_70px_110px_auto] gap-2 items-end">
          <ItemPicker label="Item" value={line.itemId} items={items} canCreate={false} onPick={(itemId) => patchLine(i, { itemId })} />
          <IntField label="Qty" min={1} value={line.quantity} onChange={(quantity) => patchLine(i, { quantity })} />
          <IntField label="Every (ms)" min={1000} step={1000} value={line.everyMs} onChange={(everyMs) => patchLine(i, { everyMs })} />
          <RemoveButton onClick={() => onChange(list.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      <button className="btn-ghost text-[10px] flex items-center gap-1" style={{ padding: '2px 8px' }} onClick={() => onChange([...list, makeTrickleEntry()])}>
        <Plus size={10} /> Add line
      </button>
    </div>
  );
}

function WeightedTokenList({ label, entries, tokenOptions, onChange }) {
  const patchRow = (i, p) => onChange(entries.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">{label}</label>
      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <TokenSelect value={entry.typeId} tokenOptions={tokenOptions} onChange={(typeId) => patchRow(i, { typeId })} />
            </div>
            <span className="text-[10px] text-gray-600">weight</span>
            <input
              type="number" min={1} value={entry.weight ?? 1}
              onChange={(e) => patchRow(i, { weight: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
              className="w-16" style={{ fontSize: 11, padding: '3px 6px' }}
            />
            <RemoveButton onClick={() => onChange(entries.filter((_, idx) => idx !== i))} />
          </div>
        ))}
      </div>
      <button className="btn-ghost text-[10px] flex items-center gap-1 mt-1.5" style={{ padding: '2px 8px' }} onClick={() => onChange([...entries, makeWeightedTokenEntry()])}>
        <Plus size={10} /> Add Token
      </button>
    </div>
  );
}

/** Picks a Token id. A value that names no Token is still shown, not dropped. */
function TokenSelect({ value, tokenOptions, onChange }) {
  const known = tokenOptions.some((t) => t.id === value);
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full" style={{ fontSize: 11 }}>
      <option value="">— pick a Token —</option>
      {value && !known && <option value={value}>{value} (missing)</option>}
      {tokenOptions.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}

/** Picks a skill id; `general` adds the Shop's catch-all section. */
function SkillSelect({ value, onChange, general = false }) {
  const groups = skillsByLayer();
  const known = (general && value === 'general') || groups.some(([, g]) => g.some((s) => s.id === value));
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full">
      {!value && <option value="">— pick a skill —</option>}
      {value && !known && <option value={value}>{value} (not a skill)</option>}
      {general && <option value="general">General</option>}
      {groups.map(([label, group]) => (
        <optgroup key={label} label={label}>
          {group.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function IntField({ label, value, onChange, min = 0, max = Infinity, step = 1 }) {
  return (
    <Field label={label}>
      <input
        type="number" min={min} max={Number.isFinite(max) ? max : undefined} step={step} value={value ?? ''}
        aria-label={label}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Math.round(Number(e.target.value)) || min)))}
        className="w-full"
      />
    </Field>
  );
}

function RemoveButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-gray-600 hover:text-red-400"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
    >
      <X size={11} />
    </button>
  );
}
