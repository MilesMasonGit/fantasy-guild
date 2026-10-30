import { useState } from 'react';
import { Settings2, Shield, HelpCircle, Lock, Sparkles } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import {
  EQUIP_CATEGORIES, TOOL_KINDS, HAND_CATEGORY, tierValue, SKILLS, ENEMY_STYLES, weaponStyleOf, authoredWeaponStyles, ATTACK_SPEED_MS, DEFAULT_ATTACK_SPEED, WEAPON_TIERS,
  expandBearer, statementsOf, doseKindsOf, DOSE_WHY, noDoseWhy, isSpentCategory,
} from '../../utils/constants';
import { Header, Section, Field, Empty, DerivedMark } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import Statements from './Statements';
import ChainInspector from '../shared/ChainInspector';
import GearLevelField from './GearLevelField';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

/** The Item editor: simplified field set. Value is derived by the balance engine and cannot be typed; inputs and recipes match on exact item IDs, so there are no tags. */

// Drinks never heal (they are work buffs), so they offer no restore amount.
const RESTORING_CATEGORIES = new Set(['food', 'consumable']);

/** A weapon's own fields, cleared when the item stops being one (out of the hands, or made a tool). */
const WEAPON_CLEARED = { styles: undefined, damage: undefined, speed: undefined, tier: undefined, levelRequired: undefined };

const styleName = (id) => SKILLS.find((s) => s.id === id)?.name || id;
const SPEED_WORDS = { fast: 'Fast', normal: 'Normal', slow: 'Slow' };

/**
 * A weapon: the one style it fights in (any hero may hold it; kills train that style), how hard it
 * hits and how often. The style is written as a one-entry `styles` list; an older item naming two
 * (the Dagger was Melee and Stealth) fights in the first until one is picked here, and an older
 * single `skillRequired` style is folded in on the first pick. `speed` is written only when it is
 * not Normal. `tier` (1 copper, 2 iron, and so on) is written only when typed.
 */
function WeaponFields({ item, onChange }) {
  const style = weaponStyleOf(item);
  const authored = authoredWeaponStyles(item);
  const pickStyle = (id) => {
    onChange({
      type: 'weapon',
      styles: [id],
      // The style lives in `styles` now; an older item's one-style field would only shadow it.
      ...(ENEMY_STYLES.includes(item.skillRequired) ? { skillRequired: undefined } : {}),
    });
  };
  const speed = ATTACK_SPEED_MS[item.speed] ? item.speed : DEFAULT_ATTACK_SPEED;
  const tierLine = WEAPON_TIERS.map((t) => `${t.tier} ${t.fast}/${t.normal}/${t.slow}`).join(', ');

  return (
    <div className="col-span-2 grid grid-cols-2 gap-4">
      <Field label="Weapon style" className="col-span-2">
        <select
          aria-label="Weapon style"
          data-field="weapon-style"
          value={style}
          onChange={(e) => pickStyle(e.target.value)}
          className="w-full"
        >
          {ENEMY_STYLES.map((id) => (
            <option key={id} value={id}>{styleName(id)}</option>
          ))}
        </select>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          The style any hero holding it fights in: its kills train that skill, and it decides the matchup.
          {authored.length === 0 && ' None written yet: it fights as Melee.'}
        </p>
        {authored.length > 1 && (
          <p data-field="weapon-style-many" className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--color-warning)' }}>
            Older content names {authored.map(styleName).join(' and ')}; a weapon has one, so it fights as {styleName(style)}. Pick its style to keep one.
          </p>
        )}
      </Field>

      <Field label="Damage" className="col-span-1">
        <input
          type="number"
          min={1}
          aria-label="Damage"
          data-field="weapon-damage"
          value={item.damage ?? ''}
          placeholder="1"
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value));
            onChange({ type: 'weapon', damage: n >= 1 ? n : undefined });
          }}
          className="w-full"
        />
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          What every hit does before the level step, the matchup and armour. Blank hits like a fist (1).
          Proposed tiers, fast/normal/slow: {tierLine}.
        </p>
      </Field>

      <Field label="Tier" className="col-span-1">
        <input
          type="number"
          min={1}
          aria-label="Weapon Tier"
          data-field="weapon-tier"
          value={item.tier ?? ''}
          placeholder="none"
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value));
            onChange({ type: 'weapon', tier: e.target.value !== '' && n >= 1 ? n : undefined });
          }}
          className="w-full"
        />
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          1 copper, 2 iron, and so on down the tiers beside Damage; blank means no tier.
        </p>
      </Field>

      <Field label="Speed" className="col-span-1">
        <select
          aria-label="Speed"
          data-field="weapon-speed"
          value={speed}
          onChange={(e) => onChange({ type: 'weapon', speed: e.target.value === DEFAULT_ATTACK_SPEED ? undefined : e.target.value })}
          className="w-full"
        >
          {Object.entries(ATTACK_SPEED_MS).map(([id, ms]) => (
            <option key={id} value={id}>{SPEED_WORDS[id] || id} ({ms / 1000} s)</option>
          ))}
        </select>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          A fast weapon hits about 2/3 as hard as a normal one, a slow one about 4/3.
        </p>
      </Field>
    </div>
  );
}

/**
 * How a food, drink or potion is used, read from its rules by the game's own rule: an elixir lasts
 * 10 fights, a drink 10 work cycles, a work potion one cycle of its skill. Shown for spent
 * categories only; gear is worn, not drunk.
 */
