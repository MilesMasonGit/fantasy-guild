import { useMemo, useState } from 'react';
import { Settings2, Tag as TagIcon, HelpCircle, X, Plus, Coffee, Lock } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { ITEM_TYPES, EQUIP_CATEGORIES, RESTORE_TYPES } from '../../utils/constants';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

/**
 * The Item editor — CMS-13's field set (Phase 1).
 *
 * ## What is deliberately absent
 * **Any way to type a value.** The old editor had `trueCost`/`sellPrice`
 * inputs, an `isRoot` "anchor this item" checkbox, and a `valueScale`
 * multiplier. CMS-78 removed the starting-value prompt, CMS-44 made root values
 * derive from Map economics rather than being hand-set, and **CMS-86 removed
 * manual entry entirely** — an item with no derivation chain is a Critical
 * audit row, not a number you type. The value shown here is read-only output
 * from the balance engine (Phase 8), blank until then.
 *
 * **`assignedEffect`.** The old Effects table (56 placeholder entries) was
 * retired outright by CMS-36; the replacement is the Token effect-block system
 * (Phase 5), which lives on Tokens, not Items.
 *
 * **A fixed tag vocabulary.** See CMS-91 — tags carry no mechanical meaning in
 * the Token economy, so there is no game-side list to read and hardcoding one
 * in the CMS is what CMS-5 forbids. Tags are free-form, with autocomplete over
 * whatever is already in use.
 */

/** Types whose items restore something when consumed. */
const CONSUMABLE_TYPES = new Set(['food', 'drink', 'potion']);
/** Types that occupy an equipment slot. */
const EQUIPPABLE_TYPES = new Set(['tool', 'weapon', 'armor']);

export default function ItemEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const item = useEntityStore((s) => s.items[activeId]);
  const items = useEntityStore((s) => s.items);
  const updateItem = useEntityStore((s) => s.updateItem);
  const deleteItem = useEntityStore((s) => s.deleteItem);

  const [isPickerOpen, setPickerOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

  // Every tag already in use anywhere, so authoring a second "food" item offers
  // the existing spelling rather than inviting "Food" alongside it.
  const knownTags = useMemo(() => {
    const all = new Set();
    for (const other of Object.values(items)) {
      for (const tag of other.tags || []) all.add(tag);
    }
    return [...all].sort();
  }, [items]);

  if (!item) return <Empty text="Select an item from the sidebar to edit" />;

  const update = (key, value) => updateItem(activeId, { [key]: value });

  const tags = item.tags || [];
  const isConsumable = CONSUMABLE_TYPES.has(item.type);
  const isEquippable = EQUIPPABLE_TYPES.has(item.type);

  const addTag = (raw) => {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) {
      setTagDraft('');
      return;
    }
    update('tags', [...tags, tag]);
    setTagDraft('');
  };

  const suggestions = tagDraft
    ? knownTags.filter((t) => t.toLowerCase().includes(tagDraft.toLowerCase()) && !tags.includes(t)).slice(0, 6)
    : [];

  const spritePath = item.sprite ? resolveSpritePath(item.sprite) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <Header
        name={item.name}
        id={item.id}
        sprite={item.sprite}
        onDelete={() => deleteItem(activeId)}
      />

      <Section title="Identity" icon={<Settings2 size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name" className="col-span-2">
            <input
              type="text"
              value={item.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full"
            />
          </Field>

          <div className="col-span-2 grid grid-cols-2 gap-4">
            <IdSyncField entity={item} entityType="item" onUpdate={update} />
          </div>

          <Field label="Description" className="col-span-2">
            <textarea
              value={item.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
              className="w-full resize-y"
              placeholder="Flavour text shown in the Bank."
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
                value={item.sprite || ''}
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select value={item.type} onChange={(e) => update('type', e.target.value)} className="w-full">
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field label="Stackable">
            <label className="flex items-center gap-2.5 h-[38px] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={item.stackable ?? true}
                onChange={(e) => update('stackable', e.target.checked)}
                className="rounded border-white/10 text-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-gray-400">Stacks in the Bank</span>
            </label>
          </Field>

          <Field label="Tags" className="col-span-2">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.length === 0 && <span className="text-xs text-gray-600">No tags.</span>}
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-gray-300"
                >
                  {t}
                  <button
                    onClick={() => update('tags', tags.filter((x) => x !== t))}
                    className="text-gray-500 hover:text-red-400"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
                    title={`Remove ${t}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>

            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addTag(tagDraft); }
                  }}
                  placeholder="Add a tag and press Enter"
                  className="flex-1"
                  style={{ fontSize: 12 }}
                />
                <button onClick={() => addTag(tagDraft)} className="btn-ghost flex items-center gap-1" style={{ padding: '4px 10px' }}>
                  <Plus size={13} />
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {suggestions.map((t) => (
                    <button
                      key={t}
                      onClick={() => addTag(t)}
                      className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
              Free-form and organisational only. Tokens resolve inputs by exact item,
              and crafting gates on Token context — neither reads these (CMS-91).
            </p>
          </Field>
        </div>
      </Section>

      {/* Conditional fields — shown only when the type warrants them (CMS-13),
          rather than a permanent wall of mostly-empty inputs. */}
      {isConsumable && (
        <Section title="Consumable" icon={<Coffee size={14} />}>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Restore Type">
              <select
                value={item.restoreType || ''}
                onChange={(e) => update('restoreType', e.target.value)}
                className="w-full"
              >
                <option value="">None</option>
                {RESTORE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Restore Amount">
              <input
                type="number"
                value={item.restoreAmount ?? 0}
                onChange={(e) => update('restoreAmount', Number(e.target.value))}
                className="w-full"
              />
            </Field>
            <Field label="Regen (per tick)">
              <input
                type="number"
                value={item.regen ?? 0}
                onChange={(e) => update('regen', Number(e.target.value))}
                className="w-full"
              />
            </Field>
          </div>
        </Section>
      )}

      {(isEquippable || isConsumable) && (
        <Section title="Equipment" icon={<Settings2 size={14} />}>
          <Field label="Equip Category">
            <select
              value={item.equipSlot || ''}
              onChange={(e) => update('equipSlot', e.target.value)}
              className="w-full"
            >
              <option value="">Not equippable</option>
              {EQUIP_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label} {c.cap === Infinity ? '(uncapped)' : `(max ${c.cap})`}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              Which kind of slot this occupies on the hero's grid — not a grid
              position. The cap is how many of this category one hero may carry.
            </p>
          </Field>
        </Section>
      )}

      <Section title="Value" icon={<Lock size={14} />}>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
              Derived Value
            </span>
            <div
              className="w-full px-3 py-2 rounded-lg font-mono text-sm"
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.05)',
                color: item.value == null ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
              }}
            >
              {item.value == null ? 'not yet derived' : `${item.value} g`}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Values are computed from Map price down through the production chain and
          cannot be typed (CMS-86). An item nothing produces and no Map yields stays
          blank and will be raised as a Critical row once the balance engine lands.
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
