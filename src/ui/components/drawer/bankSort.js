import { itemTypeLabel } from './ItemTip.jsx';
import { categoryOfItem, getCategoryInfo } from '../../../config/registries/equipmentConstants.js';

/**
 * The words the Bank's search box matches an item by: its name, its tags, its type as the
 * tooltip says it ("Weapon") and its raw type, and the loadout kind it is worn as ("Hand").
 */
export function bankSearchWords(item) {
    if (!item) return [];
    const category = categoryOfItem(item.id);
    return [
        item.name,
        ...(Array.isArray(item.tags) ? item.tags : []),
        itemTypeLabel(item),
        item.type,
        category ? getCategoryInfo(category).label : null
    ].filter(w => typeof w === 'string' && w);
}

/** Whether an item matches a search: any of its {@link bankSearchWords} contains the term. */
export function bankSearchMatches(item, term) {
    const needle = (term || '').trim().toLowerCase();
    if (!needle) return true;
    return bankSearchWords(item).some(w => w.toLowerCase().includes(needle));
}

/**
 * Bank order: by type (its label, A to Z), then by the item's own `tier` (low first; an item
 * without one after those of its type that have one), then by name.
 * @param {object} a an item template
 * @param {object} b an item template
 */
export function compareForBank(a, b) {
    const type = itemTypeLabel(a).localeCompare(itemTypeLabel(b));
    if (type) return type;
    const ta = Number.isFinite(a?.tier) ? a.tier : Infinity;
    const tb = Number.isFinite(b?.tier) ? b.tier : Infinity;
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (a?.name || a?.id || '').localeCompare(b?.name || b?.id || '');
}

/** Item ids in Bank order. `getItem`: id to template; an id it does not know goes last. */
export function sortForBank(itemIds, getItem) {
    return [...itemIds].sort((x, y) => {
        const a = getItem(x), b = getItem(y);
        if (!a || !b) return (a ? -1 : 0) + (b ? 1 : 0) || x.localeCompare(y);
        return compareForBank(a, b);
    });
}