function DoseLine({ item, effects }) {
  if (!isSpentCategory(item.equipSlot)) return null;
  const kinds = doseKindsOf(item.equipSlot, statementsOf(expandBearer(item, effects || {})));
  return (
    <div className="col-span-2 space-y-1" data-field="dose">
      {kinds.length
        ? kinds.map((kind) => (
          <p key={kind} data-dose={kind} className="text-[11px] leading-relaxed" style={{ color: 'var(--color-accent-hover)' }}>
            {DOSE_WHY[kind]}
          </p>
        ))
        : <p data-dose="none" className="text-[10px] text-gray-500 leading-relaxed">{noDoseWhy(item.equipSlot)}</p>}
    </div>
  );
}

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
  const effects = useEntityStore((s) => s.effects);

  const [isPickerOpen, setPickerOpen] = useState(false);

  if (!item) return <Empty text="Select an item from the sidebar to edit" />;

  const update = (key, value) => updateItem(activeId, { [key]: value });

  const handleCategoryChange = (slot) => {
    updateItem(activeId, {
      equipSlot: slot,
      type: slotToType(slot),
      restoreAmount: RESTORING_CATEGORIES.has(slot) ? (item.restoreAmount || 5) : 0,
      // Tools and weapons are held in the hands; out of them, none of these means anything.
      ...(slot === HAND_CATEGORY ? {} : { tool: undefined, hands: undefined, ...WEAPON_CLEARED }),
      // A level requirement's style is the weapon's or the armour's own: a new category starts without one.
      ...(slot === item.equipSlot ? {} : { levelRequired: undefined, skillRequired: undefined }),
    });
  };

  // `tool: { kind, tier, starter? }`, written whole; no kind clears it. `starter` is written only when ticked.
  const setTool = (patch) => {
    if (patch === null) return updateItem(activeId, { tool: undefined });
    const next = { kind: item.tool?.kind, tier: tierValue(item.tool?.tier), ...(item.tool?.starter ? { starter: true } : {}), ...patch };
    if (!next.starter) delete next.starter;
    updateItem(activeId, { tool: next, hands: undefined, ...WEAPON_CLEARED });
  };
  const isHand = item.equipSlot === HAND_CATEGORY;
  const isTool = isHand && !!item.tool?.kind;

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

          {isHand && (
            <Field label="Tool" className="col-span-1">
              <select
                aria-label="Tool"
                data-field="tool-kind"
                value={item.tool?.kind || ''}
                onChange={(e) => setTool(e.target.value ? { kind: e.target.value } : null)}
                className="w-full"
              >
                <option value="">Not a tool (a weapon, or anything else held)</option>
                {TOOL_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                A hero holding it may work Tokens that need this kind of tool. A tool takes one hand.
              </p>
            </Field>
          )}

          {isTool && (
            <Field label="Tool Tier" className="col-span-1">
              <input
                type="number"
                min={1}
                aria-label="Tool Tier"
                data-field="tool-tier"
                value={tierValue(item.tool?.tier)}
                onChange={(e) => setTool({ tier: tierValue(Number(e.target.value)) })}
                className="w-full"
              />
              <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                Works every Token that needs this tier or lower (a Token's Needs tool). The player never sees the number.
              </p>
            </Field>
          )}

          {isHand && !isTool && (
            <Field label="Hands" className="col-span-1">
              <select
                aria-label="Hands"
                data-field="hands"
                value={item.hands === 2 ? 2 : 1}
                onChange={(e) => update('hands', Number(e.target.value) === 2 ? 2 : undefined)}
                className="w-full"
              >
                <option value={1}>One hand</option>
                <option value={2}>Two hands</option>
              </select>
              <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                A hero has two hands. A two-handed weapon leaves no hand for a tool.
              </p>
            </Field>
          )}

          {isHand && !isTool && (
            <WeaponFields item={item} onChange={(patch) => updateItem(activeId, patch)} />
          )}

          <GearLevelField item={item} onChange={(patch) => updateItem(activeId, patch)} />

          {isTool && (
            <label className="col-span-2 flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                aria-label="Starter tool"
                data-field="tool-starter"
                checked={item.tool?.starter === true}
                onChange={(e) => setTool({ starter: e.target.checked })}
                className="rounded border-white/10 text-emerald-500 cursor-pointer"
              />
              <span className="text-xs text-gray-300">Starter tool: a new game's Bank holds one</span>
            </label>
          )}

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

          <DoseLine item={item} effects={effects} />
        </div>
      </Section>

      <Section title="Rules" icon={<Sparkles size={14} />}>
        <Statements item={item} />
      </Section>

      <Section title="Value" icon={<Lock size={14} />}>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5 text-gray-500">
              <span>Derived Value</span>
              <DerivedMark />
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
          Worked out by the simulator from whatever produces this — so it cannot be
          typed. An item nothing produces stays blank, and Recalculate raises it as a
          Critical.
        </p>

        <div className="mt-4">
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1.5 text-gray-500">
            Where this value comes from
          </span>
          <ChainInspector itemId={item.id} />
        </div>
      </Section>

      <SpritePickerModal
        isOpen={isPickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(spriteId) => update('sprite', spriteId)}
      />
    </div>
  );
}
