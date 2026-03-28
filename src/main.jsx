// Fantasy Guild - Main Entry Point
// Phase 21: Save UI

import './styles/main.css';
import './styles/components.css';
import './styles/modals.css';
import './styles/cards/modules/core.css';
import './styles/cards/modules/wrapper.css';
import './styles/cards/modules/slots.css';
import './styles/cards/modules/combat.css';
import './styles/cards/modules/combat-groups.css';
import './styles/cards/modules/loot-table.css';
// import './styles/cards/explore.css';
// import './styles/cards/invasion.css';
// import './styles/cards/recruit.css';
import './styles/components-transparency.css';
import './tailwind.css';
import './ui/styles/index.css';
import { RecruitSystem } from './systems/cards/RecruitSystem.js';
import { CardCraftingSystem } from './systems/cards/CardCraftingSystem.js';
import { CombatSystem } from './systems/combat/CombatSystem.js';
import CardSystem from './systems/cards/CardSystem.js';
import { WoundedSystem } from './systems/combat/WoundedSystem.js';
import { LootSystem } from './systems/combat/LootSystem.js';
import { InvasionManager } from './systems/combat/InvasionManager.js';
import { ThreatSystem } from './systems/threat/ThreatSystem.js';
import { AreaSystem } from './systems/area/AreaSystem.js';
import { AudioSystem } from './systems/core/AudioSystem.js';
// import './styles/cards/invasion.css';
// import './styles/modals.css';

// === Core Systems ===
import { EventBus } from './systems/core/EventBus.js';
import { logger } from './utils/Logger.js';
import { TimeManager } from './systems/core/TimeManager.js';
import { GameLoop } from './systems/core/GameLoop.js';
import { DiscoveryManager } from './systems/core/DiscoveryManager.js';

import { SaveManager } from './systems/core/SaveManager.js';
import * as NotificationSystem from './systems/core/NotificationSystem.js';

// === State ===
import { GameState } from './state/GameState.js';

// === Hero Systems ===
import * as HeroManager from './systems/hero/HeroManager.js';
import * as SkillSystem from './systems/hero/SkillSystem.js';
import * as RegenSystem from './systems/hero/RegenSystem.js';
import * as ModifierAggregator from './systems/global/ModifierAggregator.js';
import * as EffectProcessor from './systems/effects/EffectProcessor.js';
import * as EquipmentManager from './systems/equipment/EquipmentManager.js';

// === Registries ===
import { CARDS, getCard as getCardTemplate, getTaskCards } from './config/registries/cardRegistry.js';
import { ITEMS, getAllItems } from './config/registries/itemRegistry.js';

// === Card Systems ===
import * as CardManager from './systems/cards/CardManager.js';
import { ensureModular } from './systems/cards/CardAssembler.js';
import { TaskSystem } from './systems/task/TaskSystem.js';
import { PackSystem } from './systems/cards/PackSystem.js';
import * as DeckSystem from './systems/cards/DeckSystem.js';
// === Inventory Systems ===
import { InventoryManager } from './systems/inventory/InventoryManager.js';
import { InventoryGroupManager } from './systems/economy/InventoryGroupManager.js';
import ProjectManager from './systems/project/ProjectManager.js';

import * as ToastNotification from './ui/components/ToastNotificationComponent.js';

import { renderSlotSelection, bindSlotSelection } from './ui/modals/SlotSelectionModal.js';
import { renderModal, bindModal, showModal, hideModal } from './ui/components/ModalComponent.js';

import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactRoot from './ui/ReactRoot.jsx';

logger.info('main', 'Fantasy Guild starting...');

window.Game = {
    GameState,
    EventBus,
    SaveManager,
    InventoryManager,
    InventoryGroupManager,
    HeroManager,
    TaskSystem,
    CardManager,
    SkillSystem,
    CombatSystem,
    WoundedSystem,
    LootSystem,
    InvasionManager,
    PackSystem,
    DeckSystem,
    AreaSystem,
    EffectProcessor,
    EquipmentManager,
    ProjectManager
};
window.GameState = GameState;
logger.debug('main', 'DEV: Global window.Game and window.GameState objects exposed for debugging.');

