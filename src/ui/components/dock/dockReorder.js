// Reordering a hero on the hero bar: a hero dropped on another goes to HeroManager.reorderHero.

/**
 * Move `sourceHeroId` to stand where `targetHeroId` currently is.
 *
 * `heroIds` is the list's current order; `targetHeroId`'s index in it is the
 * new position `HeroManager.reorderHero` is told to put the source hero at.
 *
 * @returns {boolean} whether a reorder was actually issued
 */
export function reorderHeroInDock(heroManager, heroIds, sourceHeroId, targetHeroId) {
    if (sourceHeroId === targetHeroId) return false;
    const targetIndex = heroIds.indexOf(targetHeroId);
    if (targetIndex === -1) return false;
    heroManager.reorderHero(sourceHeroId, targetIndex);
    return true;
}
