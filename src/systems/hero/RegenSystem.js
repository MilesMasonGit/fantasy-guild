import * as HeroManager from './HeroManager.js';
import { EventBus } from '../core/EventBus.js';
import { REGEN_CONFIG } from '../../config/FormulaRegistry.js';
import * as ConsumptionSystem from './ConsumptionSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * RegenSystem - HP and Energy regeneration for heroes that are idle, working or
 * in combat (not wounded). Rates come from FormulaRegistry.REGEN_CONFIG and are
 * applied in interval-sized chunks accumulated across ticks. Publishes
 * HEROES_UPDATED when anything changed.
 */

let hpTimer = 0;
let energyTimer = 0;

let regenOccurred = false;

/**
 * Process regeneration for all regenerating heroes
 * Called every tick by GameLoop
 * @param {number} delta - Time since last tick in MILLISECONDS
 */
export function tick(delta) {
    const heroes = HeroManager.getAllHeroes();

    // Convert delta (ms) to seconds for config compatibility
    const deltaSec = delta / 1000;

    hpTimer += deltaSec;
    energyTimer += deltaSec;

    let hpToRegen = 0;
    let energyToRegen = 0;

    while (hpTimer >= REGEN_CONFIG.hp.interval) {
        hpToRegen += REGEN_CONFIG.hp.amount;
        hpTimer -= REGEN_CONFIG.hp.interval;
    }

    while (energyTimer >= REGEN_CONFIG.energy.interval) {
        energyToRegen += REGEN_CONFIG.energy.amount;
        energyTimer -= REGEN_CONFIG.energy.interval;
    }

    regenOccurred = false;

    for (const hero of heroes) {
        // Wounded heroes do not regenerate via this system.
        if (hero.status !== 'idle' && hero.status !== 'working' && hero.status !== 'combat') continue;

        // ⚠️ A vital may be missing, and this must not throw: it runs inside a
        // GameLoop tick handler, so one bad hero would raise the same error every
        // frame. A hero without `hp` or `energy` is legacy or test-shaped save data.

        if (hpToRegen > 0 && hero.hp && hero.hp.current < hero.hp.max) {
            HeroManager.modifyHeroHp(hero.id, hpToRegen);
            regenOccurred = true;
        }

        if (energyToRegen > 0 && hero.energy && hero.energy.current < hero.energy.max) {
            HeroManager.modifyHeroEnergy(hero.id, energyToRegen);
            regenOccurred = true;
        }

        // Eat when hurt, anywhere. Combat has its own eating path, but a hero on a
        // fight-free gathering loop must not be stranded below the threshold by
        // hazard chip damage with food in their grid.
        if (hero.status !== 'combat' && ConsumptionSystem.tryEat(hero.id)) {
            regenOccurred = true;
        }
    }

    if (regenOccurred) {
        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'regen' });
    }
}

/**
 * Get current regen config
 * @returns {Object}
 */
export function getRegenConfig() {
    return JSON.parse(JSON.stringify(REGEN_CONFIG));
}

/**
 * Reset timers (useful for testing or pause/resume)
 */
export function reset() {
    hpTimer = 0;
    energyTimer = 0;
}
