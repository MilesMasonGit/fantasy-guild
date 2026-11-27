import { useState } from 'react';
import { Settings2, Shield, HelpCircle, Lock, Sparkles } from 'lucide-react';
import { useEntityStore } from '../../stores/useEntityStore';
import {
  EQUIP_CATEGORIES, TOOL_KINDS, HAND_CATEGORY, tierValue, SKILLS, COMBAT_SKILL_IDS, weaponStyleOf, authoredWeaponStyles, ATTACK_SPEED_MS, DEFAULT_ATTACK_SPEED, weaponMoteOf,
  expandBearer, statementsOf, doseKindsOf, isDrinkLike, ONE_DRINK_WHY, DOSE_WHY, noDoseWhy, isSpentCategory,
  DAMAGE_TYPES, DAMAGE_GROUPS, DEFAULT_DAMAGE_TYPE_BY_STYLE, DEFAULT_ARROW_DAMAGE_TYPE, damageTypeLabel, isConsumableCategory,
  isWornGear, BREAK_CHANCE_MAX, catchItemIds, coinWorthOf,
} from '../../utils/constants';
import { Header, Section, Field, Empty, DerivedMark } from '../shared/EditorLayout';
import SpritePickerModal from './SpritePickerModal';
import Statements from './Statements';
import ChainInspector from '../shared/ChainInspector';
import GearLevelField from './GearLevelField';
import GearDefenceFields from './GearDefenceFields';
import FishingItemFields from './FishingItemFields';
import UseBlock from './UseBlock';
import PlanFields from '../shared/PlanFields';
import { coinWorthFromValue, isCoinWorthPinned } from '../../engine/ledger/coins.js';
import { resolveSpritePath } from '../../../../src/utils/AssetManager.js';

/** The Item editor: simplified field set. Value is derived by the balance engine and cannot be typed; inputs and recipes match on exact item IDs, so there are no tags. */

// Only food heals; drinks and potions are buffs.
const RESTORING_CATEGORIES = new Set(['food']);

/** A weapon's own fields, cleared when the item stops being one (out of the hands, or made a tool). */
const WEAPON_CLEARED = { styles: undefined, damage: undefined, damageType: undefined, speed: undefined, tier: undefined, levelRequired: undefined, mote: undefined, thrown: undefined };

