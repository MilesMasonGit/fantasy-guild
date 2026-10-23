import { ITEM_TYPES } from '../../../config/registries/itemRegistry.js';

/**
 * Which tile surface an item type wears (the `--color-item-tint-*` shades in `tailwind.css`).
 * Read from the item's own `type` field, as authored in the CMS. Gear shares the tools' steel,
 * maps and modifiers share parchment; any type not named here gets the plain default.
 */
const TINT_OF_TYPE = Object.freeze({
    [ITEM_TYPES.MATERIAL]: 'material',
    [ITEM_TYPES.INGREDIENT]: 'material',
    [ITEM_TYPES.DROP]: 'material',
    [ITEM_TYPES.TOOL]: 'tool',
    [ITEM_TYPES.WEAPON]: 'tool',
    [ITEM_TYPES.ARMOR]: 'tool',
    [ITEM_TYPES.FOOD]: 'food',
    [ITEM_TYPES.DRINK]: 'drink',
    [ITEM_TYPES.POTION]: 'potion',
    [ITEM_TYPES.MAP]: 'map',
    [ITEM_TYPES.MODIFIER]: 'map'
});

/** The tint name for an item (`material`, `tool`, … or `default`). */
export function itemTintName(item) {
    return TINT_OF_TYPE[item?.type] || 'default';
}

/** A style object that sets an item tile's surface; pair it with the `ui-item-tile` class. */
export function itemTintStyle(item) {
    return { '--item-tint': `var(--color-item-tint-${itemTintName(item)})` };
}
