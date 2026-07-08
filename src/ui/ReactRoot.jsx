import React from 'react';
import { cn } from './utils/cn.js';
import { USE_DECK_LOOP } from '../config/featureFlags.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EventBus } from '../systems/core/EventBus.js';

// Providers & Context
import { EngineProvider } from './context/EngineContext.jsx';
import { DndProvider } from './context/DndProvider.jsx';
import { ViewportProvider } from './context/ViewportContext.jsx';

// Hooks
import { useUIModals } from './hooks/useUIModals.js';

// Components
import TopBarView from './components/TopBarView.jsx';
import HeroView from './components/HeroView.jsx';
import InvView from './components/InvView.jsx';
import CardView from './components/CardView.jsx';
import TavernDrawer from './components/TavernDrawer.jsx';
import InvasionHUD from './components/hud/InvasionHUD.jsx';
import LayoutSandbox from './components/sandbox/LayoutSandbox.jsx';

// Base Components / HUD
import { FPSCounter } from './components/base/FPSCounter.jsx';
import { ParticleOverlay } from './components/base/ParticleOverlay.jsx';
import ToastContainer from './components/base/ToastContainer.jsx';
import TestDashboard from './components/TestDashboard.jsx';

// Overlays & Modals
import PackOpeningOverlay from './components/PackOpeningOverlay.jsx';
import SettingsModal from './modals/SettingsModal.jsx';
import CardLibraryModal from './modals/CardLibraryModal.jsx';
import CollectionBinderModal from './modals/CollectionBinderModal.jsx';
import CollectionModal from './modals/CollectionModal.jsx';
import SpawnEntityModal from './modals/SpawnEntityModal.jsx';
import SlotSelectionModal from './modals/SlotSelectionModal.jsx';
import BonusModal from './modals/BonusModal.jsx';
import WorldMapDrawer from './components/WorldMapDrawer.jsx';
import AreaUnlockOverlay from './components/AreaUnlockOverlay.jsx';
import HeroCustomizeModal from './modals/HeroCustomizeModal.jsx';

/**
 * ReactRoot - The definitive entry point for the React UI layer.
 * Manages the top-level layout, provides the Engine/DnD context, 
 * and orchestrates global modal overlays.
 */
