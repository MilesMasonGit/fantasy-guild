// Reordering a hero within a dock-style strip of tabs/figures. Shared by BottomHeroDock and
// BankHeroPanel so both wire a hero-on-hero drop to HeroManager.reorderHero the same way.

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
