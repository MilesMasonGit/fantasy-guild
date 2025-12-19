// Fantasy Guild - Regen System
// Phase 11: Regen System

import { GameState } from '../../state/GameState.js';
import * as HeroManager from './HeroManager.js';
import { EventBus } from '../core/EventBus.js';

/**
 * RegenSystem - Handles HP and Energy regeneration for idle heroes
 * 
 * Design:
 * - Only idle heroes regenerate
 * - Regeneration happens every tick
 * - Rate is configurable via constants
 * - Publishes ui_update event for ViewManager to refresh
 */

// Regen rates (per second)
// Regen configuration (amount per interval in seconds)
const REGEN_CONFIG = {
    hp: { amount: 2, interval: 1.0 },      // 2 HP every 1.0s
    energy: { amount: 1, interval: 5.0 }   // 1 Energy every 5.0s
};

// Timers for intervals
let hpTimer = 0;
let energyTimer = 0;

// Track if any regen happened (for UI updates)
let regenOccurred = false;

/**
 * Process regeneration for all idle heroes
 * Called every tick by GameLoop
 * @param {number} deltaSec - Time since last tick in seconds
 */
export function tick(deltaSec) {
    const heroes = HeroManager.getAllHeroes();

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
        // Allow regen for 'idle' and 'working' statuses
        // Note: 'combat' and 'wounded' do not regenerate
        if (hero.status !== 'idle' && hero.status !== 'working') continue;

        // Regenerate HP if not at max
        if (hpToRegen > 0 && hero.hp.current < hero.hp.max) {
            HeroManager.modifyHeroHp(hero.id, hpToRegen);
            regenOccurred = true;
        }

        // Regenerate Energy if not at max
        if (energyToRegen > 0 && hero.energy.current < hero.energy.max) {
            HeroManager.modifyHeroEnergy(hero.id, energyToRegen);
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
