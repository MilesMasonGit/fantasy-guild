import React from 'react';
import { AnimatePresence } from 'framer-motion';
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
import Board from './components/board/Board.jsx';
import Tray from './components/board/Tray.jsx';
import BottomFolderDrawer from './components/drawer/BottomFolderDrawer.jsx';

import { DOCK_RESERVED_H } from './components/dock/dockConstants.js';
import BubbleMenu from './components/nav/BubbleMenu.jsx';
import HeroDock from './components/dock/HeroDock.jsx';
import VerticalHeroDock from './components/dock/VerticalHeroDock.jsx';
import GuildHallScreen from './components/fullscreen/GuildHallScreen.jsx';
import LayoutSandbox from './components/sandbox/LayoutSandbox.jsx';
import { TokenInspectPopup } from './components/board/TokenInspectPopup.jsx';

// Base Components / HUD
import { FPSCounter } from './components/base/FPSCounter.jsx';
import { ParticleOverlay } from './components/base/ParticleOverlay.jsx';
import ToastContainer from './components/base/ToastContainer.jsx';
import TestDashboard from './components/TestDashboard.jsx';
import TimeBankWidget from './components/hud/TimeBankWidget.jsx';

/** Time Bank widget visibility — parked, not deleted (owner request
 *  2026-08-02). The widget and its manager are untouched; only the HUD
 *  placement is switched off, so restoring it is this one flag. */
const SHOW_TIME_BANK = false;

// Overlays & Modals
import SettingsModal from './modals/SettingsModal.jsx';
import SlotSelectionModal from './modals/SlotSelectionModal.jsx';
import HeroEditModal from './modals/HeroEditModal.jsx';
import JobChangeModal from './modals/JobChangeModal.jsx';
import LootTableModal from './modals/LootTableModal.jsx';

/**
 * The notifications column — the second of the play area's four (D-237).
 *
 * The play area reads **nav · notifications · playmat · tray**, left to right
 * (owner decision 2026-08-11), mirroring to **tray · playmat · notifications ·
 * nav** when the bubble menu is flipped to the right, so notifications always
 * sit beside the nav rather than swapping to the far side.
 *
 * ⚠️ **It reserves its width whether or not anything is in it.** A column that
 * only appeared when a toast arrived would shove the board sideways every time
 * the game said something, which is worse than the space it costs — and the
 * board cannot absorb the movement, since D-171 fixes it at 896px.
 *
 * ⚠️ **This is width the play area did not need before.** Nav (150) + this (256)
 * + board (896) + tray (256) wants ~1558px before the board starts clipping,
 * against ~1302px previously. Narrow windows are "small mode" (roadmap G-20),
 * which is the agreed answer rather than shrinking anything here.
 *
 * The width is a placeholder matching the Tray, for symmetry either side of the
 * board. Refining it is expected — but note the floor: `Toast` carries
 * `min-w-[220px]`, so under about 240px the toasts overflow their own column.
 */
