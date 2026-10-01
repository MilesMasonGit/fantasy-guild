import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlagRulesPanel } from './components/drawer/FlagRulesPanel.jsx';
import { cn } from './utils/cn.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EventBus } from '../systems/core/EventBus.js';

// Providers & Context
import { EngineProvider } from './context/EngineContext.jsx';
import { DeckDndProvider } from './dnd/DndKit.jsx';
import { ViewportProvider } from './context/ViewportContext.jsx';
import { setMatBankLocked } from './hooks/useMatBankLock.js';

// Hooks
import { useUIModals } from './hooks/useUIModals.js';
import { useInspectTokenHandlers } from './hooks/useInspectTokenHandlers.js';

// Components
import Board from './components/board/Board.jsx';
import BottomFolderDrawer from './components/drawer/BottomFolderDrawer.jsx';
import ShopDrawer from './components/drawer/ShopDrawer.jsx';

import BubbleMenu from './components/nav/BubbleMenu.jsx';
import BottomHeroDock, { showsBottomHeroDock } from './components/dock/BottomHeroDock.jsx';
import BankHeroPanel from './components/dock/BankHeroPanel.jsx';
import GuildHallBoard from './components/board/GuildHallBoard.jsx';
import GuildHallEffectsPanel from './components/board/GuildHallEffectsPanel.jsx';
import { InspectionPanel } from './components/drawer/InspectionPanel.jsx';
import { SIDE_COLUMN_PX, NOTIFICATION_COLUMN, columnWidthCss } from './components/board/boardConstants.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { selectGuildInspectSelection } from './guildInspectSelection.js';
import LayoutSandbox from './components/sandbox/LayoutSandbox.jsx';
import { TokenInspectPopup } from './components/board/TokenInspectPopup.jsx';

// Base Components / HUD
import { FPSCounter } from './components/base/FPSCounter.jsx';
import { ParticleOverlay } from './components/base/ParticleOverlay.jsx';
import { TutorialAideOverlay } from './components/base/TutorialAideOverlay.jsx';
import { ErrorBoundary } from './components/base/ErrorBoundary.jsx';
import ToastContainer from './components/base/ToastContainer.jsx';
import DiscardBinPanel from './components/board/DiscardBinPanel.jsx';
import TestDashboard from './components/TestDashboard.jsx';
import PlaymatTuner from './components/PlaymatTuner.jsx';
import MatTuner from './components/MatTuner.jsx';
import { TERRAIN_ENABLED } from '../config/registries/terrainRegistry.js';
import TimeBankWidget from './components/hud/TimeBankWidget.jsx';
import MatTopBar, { showsMatTopBar } from './components/board/MatTopBar.jsx';
import MatCapBadge from './components/board/MatCapBadge.jsx';
import MatUpkeepBadge from './components/board/MatUpkeepBadge.jsx';
import MatDisallowControls from './components/board/MatDisallowControls.jsx';
import { PerfProfiler, usePerfHudShowing } from './dev/perf/PerfProfiler.jsx';

/** Time Bank widget visibility — parked, not deleted (owner request
 *  2026-08-02). The widget and its manager are untouched; only its placement
 *  is switched off, so restoring it is this one flag. It lives at the right
 *  end of the mat's top bar (B2 Time Bank, FB-28). */
const SHOW_TIME_BANK = false;