/** The nine damage types as dropdown options, grouped under Physical, Elemental and Special. */
function DamageTypeOptions() {
  return DAMAGE_GROUPS.map((g) => (
    <optgroup key={g.id} label={g.label}>
      {DAMAGE_TYPES.filter((t) => t.group === g.id).map((t) => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </optgroup>
  ));
}

const styleName = (id) => SKILLS.find((s) => s.id === id)?.name || id;
const SPEED_WORDS = { fast: 'Fast', normal: 'Normal', slow: 'Slow' };

/**
 * A weapon: the one style it fights in (any hero may hold it; kills train that style), how hard it
 * hits and how often. The style is written as a one-entry `styles` list; an older item naming two
 * (the Dagger was Melee and Stealth) fights in the first until one is picked here, and an older
 * single `skillRequired` style is folded in on the first pick. `speed` is written only when it is
 * not Normal. `tier` (1 copper, 2 iron, and so on) is written only when typed. `damageType` is
 * written only when picked; blank hits with its style's default. A Magic weapon names the Mote it
 * burns (`mote`, a Consumable's id; blank casts free), a Stealth one may be thrown (`thrown: true`,
 * a Kunai that spends itself); either is cleared when the style changes.
 */
function WeaponFields({ item, items, onChange }) {
  const style = weaponStyleOf(item);
  const authored = authoredWeaponStyles(item);
  const pickStyle = (id) => {
    onChange({
      type: 'weapon',
      styles: [id],
      // The style lives in `styles` now; an older item's one-style field would only shadow it.
      ...(COMBAT_SKILL_IDS.includes(item.skillRequired) ? { skillRequired: undefined } : {}),
      // What a weapon spends belongs to its style: a Mote to Magic, a throw to Stealth.
      ...(id !== 'magic' ? { mote: undefined } : {}),
      ...(id !== 'stealth' ? { thrown: undefined } : {}),
    });
  };
  const motes = Object.values(items || {})
    .filter((i) => i?.id && isConsumableCategory(i.equipSlot))
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  const speed = ATTACK_SPEED_MS[item.speed] ? item.speed : DEFAULT_ATTACK_SPEED;

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
          {COMBAT_SKILL_IDS.map((id) => (
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

      <Field label="Damage type" className="col-span-1">
        <select
          aria-label="Damage type"
          data-field="weapon-damage-type"
          value={item.damageType || ''}
          onChange={(e) => onChange({ type: 'weapon', damageType: e.target.value || undefined })}
          className="w-full"
        >
          <option value="">{styleName(style)}'s default ({damageTypeLabel(DEFAULT_DAMAGE_TYPE_BY_STYLE[style])})</option>
          <DamageTypeOptions />
        </select>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          Every hit is this type: enemies resist or are weak to it. A bow's shot adds its arrow's type too.
        </p>
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
          What every hit does before the level step, the matchup and the enemy's resistances. Blank hits like a fist (1).
          The tier table (damage by metal and speed, the level by tier) is the content guide's: CONTENT_PHILOSOPHY, Weapon tiers.
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

      <Field label="Attacks every" className="col-span-1">
        <select
          aria-label="Attacks every"
          data-field="weapon-speed"
          value={speed}
          onChange={(e) => onChange({ type: 'weapon', speed: e.target.value === DEFAULT_ATTACK_SPEED ? undefined : e.target.value })}
          className="w-full"
        >
          {Object.entries(ATTACK_SPEED_MS).map(([id, ms]) => (
            <option key={id} value={id}>{ms / 1000} s ({SPEED_WORDS[id] || id})</option>
          ))}
        </select>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          A fast weapon hits about 2/3 as hard as a normal one, a slow one about 4/3.
        </p>
      </Field>

      {style === 'magic' && (
        <Field label="Mote it burns" className="col-span-2">
          <select
            aria-label="Mote it burns"
            data-field="weapon-mote"
            value={weaponMoteOf(item) || ''}
            onChange={(e) => onChange({ type: 'weapon', mote: e.target.value || undefined })}
            className="w-full"
          >
            <option value="">None: casts free</option>
            {weaponMoteOf(item) && !items?.[weaponMoteOf(item)] && <option value={weaponMoteOf(item)}>{weaponMoteOf(item)} (no such item)</option>}
            {motes.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.id}</option>
            ))}
          </select>
          <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
            Every cast spends one, hit or miss, carried in a Consumable slot and drawn from the Bank like arrows. With none, the hero casts at half damage and says Needs (the Mote). None picked: casts free at full damage (the content check names it).
          </p>
        </Field>
      )}

      {style === 'stealth' && (
        <label className="col-span-2 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            aria-label="Thrown"
            data-field="weapon-thrown"
            checked={item.thrown === true}
            onChange={(e) => onChange({ type: 'weapon', thrown: e.target.checked ? true : undefined })}
            className="rounded border-white/10 text-emerald-500 cursor-pointer"
          />
          <span className="text-xs text-gray-300">Thrown (a Kunai): the one in hand is kept, each throw spends another from the Bank; with none there, it throws the one in hand at half damage</span>
        </label>
      )}
    </div>
  );
}

/**
 * An arrow: a Consumable a hero with a Ranged weapon carries, one spent per shot, adding its own
 * damage in its own type to the bow's. Written `arrow: { damage, damageType }`; unticked removes it.
 */
function ArrowFields({ item, onChange }) {
  const arrow = item.arrow && typeof item.arrow === 'object' ? item.arrow : null;
  const set = (patch) => onChange({ arrow: { damage: arrow?.damage ?? 1, damageType: arrow?.damageType ?? DEFAULT_ARROW_DAMAGE_TYPE, ...patch } });
  return (
    <div className="col-span-2 grid grid-cols-2 gap-4" data-field="arrow-block">
      <label className="col-span-2 flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          aria-label="Arrow"
          data-field="arrow"
          checked={!!arrow}
          onChange={(e) => onChange({ arrow: e.target.checked ? { damage: 1, damageType: DEFAULT_ARROW_DAMAGE_TYPE } : undefined })}
          className="rounded border-white/10 text-emerald-500 cursor-pointer"
        />
        <span className="text-xs text-gray-300">Arrow: a hero with a bow carries it and shoots one a shot</span>
      </label>
      {arrow && (
        <>
          <Field label="Arrow damage" className="col-span-1">
            <input
              type="number"
              min={1}
              aria-label="Arrow damage"
              data-field="arrow-damage"
              value={arrow.damage ?? ''}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value));
                set({ damage: n >= 1 ? n : 1 });
              }}
              className="w-full"
            />
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              Added to the bow's damage on every shot. Bow and arrow each about half a comparable weapon.
            </p>
          </Field>
          <Field label="Arrow damage type" className="col-span-1">
            <select
              aria-label="Arrow damage type"
              data-field="arrow-damage-type"
              value={arrow.damageType || DEFAULT_ARROW_DAMAGE_TYPE}
              onChange={(e) => set({ damageType: e.target.value })}
              className="w-full"
            >
              <DamageTypeOptions />
            </select>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              Usually Stab: a ghost immune to Stab still takes the bow's part.
            </p>
          </Field>
        </>
      )}
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
  const statements = statementsOf(expandBearer(item, effects || {}));
  const kinds = doseKindsOf(item.equipSlot, statements);
  return (
    <div className="col-span-2 space-y-1" data-field="dose">
      {kinds.length
        ? kinds.map((kind) => (
          <p key={kind} data-dose={kind} className="text-[11px] leading-relaxed" style={{ color: 'var(--color-accent-hover)' }}>
            {DOSE_WHY[kind]}
          </p>
        ))
        : <p data-dose="none" className="text-[10px] text-gray-500 leading-relaxed">{noDoseWhy(item.equipSlot)}</p>}
      {isDrinkLike(item.equipSlot, statements) && (
        <p data-dose="one-drink" className="text-[11px] leading-relaxed" style={{ color: 'var(--color-accent-hover)' }}>
          {ONE_DRINK_WHY}
        </p>
      )}
    </div>
  );
}

