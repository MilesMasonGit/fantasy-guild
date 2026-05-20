// Verification script for MasterySystem Unified Bonuses
import { GameState } from './src/state/GameState.js';
import { MasterySystem } from './src/systems/progression/MasterySystem.js';
import { logger } from './src/utils/Logger.js';

async function verifyBonuses() {
    console.log('--- MasterySystem Verification ---');

    // 1. Mock GameState
    GameState.initNew();
    const state = GameState.state;

    // 2. Mock Area Mastery
    state.areaStates = {
        'guild_hall_v1': {
            mastery: { setMasteryUnlocked: true, questMasteryUnlocked: false },
            collectionProgress: {},
            completedQuestIds: []
        }
    };

    // 3. Mock Project Progress (Bunk Bed Level 2)
    state.progress.projects = {
        'bunk_bed': { level: 2, inputProgress: {} }
    };

    // 4. Mock Active Cards (Placeholder for Local Bonus)
    state.cards.active = [
        { templateId: 'bunk_bed', areaId: 'guild_hall_v1', idCount: 1 }
    ];

    console.log('Context: Active Area is guild_hall_v1');
    console.log('Project: Bunk Bed Level 2 is completed.');
    console.log('Card: Bunk Bed is on the board in guild_hall_v1.');

    // 5. Test getEffectiveBonuses (Task context)
    const taskContext = { areaId: 'guild_hall_v1', skill: 'social' };
    const bonuses = MasterySystem.getEffectiveBonuses(taskContext);
    console.log('\nEffective Bonuses (Social Task in Guild Hall):', bonuses);

    // 6. Test getAllActiveBonuses (UI context)
    state.ui.activeAreaId = 'guild_hall_v1';
    const allBonuses = MasterySystem.getAllActiveBonuses();
    console.log('\nAll Active Bonuses (UI Modal):');
    console.log('Global:', allBonuses.global);
    console.log('Local:', allBonuses.local);

    // Verification Logic
    if (bonuses.speedReduction > 0) {
        console.log('\nSUCCESS: Found speed reduction bonus!');
    } else {
        console.log('\nFAILURE: No bonuses detected.');
    }
}

verifyBonuses().catch(console.error);
