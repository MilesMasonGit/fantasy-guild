import { useMemo, useState } from 'react';
import { Plus, X, Sprout } from 'lucide-react';
import { useEntityStore, makeLifecycleBlock, makeWeightedTokenEntry, makeTrickleEntry, TOKEN_LIFECYCLE_BLOCKS } from '../../stores/useEntityStore';
import { FOUNDATION_KINDS, TURN_DEFAULTS, RESPAWN_MODES, RESPAWN_DEFAULTS, RESPAWN_MIN_MS, skillsByLayer } from '../../utils/constants';
import { Section, Field } from '../shared/EditorLayout';
import { ItemPicker, ItemList } from './Statements';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

/**
 * The Token Lifecycle blocks: spawner, grows, turns, foundation, shop, trickle and respawn, each added or removed as a whole.
 * ⚠️ Removing a block writes `undefined`, which JSON.stringify omits, so an absent block stays absent in the file.
 */

const BLOCK_INFO = {
  spawner: { title: 'Spawner', what: 'Adds new Tokens to the mat on a clock, up to its family’s cap.' },
  grows: { title: 'Grows', what: 'Becomes another Token after a time (Sapling → Tree); it may need a Token in reach and cost an item (Stump → Sapling).' },
  turns: { title: 'Turns', what: 'Rolls a chance every cycle to turn into one of a list, and the same to turn back (Coast ↔ Shrimp Coast).' },
  foundation: { title: 'Foundation', what: 'Bought at the Shop and built on with a recipe.' },
  shop: { title: 'Shop', what: 'Sold at the Shop, priced in items.' },
  trickle: { title: 'Passive Production', what: 'Drops these items beside the Token every 5 minutes, all on one timer, no hero needed (Guild Hall only, for now). The Wishing Well adds its Water to the Hall’s.' },
  respawn: { title: 'Respawns', what: 'Comes back after it runs out instead of leaving the mat: refills where it stands after a rest, or regrows from another Token (Tree → Sapling → Tree).' },
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
                    <GrowsBlock block={token.grows} selfId={token.id} tokenOptions={tokenOptions} items={items} onChange={(v) => set('grows', v)} />
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
                  {key === 'respawn' && (
                    <RespawnBlock block={token.respawn} selfId={token.id} tokens={tokens} tokenOptions={tokenOptions} onChange={(v) => set('respawn', v)} />
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
      {/* `withinReach: true`, written ONLY when ticked: the game's `SpawnerSystem.plantsWithinReach` reads it. */}
      <label className="flex items-center gap-2 cursor-pointer select-none" title="A Forest: it plants only within its reach, and its allowance counts the trees standing in its reach (a map's included), not every one on the mat.">
        <input
          type="checkbox"
          aria-label="Plants within its reach"
          data-field="within-reach"
          checked={block.withinReach === true}
          onChange={(e) => {
            const rest = { ...block };
            delete rest.withinReach;
            onChange(e.target.checked ? { ...rest, withinReach: true } : rest);
          }}
          className="rounded border-white/10 text-emerald-500 cursor-pointer"
        />
        <span className="text-xs text-gray-300">Plants within its reach</span>
      </label>
      <p className="text-[10px] text-gray-600">
        {block.withinReach === true
          ? 'Lands its Tokens only within its reach; its allowance counts its family standing there, map Tokens included.'
          : 'Lands its Tokens at the nearest free spot; its allowance adds to every spawner of the same family across the mat.'}
      </p>
    </div>
  );
}

/**
 * A growth: what it becomes and when. A Stump also names the Tokens one of which must stand in its reach for its clock to run
 * (its Forest), and what it pays from the Bank when it grows (a seedling). Each list is written only while it has entries,
 * so a plain growth's file stays as it was.
 */
function GrowsBlock({ block, selfId, tokenOptions, items, onChange }) {
  const patch = (p) => {
    const next = { ...block, ...p };
    for (const key of ['needsNearby', 'cost']) {
      if (Array.isArray(next[key]) && next[key].length === 0) delete next[key];
    }
    onChange(next);
  };
  const nearby = Array.isArray(block.needsNearby) ? block.needsNearby : [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Grows into">
          <TokenSelect value={block.into} tokenOptions={tokenOptions} onChange={(into) => patch({ into })} />
        </Field>
        <IntField label="After (ms)" min={1000} step={1000} value={block.afterMs} onChange={(afterMs) => patch({ afterMs })} />
      </div>
      <div data-field="needs-nearby">
        <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">Needs one of these in reach</label>
        <div className="space-y-1.5">
          {nearby.map((typeId, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <TokenSelect
                  ariaLabel="Needs in reach"
                  value={typeId}
                  tokenOptions={tokenOptions.filter((t) => t.id !== selfId)}
                  onChange={(next) => patch({ needsNearby: nearby.map((id, idx) => (idx === i ? next : id)) })}
                />
              </div>
              <RemoveButton onClick={() => patch({ needsNearby: nearby.filter((_, idx) => idx !== i) })} />
            </div>
          ))}
        </div>
        <button className="btn-ghost text-[10px] flex items-center gap-1 mt-1.5" style={{ padding: '2px 8px' }} onClick={() => patch({ needsNearby: [...nearby, ''] })}>
          <Plus size={10} /> Add Token
        </button>
      </div>
      <div data-field="grow-cost">
        <ItemList
          label="Costs when it grows (from the Bank)"
          entries={Array.isArray(block.cost) ? block.cost : []}
          items={items}
          canCreate={false}
          onChange={(cost) => patch({ cost })}
        />
      </div>
      <p className="text-[10px] text-gray-600">
        {nearby.length
          ? 'Its clock stands still while none of these stands within reach (a Stump with no Forest stays a Stump).'
          : 'Grows wherever it stands.'}
        {Array.isArray(block.cost) && block.cost.length
          ? ' When it grows it pays the cost; with none in the Bank it stops and says what it needs.'
          : ''}
      </p>
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
      {/* A building recipe names a minimum tier; a higher tier builds everything a lower one can. Unset is tier 1. */}
      <IntField label="Tier" min={1} value={block.tier ?? 1} onChange={(tier) => patch({ tier })} />
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
        <div key={i} className="grid grid-cols-[1fr_70px_auto] gap-2 items-end">
          <ItemPicker label="Item" value={line.itemId} items={items} canCreate={false} onPick={(itemId) => patchLine(i, { itemId })} />
          <IntField label="Qty" min={1} value={line.quantity} onChange={(quantity) => patchLine(i, { quantity })} />
          <RemoveButton onClick={() => onChange(list.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      <button className="btn-ghost text-[10px] flex items-center gap-1" style={{ padding: '2px 8px' }} onClick={() => onChange([...list, makeTrickleEntry()])}>
        <Plus size={10} /> Add line
      </button>
    </div>
  );
}

/** Seconds as the note says them: `30 s`. */
const seconds = (ms) => `${Math.round((Number(ms) || 0) / 1000)} s`;

/** How long `fromId` takes to grow back into `toId` along its Grows chain, or null when it never does. */
function regrowTime(fromId, toId, tokens) {
  const seen = new Set();
  let id = fromId;
  let total = 0;
  while (id && tokens[id]?.grows && !seen.has(id)) {
    seen.add(id);
    total += Number(tokens[id].grows.afterMs) || 0;
    id = tokens[id].grows.into;
    if (id === toId) return total;
  }
  return null;
}

/**
 * How a Token comes back after it runs out. A refill rests where it stands for its time, then refills to its starting charges all at once. A regrow becomes another Token at 0, whose own Grows block brings it back, so its time is set there and only shown here.
 * Switching the mode rewrites the block, so a file never carries a refill's time on a regrow or the other way round.
 */
function RespawnBlock({ block, selfId, tokens, tokenOptions, onChange }) {
  const mode = RESPAWN_MODES.includes(block.mode) ? block.mode : RESPAWN_DEFAULTS.mode;
  const switchTo = (next) => {
    if (next === block.mode) return;
    onChange(next === 'regrow' ? { mode: 'regrow', into: '' } : { mode: 'refill', afterMs: RESPAWN_DEFAULTS.afterMs });
  };
  const into = mode === 'regrow' && block.into ? tokens[block.into] : null;
  const back = into ? regrowTime(block.into, selfId, tokens) : null;
  let note;
  if (mode === 'refill') note = 'At 0 charges it stays where it stands, resting, then refills to its starting charges all at once. With a resting sprite it is drawn as that picture while it rests (every vein shares one empty rock; its name still says which ore); without one, as its own art, greyed.';
  else if (!block.into) note = 'Pick the Token it becomes at 0 charges; that Token’s Grows block brings it back.';
  else if (!into) note = `${block.into} does not exist.`;
  else if (back === null) note = `${into.name || block.into} never grows back into this Token: give it a Grows block that ends here.`;
  else note = `At 0 charges it becomes ${into.name || block.into}, which grows back in ${seconds(back)} (set on its Grows block).`;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Comes back by">
          <select aria-label="Comes back by" value={mode} onChange={(e) => switchTo(e.target.value)} className="w-full">
            <option value="refill">Refilling where it stands</option>
            <option value="regrow">Regrowing from another Token</option>
          </select>
        </Field>
        {mode === 'refill' ? (
          <IntField
            label="Rests for (ms)" min={RESPAWN_MIN_MS} step={1000}
            value={block.afterMs ?? RESPAWN_DEFAULTS.afterMs}
            onChange={(afterMs) => onChange(refillBlock(afterMs, block.restingSprite))}
          />
        ) : (
          <Field label="Regrows from">
            <TokenSelect
              ariaLabel="Regrows from"
              value={block.into}
              tokenOptions={tokenOptions.filter((t) => t.id !== selfId)}
              onChange={(next) => onChange({ mode: 'regrow', into: next })}
            />
          </Field>
        )}
      </div>
      {mode === 'refill' && (
        <RestingSpriteField
          value={block.restingSprite}
          onChange={(restingSprite) => onChange(refillBlock(block.afterMs ?? RESPAWN_DEFAULTS.afterMs, restingSprite))}
        />
      )}
      <p className="text-[10px] text-gray-600">{note}</p>
    </div>
  );
}

/** A refill block in the file's order; no resting sprite leaves no key. */
function refillBlock(afterMs, restingSprite) {
  const sprite = typeof restingSprite === 'string' ? restingSprite.trim() : '';
  return sprite ? { mode: 'refill', afterMs, restingSprite: sprite } : { mode: 'refill', afterMs };
}

/** The picture a resting Token is drawn as: typed, or picked from the sprite browser. */
function RestingSpriteField({ value, onChange }) {
  const [picking, setPicking] = useState(false);
  const path = value ? resolveSpritePath(value) : null;
  return (
    <Field label="Resting sprite">
      <div className="flex gap-2 items-center">
        <div className="w-8 h-8 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
          {path && (
            <img
              src={path.startsWith('/') ? path : `/${path}`}
              className="w-7 h-7 object-contain pixel-art"
              alt=""
              onError={(e) => { e.target.style.visibility = 'hidden'; }}
            />
          )}
        </div>
        <input
          type="text"
          aria-label="Resting sprite"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="none: its own art, greyed"
          className="flex-1 min-w-0"
        />
        <button type="button" onClick={() => setPicking(true)} className="btn-ghost text-xs" style={{ padding: '6px 10px' }}>
          Browse
        </button>
      </div>
      <SpritePickerModal isOpen={picking} onClose={() => setPicking(false)} onSelect={(spriteId) => onChange(spriteId)} />
    </Field>
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
function TokenSelect({ value, tokenOptions, onChange, ariaLabel }) {
  const known = tokenOptions.some((t) => t.id === value);
  return (
    <select aria-label={ariaLabel} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full" style={{ fontSize: 11 }}>
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
