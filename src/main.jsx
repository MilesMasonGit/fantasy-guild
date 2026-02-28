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
// import './styles/cards/invasion.css';
// import './styles/modals.css';

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
// === Inventory Systems ===
import { InventoryManager } from './systems/inventory/InventoryManager.js';

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
    HeroManager,
    TaskSystem,
    CardManager,
    CombatSystem,
    WoundedSystem,
    LootSystem,
    InvasionManager
};
logger.debug('main', 'DEV: Global window.Game object exposed for debugging.');

// Initialize systems that need event subscriptions
LootSystem.init();
InvasionManager.init();
AreaSystem.init();

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

// Invasion system (escalation)
GameLoop.onTick('invasion_system', (delta) => {
    if (GameState.getIsInitialized()) {
        InvasionManager.processTick(delta);
    }
});

/**
 * Create default heroes and cards for a new game
 */
function createDefaultGameData() {
    logger.debug('main', 'Creating default cards...');

    // Create 1 FREE starting recruit card (they use unshift to go to top)
    RecruitSystem.createRecruitCard(true);  // isFree = true



    // Create starting Explore card for Guild Hall
    CardManager.createCard('explore_abandoned_guild_hall');

    // Give player 1 starting Ancient Key (required to explore Guild Hall)
    InventoryManager.addItem('key_ancient', 1);

    // Initialize exploration tracking in GameState
    if (!GameState.exploration) {
        GameState.exploration = { count: 0 };
    }

    logger.debug('main', 'Created 1 starting recruit card and 1 Ancient Key');
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

    // CRITICAL: Initialize ExploreSystem BEFORE creating cards
    // This ensures the card_spawned listener is ready to generate slots
    ExploreSystem.init();



    // Initialize inventory first (must be done before rendering)
    InventoryManager.init();

    // Create default data for new games
    if (isNewGame) {
        createDefaultGameData();
    }

    // Rebuild card lookup cache to ensure INITIAL_STATE cards are indexed
    // This catches both loaded cards and pre-spawned initial cards
    GameState.rebuildCardCache();

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
    const usePixelFont = SettingsManager.get('ui.usePixelFont') !== false;
    document.body.dataset.font = usePixelFont ? 'pixel' : 'inter';

    // Update font dynamically if user changes it
    EventBus.subscribe('settings_updated', (settings) => {
        if (settings.ui) {
            document.body.dataset.font = settings.ui.usePixelFont !== false ? 'pixel' : 'inter';
        }
    });

    // Initialize toast notifications first (before any notifications)
    ToastNotification.init();

    logger.info('main', 'UI initialized, showing slot selection...');

    // React Mounting (Strangler Fig Bridge)
    const reactRootEl = document.getElementById('react-root');
    if (reactRootEl) {
        const root = createRoot(reactRootEl);
        root.render(<ReactRoot engine={window.Game} />);
        logger.info('main', 'React EngineProvider mounted successfully.');
    }

    // Show slot selection modal (Temporary Vanilla fallback until ported to React)
    const showSlotSelection = (onSelect) => {
        const slots = SaveManager.getAllSlotInfos();
        const content = renderSlotSelection(slots);
        const modal = renderModal(content, { title: 'Fantasy Guild', hideClose: true });

        bindSlotSelection(modal.querySelector('.slot-selection'), {
            onLoad: (index) => {
                const success = SaveManager.loadSlot(index);
                hideModal(modal);
                onSelect(index, !success);
            },
            onNew: (index) => {
                SaveManager.newGame(index);
                hideModal(modal);
                onSelect(index, true);
            },
            onDelete: (index) => {
                if (confirm('Are you sure you want to delete this save?')) {
                    SaveManager.deleteSlot(index);
                    hideModal(modal);
                    showSlotSelection(onSelect);
                }
            }
        });
        showModal(modal);
    };

    showSlotSelection(onSlotSelected);

    // Global Event Listeners
    window.addEventListener('combat-style-change', (event) => {
        const { cardId, style } = event.detail;
        if (cardId && style) {
            CardManager.updateCombatStyle(cardId, style);
        }
    });
});
