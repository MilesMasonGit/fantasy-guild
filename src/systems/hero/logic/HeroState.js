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

export function modifyHeroHp(heroId, amount) {
    const hero = getHero(heroId);
    if (!hero) return { success: false, error: 'HERO_NOT_FOUND' };

    hero.hp.current = Math.max(0, Math.min(hero.hp.max, hero.hp.current + amount));
    return { success: true, newHp: hero.hp.current };
}

export function modifyHeroEnergy(heroId, amount) {
    const hero = getHero(heroId);
    if (!hero) return { success: false, error: 'HERO_NOT_FOUND' };

    hero.energy.current = Math.max(0, Math.min(hero.energy.max, hero.energy.current + amount));
    return { success: true, newEnergy: hero.energy.current };
}
