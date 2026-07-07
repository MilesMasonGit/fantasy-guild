/**
 * HeroTransferResolver - Handles hero activation, bencing, and direct swaps.
 */
export const HeroTransferResolver = {
    resolve(event, engine, activeData, overData) {
        const { over } = event;
        const entityId = activeData.id;
        const overHeroId = overData?.type === 'hero' ? overData.id : null;

        // 1. Drop into Tavern (Bench)
        if (over?.id === 'tavern-drawer') {
            engine.HeroManager.moveHeroToBench(entityId);
            return { success: true, action: 'hero_bench' };
        }

        // 2. Drop into Roster (Activate)
        if (over?.id === 'hero-view-roster') {
            const moveResult = engine.HeroManager.moveHeroToActive(entityId);
            if (moveResult.success) {
                return { success: true, action: 'hero_activate' };
            } else {
                return { success: false, action: 'hero_activate_fail', error: moveResult.error };
            }
        }

        // 3. Direct Hero-on-Hero Swap
        if (overHeroId && entityId !== overHeroId) {
            const dragIsBenched = activeData.idPrefix === 'bench';
            const overIsBenched = overData.idPrefix === 'bench';

            if (dragIsBenched !== overIsBenched) {
                if (dragIsBenched) {
                    engine.HeroManager.moveHeroToBench(overHeroId);
                    engine.HeroManager.moveHeroToActive(entityId);
                } else {
                    engine.HeroManager.moveHeroToBench(entityId);
                    engine.HeroManager.moveHeroToActive(overHeroId);
                }
                return { success: true, action: 'hero_swap' };
            }
        }

        return { success: false, action: 'none' };
    },

    /**
     * Unassign a hero from its current card before moving.
     */
    ensureHeroUnassigned(heroId, engine) {
        const hero = engine.HeroManager.getHero(heroId);
        if (!hero) return;

        // Ensure activated if benched
        if (engine.HeroManager.getBench().some(h => h.id === heroId)) {
            const result = engine.HeroManager.moveHeroToActive(heroId);
            if (!result.success) throw new Error(result.error);
        }

        if (hero.assignedCardId) {
            engine.AssignmentSystem.unassignHero(heroId);
        }
    }
};
