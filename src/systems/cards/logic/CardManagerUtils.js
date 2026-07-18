/**
 * Card utilities that survive the deck-loop rework.
 *
 * The rest of this module (publishCardUpdate, updateProgress,
 * resetProgress, rehydrateCards, reapplyAllPersistentModifiers,
 * set/clearAssignedHero) operated on the retired `cards.active` /
 * `cards.library` arrays and the never-populated card cache — all deleted
 * in the code-review Wave 4 sweep (CR-007/CR-018/CR-027).
 *
 * What remains is what the deck loop's EPHEMERAL cards actually use.
 */

/** Bump a card's revision counter so ref-based UI reads see a change. */
export function bumpCardRev(card) {
    if (card) card._rev = (card._rev || 0) + 1;
}

/** Deep-clone a traits array (state snapshots). */
export function cloneTraits(traits) {
    if (!traits) return [];
    return structuredClone(traits);
}
