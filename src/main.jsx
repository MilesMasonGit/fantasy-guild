// Fantasy Guild - Main Entry Point
// Optimized via Auditor Persona

import './tailwind.css';
import './styles/main.css';
import './styles/components.css';
import './styles/modals.css';
import './styles/cards/modules/core.css';
import './styles/cards/modules/wrapper.css';
import './styles/cards/modules/slots.css';
import './styles/cards/modules/combat.css';
import './styles/cards/modules/combat-groups.css';
import './styles/cards/modules/loot-table.css';
import './ui/styles/index.css';

// === Core React & Rendering ===
import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactRoot from './ui/ReactRoot.jsx';

// === System Orchestration ===
import { EngineBootstrap } from './systems/core/EngineBootstrap.js';
import { EventBus } from './systems/core/EventBus.js';
import { GameState } from './state/GameState.js';
import { SaveManager } from './systems/core/SaveManager.js';
import { SettingsManager } from './systems/core/SettingsManager.js';
import { logger } from './utils/Logger.js';

/**
 * Fantasy Guild Idle - Bootstrap Lifecycle
 */
document.addEventListener('DOMContentLoaded', async () => {
    const app = document.getElementById('app');
    if (!app) {
        console.error('Critical Error: #app element not found');
        return;
    }

    logger.info('main', 'Fantasy Guild Initializing...');

    // 1. Initialize Asset Pipeline
    const { initializeAssets } = await import('./utils/AssetManager.js');
    initializeAssets();

    // 2. Initialize Core Management Layers
    SaveManager.init();
    SettingsManager.init();

    // 3. Assemble Full Engine Suite
    const engine = EngineBootstrap.getEngine();

    // 4. Configure Development Environment (Debug Hooks)
    if (import.meta.env.DEV) {
        window.Game = engine;
        window.GameState = engine.GameState;
        logger.debug('main', 'DEBUG: window.Game and window.GameState exposed.');
    }

    // 5. Initialize Sound System Preferences
    const fontPref = SettingsManager.get('ui.fontFamily') || 'silkpixel';
    document.body.dataset.font = fontPref;
    const allCapsPref = SettingsManager.get('ui.allCaps') !== false;
    document.body.dataset.allcaps = allCapsPref ? 'true' : 'false';
    EventBus.subscribe('settings_updated', (s) => {
        if (s.ui?.fontFamily) document.body.dataset.font = s.ui.fontFamily;
        if (s.ui && s.ui.allCaps !== undefined) {
            document.body.dataset.allcaps = s.ui.allCaps ? 'true' : 'false';
        }
    });

    // 6. Initialize Interaction & Registry Overlays
    EngineBootstrap.init();

    // 7. Mount the React UI Engine
    const reactRootEl = document.getElementById('react-root');
    if (reactRootEl) {
        const root = createRoot(reactRootEl);
        root.render(<ReactRoot engine={engine} />);
        logger.info('main', 'React UI Engine online.');
    }

    // 7. Handle Post-UI Lifecycle Events
    EventBus.subscribe('react:slot_selected', (data) => {
        EngineBootstrap.onSlotSelected(data.index, data.isNewGame);
    });


    logger.info('main', 'Bootstrap complete. Waiting for user interaction.');
});