export const ReactRoot = ({ engine }) => {
    // --- Modular State Management ---
    const ui = useUIModals(engine);

    // --- Core Actions ---
    const handleSlotSelect = async (index) => {
        const isEmpty = !engine.SaveManager.hasSlot(index);
        if (isEmpty) {
            engine.SaveManager.newGame(index);
        } else {
            const loaded = await engine.SaveManager.loadSlot(index);
            // Refused (incompatible version) or corrupted — stay on the slot
            // screen; the notification explains why.
            if (!loaded) return;
        }
        ui.slotSelection.close();
        engine.EventBus.publish('react:slot_selected', { index, isNewGame: isEmpty });
    };


    // --- Panel Visibility State ---
    const [leftVisible, setLeftVisible] = React.useState(true);
    const [rightVisible, setRightVisible] = React.useState(true);

    // --- Dynamic Debug Mode Subscription ---
    const [debugMode, setDebugMode] = React.useState(() => SettingsManager.get('debugMode') ?? false);

    React.useEffect(() => {
        const unsubscribe = EventBus.subscribe('settings_updated', (s) => {
            setDebugMode(s.debugMode ?? false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <EngineProvider engine={engine}>
            <ViewportProvider>
                <DndProvider engine={engine}>
                <ParticleOverlay disabled={ui.isAnyModalOpen} />
                {/* 1. Main Application Layout */}
                <div className="react-overlay absolute inset-0 z-50 pointer-events-none flex flex-col">
                    <div className="pointer-events-auto w-full">
                        <TopBarView
                            onSettingsClick={ui.settings.open}
                            onWorldMapClick={ui.worldMap.toggle}
                            onCardLibraryClick={ui.cardLibrary.open}
                            onCodexClick={ui.codex.toggle}
                            onBonusesClick={ui.bonuses.open}
                        />
                    </div>

                    <div className="flex-1 relative flex overflow-hidden">
                        {/* Center: Playmat (old) or Area Deck Loop (new, placeholder until Phase 6) */}
                        <div className="flex-1 overflow-y-auto pointer-events-auto relative z-0">
                            {USE_DECK_LOOP ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center opacity-60">
                                        <div className="text-2xl font-bold">Deck Loop Mode</div>
                                        <div className="text-sm mt-2">Area Banner Rows arrive in Phase 6</div>
                                    </div>
                                </div>
                            ) : (
                                <CardView
                                    onOpenWorldMap={ui.worldMap.close}
                                    leftVisible={leftVisible}
                                    rightVisible={rightVisible}
                                    isTavernOpen={ui.tavern.isOpen}
                                />
                            )}
                            
                            {/* Global HUD Layer (Pushes notifications and global overlays) */}
                            <div className={cn(
                                "absolute inset-y-0 z-[100] pointer-events-none transition-all duration-300 ease-in-out",
                                !leftVisible ? "left-0" : (ui.tavern.isOpen ? "left-[34rem]" : "left-64"),
                                rightVisible ? "right-64" : "right-0"
                            )}>
                                <div className="relative w-full h-full">
                                    <InvasionHUD />
                                    <ToastContainer />
                                </div>
                            </div>
                        </div>

                        {/* Left Panel: Heroes/Tavern (Absolute Overlay) */}
                        <div className={cn(
                            "absolute top-0 left-0 h-full z-[90] transition-transform duration-300 ease-in-out pointer-events-auto flex-shrink-0",
                            !leftVisible && "-translate-x-full"
                        )}>
                            <div className="h-full relative shadow-2xl">
                                <HeroView
                                    isTavernOpen={ui.tavern.isOpen}
                                    onTavernToggle={ui.tavern.toggle}
                                />
                                
                                {/* Toggle Tab */}
                                <div 
                                    className="panel-tab panel-tab--left group"
                                    onClick={() => setLeftVisible(!leftVisible)}
                                >
                                    <span>{leftVisible ? "HIDE" : "HEROES"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Panel: Vault/Inventory (Absolute Overlay) */}
                        <div className={cn(
                            "absolute top-0 right-0 h-full z-[90] transition-transform duration-300 ease-in-out pointer-events-auto flex-shrink-0",
                            !rightVisible && "translate-x-full"
                        )}>
                            <div className="h-full relative shadow-2xl">
                                <InvView />

                                {/* Toggle Tab */}
                                <div 
                                    className="panel-tab panel-tab--right group"
                                    onClick={() => setRightVisible(!rightVisible)}
                                >
                                    <span>{rightVisible ? "HIDE" : "VAULT"}</span>
                                </div>
                            </div>
                        </div>

                        <TavernDrawer
                            isOpen={ui.tavern.isOpen}
                            onClose={ui.tavern.close}
                        />
                    </div>
                </div>

                {/* 2. Global HUD Components */}
                {(import.meta.env.DEV || debugMode) && (
                    <>
                        <TestDashboard />
                        <FPSCounter />
                    </>
                )}

                {/* 3. Modal Layer Overlays */}
                <SettingsModal isOpen={ui.settings.isOpen} onClose={ui.settings.close} />
                <SpawnEntityModal isOpen={ui.spawnEntity.isOpen} onClose={ui.spawnEntity.close} />
                <SlotSelectionModal isOpen={ui.slotSelection.isOpen} onSelect={handleSlotSelect} />
                {ui.worldMap.isOpen && <WorldMapDrawer isOpen onClose={ui.worldMap.close} />}
                {/* Same TopBar button, different card manager per mode: the old
                    board library flag-off, the Collection Binder (Phase 5 §5D)
                    flag-on. The old modal retires in Phase 9. */}
                {ui.cardLibrary.isOpen && (
                    USE_DECK_LOOP
                        ? <CollectionBinderModal isOpen onClose={ui.cardLibrary.close} />
                        : <CardLibraryModal isOpen onClose={ui.cardLibrary.close} />
                )}
                {ui.codex.isOpen && <CollectionModal isOpen onClose={ui.codex.close} />}
                {ui.bonuses.isOpen && <BonusModal isOpen onClose={ui.bonuses.close} />}
                <HeroCustomizeModal 
                    isOpen={ui.heroCustomize.isOpen} 
                    onClose={ui.heroCustomize.close} 
                    heroId={ui.heroCustomize.heroId} 
                />
                
                <AreaUnlockOverlay />
                
                {ui.pack.results && (
                    <PackOpeningOverlay 
                        results={ui.pack.results} 
                        onClose={() => ui.pack.setResults(null)} 
                    />
                )}

                {/* 4. Development Tooling */}
                {ui.sandbox.isOpen && (
                    <div className="pointer-events-auto absolute inset-0 z-[1000] bg-gi-background">
                        <LayoutSandbox />
                        <button
                            onClick={ui.sandbox.toggle}
                            className="absolute top-4 right-4 p-2 bg-gi-danger/20 text-gi-danger rounded hover:bg-gi-danger hover:text-white pointer-events-auto z-50 transition-colors shadow-lg"
                        >
                            Close Sandbox
                        </button>
                    </div>
                )}
                </DndProvider>
            </ViewportProvider>
        </EngineProvider>
    );
};

export default ReactRoot;
