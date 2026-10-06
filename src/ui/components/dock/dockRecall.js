
import { DRAG_KIND } from '../../dnd/dragConstants.js';

/**
 * Whether a drag dropped on the Dock means **recall**: any FLAG drag, the flag itself or a
 * hero picked up on the board (which drags their flag, since the player never moves a hero). A
 * hero dragged from the Dock itself (`DRAG_KIND.HERO`) is a reorder, not this.
 * Shared by the Dock's own drop zone and every hero tab in it, so a flag dropped onto a tab
 * recalls instead of being refused (the tab is the smaller target and wins the collision).
 */
export function isRecallDrop(p) {
    return !!p?.heroId && p.kind === DRAG_KIND.FLAG;
}

/**
 * Take the flag down and bring the hero home (a fight ends at once). By hero, not by tile: a
 * tile can show a different hero than the one dragged.
 * @param {object} placement the engine's board Placement module (`engine.BoardPlacement`)
 */
export function recallFromDrop(placement, p) {
    if (!isRecallDrop(p)) return null;
    return placement?.recallHeroById?.(p.heroId) ?? null;
}
