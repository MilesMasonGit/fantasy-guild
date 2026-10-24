import React, { useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { cn } from './utils/cn.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus, UI_LISTENER } from '../systems/core/EventBus.js';

import { DeckDndProvider } from './dnd/DndKit.jsx';
import { ViewportProvider } from './context/ViewportContext.jsx';
import { setMatBankLocked } from './hooks/useMatBankLock.js';

import { useUIModals } from './hooks/useUIModals.js';
import { useEscapeLayer } from './utils/escapeLayers.js';
import { useInspectTokenHandlers } from './hooks/useInspectTokenHandlers.js';
import { useHeroSheetRequests } from './hooks/useHeroSheetRequests.js';

import Board from './components/board/Board.jsx';
import BankDrawer from './components/drawer/BankDrawer.jsx';
import ShopDrawer from './components/drawer/ShopDrawer.jsx';
import AtlasScreen from './components/atlas/AtlasScreen.jsx';
import ArrivalCard from './components/atlas/ArrivalCard.jsx';

import BubbleMenu from './components/nav/BubbleMenu.jsx';
import BottomHeroDock from './components/dock/BottomHeroDock.jsx';
import BankHeroPanel from './components/dock/BankHeroPanel.jsx';
import WorkRulesDrawer from './components/dock/WorkRulesDrawer.jsx';
import GuildHallBoard from './components/board/GuildHallBoard.jsx';
import GuildHallEffectsPanel from './components/board/GuildHallEffectsPanel.jsx';
import HallSky from './components/board/HallSky.jsx';
import HallCamera from './components/board/HallCamera.jsx';
import { InspectionPanel } from './components/drawer/InspectionPanel.jsx';
import { SIDE_COLUMN_PX, NOTIFICATION_COLUMN, columnWidthCss } from './components/board/boardConstants.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { selectGuildInspectSelection } from './guildInspectSelection.js';
import { TokenInspectPopup } from './components/board/TokenInspectPopup.jsx';

import { FPSCounter } from './components/base/FPSCounter.jsx';
import { ParticleOverlay } from './components/base/ParticleOverlay.jsx';
import { ErrorBoundary } from './components/base/ErrorBoundary.jsx';
import { ItemStubColumn } from './components/notifications/ItemStubColumn.jsx';
import { BannerStack } from './components/notifications/BannerStack.jsx';
import { ScreenCalloutLayer } from './components/notifications/ScreenCalloutLayer.jsx';
import TestDashboard from './components/TestDashboard.jsx';
import PlaymatTuner from './components/PlaymatTuner.jsx';
import MatTuner from './components/MatTuner.jsx';
import CatchUpOverlay from './components/hud/CatchUpOverlay.jsx';
import MatTopBar from './components/board/MatTopBar.jsx';
import MatRegionName from './components/board/MatRegionName.jsx';
import MatCapBadge from './components/board/MatCapBadge.jsx';
import MatUpkeepBadge from './components/board/MatUpkeepBadge.jsx';
import { MapModeToggles, MapModeBanner } from './components/board/MatModeControls.jsx';
import { PerfProfiler, usePerfHudShowing } from './dev/perf/PerfProfiler.jsx';
import { useDrawn } from './dev/perf/drawSwitches.js';

import SettingsModal from './modals/SettingsModal.jsx';
import SlotSelectionModal from './modals/SlotSelectionModal.jsx';
import HeroEditModal from './modals/HeroEditModal.jsx';
import JobChangeModal from './modals/JobChangeModal.jsx';
import PromotionCeremonyModal from './modals/PromotionCeremonyModal.jsx';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';

/** The nav's views that Escape closes; Settings is a window and closes itself. */
const NAV_VIEWS = ['guild', 'bank', 'shop', 'atlas'];

/**
 * ReactRoot: the entry point for the React UI layer. Manages the top-level layout, provides
 * the DnD context, and orchestrates global modal overlays.
 *
 * ⭐ The UI reaches the engine one way: a component imports the engine module it reads or
 * commands (there is no engine context). An engine command announces its own change; the UI
 * publishes only UI events (`engineEvents.js`).
 */
export const ReactRoot = () => {
    const ui = useUIModals();
    const { onInspectToken, onClearInspect } = useInspectTokenHandlers(ui.inspect);

    // A refused save (incompatible or corrupted) leaves the slot screen up; the notification
    // says why.
    const handleSlotSelect = (index, { catchUp = true } = {}) =>
        EngineBootstrap.startSlot(index, { catchUp, onOpened: ui.slotSelection.close });

    // "Load as I left it" reloads the page into the slot it put back: open it at once, as it was.
    const resumeRef = React.useRef(handleSlotSelect);
    resumeRef.current = handleSlotSelect;
    React.useEffect(() => {
        const slot = SaveManager.takeResumeSlot();
        if (slot != null) resumeRef.current(slot, { catchUp: false });
    }, []);

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
    const [backgroundTile, setBackgroundTile] = React.useState(() => SettingsManager.get('ui.backgroundTile') ?? 'u_table_wood_spruce');
    // The wood table: drawn around the mat, and carried down with it as the camera looks up to the Hall's sky.
    const tableBackground = {
        backgroundImage: backgroundDrawn ? `url('/assets/ui/${backgroundTile}.png')` : 'none',
        backgroundRepeat: 'repeat',
        backgroundSize: '512px',
        imageRendering: 'pixelated',
        backgroundColor: '#0a0a0a'
    };
    const tableRef = React.useRef(null);

    React.useEffect(() => {
        const unsubscribe = EventBus.subscribe(ENGINE_EVENTS.SETTINGS_UPDATED, (s) => {
            setDebugMode(s.debugMode ?? false);
            setMenuRight(s.ui?.bubbleMenuRight ?? false);
            setBackgroundTile(s.ui?.backgroundTile ?? 'u_table_wood_spruce');
        }, UI_LISTENER);
        return () => unsubscribe();
    }, []);

    // A stress scenario from the perf harness (`?stress=…`) builds its own board, so the slot
    // picker has nothing left to ask. Dev and perf builds only; the event is published by
    // src/ui/dev/perf/stressScenarios.js.
    const closeSlotSelection = ui.slotSelection.close;
    React.useEffect(() => {
        if (!(import.meta.env.DEV || import.meta.env.MODE === 'perf')) return undefined;
        return EventBus.subscribe(UI_EVENTS.DEV_STRESS_STARTED, () => closeSlotSelection(), UI_LISTENER);
    }, [closeSlotSelection]);

    // The Hall's upgrade web selects by upgrade id; it has no tiles.
    const [selectedUpgradeId, setSelectedUpgradeId] = React.useState('roster_size');
    // The star under the pointer: the details panel shows it until the pointer leaves.
    const [hoveredUpgradeId, setHoveredUpgradeId] = React.useState(null);
    const isGuildView = ui.fullscreen.view === 'guild';
    const isAtlasOpen = ui.fullscreen.view === 'atlas';
    const isBankOpen = ui.drawer.panes.includes('bank');

    // While the Bank is open the mat is not interactive at all. `useMatBankLock` is the one
    // place that reaches outside React (the drag sensor) to enforce it, so this is its only
    // writer, kept in step with the Bank's own open/closed state.
    React.useEffect(() => { setMatBankLocked(isBankOpen); }, [isBankOpen]);

    const handleOpenGuildHall = React.useCallback(() => {
        ui.fullscreen.open('guild');
        setSelectedUpgradeId('roster_size');
        setHoveredUpgradeId(null);
        const def = getUpgradeDef('roster_size');
        if (def) {
            ui.inspect.set('guild_upgrade', def.id, { upgradeDef: def }, 'guild');
        }
    }, [ui.fullscreen, ui.inspect]);

    // The top bar's Region name opens the Atlas the way its bubble does; a click while it is
    // already open leaves it open.
    const { isActive: isNavActive, toggle: navToggle } = ui.nav;
    const openAtlasFromBar = useCallback(() => {
        if (!isNavActive('atlas')) navToggle('atlas');
    }, [isNavActive, navToggle]);

    const handleCloseGuildHall = useCallback(() => {
        ui.fullscreen.close();
        setHoveredUpgradeId(null);
        ui.inspect.clear('guild');
    }, [ui.fullscreen, ui.inspect]);

    // Escape closes the open view (the Guild Hall, the Bank, the Shop, the Atlas) as one layer;
    // a stray click never does.
    const openView = NAV_VIEWS.find(view => isNavActive(view)) || null;
    useEscapeLayer(!!openView, () => {
        if (openView === 'guild') handleCloseGuildHall();
        else if (openView) navToggle(openView);
    }, openView);

    const [inspectHeroId, setInspectHeroId] = React.useState(null);
    const toggleInspectHero = React.useCallback((id) => setInspectHeroId(prev => (prev === id ? null : id)), []);
    const closeInspectHero = React.useCallback(() => setInspectHeroId(null), []);

    useHeroSheetRequests(setInspectHeroId);

    const guildPaneSelection = ui.inspect.getByPane ? ui.inspect.getByPane('guild') : null;
    const guildInspectSelection = selectGuildInspectSelection({
        guildPaneSelection,
        globalSelection: ui.inspect.selection,
        selectedUpgradeId,
        getUpgradeDefFn: getUpgradeDef
    });
    const guildShownSelection = hoveredUpgradeId
        ? selectGuildInspectSelection({ hoveredUpgradeId, getUpgradeDefFn: getUpgradeDef })
        : guildInspectSelection;

    // Close must clear BOTH the pane's explicit selection and the web's own 'last picked' id:
    // clearing only the pane left the fallback chain above re-deriving the same selection on
    // the next render, so the panel looked like it never closed.
    const handleClearGuildInspect = React.useCallback(() => {
        ui.inspect.clear('guild');
        setSelectedUpgradeId(null);
    }, [ui.inspect]);

    return (
        <ViewportProvider>
            <DeckDndProvider>
            {particlesDrawn && <ParticleOverlay disabled={ui.isAnyModalOpen} />}
            <ScreenCalloutLayer />
            <div className="react-overlay absolute inset-0 z-50 pointer-events-none flex flex-col">
                <div
                    ref={tableRef}
                    className="flex-1 relative flex overflow-hidden bg-black"
                    style={tableBackground}
                >
                    <div
                        className={cn(
                            "absolute inset-0 bg-black/45 pointer-events-none transition-opacity duration-300 z-0",
                            (isGuildView || isBankOpen) ? "opacity-100" : "opacity-0"
                        )}
                    />

                    {!menuRight && <BubbleMenu ui={ui} side="left" />}
                    {menuRight && isBankOpen && !isGuildView && (
                        // The Bank's hero column: the hero panel (below) draws over it.
                        <aside
                            style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
                            className="shrink-0 h-full pointer-events-none"
                        />
                    )}
                    {/**
                     * The mat's column, under the camera that looks up from the mat to the Hall's
                     * sky (`HallCamera`). `min-w-0`: the column takes the room it is given, not its
                     * widest content's. ⚠️ `overflow-clip`, not `overflow-hidden`: mid-glide the
                     * mat or the Hall sits outside the column's box, and focus landing there would
                     * scroll a hidden box to it; a clipped box is no scroll container.
                     */}
                    <div className="flex-1 min-w-0 relative flex flex-col overflow-clip z-10">
                        <HallCamera
                            open={isGuildView}
                            away={!isGuildView && (ui.fullscreen.view !== null || isBankOpen || ui.shop.isOpen || ui.settings.isOpen)}
                            sky={<HallSky />}
                            table={tableBackground}
                            tableAnchor={tableRef}
                            hall={
                                <>
                                    {/**
                                     * The Guild Hall Effects list: always LEFT of the upgrade web,
                                     * whichever side the nav is on. With the nav flipped right it sits
                                     * between the inspection column and the web.
                                     */}
                                    <GuildHallEffectsPanel />
                                    <div className="flex-1 min-w-0 min-h-0 relative pointer-events-auto">
                                        <GuildHallBoard
                                            selectedUpgradeId={guildInspectSelection?.id ?? selectedUpgradeId}
                                            onSelectUpgrade={(def) => {
                                                setSelectedUpgradeId(def.id);
                                                ui.inspect.set('guild_upgrade', def.id, { upgradeDef: def }, 'guild');
                                            }}
                                            onHoverUpgrade={setHoveredUpgradeId}
                                            onClose={handleCloseGuildHall}
                                        />
                                    </div>
                                    {/**
                                     * The Hall's details panel: always RIGHT of the upgrade web, whichever
                                     * side the nav is on, as the Effects list is always left of it.
                                     */}
                                    <aside
                                        data-hall-details
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
                                                    selection={guildShownSelection}
                                                    onClear={handleClearGuildInspect}
                                                />
                                            </div>
                                        </div>
                                    </aside>
                                </>
                            }
                        >
                        <div className="flex-1 flex min-h-0 relative">
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
                            <PerfProfiler id="TopBar">
                                <MatTopBar
                                    left={<MatRegionName onOpenAtlas={openAtlasFromBar} />}
                                    middle={<MapModeBanner fallback={<><MatCapBadge /><MatUpkeepBadge /></>} />}
                                    right={<MapModeToggles />}
                                />
                            </PerfProfiler>
                            <div className="flex-1 min-w-0 min-h-0 relative">
                            <Board
                                inspectedHeroId={inspectHeroId}
                                inspectedTokenId={ui.inspect.selection?.type === 'token' ? (ui.inspect.selection.source?.instanceId ?? null) : null}
                                onOpenGuildHall={handleOpenGuildHall}
                                onInspectToken={onInspectToken}
                                onClearInspect={onClearInspect}
                            />
                            {/**
                             * Over the mat, under the top bar: the item stubs at the right,
                             * the banners at the centre. Neither takes any width from the mat.
                             * On the mat's side of the camera, so never over the Hall screen:
                             * both live in their own stores, so what arrives meanwhile is there
                             * on the way back (loot flies to no stub).
                             */}
                            <ErrorBoundary label="Notifications">
                                <ItemStubColumn />
                                <BannerStack />
                            </ErrorBoundary>
                            </div>
                        </div>
                        </div>

                        {/**
                         * Bottom Hero Dock: horizontal sliding tabs. On the mat's side of the
                         * camera, so never on the Guild Hall upgrade screen.
                         */}
                        {dockDrawn && (
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
                        {/* The Work Permissions grid rises from behind the bar, the mat's full width. */}
                        {dockDrawn && (
                            <ErrorBoundary label="WorkRulesDrawer">
                                <WorkRulesDrawer
                                    open={ui.flagRules.isOpen}
                                    heroPanelOpen={Boolean(inspectHeroId)}
                                    litHeroId={ui.flagRules.heroId}
                                    onClose={ui.flagRules.close}
                                />
                            </ErrorBoundary>
                        )}
                        </HallCamera>
                        {/* The Atlas pops up over the mat column only: the nav beside it stays reachable to close it. */}
                        <AnimatePresence>
                            {isAtlasOpen && (
                                <ErrorBoundary key="atlas" label="AtlasScreen">
                                    <AtlasScreen onClose={ui.fullscreen.close} closePromotion={ui.dock.closePromotion} />
                                </ErrorBoundary>
                            )}
                        </AnimatePresence>
                        <ErrorBoundary label="ArrivalCard"><ArrivalCard /></ErrorBoundary>
                    </div>
                    {!menuRight && isBankOpen && !isGuildView && (
                        // The Bank's hero column: the hero panel (below) draws over it.
                        <aside
                            style={{ width: columnWidthCss(NOTIFICATION_COLUMN) }}
                            className="shrink-0 h-full pointer-events-none"
                        />
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
                            <BankDrawer drawer={ui.drawer} menuRight={menuRight} />
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

            {/* Debug Mode exists in dev and perf builds only; a shipped build has no QA tools. */}
            {(import.meta.env.DEV || (import.meta.env.MODE === 'perf' && debugMode)) && (
                <>
                    <TestDashboard />
                    {/* The ground's look, for the eye-check: dev builds only. */}
                    {import.meta.env.DEV && <PlaymatTuner />}
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

            {/* Over everything: the loading bar while time away is caught up, then the summary. */}
            <CatchUpOverlay />

            </DeckDndProvider>
        </ViewportProvider>
    );
};

export default ReactRoot;
