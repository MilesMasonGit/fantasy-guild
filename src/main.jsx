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
import { createRoot } from 'react-dom/client';
import ReactRoot from './ui/ReactRoot.jsx';
import { ErrorBoundary } from './ui/components/base/ErrorBoundary.jsx';

// === System Orchestration ===
import { EngineBootstrap } from './systems/core/EngineBootstrap.js';
import { EventBus } from './systems/core/EventBus.js';
import { SaveManager } from './systems/core/SaveManager.js';
import { SettingsManager } from './systems/core/SettingsManager.js';
import { preloadGameArt } from './systems/core/AssetPreloader.js';
import { loadSpriteFxManifest } from './ui/utils/spriteFx.js';
import { logger } from './utils/Logger.js';
import { ENGINE_EVENTS, UI_EVENTS } from './systems/core/engineEvents.js';

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

    // Prevent default browser context menu globally for game/desktop feel
    document.addEventListener('contextmenu', (e) => {
        // Allow text input / textarea inspect if needed, otherwise prevent default
        if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
        e.preventDefault();
    });

    // 1. Initialize Asset Pipeline
    // Art preload runs concurrently with engine setup; the React mount below
    // gates on the critical subset so first paint never shows sprite pop-in.
    const artReady = preloadGameArt();
    // Wave 5: which sprites have a generated hard shadow and outlines
    // (`scripts/spriteFx.mjs`). A small file; failure only means no effects.
    const fxReady = loadSpriteFxManifest();
    // `AssetManager.initializeAssets()` used to be dynamically imported and
    // called here. It was an empty function kept for "legacy support for
    // main.jsx" — i.e. this line was the only reason it existed. Both went on
    // 2026-08-24 (CR2-103). `preloadGameArt()` above is the real pipeline.

    // 2. Initialize Core Management Layers
    // SettingsManager must load stored settings BEFORE SaveManager reads the
    // autosave interval from it (CR-004).
    SettingsManager.init();
    SaveManager.init();

    // 3. Assemble Full Engine Suite
    const engine = EngineBootstrap.getEngine();

    // 4. Configure Development Environment (Debug Hooks)
    if (import.meta.env.DEV) {
        window.Game = engine;
        window.GameState = engine.GameState;
        logger.debug('main', 'DEBUG: window.Game and window.GameState exposed.');
    }

    // 5. Initialize UI / Typography / Sound Preferences
    const fontPref = SettingsManager.get('ui.fontFamily') || 'silkpixel';
    document.body.dataset.font = fontPref;
    const allCapsPref = SettingsManager.get('ui.allCaps') !== false;
    document.body.dataset.allcaps = allCapsPref ? 'true' : 'false';
    SettingsManager.applyFontSizes();
    EventBus.subscribe(ENGINE_EVENTS.SETTINGS_UPDATED, (s) => {
        if (s.ui?.fontFamily) document.body.dataset.font = s.ui.fontFamily;
        if (s.ui && s.ui.allCaps !== undefined) {
            document.body.dataset.allcaps = s.ui.allCaps ? 'true' : 'false';
        }
        if (s.ui?.fontSizes) {
            SettingsManager.applyFontSizes(s.ui.fontSizes);
        }
    });

    // 6. Initialize Interaction & Registry Overlays
    EngineBootstrap.init();

    // 7. Mount the React UI Engine (gated on critical art being warm)
    await Promise.all([artReady, fxReady]);
    const reactRootEl = document.getElementById('react-root');
    if (reactRootEl) {
        const root = createRoot(reactRootEl);
        // CR3-203: the last-resort boundary. Everything that matters is
        // already covered by its own named boundary inside ReactRoot; this
        // one only catches whatever isn't under a named surface yet.
        root.render(
            <ErrorBoundary label="App">
                <ReactRoot engine={engine} />
            </ErrorBoundary>
        );
        logger.info('main', 'React UI Engine online.');
    }

    // Perf harness (round-3 review, P3): `window.__perf`, the Perf HUD and
    // `?stress=<name>`. Dev builds only — a production build drops this line
    // and the whole of src/ui/dev/perf with it.
    if (import.meta.env.DEV) {
        import('./ui/dev/perf/perfHarness.js').then(m => m.installPerf());
    }

    // Dismiss the boot splash now that the UI is mounted over warm art.
    const splash = document.getElementById('boot-splash');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 350);
    }

    // 7. Handle Post-UI Lifecycle Events
    EventBus.subscribe(UI_EVENTS.REACT_SLOT_SELECTED, (data) => {
        EngineBootstrap.onSlotSelected(data.index, data.isNewGame);
    });


    logger.info('main', 'Bootstrap complete. Waiting for user interaction.');
});
