// Putting a loaded save into play

import { GameState } from '../../state/GameState.js';
import { rehydrateHero } from '../hero/HeroManager.js';
import { recalculateEquipmentModifiers } from '../equipment/EquipmentManager.js';
import { syncAggregator } from '../effects/LiveEffects.js';
import { assignFlagColours } from '../board/FlagColours.js';
import { logger } from '../../utils/Logger.js';

/**
 * Hand a migrated, validated save to the store and rebuild what the save leaves out.
 * This lives here, not in `GameState`, so the store imports nothing from the engine.
 * @param {Object} savedState
 */
export function loadSavedState(savedState) {
    GameState.initFromSave(savedState);
    const state = GameState.state;
    if (!state) return;

    (state.heroes || []).forEach(hero => {
        rehydrateHero(hero);
        recalculateEquipmentModifiers(hero);
        // The fresh aggregator holds no carried effect: their fight numbers go back on now. The
        // board's load handler later ends the fight-bound ones, and that re-syncs on its own.
        syncAggregator(hero);
    });
    // A save from before heroes held a colour from the start: each gets one, in roster order.
    assignFlagColours();
    logger.info('GameState', 'Save rehydration complete.');
}
