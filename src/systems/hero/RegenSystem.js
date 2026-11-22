import * as HeroManager from './HeroManager.js';
import { EventBus } from '../core/EventBus.js';
import { REGEN_CONFIG } from '../../config/FormulaRegistry.js';
import * as ConsumptionSystem from './ConsumptionSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { REST_MEAL_GAP_MS } from '../../config/loopConstants.js';
import { regenPerInterval } from './regen.js';

/**
 * RegenSystem - HP regeneration for idle heroes (working and walking ones are idle too): never in a
 * fight, where only food heals, and never wounded. Every `REGEN_CONFIG.hp.interval` each hurt hero
 * heals their Regen's worth (`regen.js`). Publishes HEROES_UPDATED when anything changed.
 */

let hpTimer = 0;

let regenOccurred = false;

/**
 * `heroId → game time left before that hero may eat again` out of a fight. Runtime only: an entry
 * lives at most `REST_MEAL_GAP_MS`, so a load forgets less than one meal's wait.
 */
const mealWait = new Map();

/**
 * `heroId → healing owed below 1 HP`, so +10% Regen still heals one more every ten intervals.
 * Runtime only, like `mealWait`: a load forgets less than 1 HP. Kept only while the hero is hurt.
 */
const owed = new Map();

/**
 * ⚠️ With no Regen a hero heals exactly `chunks` (whole HP, nothing owed), the ticks they always
 * did: the epsilon only stops 0.1 × 10 summing to 0.9999… from losing a point.
 */
function heal(hero, chunks) {
    const total = (owed.get(hero.id) || 0) + regenPerInterval(hero) * chunks;
    const whole = Math.floor(total + 1e-9);
    const rest = total - whole;
    if (rest > 1e-9) owed.set(hero.id, rest);
    else owed.delete(hero.id);
    if (whole <= 0) return false;
    HeroManager.modifyHeroHp(hero.id, whole);
    return true;
}

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

    let chunks = 0;

    while (hpTimer >= REGEN_CONFIG.hp.interval) {
        chunks++;
        hpTimer -= REGEN_CONFIG.hp.interval;
    }

    regenOccurred = false;

    for (const [heroId, left] of mealWait) {
        if (left - delta > 0) mealWait.set(heroId, left - delta);
        else mealWait.delete(heroId);
    }

    for (const hero of heroes) {
        // Wounded heroes recover through WoundedSystem; a hero in a fight eats or goes without.
        if (hero.status !== 'idle') continue;

        // ⚠️ A vital may be missing, and this must not throw: it runs inside a
        // GameLoop tick handler, so one bad hero would raise the same error every
        // frame. A hero without `hp` is legacy or test-shaped save data.

        if (chunks > 0 && hero.hp) {
            if (hero.hp.current < hero.hp.max) {
                if (heal(hero, chunks)) regenOccurred = true;
            } else {
                owed.delete(hero.id);
            }
        }

        // Eat when hurt, out of fights too. Combat has its own eating path, but a hero on a
        // fight-free gathering loop must not be stranded below the threshold by
        // hazard chip damage with food in their grid.
        if (!mealWait.has(hero.id) && ConsumptionSystem.tryEat(hero.id).length) {
            mealWait.set(hero.id, REST_MEAL_GAP_MS);
            regenOccurred = true;
        }
    }

    if (regenOccurred) {
        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'regen' });
    }
}

/**
 * Reset timers (useful for testing or pause/resume)
 */
export function reset() {
    hpTimer = 0;
    mealWait.clear();
    owed.clear();
}
