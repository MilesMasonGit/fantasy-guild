// Fantasy Guild - putting a loaded save into play

import { GameState } from '../../state/GameState.js';
import { rehydrateHero } from '../hero/HeroManager.js';
import { recalculateEquipmentModifiers } from '../equipment/EquipmentManager.js';
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
    });
    // A save from before heroes held a colour from the start: each gets one, in roster order.
    assignFlagColours();

    if (!state.quests) {
        state.quests = {
            completedTutorials: [],
            tutorialStep: 0,
            // quests run on the game-time `clockMs`, not the wall clock.
            clockMs: 0
        };
    }
    logger.info('GameState', 'Save rehydration complete.');
}