/**
 * A tool's or weapon's chance to break, as a percent, written as `breakChance` only when above 0
 * (`itemBreak.js`): a tool at the end of each work cycle it is used for, a weapon at each kill.
 * Blank never breaks. The words typed are kept while typing ("0." on the way to 0.5).
 */
function BreakChanceField({ item, isTool, onChange }) {
  const [draft, setDraft] = useState(item.breakChance == null ? '' : String(item.breakChance));
  const write = (text) => {
    setDraft(text);
    const n = Number(text);
    onChange({ breakChance: text.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.min(BREAK_CHANCE_MAX, n) : undefined });
  };
  return (
    <Field label="Break chance %" className="col-span-1">
      <input
        type="number"
        min={0}
        max={BREAK_CHANCE_MAX}
        step="0.1"
        aria-label="Break chance"
        data-field="break-chance"
        value={draft}
        placeholder="Never breaks"
        onChange={(e) => write(e.target.value)}
        className="w-full"
      />
      <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
        {isTool
          ? 'Checked as each work cycle it is used for ends: it breaks and is gone, and its hero stops.'
          : 'Checked at each kill made with it: it breaks and is gone, and its hero stops.'}
        {' '}Blank never breaks.
      </p>
    </Field>
  );
}

/**
 * What one copy sells for from the Bank, `coinWorth` (`itemCoins.js`). Recalculate writes it from
 * the item's value once the content uses coins (`engine/ledger/coins.js`); a whole number of 0 or more typed here is written and
 * pinned (`sim.coinWorthPinned`), so Recalculate keeps it, and unticking the pin derives it again.
 * Blank, or a number that is not one, writes nothing and drops the pin. The words typed are kept while typing.
 */
