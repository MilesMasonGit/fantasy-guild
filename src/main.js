// Fantasy Guild - Main Entry Point
// Phase 21: Save UI

import './styles/main.css';
import './styles/panels.css';
import './styles/components.css';
import './styles/notifications.css';
import './styles/cards/modules/core.css';
import './styles/cards/modules/slots.css';
import './styles/cards/modules/combat.css';
import './styles/cards/activity.css';
import './styles/cards/explore.css';
import './styles/cards/area.css';
import './styles/cards/recruit.css';
import './styles/cards/expansion.css';
import './styles/inventory.css';
import './styles/modals.css';
import { viewManager } from './ui/ViewManager.js';

// === Core Systems ===
import { EventBus } from './systems/core/EventBus.js';
import { logger } from './utils/Logger.js';
import { TimeManager } from './systems/core/TimeManager.js';
import { GameLoop } from './systems/core/GameLoop.js';

import { SaveManager } from './systems/core/SaveManager.js';
import * as NotificationSystem from './systems/core/NotificationSystem.js';

// === State ===
import { GameState } from './state/GameState.js';

// === Hero Systems ===
import * as HeroManager from './systems/hero/HeroManager.js';
import * as SkillSystem from './systems/hero/SkillSystem.js';
import * as RegenSystem from './systems/hero/RegenSystem.js';
import * as ModifierAggregator from './systems/global/ModifierAggregator.js';

// === Registries ===
import { CARDS, getCard as getCardTemplate, getTaskCards } from './config/registries/cardRegistry.js';
import { ITEMS, getAllItems } from './config/registries/itemRegistry.js';

// === Card Systems ===
import * as CardManager from './systems/cards/CardManager.js';
import { TaskSystem } from './systems/task/TaskSystem.js';
import ExploreSystem from './systems/cards/ExploreSystem.js';
import AreaSystem from './systems/cards/AreaSystem.js';
import { RecruitSystem } from './systems/cards/RecruitSystem.js';
import { CardCraftingSystem } from './systems/cards/CardCraftingSystem.js';
import { CombatSystem } from './systems/combat/CombatSystem.js';
import CardSystem from './systems/cards/CardSystem.js';
import { WoundedSystem } from './systems/combat/WoundedSystem.js';
import { LootSystem } from './systems/combat/LootSystem.js';

// === Inventory Systems ===
import { InventoryManager } from './systems/inventory/InventoryManager.js';

import * as ToastNotification from './ui/components/ToastNotificationComponent.js';
import * as DragDropHandler from './ui/DragDropHandler.js';
import { updateCardStack, setupEventDelegation, initEventSubscriptions } from './ui/panels/CenterPanel.js';
import { setupLeftPanelEventDelegation } from './ui/panels/LeftPanel.js';

logger.info('main', 'Fantasy Guild starting...');

window.Game = {
    GameState,
    EventBus,
    SaveManager,
    InventoryManager,
    HeroManager,
    TaskSystem,
    CardManager,
    CardSystem,
    CombatSystem,
    WoundedSystem,
    LootSystem
};
logger.debug('main', 'DEV: Global window.Game object exposed for debugging.');

// Initialize systems that need event subscriptions
LootSystem.init();

// === Register Game Loop Systems ===
// Time tracking
GameLoop.onTick('time_tracking', (delta) => {
    if (GameState.getIsInitialized()) {
        GameState.updateTime({
            gameTimeMs: GameState.time.gameTimeMs + delta,
            lastTickAt: Date.now()
        });
    }
});

// Hero regeneration
GameLoop.onTick('regen_system', (delta) => {
    if (GameState.getIsInitialized()) {
        RegenSystem.tick(delta);
    }
});

// Card System (Centralized)
GameLoop.onTick('card_system', (delta) => {
    if (GameState.getIsInitialized()) {
        CardSystem.tick(delta);
    }
});

