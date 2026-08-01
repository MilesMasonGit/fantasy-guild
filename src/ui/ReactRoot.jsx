import React from 'react';
import { cn } from './utils/cn.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EventBus } from '../systems/core/EventBus.js';

// Providers & Context
import { EngineProvider } from './context/EngineContext.jsx';
import { DeckDndProvider } from './dnd/DndKit.jsx';
import { ViewportProvider } from './context/ViewportContext.jsx';

// Hooks
import { useUIModals } from './hooks/useUIModals.js';

// Components
import AreaBannerContainer from './components/banner/AreaBannerContainer.jsx';
import UniversalBucketPanel from './components/banner/UniversalBucketPanel.jsx';
import BottomFolderDrawer from './components/drawer/BottomFolderDrawer.jsx';
import BubbleMenu from './components/nav/BubbleMenu.jsx';
import HeroDock from './components/dock/HeroDock.jsx';
import GuildHallScreen from './components/fullscreen/GuildHallScreen.jsx';
import PackShopScreen from './components/fullscreen/PackShopScreen.jsx';
import AreaManagerScreen from './components/fullscreen/AreaManagerScreen.jsx';
import LayoutSandbox from './components/sandbox/LayoutSandbox.jsx';

// Base Components / HUD
import { FPSCounter } from './components/base/FPSCounter.jsx';
import { ParticleOverlay } from './components/base/ParticleOverlay.jsx';
import ToastContainer from './components/base/ToastContainer.jsx';
import TestDashboard from './components/TestDashboard.jsx';
import TimeBankWidget from './components/hud/TimeBankWidget.jsx';

// Overlays & Modals
import PackOpeningOverlay from './components/PackOpeningOverlay.jsx';
import SettingsModal from './modals/SettingsModal.jsx';
import CollectionBinderModal from './modals/CollectionBinderModal.jsx';
import SlotSelectionModal from './modals/SlotSelectionModal.jsx';
import BonusModal from './modals/BonusModal.jsx';
import HeroEditModal from './modals/HeroEditModal.jsx';
import AreaUnlockOverlay from './components/AreaUnlockOverlay.jsx';

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

    // --- Dynamic Debug Mode Subscription ---
    const [debugMode, setDebugMode] = React.useState(() => SettingsManager.get('debugMode') ?? false);
    // Bubble menu side (UI overhaul Phase 1 §COL-01): left by default,
    // right via the Settings toggle.
    const [menuRight, setMenuRight] = React.useState(() => SettingsManager.get('ui.bubbleMenuRight') ?? false);

    React.useEffect(() => {
        const unsubscribe = EventBus.subscribe('settings_updated', (s) => {
            setDebugMode(s.debugMode ?? false);
            setMenuRight(s.ui?.bubbleMenuRight ?? false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <EngineProvider engine={engine}>
            <ViewportProvider>
                <DeckDndProvider engine={engine}>
                <ParticleOverlay disabled={ui.isAnyModalOpen} />
                {/* 1. Main Application Layout */}
                <div className="react-overlay absolute inset-0 z-50 pointer-events-none flex flex-col">
                    {/* Overhaul layout (ui_overhaul_spec.md): bubble column
                        flanking banner rows over the Bottom Folder Drawer. */}
                    <div className="flex-1 relative flex overflow-hidden">
                        {!menuRight && <BubbleMenu ui={ui} side="left" />}
                        <div className="flex-1 relative flex flex-col overflow-hidden">
                            {/* Banner list + the Universal Bucket column beside
                                it (D-53). The bucket applies to every banner, so
                                it sits outside them and scrolls on its own. */}
                            <div className="flex-1 flex min-h-0">
                            <div
                                data-dnd-surface="board"
                                data-dnd-region="board"
                                className="flex-1 overflow-y-auto pointer-events-auto relative z-0 min-h-0"
                            >
                                <AreaBannerContainer />
                                {/* Global HUD Layer */}
                                <div className="absolute inset-0 z-[100] pointer-events-none">
                                    <div className="relative w-full h-full">
                                        <ToastContainer />
                                        {/* Time Bank (Phase 8) — provisional home since the
                                            TopBar retired; placement pending owner review. */}
                                        <div className="absolute top-2 right-2 pointer-events-auto">
                                            <TimeBankWidget />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <UniversalBucketPanel />
                            </div>
                            <BottomFolderDrawer drawer={ui.drawer} inspect={ui.inspect} menuRight={menuRight} cardTier={ui.cardTier} />
                            {/* Full-screen drawers (overhaul Phase 4) — cover
                                the play area, bubble column stays visible. */}
                            {ui.fullscreen.view === 'guild' && <GuildHallScreen onClose={ui.fullscreen.close} />}
                            {ui.fullscreen.view === 'packs' && <PackShopScreen onClose={ui.fullscreen.close} />}
                            {ui.fullscreen.view === 'areas' && <AreaManagerScreen onClose={ui.fullscreen.close} />}
                            {/* Hero Dock — always-visible roster strip along
                                the bottom edge. Floats over the play area
                                and the Bank drawer (roadmap D9). */}
                            <HeroDock dock={ui.dock} />
                        </div>
                        {menuRight && <BubbleMenu ui={ui} side="right" />}
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
                <SlotSelectionModal isOpen={ui.slotSelection.isOpen} onSelect={handleSlotSelect} />
                {/* Collection Binder (Phase 5 §5D) — completionist gallery. */}
                {ui.cardLibrary.isOpen && <CollectionBinderModal isOpen onClose={ui.cardLibrary.close} />}
                {ui.bonuses.isOpen && <BonusModal isOpen onClose={ui.bonuses.close} />}
                {/* Hero Edit — name, portrait, retire (Hero Dock Phase 7).
                    Opened by the Edit button on a pinned dock card. */}
                {ui.dock.editHeroId && (
                    <HeroEditModal
                        heroId={ui.dock.editHeroId}
                        isOpen
                        onClose={ui.dock.closeEdit}
                    />
                )}

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
                </DeckDndProvider>
            </ViewportProvider>
        </EngineProvider>
    );
};

export default ReactRoot;
