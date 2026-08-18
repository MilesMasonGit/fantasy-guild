import { useState } from 'react';
import { Settings2, Shield, HelpCircle, Lock } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import { EQUIP_CATEGORIES } from '../../utils/constants';
import { Header, Section, Field, Empty, IdSyncField } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

/**
 * The Item editor — simplified field set.
 *
 * ## What is deliberately absent
 * **Any way to type a value.** Value is derived by the balance engine (CMS-86).
 * **Tags.** Item inputs and recipes match on exact item IDs (CMS-43/91).
 * **Stacks in Bank toggle.** All items inherently stack in the Bank.
 * **Redundant Restore Types/Regen.** Food and Drink consumables restore a flat HP amount.
 */

/** Category kinds that restore HP when consumed. */
const RESTORING_CATEGORIES = new Set(['food', 'drink', 'consumable']);

/** Maps equipSlot to standard item type for game registry compatibility */
function slotToType(slot) {
  if (!slot) return 'material';
  if (slot === 'hand') return 'tool';
  if (slot === 'hat' || slot === 'chest' || slot === 'trinket') return 'armor';
  if (slot === 'food') return 'food';
  if (slot === 'drink') return 'drink';
  if (slot === 'consumable') return 'potion';
  return 'material';
}

export default function ItemEditor() {
  const activeId = useEntityStore((s) => s.activeEntityId);
  const item = useEntityStore((s) => s.items[activeId]);
  const updateItem = useEntityStore((s) => s.updateItem);
  const deleteItem = useEntityStore((s) => s.deleteItem);

  const [isPickerOpen, setPickerOpen] = useState(false);

  if (!item) return <Empty text="Select an item from the sidebar to edit" />;

  const update = (key, value) => updateItem(activeId, { [key]: value });

  const handleCategoryChange = (slot) => {
    updateItem(activeId, {
      equipSlot: slot,
      type: slotToType(slot),
      restoreAmount: RESTORING_CATEGORIES.has(slot) ? (item.restoreAmount || 5) : 0,
    });
  };

  const isRestoring = RESTORING_CATEGORIES.has(item.equipSlot);
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

      <Section title="Classification & Equipment" icon={<Shield size={14} />}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Equip Category" className={isRestoring ? 'col-span-1' : 'col-span-2'}>
            <select
              value={item.equipSlot || ''}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full"
            >
              <option value="">Not Equippable (Material / Ingredient / Drop)</option>
              {EQUIP_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label} {c.cap === Infinity ? '(uncapped)' : `(max ${c.cap})`}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              Equip slot and loadout category on the hero's grid.
            </p>
          </Field>

          {isRestoring && (
            <Field label="HP Restore Amount" className="col-span-1">
              <input
                type="number"
                min={0}
                value={item.restoreAmount ?? 0}
                onChange={(e) => update('restoreAmount', Math.max(0, Number(e.target.value)))}
                className="w-full"
              />
              <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                Flat HP restored when consumed by a hero.
              </p>
            </Field>
          )}
        </div>
      </Section>

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
          blank and will be raised as a Critical row once the balance engine runs.
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