function CoinWorthField({ item, onChange }) {
  const [draft, setDraft] = useState(item.coinWorth == null ? '' : String(item.coinWorth));
  const pinned = isCoinWorthPinned(item);
  const sim = (pin) => {
    const next = { ...(item.sim || {}) };
    if (pin) next.coinWorthPinned = true;
    else delete next.coinWorthPinned;
    return Object.keys(next).length ? next : undefined;
  };
  const write = (text) => {
    setDraft(text);
    const n = Number(text);
    const ok = text.trim() !== '' && Number.isInteger(n) && n >= 0;
    onChange({ coinWorth: ok ? n : undefined, sim: sim(ok) });
  };
  const worth = coinWorthOf(item);
  const fromValue = coinWorthFromValue(item.value);
  return (
    <Field label="Coin worth" className="col-span-1" derived={!pinned}>
      <input
        type="number"
        min={0}
        step="1"
        aria-label="Coin worth"
        data-field="coin-worth"
        value={draft}
        placeholder="0"
        onChange={(e) => write(e.target.value)}
        className="w-full"
      />
      <label className="flex items-start gap-1.5 mt-1.5 cursor-pointer select-none" data-coin-pin={pinned ? 'on' : 'off'}>
        <input
          type="checkbox"
          aria-label="Pin this coin worth"
          checked={pinned}
          onChange={(e) => onChange({ sim: sim(e.target.checked) })}
          className="rounded border-white/10 cursor-pointer mt-0.5"
        />
        <span className="text-[10px] leading-relaxed" style={{ color: pinned ? 'var(--color-accent-hover)' : 'var(--color-text-muted)' }}>
          {pinned ? 'Pinned' : 'Pin this number'}
        </span>
      </label>
      <p data-field="coin-worth-line" className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
        One sells for {worth} {worth === 1 ? 'coin' : 'coins'} from the Bank.{' '}
        {pinned
          ? 'Pinned: Recalculate keeps it. Untick to take it from the value again.'
          : fromValue === null
            ? 'Nothing prices it yet, so Recalculate writes none (it sells for 0) unless a number is pinned.'
            : `From its value (${fromValue}) at each Recalculate, once anything in the game asks or drops coins; a number typed here is pinned.`}
      </p>
    </Field>
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
  const items = useEntityStore((s) => s.items);
  const tokens = useEntityStore((s) => s.tokens);
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
      restoreAmount: RESTORING_CATEGORIES.has(slot) ? (item.restoreAmount || 0) : 0,
      // Tools, weapons and off-hand items are held in the hands; out of them, none of these means anything.
      ...(slot === HAND_CATEGORY ? {} : { tool: undefined, hands: undefined, offHand: undefined, breakChance: undefined, ...WEAPON_CLEARED }),
      // Only worn gear lends resistances or cuts a style's damage.
      ...(isWornGear({ equipSlot: slot }) ? {} : { resistances: undefined, damageCut: undefined }),
      // Only a Consumable is shot from a bow.
      ...(isConsumableCategory(slot) ? {} : { arrow: undefined }),
      // A level requirement's style is the weapon's or the armour's own: a new category starts without one.
      ...(slot === item.equipSlot ? {} : { levelRequired: undefined, skillRequired: undefined }),
    });
  };

  // `tool: { kind, tier, starter? }`, written whole; no kind clears it. `starter` is written only when ticked.
  const setTool = (patch) => {
    if (patch === null) return updateItem(activeId, { tool: undefined });
    const next = {
      kind: item.tool?.kind, tier: tierValue(item.tool?.tier), ...(item.tool?.starter ? { starter: true } : {}),
      ...(item.tool?.baitSaving > 0 ? { baitSaving: item.tool.baitSaving } : {}), ...patch,
    };
    if (!next.starter) delete next.starter;
    if (!(next.baitSaving > 0)) delete next.baitSaving;
    updateItem(activeId, { tool: next, hands: undefined, offHand: undefined, ...WEAPON_CLEARED });
  };
  const isHand = item.equipSlot === HAND_CATEGORY;
  const isTool = isHand && !!item.tool?.kind;
  const isOffHandItem = isHand && !isTool && item.offHand === true;
  // An off-hand item is never swung: it drops the weapon's numbers and takes one hand.
  const setHeldAs = (kind) => updateItem(activeId, kind === 'offhand'
    ? { offHand: true, type: 'armor', hands: undefined, breakChance: undefined, ...WEAPON_CLEARED }
    : { offHand: undefined, type: 'weapon' });

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
            <Field label="Held as" className="col-span-1">
              <select
                aria-label="Held as"
                data-field="held-as"
                value={isOffHandItem ? 'offhand' : 'weapon'}
                onChange={(e) => setHeldAs(e.target.value)}
                className="w-full"
              >
                <option value="weapon">A weapon (attacks with it)</option>
                <option value="offhand">An off-hand item (a shield, a quiver)</option>
              </select>
              <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                A hero fights with one weapon; beside it, one off-hand item lends its resistances and rules like armour. A second weapon lends nothing.
              </p>
            </Field>
          )}

          {isHand && !isTool && !isOffHandItem && (
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

          {isHand && !isTool && !isOffHandItem && (
            <WeaponFields item={item} items={items} onChange={(patch) => updateItem(activeId, patch)} />
          )}

          {isWornGear(item) && (
            <GearDefenceFields item={item} onChange={(patch) => updateItem(activeId, patch)} />
          )}

          <GearLevelField item={item} onChange={(patch) => updateItem(activeId, patch)} />

          <FishingItemFields item={item} items={items} landed={Object.values(tokens || {}).some((t) => catchItemIds(t).includes(item.id))} onTool={setTool} onChange={(patch) => updateItem(activeId, patch)} />

          {isHand && !isOffHandItem && (
            <BreakChanceField key={item.id} item={item} isTool={isTool} onChange={(patch) => updateItem(activeId, patch)} />
          )}

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

          {isConsumableCategory(item.equipSlot) && (
            <ArrowFields item={item} onChange={(patch) => updateItem(activeId, patch)} />
          )}

          <DoseLine item={item} effects={effects} />
        </div>
      </Section>

      <Section title="Rules" icon={<Sparkles size={14} />}>
        <Statements item={item} />
      </Section>

      <UseBlock item={item} onPatch={(patch) => updateItem(activeId, patch)} />

      <Section title="Value" icon={<Lock size={14} />}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <CoinWorthField key={item.id} item={item} onChange={(patch) => updateItem(activeId, patch)} />
        </div>
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

      <PlanFields record={item} onChange={(plan) => update('plan', plan)} />

      <SpritePickerModal
        isOpen={isPickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(spriteId) => update('sprite', spriteId)}
      />
    </div>
  );
}
