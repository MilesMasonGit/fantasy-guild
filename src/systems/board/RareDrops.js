// telling the mat a loot drop was a rare one

import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';

/**
 * A drop is rare when the line it rolled on had this chance (%) or less. Items carry no rarity of
 * their own; how seldom a line lands is what makes its item a find.
 */
export const RARE_DROP_CHANCE = 10;

/** Whether a line with `chance` (%) is a rare one. A line with no chance always lands. */
export function isRareChance(chance) {
    const c = Number(chance);
    return Number.isFinite(c) && c > 0 && c <= RARE_DROP_CHANCE;
}

/**
 * Say that loot `sprite` (what `SpriteLayer.addSprite` returned) came from a rare line, so the mat
 * can make it twinkle. Only the eye listens: nothing in the game changes.
 * @param {object|null} sprite
 * @param {number} chance the line's chance (%)
 */
export function noteDrop(sprite, chance) {
    if (!sprite?.id || !isRareChance(chance)) return;
    EventBus.publish(BOARD_EVENTS.RARE_DROP, { spriteId: sprite.id, itemId: sprite.refId, chance: Number(chance) });
}
