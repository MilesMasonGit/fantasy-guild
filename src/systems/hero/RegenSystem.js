// Fantasy Guild - Regen System
// Phase 11: Regen System

import { GameState } from '../../state/GameState.js';
import * as HeroManager from './HeroManager.js';
import { EventBus } from '../core/EventBus.js';
import { REGEN_CONFIG } from '../../config/FormulaRegistry.js';
import * as ConsumptionSystem from './ConsumptionSystem.js';

/**
 * RegenSystem - Handles HP and Energy regeneration for idle heroes
 * 
 * Design:
 * - Only idle heroes regenerate
 * - Regeneration happens every tick
 * - Rate is configurable via FormulaRegistry.REGEN_CONFIG
 * - Publishes ui_update event for ViewManager to refresh
 */

// Timers for intervals
let hpTimer = 0;
let energyTimer = 0;

// Track if any regen happened (for UI updates)
let regenOccurred = false;

/**
 * Process regeneration for all idle heroes
 * Called every tick by GameLoop
 * @param {number} delta - Time since last tick in MILLISECONDS
 */
export function tick(delta) {
    const heroes = HeroManager.getAllHeroes();

    // Convert delta (ms) to seconds for config compatibility
    const deltaSec = delta / 1000;

    // Update timers
    hpTimer += deltaSec;
    energyTimer += deltaSec;

    // Calculate pending regen
    let hpToRegen = 0;
    let energyToRegen = 0;

    // Apply HP regen chunks
    while (hpTimer >= REGEN_CONFIG.hp.interval) {
        hpToRegen += REGEN_CONFIG.hp.amount;
        hpTimer -= REGEN_CONFIG.hp.interval;
    }

    // Apply Energy regen chunks
    while (energyTimer >= REGEN_CONFIG.energy.interval) {
        energyToRegen += REGEN_CONFIG.energy.amount;
        energyTimer -= REGEN_CONFIG.energy.interval;
    }

    regenOccurred = false;

    // Apply regen to each idle hero
    for (const hero of heroes) {
        // Allow regen for 'idle', 'working', and 'combat' statuses
        // Note: 'wounded' does not regenerate via this system
        if (hero.status !== 'idle' && hero.status !== 'working' && hero.status !== 'combat') continue;

        // ⚠️ **A vital may be missing, and this must not throw.** This runs
        // inside a GameLoop tick handler, so one bad hero raised the same error
        // every frame forever — it does not fail once and stop.
        //
        // `HeroGenerator` gives every hero both `hp` and `energy`, so a hero
        // without one is legacy or test-shaped save data rather than anything the
        // game creates today. That is exactly the case a tick handler has to
        // survive, and the rest of the codebase already assumes it can happen:
        // `ConsumptionSystem` and `HeroDockTab` both read `hero.energy?.current`.
        // This was the only place that did not.

        // Regenerate HP if not at max
        if (hpToRegen > 0 && hero.hp && hero.hp.current < hero.hp.max) {
            HeroManager.modifyHeroHp(hero.id, hpToRegen);
            regenOccurred = true;
        }

        // Regenerate Energy if not at max
        if (energyToRegen > 0 && hero.energy && hero.energy.current < hero.energy.max) {
            HeroManager.modifyHeroEnergy(hero.id, energyToRegen);
            regenOccurred = true;
        }

        // Eat when hurt, ANYWHERE (D-27). Combat has its own eating path — it
        // charges the attack that a mid-fight meal costs — but a hero on a
        // fight-free gathering loop must not be stranded below 25% by hazard
        // chip damage with food in their grid. This is that safety net, and
        // it's why the 25% rule reads as one rule rather than a combat one.
        if (hero.status !== 'combat' && ConsumptionSystem.tryEat(hero.id)) {
            regenOccurred = true;
        }
    }

    // Notify UI to update if regen happened
    if (regenOccurred) {
        EventBus.publish('heroes_updated', { source: 'regen' });
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
