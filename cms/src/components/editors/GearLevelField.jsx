import { SKILLS, ENEMY_STYLES, HAND_CATEGORY, isWeapon, weaponStyleOf } from '../../utils/constants';
import { Field } from '../shared/EditorLayout';

/** The worn categories besides the hands that may ask a level of their wearer. */
const ARMOUR_CATEGORIES = new Set(['hat', 'chest', 'trinket']);

/** Whether an item may carry a level requirement: a weapon, or armour and trinkets. */
function takesLevelRequirement(item) {
  if (!item) return false;
  if (item.equipSlot === HAND_CATEGORY) return isWeapon(item);
  return ARMOUR_CATEGORIES.has(item.equipSlot);
}

const styleName = (id) => SKILLS.find((s) => s.id === id)?.name || id;

/**
 * The level a weapon or a piece of armour asks of whoever wears it. A weapon's is in its own style
 * (`levelRequired` alone: "Iron Sword: Melee 15", and changing the style moves it); armour names the
 * style (`skillRequired`) beside the level. Blank means any hero may wear it.
 */
export default function GearLevelField({ item, onChange }) {
  if (!takesLevelRequirement(item)) return null;
  const weapon = isWeapon(item);
  const level = Number.isInteger(item.levelRequired) && item.levelRequired >= 1 ? item.levelRequired : '';
  const armourStyle = ENEMY_STYLES.includes(item.skillRequired) ? item.skillRequired : ENEMY_STYLES[0];
  const style = weapon ? weaponStyleOf(item) : armourStyle;

  const setLevel = (raw) => {
    const n = Math.floor(Number(raw));
    const next = raw !== '' && n >= 1 ? n : undefined;
    onChange(weapon
      ? { levelRequired: next }
      : { levelRequired: next, skillRequired: next ? armourStyle : undefined });
  };

  return (
    <div className="col-span-2 grid grid-cols-2 gap-4" data-gear-level>
      {!weapon && (
        <Field label="Required style" className="col-span-1">
          <select
            aria-label="Required style"
            data-field="gear-level-style"
            value={armourStyle}
            onChange={(e) => onChange({ skillRequired: e.target.value })}
            className="w-full"
          >
            {ENEMY_STYLES.map((id) => <option key={id} value={id}>{styleName(id)}</option>)}
          </select>
        </Field>
      )}
      <Field label="Level required" className="col-span-1">
        <input
          type="number"
          min={1}
          max={99}
          aria-label="Level required"
          data-field="gear-level"
          value={level}
          placeholder="any"
          onChange={(e) => setLevel(e.target.value)}
          className="w-full"
        />
        <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
          {weapon
            ? `In its own style: ${styleName(style)}${level ? ` ${level}` : ''}. A hero below it is refused ("Needs ${styleName(style)} ${level || 15}"). Blank: any hero.`
            : `The wearer's ${styleName(style)} level. A hero below it is refused ("Needs ${styleName(style)} ${level || 15}"). Blank: any hero.`}
        </p>
      </Field>
    </div>
  );
}
