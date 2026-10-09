import React, { useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from './utils/cn.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EventBus } from '../systems/core/EventBus.js';

import { EngineProvider } from './context/EngineContext.jsx';
import { DeckDndProvider } from './dnd/DndKit.jsx';
import { ViewportProvider } from './context/ViewportContext.jsx';
import { setMatBankLocked } from './hooks/useMatBankLock.js';

import { useUIModals } from './hooks/useUIModals.js';
import { useInspectTokenHandlers } from './hooks/useInspectTokenHandlers.js';

import Board from './components/board/Board.jsx';
import BankDrawer from './components/drawer/BankDrawer.jsx';
import ShopDrawer from './components/drawer/ShopDrawer.jsx';

import BubbleMenu from './components/nav/BubbleMenu.jsx';
import BottomHeroDock, { showsBottomHeroDock } from './components/dock/BottomHeroDock.jsx';
import BankHeroPanel from './components/dock/BankHeroPanel.jsx';
import WorkRulesDrawer from './components/dock/WorkRulesDrawer.jsx';
import GuildHallBoard from './components/board/GuildHallBoard.jsx';
import GuildHallEffectsPanel from './components/board/GuildHallEffectsPanel.jsx';
import { InspectionPanel } from './components/drawer/InspectionPanel.jsx';
import { SIDE_COLUMN_PX, NOTIFICATION_COLUMN, columnWidthCss } from './components/board/boardConstants.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { selectGuildInspectSelection } from './guildInspectSelection.js';
import { TokenInspectPopup } from './components/board/TokenInspectPopup.jsx';

import { FPSCounter } from './components/base/FPSCounter.jsx';
import { ParticleOverlay } from './components/base/ParticleOverlay.jsx';
import { TutorialAideOverlay } from './components/base/TutorialAideOverlay.jsx';
import { ErrorBoundary } from './components/base/ErrorBoundary.jsx';
import { NotificationSidebars } from './components/board/PopOutSidebars.jsx';
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
import { useDrawn } from './dev/perf/drawSwitches.js';

/**
 * Time Bank widget visibility: parked, not deleted. Only its placement is switched off, so
 * restoring it is this one flag. It lives at the right end of the mat's top bar.
 */
const SHOW_TIME_BANK = false;

import SettingsModal from './modals/SettingsModal.jsx';
import SlotSelectionModal from './modals/SlotSelectionModal.jsx';
import HeroEditModal from './modals/HeroEditModal.jsx';
import JobChangeModal from './modals/JobChangeModal.jsx';
import PromotionCeremonyModal from './modals/PromotionCeremonyModal.jsx';
import { ENGINE_EVENTS, ORPHAN_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';

/**
 * ReactRoot: the entry point for the React UI layer. Manages the top-level layout, provides
 * the Engine/DnD context, and orchestrates global modal overlays.
 */
export const ReactRoot = ({ engine }) => {
    const ui = useUIModals(engine);
    const { onInspectToken, onClearInspect } = useInspectTokenHandlers(ui.inspect);

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
        engine.EventBus.publish(UI_EVENTS.REACT_SLOT_SELECTED, { index, isNewGame: isEmpty });
    };

    // Dev only: the FPS counter stands down while the Perf HUD is up.
    const perfHudShowing = usePerfHudShowing();
    // Perf draw switches: each only stops DRAWING (see drawSwitches.js).
    const dockDrawn = useDrawn('dock');
    const drawersDrawn = useDrawn('drawers');
    const backgroundDrawn = useDrawn('background');
    const particlesDrawn = useDrawn('particles');
    const tooltipsDrawn = useDrawn('tooltips');

    const [debugMode, setDebugMode] = React.useState(() => SettingsManager.get('debugMode') ?? false);
    // Bubble menu side: left by default, right via the Settings toggle.
    const [menuRight, setMenuRight] = React.useState(() => SettingsManager.get('ui.bubbleMenuRight') ?? false);
    const [backgroundTile, setBackgroundTile] = React.useState(() => SettingsManager.get('ui.backgroundTile') ?? 'pm_table_wood_spruce');

    React.useEffect(() => {
        const unsubscribe = EventBus.subscribe(ENGINE_EVENTS.SETTINGS_UPDATED, (s) => {
            setDebugMode(s.debugMode ?? false);
            setMenuRight(s.ui?.bubbleMenuRight ?? false);
            setBackgroundTile(s.ui?.backgroundTile ?? 'pm_table_wood_spruce');
        });
        return () => unsubscribe();
    }, []);

    // A stress scenario from the perf harness (`?stress=…`) builds its own board, so the slot
    // picker has nothing left to ask. Dev and perf builds only; the event is published by
    // src/ui/dev/perf/stressScenarios.js.
    const closeSlotSelection = ui.slotSelection.close;
    React.useEffect(() => {
        if (!(import.meta.env.DEV || import.meta.env.MODE === 'perf')) return undefined;
        return EventBus.subscribe(UI_EVENTS.DEV_STRESS_STARTED, () => closeSlotSelection());
    }, [closeSlotSelection]);

    // The Hall's upgrade web selects by upgrade id; it has no tiles.
    const [selectedUpgradeId, setSelectedUpgradeId] = React.useState('roster_size');
    const isGuildView = ui.fullscreen.view === 'guild';
    const isBankOpen = ui.drawer.panes.includes('bank');

    // While the Bank is open the mat is not interactive at all. `useMatBankLock` is the one
    // place that reaches outside React (the drag sensor) to enforce it, so this is its only
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
        const unsub1 = EventBus.subscribe(ORPHAN_EVENTS.UI_OPEN_GUILD_HALL, () => handleOpenGuildHall());
        const unsub2 = EventBus.subscribe(ORPHAN_EVENTS.UI_CLOSE_GUILD_HALL, () => handleCloseGuildHall());
        const unsub3 = EventBus.subscribe(ORPHAN_EVENTS.UI_TOGGLE_GUILD_HALL, () => {
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
    const toggleInspectHero = React.useCallback((id) => setInspectHeroId(prev => (prev === id ? null : id)), []);
    const closeInspectHero = React.useCallback(() => setInspectHeroId(null), []);

    React.useEffect(() => {
        const unsub1 = EventBus.subscribe(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, (data) => {
            if (data?.action === 'equip' && data?.heroId) {
                setInspectHeroId(data.heroId);
            }
        });
        const unsub2 = EventBus.subscribe(ORPHAN_EVENTS.HERO_EQUIPPED, (data) => {
            if (data?.heroId) {
                setInspectHeroId(data.heroId);
            }
        });
        const unsub3 = EventBus.subscribe(UI_EVENTS.INSPECT_HERO, (data) => {
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

    // Close must clear BOTH the pane's explicit selection and the web's own 'last picked' id:
    // clearing only the pane left the fallback chain above re-deriving the same selection on
    // the next render, so the panel looked like it never closed.
    const handleClearGuildInspect = React.useCallback(() => {
        ui.inspect.clear('guild');
        setSelectedUpgradeId(null);
    }, [ui.inspect]);

    return (
        <EngineProvider engine={engine}>
            <ViewportProvider>
                <DeckDndProvider>
                {particlesDrawn && <ParticleOverlay disabled={ui.isAnyModalOpen} />}
                <TutorialAideOverlay />
                <div className="react-overlay absolute inset-0 z-50 pointer-events-none flex flex-col">
                    <div 
                        className="flex-1 relative flex overflow-hidden bg-black"
                        style={{
                            backgroundImage: backgroundDrawn ? `url('/assets/ui/${backgroundTile}.png')` : 'none',
                            backgroundRepeat: 'repeat',
                            backgroundSize: '512px',
                            imageRendering: 'pixelated',
                            backgroundColor: '#0a0a0a'
                        }}
                    >
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
                                                EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
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
                                    // The Bank's hero column: the hero panel (below) draws over it.
                                    <aside
                                        style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
                                        className="shrink-0 h-full pointer-events-none"
                                    />
                                ) : (
                                    <NotificationSidebars menuRight />
                                )
                            )
                        )}
                        <div className="flex-1 relative flex flex-col overflow-hidden z-10">
                            <div className="flex-1 flex min-h-0 relative">
                            {/**
                             * The Guild Hall Effects list: always LEFT of the upgrade web,
                             * whichever side the nav is on. With the nav flipped right it sits
                             * between the inspection column and the web.
                             */}
                            {isGuildView && <GuildHallEffectsPanel />}
                            <div
                                data-dnd-surface="board"
                                data-dnd-region="board"
                                className="flex-1 min-w-0 overflow-hidden pointer-events-auto relative z-0 min-h-0 flex flex-col"
                            >
                                {/**
                                 * The mat's top bar: above the Board in this column, never
                                 * over it, so the box Board measures for its fit is the bar's
                                 * height shorter and the mat shrinks to match.
                                 */}
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

                            {/**
                             * Bottom Hero Dock: horizontal sliding tabs. Not on the Guild Hall
                             * upgrade screen.
                             */}
                            {dockDrawn && showsBottomHeroDock(ui.fullscreen.view) && (
                                // A crash in the bottom hero dock stays local to it.
                                <ErrorBoundary label="HeroDock">
                                    <PerfProfiler id="HeroDock">
                                        <BottomHeroDock
                                            selectedHeroId={inspectHeroId}
                                            onSelectHero={toggleInspectHero}
                                            onDoubleClickHero={toggleInspectHero}
                                            rulesOpen={ui.flagRules.isOpen}
                                            onToggleRules={ui.flagRules.toggle}
                                        />
                                    </PerfProfiler>
                                </ErrorBoundary>
                            )}
                            {/* The work rules grid rises from behind the bar, over the mat. */}
                            {dockDrawn && showsBottomHeroDock(ui.fullscreen.view) && (
                                <ErrorBoundary label="WorkRulesDrawer">
                                    <WorkRulesDrawer
                                        open={ui.flagRules.isOpen}
                                        litHeroId={ui.flagRules.heroId}
                                        onClose={ui.flagRules.close}
                                    />
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
                                                EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'button_click' });
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
                                    // The Bank's hero column: the hero panel (below) draws over it.
                                    <aside
                                        style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
                                        className="shrink-0 h-full pointer-events-none"
                                    />
                                ) : (
                                    <NotificationSidebars />
                                )
                            )
                        )}
                        {menuRight && <BubbleMenu ui={ui} side="right" />}
                        {/**
                         * The hero panel: one full-height panel on the notification side,
                         * opened from the hero bar or from the Bank. A crash in it stays local.
                         */}
                        {!isGuildView && (
                            <ErrorBoundary label="BankHeroPanel">
                                <BankHeroPanel
                                    menuRight={menuRight}
                                    showTabs={isBankOpen}
                                    selectedHeroId={inspectHeroId}
                                    onSelectHero={toggleInspectHero}
                                    onDoubleClickHero={toggleInspectHero}
                                    onCloseHero={closeInspectHero}
                                    onEditHero={(id) => ui.dock.openEdit(id)}
                                />
                            </ErrorBoundary>
                        )}
                        {/**
                         * The bank drawer: a sibling of the nav rather than a child of the
                         * board column, because it has to reach across the notifications
                         * column, which the board column does not contain.
                         */}
                        {/**
                         * Perf HUD commit counting, dev only. A crash in the Bank drawer stays
                         * local to it.
                         */}
                        {drawersDrawn && <ErrorBoundary label="BankDrawer">
                            <PerfProfiler id="Drawer">
                                <BankDrawer drawer={ui.drawer} inspect={ui.inspect} menuRight={menuRight} />
                            </PerfProfiler>
                        </ErrorBoundary>}
                        {/**
                         * The Shop drawer, from the left edge. A crash here stays local to it
                         * too.
                         */}
                        {drawersDrawn && <ErrorBoundary label="ShopDrawer">
                            <ShopDrawer isOpen={ui.shop.isOpen} onClose={ui.shop.close} menuRight={menuRight} />
                        </ErrorBoundary>}
                    </div>
                </div>

                {(import.meta.env.DEV || debugMode) && (
                    <>
                        <TestDashboard />
                        {/* Tunes terrain only, so hidden while it is dormant. */}
                        {TERRAIN_ENABLED && <PlaymatTuner />}
                        <MatTuner />
                        {/**
                         * Hidden while the Perf HUD is on: its own frame loop and per-second
                         * commit would be measured by the HUD, and the HUD shows frames
                         * already.
                         */}
                        {!perfHudShowing && <FPSCounter />}
                    </>
                )}

                {tooltipsDrawn && ui.inspect.selection?.type === 'token' && (ui.inspect.selection.source?.rect || ui.inspect.selection.source?.instanceId != null) && (
                    <TokenInspectPopup
                        typeId={ui.inspect.selection.id}
                        instanceId={ui.inspect.selection.source?.instanceId}
                        anchorRect={ui.inspect.selection.source?.rect}
                        onClose={() => ui.inspect.clear()}
                    />
                )}
                <SettingsModal isOpen={ui.settings.isOpen} onClose={ui.settings.close} />
                <SlotSelectionModal isOpen={ui.slotSelection.isOpen} onSelect={handleSlotSelect} />
                {ui.dock.editHeroId && (
                    <HeroEditModal
                        heroId={ui.dock.editHeroId}
                        isOpen
                        onClose={ui.dock.closeEdit}
                        onChangeJob={() => { ui.dock.closeEdit(); ui.dock.openJob(ui.dock.editHeroId); }}
                    />
                )}
                {ui.dock.jobHeroId && (
                    <JobChangeModal
                        heroId={ui.dock.jobHeroId}
                        isOpen
                        onClose={ui.dock.closeJob}
                    />
                )}

                {/**
                 * The ceremony, at the end of a Promotes Token's training cycle. Opened by the
                 * board, not by a menu: the player did not ask for this window, they finished
                 * the work that earns it.
                 */}
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

                </DeckDndProvider>
            </ViewportProvider>
        </EngineProvider>
    );
};

export default ReactRoot;
