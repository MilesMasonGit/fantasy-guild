// The Item drawer's tag pills and what each tag means. The meanings are words for the player, so
// they live in the strings file, section `itemTags` of `src/i18n/en.json`, one line a tag, keyed
// by the tag's name in camelCase ("Seafood" -> `seafood`). Edit them there.

import { t } from '../../../i18n/index.js';
import { itemTypeLabel } from './ItemTip.jsx';
import { doseLength } from '../../../systems/hero/ConsumptionSystem.js';
import { DOSE } from '../../../systems/core/consumableRule.js';

/** A tag's key in the strings file's `itemTags` section: its letters and digits, first one lower case. */
export function tagKey(tag) {
    const word = String(tag ?? '').replace(/[^A-Za-z0-9]/g, '');
    return word ? word[0].toLowerCase() + word.slice(1) : '';
}

/**
 * What a tag does in the game, in one line; null when nobody has written one yet. A line may say
 * how long a drink (`{cycles}`) or an elixir (`{fights}`) lasts: the guild's now, Long-lasting
 * Brews included.
 */
export function tagExplanation(tag) {
    const key = tagKey(tag);
    if (!key) return null;
    const path = `itemTags.${key}`;
    const line = t(path, { cycles: doseLength(DOSE.DRINK), fights: doseLength(DOSE.ELIXIR) });
    return line === path ? null : line;
}

/**
 * The pills an item shows, in its own order, each once: its tags, or, for an item with none,
 * its kind (Material, Tool...), so the drawer always says what it is.
 */
export function itemTagPills(item) {
    const seen = new Set();
    const tags = (Array.isArray(item?.tags) ? item.tags : [])
        .filter(tag => typeof tag === 'string' && tag.trim())
        .filter(tag => {
            const key = tagKey(tag);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    const shown = tags.length ? tags : [itemTypeLabel(item)];
    return shown.map(tag => ({ tag, explanation: tagExplanation(tag) }));
}
