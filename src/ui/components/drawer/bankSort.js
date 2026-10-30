import { itemTypeLabel } from './ItemTip.jsx';
import { toolOf } from '../../../config/registries/toolKinds.js';
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

const wordsOf = (text) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Whether an item matches a search: the words typed are, in order, the starts of words in one of
 * its {@link bankSearchWords} ("Ore" finds "Iron Ore", not "Forest Map"), whatever the case.
 */
export function bankSearchMatches(item, term) {
    const typed = wordsOf(term || '');
    if (!typed.length) return true;
    return bankSearchWords(item).some(text => {
        const words = wordsOf(text);
        let at = 0;
        for (const t of typed) {
            while (at < words.length && !words[at].startsWith(t)) at++;
            if (at === words.length) return false;
            at++;
        }
        return true;
    });
}

/** An item's own `tier`, else its tool tier when it is a tool; Infinity when it has neither. */
function bankTier(item) {
    if (Number.isFinite(item?.tier)) return item.tier;
    return toolOf(item)?.tier ?? Infinity;
}

/**
 * Bank order: by type (its label, A to Z), then by the item's own `tier`, or its tool tier (low first; an item
 * without one after those of its type that have one), then by name.
 * @param {object} a an item template
 * @param {object} b an item template
 */
export function compareForBank(a, b) {
    const type = itemTypeLabel(a).localeCompare(itemTypeLabel(b));
    if (type) return type;
    const ta = bankTier(a), tb = bankTier(b);
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