// Wounded hero recovery
GameLoop.onTick('wounded_system', (delta) => {
    if (GameState.getIsInitialized()) {
        WoundedSystem.tick(delta);
    }
});

/**
 * Create default heroes and cards for a new game
 */
function createDefaultGameData() {
    logger.debug('main', 'Creating default cards...');

    // Create 1 FREE starting recruit card (they use unshift to go to top)
    RecruitSystem.createRecruitCard(true);  // isFree = true

    // Create starting Explore card for Ruined Guild Hall region
    const exploreCard = {
        id: CardManager.generateId('explore'),
        templateId: 'explore_dynamic',
        name: 'Explore Abandoned Guild Hall',
        cardType: 'explore',
        description: 'The abandoned guild hall stands boarded up and silent, but rumors say ancient secrets lie within its depths.',
        icon: '🏚️',

        regionId: 'ruined_guild_hall',
        selectedBiomeId: 'guild_hall',
        exploredBiomes: [],
        biomeProgress: {},

        assignedHeroId: null,
        status: 'idle',
        isUnique: true,
        createdAt: Date.now()
    };
    CardManager.addToStack(exploreCard);
    GameState.cacheCard(exploreCard);

    // Give player 5 starting Lockpicks (enough to explore Guild Hall)
    InventoryManager.addItem('lockpick', 5);
    // Give player 10 starting Wood (for testing)
    InventoryManager.addItem('wood', 10);

    // Add requested test tasks
    CardManager.createCard('gather_coal');
    CardManager.createCard('gather_copper_ore');
    CardManager.createCard('smelt_any_ore');

    // Initialize exploration tracking in GameState
    if (!GameState.exploration) {
        GameState.exploration = { count: 0 };
    }

    logger.debug('main', 'Created 1 starting recruit card, 1 explore card, and 5 lockpicks');
}

/**
 * Continue game after slot is selected
 * @param {number} slotIndex - The selected slot
 * @param {boolean} isNewGame - Whether this is a new game
 */
function onSlotSelected(slotIndex, isNewGame) {
    logger.info('main', `Slot ${slotIndex + 1} selected (isNew: ${isNewGame})`);

    // Initialize card crafting system (before creating cards)
    CardCraftingSystem.init();

    // Initialize inventory first (must be done before rendering)
    InventoryManager.init();

    // Render the full 3-column layout now that GameState is ready
    viewManager.renderFullLayout();

    // Initialize event subscriptions for UI panels
    initEventSubscriptions();

    // Set up event delegation for left panel (retire buttons)
    setupLeftPanelEventDelegation();

    // Create default data for new games
    if (isNewGame) {
        createDefaultGameData();
    }

    // Rebuild card lookup cache to ensure INITIAL_STATE cards are indexed
    // This catches both loaded cards and pre-spawned initial cards
    GameState.rebuildCardCache();

    // Start the game loop
    GameLoop.start();

    // Initialize ExploreSystem
    ExploreSystem.init();

    // Refresh UI
    updateCardStack();
    viewManager.updateHeroes(GameState.heroes);

    NotificationSystem.success('Game ready!');
}

// === Initialize UI and Show Slot Selection ===
document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    if (!app) {
        console.error('Could not find #app element');
        return;
    }

    // Initialize SaveManager (migration, etc)
    SaveManager.init();

    // Initialize toast notifications first (before any notifications)
    ToastNotification.init();

    // Render bare UI structure
    viewManager.init(app);

    // Initialize drag and drop
    DragDropHandler.init();

    // Set up event delegation for card interactions
    setupEventDelegation();

    logger.info('main', 'UI initialized, showing slot selection...');

    // Show slot selection modal
    viewManager.showSlotSelectionModal(onSlotSelected);

    // Global Event Listeners
    window.addEventListener('combat-style-change', (event) => {
        const { cardId, style } = event.detail;
        if (cardId && style) {
            CardManager.updateCombatStyle(cardId, style);
        }
    });
});
