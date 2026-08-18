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
import Board from './components/board/Board.jsx';
import Tray from './components/board/Tray.jsx';
import BottomFolderDrawer from './components/drawer/BottomFolderDrawer.jsx';

import BubbleMenu from './components/nav/BubbleMenu.jsx';
import RightmostHeroDock from './components/dock/RightmostHeroDock.jsx';
import VerticalHeroDock from './components/dock/VerticalHeroDock.jsx';
import GuildHallBoard from './components/board/GuildHallBoard.jsx';
import { InspectionPanel } from './components/drawer/InspectionPanel.jsx';
import { BOARD_PX } from './components/board/boardConstants.js';
import { getUpgradeDef, getUpgradeDefByTile } from '../config/guildUpgrades.js';
import LayoutSandbox from './components/sandbox/LayoutSandbox.jsx';
import { TokenInspectPopup } from './components/board/TokenInspectPopup.jsx';

// Base Components / HUD
import { FPSCounter } from './components/base/FPSCounter.jsx';
import { ParticleOverlay } from './components/base/ParticleOverlay.jsx';
import ToastContainer from './components/base/ToastContainer.jsx';
import { QuestColumn } from './components/quests/QuestColumn.jsx';
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
const NotificationColumn = ({ menuRight = false }) => {
    const [notificationsHidden, setNotificationsHidden] = React.useState(false);
    const [questsHidden, setQuestsHidden] = React.useState(false);

    return (
        <aside
            className="w-64 md:w-80 xl:w-[356px] shrink-0 flex flex-col justify-between min-h-0 bg-transparent pointer-events-auto transition-[width] duration-150"
        >
            {/* Top: Notifications */}
            <div className="flex-1 min-h-0 flex flex-col">
                <button
                    type="button"
                    onClick={() => setNotificationsHidden(h => !h)}
                    className="w-full text-center py-2 text-sm md:text-base font-bold text-gi-text hover:text-gi-primary border-b border-gi-border/30 transition-colors cursor-pointer select-none"
                    title={notificationsHidden ? "Click to show notifications" : "Click to hide notifications"}
                >
                    {notificationsHidden ? 'Show Notifications' : 'Notifications'}
                </button>
                {!notificationsHidden && (
                    <div className="flex-1 min-h-0 overflow-y-auto gi-scrollbar">
                        <ToastContainer />
                    </div>
                )}
            </div>

            {/* Bottom: Quests */}
            <div className="shrink-0 flex flex-col border-t border-gi-border/30">
                <button
                    type="button"
                    onClick={() => setQuestsHidden(h => !h)}
                    className="w-full text-center py-2 text-sm md:text-base font-bold text-gi-text hover:text-gi-primary border-b border-gi-border/30 transition-colors cursor-pointer select-none"
                    title={questsHidden ? "Click to show quests" : "Click to hide quests"}
                >
                    {questsHidden ? 'Show Quests' : 'Quests'}
                </button>
                {!questsHidden && (
                    <QuestColumn />
                )}
            </div>
        </aside>
    );
};

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

    const [selectedUpgradeTile, setSelectedUpgradeTile] = React.useState(17);
    const isGuildView = ui.fullscreen.view === 'guild';

    const handleOpenGuildHall = React.useCallback(() => {
        ui.fullscreen.open('guild');
        setSelectedUpgradeTile(17);
        const def = getUpgradeDef('roster_size');
        if (def) {
            ui.inspect.set('guild_upgrade', def.id, { upgradeDef: def, tileIndex: 17 });
        }
    }, [ui.fullscreen, ui.inspect]);

    const [inspectHeroId, setInspectHeroId] = React.useState(null);
    const selectedUpgradeDef = selectedUpgradeTile != null ? getUpgradeDefByTile(selectedUpgradeTile) : null;
    const guildInspectSelection = ui.inspect.selection?.type === 'guild_upgrade' 
        ? ui.inspect.selection 
        : (selectedUpgradeDef ? { type: 'guild_upgrade', id: selectedUpgradeDef.id, upgradeDef: selectedUpgradeDef, tileIndex: selectedUpgradeTile } : null);

    return (
        <EngineProvider engine={engine}>
            <ViewportProvider>
                <DeckDndProvider engine={engine}>
                <ParticleOverlay disabled={ui.isAnyModalOpen} />
                {/* 1. Main Application Layout */}
                <div className="react-overlay absolute inset-0 z-50 pointer-events-none flex flex-col">
                    {/* Overhaul layout: bubble column flanking playmat and rightmost dock */}
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
                        {/* Smooth darkening overlay for Guild Hall view */}
                        <div
                            className={cn(
                                "absolute inset-0 bg-black/45 pointer-events-none transition-opacity duration-300 z-0",
                                isGuildView ? "opacity-100" : "opacity-0"
                            )}
                        />

                        {!menuRight && <BubbleMenu ui={ui} side="left" />}
                        {!menuRight && (
                            isGuildView ? (
                                <aside className="w-64 md:w-72 xl:w-[260px] shrink-0 h-full flex flex-col items-center justify-center py-8 bg-transparent pointer-events-auto relative select-none pl-8 pr-0 z-10">
                                    <div
                                        className="w-full relative shrink-0 flex flex-col rounded-2xl border-4 border-[#3a271d] shadow-2xl overflow-hidden"
                                        style={{ height: BOARD_PX }}
                                    >
                                        <InspectionPanel
                                            className="w-full h-full flex-1"
                                            selection={guildInspectSelection}
                                            onClear={() => ui.inspect.clear()}
                                        />
                                    </div>
                                </aside>
                            ) : (
                                <NotificationColumn />
                            )
                        )}
                        <div className="flex-1 relative flex flex-col overflow-hidden z-10">
                            <div className="flex-1 flex min-h-0 relative">
                            {menuRight && (
                                ui.drawer.panes.includes('bank') ? (
                                    <VerticalHeroDock dock={ui.dock} />
                                ) : (
                                    <Tray 
                                        menuRight={true}
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
                                {isGuildView ? (
                                    <GuildHallBoard
                                        selectedTileIndex={selectedUpgradeTile}
                                        onSelectTile={(tileIndex, def) => {
                                            setSelectedUpgradeTile(tileIndex);
                                            ui.inspect.set('guild_upgrade', def.id, { upgradeDef: def, tileIndex });
                                        }}
                                        onClose={() => {
                                            ui.fullscreen.close();
                                            ui.inspect.clear();
                                        }}
                                    />
                                ) : (
                                    <Board
                                        onOpenGuildHall={handleOpenGuildHall}
                                        onInspectToken={(typeId, rect) => ui.inspect.set('token', typeId, { rect })}
                                        inspectSelection={ui.inspect.selection}
                                        onClearInspect={() => ui.inspect.clear()}
                                        isRightMenu={menuRight}
                                    />
                                )}
                                {/* Global HUD Layer */}
                                <div className="absolute inset-0 z-[100] pointer-events-none">
                                    <div className="relative w-full h-full">
                                        {SHOW_TIME_BANK && (
                                            <div className="absolute top-2 right-2 pointer-events-auto">
                                                <TimeBankWidget />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {/* The Tray */}
                            {!menuRight && (
                                ui.drawer.panes.includes('bank') ? (
                                    <VerticalHeroDock dock={ui.dock} />
                                ) : (
                                    <Tray 
                                        menuRight={false}
                                        isVaultOpen={ui.drawer.panes.includes('vault')}
                                        onInspectToken={(typeId, rect) => ui.inspect.set('token', typeId, { rect })} 
                                        onClearInspect={() => ui.inspect.clear()} 
                                    />
                                )
                            )}

                            {/* Rightmost Hero Dock: vertical sliding tabs */}
                            {!menuRight && (
                                <div className="shrink-0 h-full flex flex-col items-center justify-center py-8 pr-0">
                                    <RightmostHeroDock
                                        selectedHeroId={inspectHeroId}
                                        onSelectHero={(id) => {}}
                                        onDoubleClickHero={(id) => setInspectHeroId(prev => (prev === id ? null : id))}
                                        onCloseHero={() => setInspectHeroId(null)}
                                        onEditHero={(id) => ui.dock.openEdit(id)}
                                    />
                                </div>
                            )}
                            </div>
                        </div>
                        {menuRight && (
                            isGuildView ? (
                                <aside className="w-64 md:w-72 xl:w-[260px] shrink-0 h-full flex flex-col items-center justify-center py-8 bg-transparent pointer-events-auto relative select-none pr-8 pl-0 z-10">
                                    <div
                                        className="w-full relative shrink-0 flex flex-col rounded-2xl border-4 border-[#3a271d] shadow-2xl overflow-hidden"
                                        style={{ height: BOARD_PX }}
                                    >
                                        <InspectionPanel
                                            className="w-full h-full flex-1"
                                            selection={guildInspectSelection}
                                            onClear={() => ui.inspect.clear()}
                                        />
                                    </div>
                                </aside>
                            ) : (
                                <NotificationColumn menuRight />
                            )
                        )}
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