// Initialize systems that need event subscriptions
LootSystem.init();
InvasionManager.init();
ThreatSystem.init();
// AreaSystem.init(); // @deprecated - replaced by PackSystem
PackSystem.init();

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

// Threat & Invasion system (Regional Chaos and Active Threat)
GameLoop.onTick('threat_system', (delta) => {
    if (GameState.getIsInitialized()) {
        ThreatSystem.tick(delta);
    }
});

/**
 * Create default heroes and cards for a new game
 */
function createDefaultGameData() {
    logger.debug('main', 'Creating default cards...');

    // Create 1 FREE starting recruit card (they use unshift to go to top)
    // RecruitSystem.createRecruitCard(true);  // isFree = true (REMOVED)

    // Give player starting gold to buy their first packs
    if (GameState.state?.currency) {
        GameState.state.currency.gold = 100;
    }

    // Initialize exploration tracking in GameState (legacy compat)
    if (!GameState.exploration) {
        GameState.exploration = { count: 0 };
    }

    logger.debug('main', 'Created 1 starting recruit card and 100 starting gold');
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
    DiscoveryManager.init();
    AudioSystem.init();





    // Initialize inventory first (must be done before rendering)
    InventoryManager.init();
    InventoryGroupManager.init();
    ProjectManager.init();

    // Create default data for new games
    if (isNewGame) {
        // Initialize the grid FIRST so auto-positioning in createCard works
        AreaSystem.initGridForArea(GameState.state.ui.activeAreaId);
        createDefaultGameData();
    }

    // Rebuild card lookup cache to ensure all current cards are indexed
    GameState.rebuildCardCache();

    // Catch-all: Ensure all cards (including legacy) are synchronized with modular traits
    const activeCards = GameState.cards?.active || [];
    activeCards.forEach(card => ensureModular(card, getCardTemplate(card.templateId)));

    // Catch-all: Initialize grid and position any unplaced cards (crucial for legacy loads)
    AreaSystem.initGridForArea(GameState.state.ui.activeAreaId);

    // Start the game loop
    GameLoop.start();

    // Trigger initial render for React
    EventBus.publish('state_changed');
    EventBus.publish('heroes_updated');
    EventBus.publish('inventory_updated');
    EventBus.publish('cards_updated');

    NotificationSystem.success('Game ready!');
}

// === Initialize UI and Show Slot Selection ===
document.addEventListener('DOMContentLoaded', async () => {
    const app = document.getElementById('app');
    if (!app) {
        console.error('Could not find #app element');
        return;
    }

    // 1. Initialize Core Utilities
    const { initializeAssets } = await import('./utils/AssetManager.js');
    await initializeAssets();

    // Initialize SaveManager and SettingsManager
    SaveManager.init();

    const { SettingsManager } = await import('./systems/core/SettingsManager.js');
    SettingsManager.init();

    // Apply the configured font (default is pixel)
    const fontPref = SettingsManager.get('ui.fontFamily') || 'pixel';
    document.body.dataset.font = fontPref;

    // Update font dynamically if user changes it
    EventBus.subscribe('settings_updated', (settings) => {
        if (settings.ui && settings.ui.fontFamily) {
            document.body.dataset.font = settings.ui.fontFamily;
        }
    });

    // Initialize toast notifications first (before any notifications)
    // ToastNotification.init(); // REMOVED: Consolidation into React ToastContainer

    logger.info('main', 'UI initialized, showing slot selection...');

    // React Mounting (Strangler Fig Bridge)
    const reactRootEl = document.getElementById('react-root');
    if (reactRootEl) {
        const root = createRoot(reactRootEl);
        root.render(<ReactRoot engine={window.Game} />);
        logger.info('main', 'React EngineProvider mounted successfully.');
    }

    // Wait for React UI to report slot selection complete
    EventBus.subscribe('react:slot_selected', (data) => {
        onSlotSelected(data.index, data.isNewGame);
    });

    // Global Event Listeners
    window.addEventListener('combat-style-change', (event) => {
        const { cardId, style } = event.detail;
        if (cardId && style) {
            CardManager.updateCombatStyle(cardId, style);
        }
    });
});
