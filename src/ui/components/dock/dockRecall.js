// Fantasy Guild — dropping a hero or a pennant on the Hero Dock (Free Playmat slice 1.5)

import { DRAG_KIND } from '../../dnd/dragConstants.js';

/**
 * Whether a drag dropped on the Dock means **recall**: a hero picked up off the
 * board (their sprite on a Token, or drawn idle beside their flag), or a
 * flag's pennant. A hero dragged from the Dock itself is a reorder, not this.
 *
 * Shared by the Dock's own drop zone and every hero tab in it, so a board hero
 * dropped onto a tab recalls instead of being refused (the tab is the smaller
 * target and wins the collision).
 */
export function isRecallDrop(p) {
    if (!p?.heroId) return false;
    if (p.kind === DRAG_KIND.FLAG) return true;
    return p.kind === DRAG_KIND.HERO && (p.from?.tile != null || p.from?.flag === true);
}

/**
 * Take the flag down and bring the hero home (FP-43: a fight ends at once).
 * By hero, not by tile — a tile can show a different hero than the one dragged.
 *
 * @param {object} placement the engine's board Placement module (`engine.BoardPlacement`)
 */
export function recallFromDrop(placement, p) {
    if (!isRecallDrop(p)) return null;
    return placement?.recallHeroById?.(p.heroId) ?? null;
}