// Overlays & Modals
import SettingsModal from './modals/SettingsModal.jsx';
import SlotSelectionModal from './modals/SlotSelectionModal.jsx';
import HeroEditModal from './modals/HeroEditModal.jsx';
import JobChangeModal from './modals/JobChangeModal.jsx';
import PromotionCeremonyModal from './modals/PromotionCeremonyModal.jsx';

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
export const NotificationColumn = ({ menuRight = false, flagRules = null }) => {
    const [notificationsHidden, setNotificationsHidden] = React.useState(false);
    const slideFrom = menuRight ? 40 : -40;

    return (
        <aside
            // FP-100: gives way on a narrow window so the mat keeps a readable
            // size. Floored at the width `Toast`'s own min-width needs.
            style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
            className={cn(
                "shrink-0 h-full flex flex-col items-center justify-center py-8 bg-transparent pointer-events-auto transition-[width] duration-150 relative z-10 select-none",
                menuRight ? "pr-8 pl-0" : "pl-8 pr-0"
            )}
        >
            <div
                className="w-full relative shrink-0 flex flex-col justify-between"
                style={{ height: SIDE_COLUMN_PX, maxHeight: '100%' }}
            >
                {/* A hero's flag rules (Free Playmat 1.5b-ii, FP-81): a narrow
                    panel over this column, so the board stays in view. A
                    dedicated panel rather than the Bank drawer, which spans the
                    board too (D-238). */}
                <AnimatePresence>
                    {flagRules?.heroId && (
                        <motion.div
                            key="flag-rules"
                            initial={{ x: slideFrom, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: slideFrom, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-0 z-20"
                        >
                            <FlagRulesPanel heroId={flagRules.heroId} onClose={flagRules.close} />
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Top: Notifications */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <button
                        type="button"
                        onClick={() => setNotificationsHidden(h => !h)}
                        className="w-full text-center py-2 text-sm md:text-base font-bold text-gi-text hover:text-gi-primary border-b border-gi-border/30 transition-colors cursor-pointer select-none"
                    >
                        {notificationsHidden ? 'Show Notifications' : 'Notifications'}
                    </button>
                    {!notificationsHidden && (
                        <div className="flex-1 min-h-0 overflow-y-auto gi-scrollbar">
                            <ToastContainer />
                        </div>
                    )}
                </div>

                {/* Bottom-most: the discard bin (B3.2, FB-34, TL-13). Fixed
                    size at the foot of the column; notifications above take
                    whatever is left. The Quests section that sat between
                    them went in B6.2: quests are Tokens on the mat (TL-18). */}
                <div className="shrink-0 pt-2 border-t border-gi-border/30">
                    <DiscardBinPanel />
                </div>
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
    const { onInspectToken, onClearInspect } = useInspectTokenHandlers(ui.inspect);

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

    // Dev only: the FPS counter stands down while the Perf HUD is up (CR3-358).
    const perfHudShowing = usePerfHudShowing();

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

    // A stress scenario from the perf harness (`?stress=…`, round-3 review P3)
    // builds its own board, so the slot picker has nothing left to ask. Dev
    // builds only; the event is published by src/ui/dev/perf/stressScenarios.js.
    const closeSlotSelection = ui.slotSelection.close;
    React.useEffect(() => {
        if (!import.meta.env.DEV) return undefined;
        return EventBus.subscribe('dev:stress_started', () => closeSlotSelection());
    }, [closeSlotSelection]);

    // The Hall's upgrade web selects by upgrade id — it has no tiles (B9, TL-23).
    const [selectedUpgradeId, setSelectedUpgradeId] = React.useState('roster_size');
    const isGuildView = ui.fullscreen.view === 'guild';
    const isBankOpen = ui.drawer.panes.includes('bank');

    // CR3-402 (owner ruling): while the Bank is open the mat is not
    // interactive at all. `useMatBankLock` is the one place that reaches
    // outside React (the drag sensor) to enforce it, so this is its only
    // writer, kept in step with the Bank's own open/closed state.
    React.useEffect(() => { setMatBankLocked(isBankOpen); }, [isBankOpen]);

    const handleOpenGuildHall = React.useCallback(() => {
        ui.fullscreen.open('guild');
        setSelectedUpgradeId('roster_size');
        const def = getUpgradeDef('roster_size');
        if (def) {
            ui.inspect.set('guild_upgrade', def.id, { upgradeDef: def }, 'guild');
        }
    }, [ui.fullscreen, ui.inspect]);

    const handleCloseGuildHall = useCallback(() => {
        ui.fullscreen.close();
        ui.inspect.clear('guild');
    }, [ui.fullscreen, ui.inspect]);

    useEffect(() => {
        const unsub1 = EventBus.subscribe('ui:open_guild_hall', () => handleOpenGuildHall());
        const unsub2 = EventBus.subscribe('ui:close_guild_hall', () => handleCloseGuildHall());
        const unsub3 = EventBus.subscribe('ui:toggle_guild_hall', () => {
            if (ui.fullscreen.view === 'guild') handleCloseGuildHall();
            else handleOpenGuildHall();
        });
        return () => {
            unsub1();
            unsub2();
            unsub3();
        };
    }, [handleOpenGuildHall, handleCloseGuildHall, ui.fullscreen.view]);

    const [inspectHeroId, setInspectHeroId] = React.useState(null);

    React.useEffect(() => {
        const unsub1 = EventBus.subscribe('hero_equipment_changed', (data) => {
            if (data?.action === 'equip' && data?.heroId) {
                setInspectHeroId(data.heroId);
            }
        });
        const unsub2 = EventBus.subscribe('hero_equipped', (data) => {
            if (data?.heroId) {
                setInspectHeroId(data.heroId);
            }
        });
        const unsub3 = EventBus.subscribe('inspect_hero', (data) => {
            if (data?.heroId) {
                setInspectHeroId(data.heroId);
            }
        });
        return () => {
            unsub1();
            unsub2();
            unsub3();
        };
    }, []);

    const guildPaneSelection = ui.inspect.getByPane ? ui.inspect.getByPane('guild') : null;
    const guildInspectSelection = selectGuildInspectSelection({
        guildPaneSelection,
        globalSelection: ui.inspect.selection,
        selectedUpgradeId,
        getUpgradeDefFn: getUpgradeDef
    });

    // CR3-451: Close must clear BOTH the pane's explicit selection and the
    // web's own "last picked" id — clearing only the pane left the fallback
    // chain above re-deriving the same selection on the next render, so the
    // panel looked like it never closed.
    const handleClearGuildInspect = React.useCallback(() => {
        ui.inspect.clear('guild');
        setSelectedUpgradeId(null);
    }, [ui.inspect]);

    return (
        <EngineProvider engine={engine}>
            <ViewportProvider>
                <DeckDndProvider>
                <ParticleOverlay disabled={ui.isAnyModalOpen} />
                <TutorialAideOverlay />
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
                        {/* Smooth darkening overlay for Guild Hall view and Item Bank view */}
                        <div
                            className={cn(
                                "absolute inset-0 bg-black/45 pointer-events-none transition-opacity duration-300 z-0",
                                (isGuildView || isBankOpen) ? "opacity-100" : "opacity-0"
                            )}
                        />

                        {!menuRight && <BubbleMenu ui={ui} side="left" />}
                        {menuRight && (
                            isGuildView ? (
                                <aside
                                    style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
                                    className="shrink-0 h-full flex flex-col items-center justify-center py-8 bg-transparent pointer-events-auto relative select-none pr-8 pl-0 z-10"
                                >
                                    <div
                                        className="w-full relative shrink-0 flex flex-col gap-2.5"
                                        style={{ height: SIDE_COLUMN_PX, maxHeight: '100%' }}
                                    >
                                        <button
                                            onClick={() => {
                                                EventBus.publish('audio:play', { clip: 'button_click' });
                                                handleCloseGuildHall();
                                            }}
                                            className="w-full shrink-0 py-2.5 px-4 rounded-xl border-2 border-[#5c3e2e] hover:border-gi-gold/70 bg-[#2a1d15]/95 hover:bg-[#3d2a1f] text-amber-200 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all duration-150 cursor-pointer active:scale-[0.98] group"
                                        >
                                            <ArrowLeft size={16} className="text-gi-gold group-hover:-translate-x-1 transition-transform" />
                                            <span>Return to Playmat</span>
                                        </button>
                                        <div className="w-full flex-1 min-h-0 relative flex flex-col rounded-2xl border-4 border-[#3a271d] shadow-2xl overflow-hidden">
                                            <InspectionPanel
                                                className="w-full h-full flex-1"
                                                selection={guildInspectSelection}
                                                onClear={handleClearGuildInspect}
                                            />
                                        </div>
                                    </div>
                                </aside>
                            ) : (
                                isBankOpen ? (
                                    <aside
                                        style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
                                        className="shrink-0 h-full flex flex-col pointer-events-none relative z-[100]"
                                    >
                                        {/* CR3-203: a crash in the Bank's hero
                                            panel stays local to this aside. */}
                                        <ErrorBoundary label="BankHeroPanel">
                                            <BankHeroPanel
                                                menuRight={menuRight}
                                                selectedHeroId={inspectHeroId}
                                                onSelectHero={(id) => setInspectHeroId(prev => (prev === id ? null : id))}
                                                onDoubleClickHero={(id) => setInspectHeroId(prev => (prev === id ? null : id))}
                                                onCloseHero={() => setInspectHeroId(null)}
                                                onEditHero={(id) => ui.dock.openEdit(id)}
                                            />
                                        </ErrorBoundary>
                                    </aside>
                                ) : (
                                    <NotificationColumn menuRight flagRules={ui.flagRules} />
                                )
                            )
                        )}
                        <div className="flex-1 relative flex flex-col overflow-hidden z-10">
                            <div className="flex-1 flex min-h-0 relative">
                            {/* The Guild Hall Effects list: always LEFT of the
                                upgrade web, whichever side the nav is on (B9,
                                FB-38). With the nav flipped right it sits
                                between the inspection column and the web. */}
                            {isGuildView && <GuildHallEffectsPanel />}
                            <div
                                data-dnd-surface="board"
                                data-dnd-region="board"
                                className="flex-1 min-w-0 overflow-hidden pointer-events-auto relative z-0 min-h-0 flex flex-col"
                            >
                                {/* The mat's top bar (B2, FB-28): above the Board
                                    in this column, never over it, so the box Board
                                    measures for its fit is the bar's height
                                    shorter and the mat shrinks to match. */}
                                {showsMatTopBar(ui.fullscreen.view) && (
                                    <PerfProfiler id="TopBar">
                                        <MatTopBar
                                            left={<><MatCapBadge /><MatUpkeepBadge /></>}
                                            right={<><MatDisallowControls />{SHOW_TIME_BANK ? <TimeBankWidget /> : null}</>}
                                        />
                                    </PerfProfiler>
                                )}
                                <div className="flex-1 min-w-0 min-h-0 relative">
                                {isGuildView ? (
                                    <GuildHallBoard
                                        selectedUpgradeId={guildInspectSelection?.id ?? selectedUpgradeId}
                                        onSelectUpgrade={(def) => {
                                            setSelectedUpgradeId(def.id);
                                            ui.inspect.set('guild_upgrade', def.id, { upgradeDef: def }, 'guild');
                                        }}
                                        onClose={handleCloseGuildHall}
                                    />
                                ) : (
                                    <Board
                                        inspectedHeroId={inspectHeroId}
                                        inspectedTokenId={ui.inspect.selection?.type === 'token' ? (ui.inspect.selection.source?.instanceId ?? null) : null}
                                        onOpenGuildHall={handleOpenGuildHall}
                                        onInspectToken={onInspectToken}
                                        onClearInspect={onClearInspect}
                                    />
                                )}
                                </div>
                            </div>
                            </div>

                            {/* Bottom Hero Dock: horizontal sliding tabs. Not on
                                the Guild Hall upgrade screen (FB-47). */}
                            {showsBottomHeroDock(ui.fullscreen.view) && (
                                // CR3-203: a crash in the bottom hero dock stays local to it.
                                <ErrorBoundary label="HeroDock">
                                    <PerfProfiler id="HeroDock">
                                        <BottomHeroDock
                                            isBankOpen={isBankOpen}
                                            selectedHeroId={inspectHeroId}
                                            onSelectHero={(id) => setInspectHeroId(prev => (prev === id ? null : id))}
                                            onDoubleClickHero={(id) => setInspectHeroId(prev => (prev === id ? null : id))}
                                            onCloseHero={() => setInspectHeroId(null)}
                                            onEditHero={(id) => ui.dock.openEdit(id)}
                                        />
                                    </PerfProfiler>
                                </ErrorBoundary>
                            )}
                        </div>
                        {!menuRight && (
                            isGuildView ? (
                                <aside
                                    style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
                                    className="shrink-0 h-full flex flex-col items-center justify-center py-8 bg-transparent pointer-events-auto relative select-none pl-8 pr-0 z-10"
                                >
                                    <div
                                        className="w-full relative shrink-0 flex flex-col gap-2.5"
                                        style={{ height: SIDE_COLUMN_PX, maxHeight: '100%' }}
                                    >
                                        <button
                                            onClick={() => {
                                                EventBus.publish('audio:play', { clip: 'button_click' });
                                                handleCloseGuildHall();
                                            }}
                                            className="w-full shrink-0 py-2.5 px-4 rounded-xl border-2 border-[#5c3e2e] hover:border-gi-gold/70 bg-[#2a1d15]/95 hover:bg-[#3d2a1f] text-amber-200 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all duration-150 cursor-pointer active:scale-[0.98] group"
                                        >
                                            <ArrowLeft size={16} className="text-gi-gold group-hover:-translate-x-1 transition-transform" />
                                            <span>Return to Playmat</span>
                                        </button>
                                        <div className="w-full flex-1 min-h-0 relative flex flex-col rounded-2xl border-4 border-[#3a271d] shadow-2xl overflow-hidden">
                                            <InspectionPanel
                                                className="w-full h-full flex-1"
                                                selection={guildInspectSelection}
                                                onClear={handleClearGuildInspect}
                                            />
                                        </div>
                                    </div>
                                </aside>
                            ) : (
                                isBankOpen ? (
                                    <aside
                                        style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
                                        className="shrink-0 h-full flex flex-col pointer-events-none relative z-[100]"
                                    >
                                        {/* CR3-203: a crash in the Bank's hero
                                            panel stays local to this aside. */}
                                        <ErrorBoundary label="BankHeroPanel">
                                            <BankHeroPanel
                                                menuRight={menuRight}
                                                selectedHeroId={inspectHeroId}
                                                onSelectHero={(id) => setInspectHeroId(prev => (prev === id ? null : id))}
                                                onDoubleClickHero={(id) => setInspectHeroId(prev => (prev === id ? null : id))}
                                                onCloseHero={() => setInspectHeroId(null)}
                                                onEditHero={(id) => ui.dock.openEdit(id)}
                                            />
                                        </ErrorBoundary>
                                    </aside>
                                ) : (
                                    <NotificationColumn flagRules={ui.flagRules} />
                                )
                            )
                        )}
                        {menuRight && <BubbleMenu ui={ui} side="right" />}
                        {/* The bank drawer (D-238). A sibling of the nav rather
                            than a child of the board column, because it has to
                            reach across the notifications column — which the
                            board column does not contain. */}
                        {/* Perf HUD commit counting, dev only (P3). CR3-203: a
                            crash in the Bank drawer stays local to it. */}
                        <ErrorBoundary label="BankDrawer">
                            <PerfProfiler id="Drawer">
                                <BottomFolderDrawer drawer={ui.drawer} inspect={ui.inspect} menuRight={menuRight} />
                            </PerfProfiler>
                        </ErrorBoundary>
                        {/* The Shop drawer, from the left edge (B4: FB-25, FB-27).
                            CR3-203: a crash here stays local to it too. */}
                        <ErrorBoundary label="ShopDrawer">
                            <ShopDrawer isOpen={ui.shop.isOpen} onClose={ui.shop.close} menuRight={menuRight} />
                        </ErrorBoundary>
                    </div>
                </div>

                {/* 2. Global HUD Components */}
                {(import.meta.env.DEV || debugMode) && (
                    <>
                        <TestDashboard />
                        {/* Tunes terrain only, so hidden while it is dormant (FP-10). */}
                        {TERRAIN_ENABLED && <PlaymatTuner />}
                        {/* Tunes the free playmat's rules (FP-66). */}
                        <MatTuner />
                        {/* Hidden while the Perf HUD is on: its own frame loop
                            and per-second commit would be measured by the HUD,
                            and the HUD shows frames already (CR3-358). */}
                        {!perfHudShowing && <FPSCounter />}
                    </>
                )}

                {/* 3. Modal Layer Overlays */}
                {ui.inspect.selection?.type === 'token' && (ui.inspect.selection.source?.rect || ui.inspect.selection.source?.instanceId != null) && (
                    <TokenInspectPopup
                        typeId={ui.inspect.selection.id}
                        instanceId={ui.inspect.selection.source?.instanceId}
                        anchorRect={ui.inspect.selection.source?.rect}
                        onClose={() => ui.inspect.clear()}
                    />
                )}
                <SettingsModal isOpen={ui.settings.isOpen} onClose={ui.settings.close} />
                <SlotSelectionModal isOpen={ui.slotSelection.isOpen} onSelect={handleSlotSelect} />
                {/* Hero Edit — name, portrait, job (Hero Dock Phase 7).
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

                {/* The ceremony, at the end of a Promotes Token's training cycle
                    (Promotes rule P4). Opened by the board, not by a menu — the
                    player did not ask for this window, they finished the work
                    that earns it. */}
                {ui.dock.promotionOffer && (
                    <PromotionCeremonyModal
                        // ⚠️ Keyed on the offer, so a NEW offer gets a NEW
                        // component. The ceremony keeps local state (whether it
                        // has been answered, and any refusal), and without this
                        // key that state survived into the next offer — decline,
                        // get asked again, and the window still showed the old
                        // answer with only a "Done" button. Found by playing, on
                        // the branch this was ported from.
                        key={`${ui.dock.promotionOffer.instanceId}:${ui.dock.promotionOffer.heroId}:${ui.dock.promotionOffer.jobId}`}
                        offer={ui.dock.promotionOffer}
                        onClose={ui.dock.closePromotion}
                    />
                )}

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
