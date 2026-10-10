import { useState } from 'react';
import { Settings2, Map as MapIcon, Sparkles, Repeat, Coins, X, Plus, AlertTriangle, ScrollText, HelpCircle } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { Header, Section, Field, Empty } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';
import { STARTING_TOKEN_CAP } from '../../utils/constants';
import {
  isMapItem, isModifier, whatItWrites, mapItemFindings, MODIFIER_EFFECT_KINDS, MAP_TEXT,
} from '../../../../src/systems/atlas/mapItems.js';
import { BIOME_GROUND, nodeLimit } from '../../../../src/systems/atlas/Budget.js';
import { TERRAIN } from '../../../../src/systems/atlas/TerrainMap.js';

/**
 * The Map editor: Base Maps and Modifiers. Each one is an item (type `map` or `modifier`) in the
 * item collection, edited only here, so Sync writes it into `items.json` and the game banks it
 * like any item. What it writes is previewed with the game's own budget (`Budget.js`).
 */

const KIND_LABEL = { map: 'Base Map', modifier: 'Modifier' };

/** The modifier effects, in the author's words, and the row each starts as. */
const EFFECTS = [
  { kind: MODIFIER_EFFECT_KINDS.DENSITY, label: 'More of a node', make: () => ({ kind: MODIFIER_EFFECT_KINDS.DENSITY, typeId: '', points: 8 }) },
  { kind: MODIFIER_EFFECT_KINDS.REPLACE, label: 'A better node instead', make: () => ({ kind: MODIFIER_EFFECT_KINDS.REPLACE, from: '', to: '', share: 1 }) },
  { kind: MODIFIER_EFFECT_KINDS.THREAT, label: 'An enemy camp', make: () => ({ kind: MODIFIER_EFFECT_KINDS.THREAT, typeId: '', count: 1 }) },
  { kind: MODIFIER_EFFECT_KINDS.TREASURE, label: 'A treasure', make: () => ({ kind: MODIFIER_EFFECT_KINDS.TREASURE, typeId: '', count: 1 }) },
];
const EFFECT_LABEL = Object.fromEntries(EFFECTS.map((e) => [e.kind, e.label]));

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export default function MapEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
  const updateItem = useEntityStore((s) => s.updateItem);
  const deleteItem = useEntityStore((s) => s.deleteItem);
  const setMapKind = useEntityStore((s) => s.setMapKind);
  const [isPickerOpen, setPickerOpen] = useState(false);

  const map = items[activeId];
  if (!isMapItem(map)) return <Empty text="Select a Map from the sidebar to edit" />;

  const c = map.cartography || {};
  const update = (key, value) => updateItem(activeId, { [key]: value });
  const setCartography = (patch) => {
    const next = { ...c, ...patch };
    for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
    updateItem(activeId, { cartography: next });
  };

  const nameOf = (id) => tokens[id]?.name || id;
  const writes = whatItWrites(map, { cap: STARTING_TOKEN_CAP, nameOf });
  const findings = mapItemFindings(map, { tokenExists: (id) => !!tokens[id], itemOf: (id) => items[id] || null });
  const spritePath = map.sprite ? resolveSpritePath(map.sprite) : null;
  const otherMaps = Object.values(items).filter((i) => isMapItem(i) && i.id !== map.id);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <Header name={map.name} id={map.id} sprite={map.sprite} onDelete={() => deleteItem(activeId)} />

      <Section title="Identity" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name">
            <input type="text" value={map.name} onChange={(e) => update('name', e.target.value)} className="w-full" />
          </Field>
          <Field label="Kind">
            <select value={map.type} onChange={(e) => setMapKind(activeId, e.target.value)} className="w-full">
              <option value="map">{KIND_LABEL.map}</option>
              <option value="modifier">{KIND_LABEL.modifier}</option>
            </select>
          </Field>
          <Field label="Description" className="col-span-2">
            <textarea
              value={map.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              className="w-full resize-y"
              placeholder="Flavour text shown in the Bank."
            />
          </Field>
          <Field label="Sprite" className="col-span-2">
            <div className="flex gap-2 items-center">
              <div className="w-16 h-16 rounded border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {spritePath ? (
                  <img
                    src={spritePath.startsWith('/') ? spritePath : `/${spritePath}`}
                    className="w-16 h-16 object-contain pixel-art"
                    alt=""
                    onError={(e) => { e.target.style.visibility = 'hidden'; }}
                  />
                ) : (
                  <HelpCircle size={16} className="text-gray-600" />
                )}
              </div>
              <input
                type="text"
                value={map.sprite || ''}
                onChange={(e) => update('sprite', e.target.value)}
                placeholder="sprite_id or assets/..."
                className="flex-1 min-w-0"
              />
              <button onClick={() => setPickerOpen(true)} className="btn-ghost text-xs" style={{ padding: '6px 10px' }}>
                Browse
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              Shown at 64 px in the Bank: map art is drawn at 64 × 64.
            </p>
          </Field>
        </div>
      </Section>

      {isModifier(map)
        ? <EffectsSection effects={c.effects || []} tokens={tokens} onChange={(effects) => setCartography({ effects })} />
        : <CartographySection c={c} tokens={tokens} onChange={setCartography} />}

      <Section title={MAP_TEXT.whatItWrites} icon={<ScrollText size={14} />}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{writes.headline}</span>
          {!isModifier(map) && (
            <span className="text-[10px] text-gray-500">
              at the starting Token cap ({STARTING_TOKEN_CAP}): at most {nodeLimit(STARTING_TOKEN_CAP)} map Tokens
            </span>
          )}
        </div>
        {writes.lines.length > 0 ? (
          <ul className="space-y-1">
            {writes.lines.map((line, i) => (
              <li key={`${line.role}-${line.typeId}-${i}`} className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                {line.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-gray-600">Nothing yet.</p>
        )}
        <p className="text-[10px] text-gray-600 leading-relaxed">
          {isModifier(map)
            ? 'A Modifier writes nothing alone: slotted beside Base Maps, it changes what they write. The game shows these lines when the item is inspected.'
            : 'The same summary the game shows when the item is inspected. Several Base Maps slotted together blend: each writes its share of the points.'}
        </p>
        {findings.length > 0 && (
          <ul className="space-y-1 pt-1">
            {findings.map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--color-warning)' }}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Upcycling" icon={<Repeat size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Trades up into">
            <select
              value={c.upcycle?.itemId || ''}
              onChange={(e) => setCartography({
                upcycle: e.target.value ? { itemId: e.target.value, ratio: c.upcycle?.ratio || 10 } : undefined,
              })}
              className="w-full"
            >
              <option value="">— none —</option>
              {otherMaps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="How many for one">
            <input
              type="number"
              min={2}
              value={c.upcycle?.ratio ?? ''}
              disabled={!c.upcycle?.itemId}
              onChange={(e) => setCartography({ upcycle: { ...c.upcycle, ratio: Math.max(0, Math.round(num(e.target.value))) } })}
              className="w-full"
            />
          </Field>
        </div>
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Trade this many of this map for one of the other, in the Cartography screen. Kept for
          that screen, which comes in a later slice: the game does not read it yet.
        </p>
      </Section>

      <Section title="Bounties" icon={<Coins size={14} />}>
        <Field label="Bounty weight">
          <input
            type="number"
            min={0}
            step={0.5}
            value={c.bountyWeight ?? 1}
            onChange={(e) => setCartography({ bountyWeight: Math.max(0, num(e.target.value, 1)) })}
            className="w-32"
          />
        </Field>
        <p className="text-[10px] text-gray-600 leading-relaxed">
          A claimed bounty sometimes pays a map, picked by these weights across every map: 2 is
          twice as likely as 1, and 0 means bounties never pay this one. To make it drop from an
          enemy, add it to that enemy&apos;s Drops in the Token editor.
        </p>
      </Section>

      <SpritePickerModal
        isOpen={isPickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(spriteId) => update('sprite', spriteId)}
      />
    </div>
  );
}

/** A Base Map's Cartography block: biome, points, its node mix, camps, treasures and ground. */
function CartographySection({ c, tokens, onChange }) {
  const nodes = c.nodes || [];
  const weightSum = nodes.reduce((n, r) => n + Math.max(0, num(r.weight)), 0);
  const points = num(c.points);
  const biomeDefault = BIOME_GROUND[c.biome];

  return (
    <Section title="Cartography" icon={<MapIcon size={14} />}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Biome">
          <input
            type="text"
            list="atlas-biomes"
            value={c.biome || ''}
            onChange={(e) => onChange({ biome: e.target.value.trim().toLowerCase() })}
            placeholder="forest, mountain, coast…"
            className="w-full"
          />
          <datalist id="atlas-biomes">
            {Object.keys(BIOME_GROUND).map((b) => <option key={b} value={b} />)}
          </datalist>
        </Field>
        <Field label="Points">
          <input
            type="number"
            min={0}
            data-field="points"
            value={c.points ?? 0}
            onChange={(e) => onChange({ points: Math.max(0, num(e.target.value)) })}
            className="w-full"
          />
          <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
            Roughly how many node Tokens it writes, split by the weights below.
          </p>
        </Field>
      </div>

      <RowList
        title="Nodes"
        rows={nodes}
        amountKey="weight"
        amountLabel="weight"
        defaultAmount={1}
        tokens={tokens}
        note={(row) => (weightSum > 0 ? `≈ ${Math.round((points * Math.max(0, num(row.weight))) / weightSum)}` : '')}
        empty="No nodes: the Tokens this map is made of, each with a weight."
        onChange={(next) => onChange({ nodes: next })}
      />
      <RowList
        title="Enemy camps"
        rows={c.camps || []}
        amountKey="count"
        amountLabel="count"
        defaultAmount={1}
        tokens={tokens}
        empty="No camps of its own."
        onChange={(next) => onChange({ camps: next })}
      />
      <RowList
        title="Treasures"
        rows={c.treasures || []}
        amountKey="count"
        amountLabel="count"
        defaultAmount={1}
        tokens={tokens}
        empty="No treasures of its own."
        onChange={(next) => onChange({ treasures: next })}
      />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Ground">
          <select
            value={c.terrain || ''}
            onChange={(e) => onChange({ terrain: e.target.value || undefined })}
            className="w-full"
          >
            <option value="">The biome&apos;s ({biomeDefault?.terrain || 'grass'})</option>
            {Object.values(TERRAIN).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Water (share of the mat)">
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={c.water ?? ''}
            placeholder={String(biomeDefault?.water ?? 0)}
            onChange={(e) => onChange({
              water: e.target.value === '' ? undefined : Math.min(1, Math.max(0, num(e.target.value))),
            })}
            className="w-full"
          />
        </Field>
      </div>
    </Section>
  );
}

/** Token rows with an amount (`weight` or `count`). */
function RowList({ title, rows, amountKey, amountLabel, defaultAmount, tokens, note, empty, onChange }) {
  const patch = (i, p) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</span>
        <button
          onClick={() => onChange([...rows, { typeId: '', [amountKey]: defaultAmount }])}
          className="btn-ghost flex items-center gap-1 text-[11px]"
          style={{ padding: '2px 8px' }}
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {rows.length === 0 && <p className="text-[11px] text-gray-600">{empty}</p>}
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border p-2" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <TokenSelect value={row.typeId} tokens={tokens} onChange={(typeId) => patch(i, { typeId })} />
          <label className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider text-gray-600">{amountLabel}</span>
            <input
              type="number"
              min={0}
              value={row[amountKey] ?? defaultAmount}
              onChange={(e) => patch(i, { [amountKey]: Math.max(0, num(e.target.value)) })}
              className="w-16"
              style={{ fontSize: 11, padding: '3px 6px' }}
            />
          </label>
          {note && <span className="text-[10px] font-mono w-10 text-right text-gray-500">{note(row)}</span>}
          <RemoveButton onClick={() => onChange(rows.filter((_, idx) => idx !== i))} />
        </div>
      ))}
    </div>
  );
}

/** A Modifier's effects: what it adds to, or changes in, the Base Maps beside it. */
function EffectsSection({ effects, tokens, onChange }) {
  const patch = (i, p) => onChange(effects.map((e, idx) => (idx === i ? { ...e, ...p } : e)));
  return (
    <Section title="Effects" icon={<Sparkles size={14} />}>
      {effects.length === 0 && (
        <p className="text-[11px] text-gray-600">No effects: a Modifier with none changes nothing.</p>
      )}
      {effects.map((effect, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-3" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
              {EFFECT_LABEL[effect?.kind] || `Unknown effect (${effect?.kind})`}
            </span>
            <RemoveButton onClick={() => onChange(effects.filter((_, idx) => idx !== i))} />
          </div>
          <EffectFields effect={effect} tokens={tokens} onChange={(p) => patch(i, p)} />
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {EFFECTS.map((e) => (
          <button
            key={e.kind}
            onClick={() => onChange([...effects, e.make()])}
            className="btn-ghost flex items-center gap-1 text-[11px]"
            style={{ padding: '3px 8px' }}
          >
            <Plus size={12} /> {e.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function EffectFields({ effect, tokens, onChange }) {
  switch (effect?.kind) {
    case MODIFIER_EFFECT_KINDS.DENSITY:
      return (
        <div className="flex items-center gap-2">
          <TokenSelect value={effect.typeId} tokens={tokens} onChange={(typeId) => onChange({ typeId })} />
          <Amount label="+ points" value={effect.points ?? 0} onChange={(points) => onChange({ points })} />
        </div>
      );
    case MODIFIER_EFFECT_KINDS.REPLACE:
      return (
        <div className="flex items-center gap-2">
          <TokenSelect value={effect.from} tokens={tokens} onChange={(from) => onChange({ from })} />
          <span className="text-xs text-gray-500">becomes</span>
          <TokenSelect value={effect.to} tokens={tokens} onChange={(to) => onChange({ to })} />
          <Amount
            label="%"
            value={Math.round((effect.share ?? 1) * 100)}
            onChange={(pct) => onChange({ share: Math.min(1, Math.max(0, pct / 100)) })}
          />
        </div>
      );
    case MODIFIER_EFFECT_KINDS.THREAT:
    case MODIFIER_EFFECT_KINDS.TREASURE:
      return (
        <div className="flex items-center gap-2">
          <TokenSelect value={effect.typeId} tokens={tokens} onChange={(typeId) => onChange({ typeId })} />
          <Amount label="count" value={effect.count ?? 1} onChange={(count) => onChange({ count: Math.max(1, Math.round(count)) })} />
        </div>
      );
    default:
      return <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>The game does not read this kind of effect.</p>;
  }
}

function Amount({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-1 shrink-0">
      <span className="text-[9px] uppercase tracking-wider text-gray-600">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, num(e.target.value)))}
        className="w-16"
        style={{ fontSize: 11, padding: '3px 6px' }}
      />
    </label>
  );
}

/** Pick one Token by name. A reference to a Token that no longer exists stays visible, marked missing. */
function TokenSelect({ value, tokens, onChange }) {
  const sorted = Object.values(tokens || {}).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const missing = value && !tokens[value];
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 min-w-0"
      style={{ fontSize: 12, color: missing ? 'var(--color-error)' : undefined }}
    >
      <option value="">— choose a Token —</option>
      {missing && <option value={value}>{value} — missing</option>}
      {sorted.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}

function RemoveButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-gray-600 hover:text-red-400"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
      title="Remove"
    >
      <X size={12} />
    </button>
  );
}
