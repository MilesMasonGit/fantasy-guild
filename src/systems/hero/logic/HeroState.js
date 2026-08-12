import { EventBus } from '../../core/EventBus.js';
import { getHero } from './HeroLookup.js';

/**
 * Hero State: Status and Resource (HP/Energy) mutations.
 */

export function setHeroStatus(heroId, status) {
    const hero = getHero(heroId);
    if (!hero) return { success: false, error: 'HERO_NOT_FOUND' };

    hero.status = status;
    return { success: true };
}

/**
 * Handle assignment state changes internally.
 */
export function setAssignment(heroId, cardId) {
    const hero = getHero(heroId);
    if (!hero) return { success: false, error: 'HERO_NOT_FOUND' };

    hero.assignedCardId = cardId;
    
    // Only set to working/idle if they aren't wounded.
    if (hero.status !== 'wounded') {
        hero.status = cardId ? 'working' : 'idle';
    }

    EventBus.publish('heroes_updated', { heroId, source: 'setAssignment' });
    return { success: true };
}


export function updateHeroProfile(heroId, updates = {}) {
    const hero = getHero(heroId);
    if (!hero) return { success: false, error: 'HERO_NOT_FOUND' };

    if (updates.name !== undefined && updates.name.trim()) {
        hero.name = updates.name.trim();
    }

    if (updates.icon !== undefined) {
        hero.icon = updates.icon;
    }

    if (updates.spriteId !== undefined) {
        hero.spriteId = updates.spriteId;
    }

    EventBus.publish('heroes_updated', { source: 'updateHeroProfile', heroId });
    return { success: true };
}

/**
 * ⚠️ Both mutators check the vital exists before writing to it.
 *
 * `HeroGenerator` always supplies `hp` and `energy`, so a hero missing one is
 * legacy or test-shaped save data — but these are called from a **GameLoop tick
 * handler** (`RegenSystem`), where an exception repeats every frame rather than
 * failing once. A missing vital is reported the same way a missing hero is,
 * rather than thrown.
 */
export function modifyHeroHp(heroId, amount) {
    const hero = getHero(heroId);
    if (!hero) return { success: false, error: 'HERO_NOT_FOUND' };
    if (!hero.hp) return { success: false, error: 'NO_HP' };

    hero.hp.current = Math.max(0, Math.min(hero.hp.max, hero.hp.current + amount));
    return { success: true, newHp: hero.hp.current };
}

export function modifyHeroEnergy(heroId, amount) {
    const hero = getHero(heroId);
    if (!hero) return { success: false, error: 'HERO_NOT_FOUND' };
    if (!hero.energy) return { success: false, error: 'NO_ENERGY' };

    hero.energy.current = Math.max(0, Math.min(hero.energy.max, hero.energy.current + amount));
    return { success: true, newEnergy: hero.energy.current };
}