const NotificationColumn = ({ menuRight = false }) => (
    <aside
        className={cn(
            'w-64 md:w-80 xl:w-[356px] shrink-0 flex flex-col min-h-0 bg-gi-base/40 pointer-events-auto transition-[width] duration-150',
            // The divider faces the board, so it stays between this column and
            // the playmat when the whole arrangement mirrors.
            menuRight ? 'border-l border-gi-border/40' : 'border-r border-gi-border/40'
        )}
    >
        <ToastContainer />
    </aside>
);

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

    // Dynamic Debug Mode Subscription ---
    const [debugMode, setDebugMode] = React.useState(() => SettingsManager.get('debugMode') ?? false);
    // Bubble menu side (UI overhaul Phase 1 §COL-01): left by default,
    // right via the Settings toggle.
    const [menuRight, setMenuRight] = React.useState(() => SettingsManager.get('ui.bubbleMenuRight') ?? false);
    const [backgroundTile, setBackgroundTile] = React.useState(() => SettingsManager.get('ui.backgroundTile') ?? 'pm_table_wood_spruce');

    React.useEffect(() => {
        const unsubscribe = EventBus.subscribe('settings_updated', (s) => {
            setDebugMode(s.debugMode ?? false);
            setMenuRight(s.ui?.bubbleMenuRight ?? false);
            setBackgroundTile(s.ui?.backgroundTile ?? 'pm_table_wood_spruce');
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
                    <div 
                        className="flex-1 relative flex overflow-hidden bg-black"
                        style={{
                            backgroundImage: `url('/assets/ui/${backgroundTile}.png')`,
                            backgroundRepeat: 'repeat',
                            backgroundSize: '512px',
                            imageRendering: 'pixelated',
                            backgroundColor: '#0a0a0a'
                        }}
                    >
                        {!menuRight && <BubbleMenu ui={ui} side="left" />}
                        {!menuRight && <NotificationColumn />}
                        <div className="flex-1 relative flex flex-col overflow-hidden">
                            {/* Banner list + the Universal Bucket column beside
                                it (D-53). The bucket applies to every banner, so
                                it sits outside them and scrolls on its own. */}
                            {/* `relative` so the Hero Dock can anchor to the
                                BOTTOM OF THE PLAY AREA rather than the bottom
                                of the screen: when a bottom drawer opens this
                                box shrinks, and the dock rides up to rest on
                                the drawer's top edge instead of floating over
                                its lower band (owner request 2026-08-02). */}
                            <div className="flex-1 flex min-h-0 relative">
                            {/* ⚠️ The Tray leads when the nav is on the right, so
                                the mirror is a true mirror. Without this the
                                order became board, tray, notifications, nav —
                                which leaves **notifications and playmat
                                non-contiguous**, and the side drawer (D-238) has
                                to cover exactly those two and not the Tray. */}
                            {menuRight && (
                                ui.drawer.panes.includes('bank') ? (
                                    <VerticalHeroDock dock={ui.dock} />
                                ) : (
                                    <Tray 
                                        isVaultOpen={ui.drawer.panes.includes('vault')}
                                        onInspectToken={(typeId, rect) => ui.inspect.set('token', typeId, { rect })} 
                                        onClearInspect={() => ui.inspect.clear()} 
                                    />
                                )
                            )}
                            <div
                                data-dnd-surface="board"
                                data-dnd-region="board"
                                className="flex-1 overflow-y-auto pointer-events-auto relative z-0 min-h-0"
                            >
                                {/* The Guild Hall tile opens the upgrade tree —
                                    upgrades are installed on the centre tile, so
                                    that is where they are bought (D-121). */}
                                <Board
                                    onOpenGuildHall={() => ui.nav.toggle('guild')}
                                    onInspectToken={(typeId, rect) => ui.inspect.set('token', typeId, { rect })}
                                    inspectSelection={ui.inspect.selection}
                                    onClearInspect={() => ui.inspect.clear()}
                                />
                                {/* Global HUD Layer.
                                    ⚠️ `ToastContainer` used to live here, floating
                                    over the board. It is now its own column
                                    (D-237) — see `NotificationColumn` below. */}
                                <div className="absolute inset-0 z-[100] pointer-events-none">
                                    <div className="relative w-full h-full">
                                        {/* Time Bank (Phase 8) — hidden for now (owner
                                            request 2026-08-02). Its home here was always
                                            provisional after the TopBar retired; flip this
                                            back to true to bring it back unchanged. */}
                                        {SHOW_TIME_BANK && (
                                            <div className="absolute top-2 right-2 pointer-events-auto">
                                                <TimeBankWidget />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {/* The Tray (UI §2, D-107). Permanent, beside the
                                board, and LOAD-BEARING: an open Bank covers the
                                board, so the only route from storage to a tile
                                is Bank → Tray → Board. (Or when Bank is open, it becomes the VerticalHeroDock). */}
                            {!menuRight && (
                                ui.drawer.panes.includes('bank') ? (
                                    <VerticalHeroDock dock={ui.dock} />
                                ) : (
                                    <Tray 
                                        isVaultOpen={ui.drawer.panes.includes('vault')}
                                        onInspectToken={(typeId, rect) => ui.inspect.set('token', typeId, { rect })} 
                                        onClearInspect={() => ui.inspect.clear()} 
                                    />
                                )
                            )}
                            {/* Inspection now lives OVER THE TRAY (D-240),
                                having left the bank drawer.

                                ⚠️ It had to go somewhere in the same change, not
                                later: `InspectionPanel` is the only route to
                                Token detail from the Vault, the Cartographer,
                                the Tray *and* the board, and D-145 is explicit
                                that planning happens before placement. Removing
                                it without a home switches D-145 off rather than
                                deferring it.

                                Provisional placement — the owner has other plans
                                for this space. */}

                            {/* Hero Dock — always-visible roster strip along the
                                bottom edge. It lives INSIDE the play area, not
                                beside the drawer: anchored to this box's bottom
                                it sits on the screen edge while no drawer is
                                open, and lifts to rest on the drawer's top edge
                                when one opens, instead of covering its lower
                                band. Still floats over the banners rather than
                                displacing them (roadmap D9). */}
                            {!ui.drawer.isOpen && <HeroDock dock={ui.dock} />}
                            </div>
                            {/* Full-screen drawers (overhaul Phase 4) — cover
                                the play area, bubble column stays visible. */}
                            <AnimatePresence>
                                {ui.fullscreen.view === 'guild' && <GuildHallScreen onClose={ui.fullscreen.close} />}
                            </AnimatePresence>
                        </div>
                        {menuRight && <NotificationColumn menuRight />}
                        {menuRight && <BubbleMenu ui={ui} side="right" />}
                        {/* The bank drawer (D-238). A sibling of the nav rather
                            than a child of the board column, because it has to
                            reach across the notifications column — which the
                            board column does not contain. */}
                        <BottomFolderDrawer drawer={ui.drawer} inspect={ui.inspect} menuRight={menuRight} cardTier={ui.cardTier} />
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
                {ui.inspect.selection?.type === 'token' && ui.inspect.selection.source?.rect && (
                    <TokenInspectPopup
                        typeId={ui.inspect.selection.id}
                        anchorRect={ui.inspect.selection.source.rect}
                        onClose={() => ui.inspect.clear()}
                    />
                )}
                <SettingsModal isOpen={ui.settings.isOpen} onClose={ui.settings.close} />
                <SlotSelectionModal isOpen={ui.slotSelection.isOpen} onSelect={handleSlotSelect} />
                {/* Hero Edit — name, portrait, retire (Hero Dock Phase 7).
                    Opened by the Edit button on a pinned dock card. */}
                {ui.dock.editHeroId && (
                    <HeroEditModal
                        heroId={ui.dock.editHeroId}
                        isOpen
                        onClose={ui.dock.closeEdit}
                        onChangeJob={() => { ui.dock.closeEdit(); ui.dock.openJob(ui.dock.editHeroId); }}
                    />
                )}
                {/* Promotion and re-training — one screen, because they are one
                    act (D-248). Opened from the hero sheet. */}
                {ui.dock.jobHeroId && (
                    <JobChangeModal
                        heroId={ui.dock.jobHeroId}
                        isOpen
                        onClose={ui.dock.closeJob}
                    />
                )}
                
                <LootTableModal
                    data={ui.lootTable.data}
                    isOpen={ui.lootTable.isOpen}
                    onClose={ui.lootTable.close}
                />


                {/* The pack-opening overlay is deleted with the pack economy
                    (D-153: "There is no pack system. Maps absorbed it"). The
                    Map burst that replaces it is a physical scatter of sprites
                    onto the board (D-142), not a pick-one modal, so it is built
                    fresh in Phase 8 rather than adapted. */}

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
