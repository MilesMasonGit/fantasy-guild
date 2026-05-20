import { GameState } from '../src/state/GameState.js';
import { QuestTracker } from '../src/systems/progression/QuestTracker.js';
import { EventBus } from '../src/systems/core/EventBus.js';

// Setup
GameState.initNew();
const areaId = 'guild_hall_v1';
const questId = 'quest_gh_water'; // Requires ON_ITEM_GAINED for drink_water

// 1. Create a physical quest card
const cardId = 'test_quest_card';
GameState.state.cards.active.push({
    id: cardId,
    templateId: questId,
    progress: 0,
    areaId: areaId,
    traits: [] // Traits will be injected by rehydration or should be assumed
});

console.log('--- Initial State ---');
console.log('Card Progress:', GameState.state.cards.active[0].progress);

// 2. Listen for UI Pulse
EventBus.subscribe('cards_progress_updated', (data) => {
    console.log('--- UI Pulse Received ---');
    console.log('Data:', data);
});

// 3. Simulate Item Gained
console.log('--- Simulating Item Gain: drink_water ---');
QuestTracker.processEvent('ON_ITEM_GAINED', { itemId: 'drink_water', amount: 1 });

console.log('--- Final State ---');
console.log('Card Progress:', GameState.state.cards.active[0].progress);

if (GameState.state.cards.active[0].progress === 1) {
    console.log('SUCCESS: Quest progress updated correctly!');
} else {
    console.log('FAILURE: Quest progress did not update.');
    process.exit(1);
}
