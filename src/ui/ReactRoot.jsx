import React, { useCallback } from 'react';
import { cn } from './utils/cn.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus, UI_LISTENER } from '../systems/core/EventBus.js';

import { DeckDndProvider } from './dnd/DndKit.jsx';
import { setMatBankLocked } from './hooks/useMatBankLock.js';

import { useUIModals } from './hooks/useUIModals.js';
import { useEscapeLayer } from './utils/escapeLayers.js';
import { useInspectTokenHandlers } from './hooks/useInspectTokenHandlers.js';
import { useEncyclopediaBack } from './hooks/useEncyclopediaBack.js';
import { useHeroSheetRequests } from './hooks/useHeroSheetRequests.js';
import { useOneBottomDrawer } from './hooks/useOneBottomDrawer.js';
import { useWorldMapRequests } from './hooks/useWorldMapRequests.js';
import { selectHero, useSelectionClearing } from './hooks/useMatSelection.js';

import Board from './components/board/Board.jsx';
import BankDrawer from './components/drawer/BankDrawer.jsx';
import ShopPanel from './components/drawer/ShopPanel.jsx';
import WorldScreen from './components/atlas/WorldScreen.jsx';
import WorldDrawer from './components/atlas/WorldDrawer.jsx';
import WorldCamera from './components/atlas/WorldCamera.jsx';
import ArrivalCard from './components/atlas/ArrivalCard.jsx';
import EncyclopediaScreen from './components/encyclopedia/EncyclopediaScreen.jsx';

import BubbleMenu from './components/nav/BubbleMenu.jsx';
import BottomHeroDock from './components/dock/BottomHeroDock.jsx';
import HeroDrawer from './components/dock/HeroDrawer.jsx';
import GuildHallBoard from './components/board/GuildHallBoard.jsx';
import HallSky from './components/board/HallSky.jsx';
import HallCamera from './components/board/HallCamera.jsx';
import { HallUpgradeDrawer, HERO_BAR_CLEAR_PX } from './components/drawer/HallUpgradeDrawer.jsx';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { TokenInspectPopup } from './components/board/TokenInspectPopup.jsx';
import { FightPanelPopup } from './components/combat/FightPanelPopup.jsx';
import { FightTabStrip } from './components/combat/FightTab.jsx';

import { FPSCounter } from './components/base/FPSCounter.jsx';
import { ParticleOverlay } from './components/base/ParticleOverlay.jsx';
import { ErrorBoundary } from './components/base/ErrorBoundary.jsx';
import { ItemStubColumn } from './components/notifications/ItemStubColumn.jsx';
import { BannerStack } from './components/notifications/BannerStack.jsx';
import { ScreenCalloutLayer } from './components/notifications/ScreenCalloutLayer.jsx';
import TestDashboard from './components/TestDashboard.jsx';
import CatchUpOverlay from './components/hud/CatchUpOverlay.jsx';
import MatTopBar from './components/board/MatTopBar.jsx';
import { LimesBlurb } from './components/limes/LimesBlurb.jsx';
import { LimesTargetMark } from './components/limes/LimesTargetMark.jsx';
import MatRegionName from './components/board/MatRegionName.jsx';
import MatCapBadge from './components/board/MatCapBadge.jsx';
import MatUpkeepBadge from './components/board/MatUpkeepBadge.jsx';
import { MapModeToggles, MapModeBanner } from './components/board/MatModeControls.jsx';
import { PerfProfiler, usePerfHudShowing } from './dev/perf/PerfProfiler.jsx';
import { useDrawn } from './dev/perf/drawSwitches.js';

import SettingsModal from './modals/SettingsModal.jsx';
import SlotSelectionModal from './modals/SlotSelectionModal.jsx';
import HeroEditModal from './modals/HeroEditModal.jsx';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';

/** The nav's views that Escape closes; Settings is a window and closes itself. */
const NAV_VIEWS = ['guild', 'bank', 'shop', 'atlas', 'encyclopedia'];

/**
 * ReactRoot: the entry point for the React UI layer. Manages the top-level layout, provides
 * the DnD context, and orchestrates global modal overlays.
 *
 * ⭐ The UI reaches the engine one way: a component imports the engine module it reads or
 * commands (there is no engine context). An engine command announces its own change; the UI
 * publishes only UI events (`engineEvents.js`).
 */
const ReactRoot = () => {
    const ui = useUIModals();
    const { onInspectToken, onClearInspect } = useInspectTokenHandlers(ui.inspect);

    // A refused save (incompatible or corrupted) leaves the slot screen up; the notification
    // says why. `setup` is the new-game screen's choices, for an empty slot.
    const handleSlotSelect = (index, { catchUp = true, setup } = {}) =>
        EngineBootstrap.startSlot(index, { catchUp, setup, onOpened: ui.slotSelection.close });

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

    // The Hall star in the Upgrade drawer, by id: none (the drawer closed) until a star is clicked.
    const [hallStarId, setHallStarId] = React.useState(null);
    const isGuildView = ui.fullscreen.view === 'guild';
    const isAtlasOpen = ui.fullscreen.view === 'atlas';
    const isEncyclopediaOpen = ui.fullscreen.view === 'encyclopedia';
    const isBankOpen = ui.drawer.panes.includes('bank');

    // While the Bank is open the mat is not interactive at all. `useMatBankLock` is the one
    // place that reaches outside React (the drag sensor) to enforce it, so this is its only
    // writer, kept in step with the Bank's own open/closed state.
    React.useEffect(() => { setMatBankLocked(isBankOpen); }, [isBankOpen]);

    const handleOpenGuildHall = React.useCallback(() => {
        ui.fullscreen.open('guild');
        setHallStarId(null);
    }, [ui.fullscreen]);

    // The top bar's Region name opens the Atlas the way its bubble does; a click while it is
    // already open leaves it open.
    const { isActive: isNavActive, toggle: navToggle } = ui.nav;
    const openAtlasFromBar = useCallback(() => {
        if (!isNavActive('atlas')) navToggle('atlas');
    }, [isNavActive, navToggle]);

    // A "look it up" link opens the Encyclopedia from anywhere, closing what is open (a card, the Bank).
    const { clear: clearInspect } = ui.inspect;
    React.useEffect(() => EventBus.subscribe(UI_EVENTS.OPEN_ENCYCLOPEDIA, () => {
        clearInspect();
        if (!isNavActive('encyclopedia')) navToggle('encyclopedia');
    }, UI_LISTENER), [isNavActive, navToggle, clearInspect]);

    const handleCloseGuildHall = useCallback(() => {
        ui.fullscreen.close();
        setHallStarId(null);
    }, [ui.fullscreen]);
    const closeHallStar = useCallback(() => setHallStarId(null), []);

    // Escape closes the open view (the Guild Hall, the Bank, the Shop, the Atlas, the Encyclopedia) as one layer;
    // a stray click never does.
    const openView = NAV_VIEWS.find(view => isNavActive(view)) || null;
    useEscapeLayer(!!openView, () => {
        if (openView === 'guild') handleCloseGuildHall();
        else if (openView) navToggle(openView);
    }, openView);

    // A book opened from a Token's recipe list brings that card back as it closes.
    useEncyclopediaBack(isEncyclopediaOpen, !!openView && openView !== 'encyclopedia', onInspectToken);

    const [inspectHeroId, setInspectHeroId] = React.useState(null);
    const closeInspectHero = React.useCallback(() => setInspectHeroId(null), []);
    // The hero bar: a click selects the hero (and closes another hero's drawer); a double-click
    // opens theirs too.
    const pickHeroOnBar = React.useCallback((id) => {
        selectHero(id);
        setInspectHeroId(prev => (prev && prev !== id ? null : prev));
    }, []);
    const inspectHeroOnBar = React.useCallback((id) => {
        selectHero(id);
        setInspectHeroId(id);
    }, []);
    // The mat's selection clears on leaving the mat (the World Map, the Guild Hall), and on its
    // other triggers. The Encyclopedia, the Bank and the Shop lie over the mat and keep it.
    useSelectionClearing(isAtlasOpen || isGuildView);

    useHeroSheetRequests(setInspectHeroId);
    useOneBottomDrawer({ shopOpen: ui.shop.isOpen, heroId: inspectHeroId, closeShop: ui.shop.close, closeHero: closeInspectHero });
    const openAtlas = ui.fullscreen.open;
    const openWorldMap = React.useCallback(() => openAtlas('atlas'), [openAtlas]);
    useWorldMapRequests(openWorldMap);

    return (
        <DeckDndProvider>
            <ScreenCalloutLayer />
            <LimesTargetMark />
            <div className="react-overlay absolute inset-0 z-50 pointer-events-none flex flex-col">
                {/* ⚠️ `overflow-clip`: the Hall's web runs past the column to the screen's edge, and a
                    hidden box would scroll to a focused star out there. `min-h-0`: a clipped box, unlike a
                    hidden one, would otherwise grow to its tallest content (the nav) past the screen. */}
                <div
                    ref={tableRef}
                    className="flex-1 min-h-0 relative flex overflow-clip bg-black"
                    style={tableBackground}
                >
                    <div
                        className={cn(
                            "absolute inset-0 bg-black/45 pointer-events-none transition-opacity duration-300 z-0",
                            (isGuildView || isBankOpen) ? "opacity-100" : "opacity-0"
                        )}
                    />

                    {!menuRight && <BubbleMenu ui={ui} side="left" />}
                    {/**
                     * The mat's column, under the camera that looks up from the mat to the Hall's
                     * sky (`HallCamera`). `min-w-0`: the column takes the room it is given, not its
                     * widest content's. ⚠️ `overflow-clip`, not `overflow-hidden`: mid-glide the
                     * mat or the Hall sits outside the column's box, and focus landing there would
                     * scroll a hidden box to it; a clipped box is no scroll container. While the Hall
                     * is open it clips only up and down: its sky's web runs on sideways under the
                     * nav (which is over this column) to the screen's edge.
                     * ⚠️ No layer of its own: the hero bar at its foot is drawn in the screen's
                     * layers, over the side drawers; everything else in it is in the `z-10` box.
                     */}
                    <div className={cn('flex-1 min-w-0 relative flex flex-col overflow-y-clip', isGuildView ? 'overflow-x-visible' : 'overflow-x-clip')}>
                        <div className="flex-1 min-h-0 relative flex flex-col z-10">
                        <HallCamera
                            open={isGuildView}
                            away={!isGuildView && (ui.fullscreen.view !== null || isBankOpen || ui.shop.isOpen || ui.settings.isOpen)}
                            sky={<HallSky />}
                            table={tableBackground}
                            tableAnchor={tableRef}
                            hall={
                                <>
                                    {/* Clear of the hero bar at the screen's foot, so no star's title is under it. */}
                                    <div className="flex-1 min-w-0 min-h-0 relative pointer-events-auto" style={{ paddingBottom: HERO_BAR_CLEAR_PX }}>
                                        <GuildHallBoard
                                            selectedUpgradeId={hallStarId}
                                            onSelectUpgrade={(def) => setHallStarId(def.id)}
                                        />
                                        <div className="absolute left-3 top-3 z-10">
                                            <LimesBlurb spot="guildHall" />
                                        </div>
                                    </div>
                                </>
                            }
                        >
                        {/**
                         * The mat's side stays put while the Bank is open: the Bank and its Item
                         * drawer lie over it, so it is never measured or redrawn for them.
                         */}
                        <div className="flex-1 min-h-0 flex flex-col relative">
                        {/**
                         * The mat's room, under the camera that pans down from the mat to the world
                         * map (`WorldCamera`): the top bar goes with the mat, the hero bar below stays.
                         */}
                        <WorldCamera
                            open={isAtlasOpen}
                            away={!isAtlasOpen && (ui.fullscreen.view !== null || isBankOpen || ui.shop.isOpen || ui.settings.isOpen)}
                            world={<ErrorBoundary label="WorldScreen"><WorldScreen onClose={ui.fullscreen.close} menuRight={menuRight} /></ErrorBoundary>}
                            table={tableBackground}
                            tableAnchor={tableRef}
                        >
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
                            {/* The Encyclopedia lies over the mat but under the item stubs: a stub clicked while it is open turns to that item's chart. */}
                            {isEncyclopediaOpen && (
                                <ErrorBoundary label="EncyclopediaScreen">
                                    <EncyclopediaScreen onClose={ui.fullscreen.close} />
                                </ErrorBoundary>
                            )}
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
                            {/* Minimized fight windows: a strip of tabs at the mat's foot, above the hero bar. */}
                            <ErrorBoundary label="FightTabs"><FightTabStrip /></ErrorBoundary>
                            </div>
                        </div>
                        </WorldCamera>
                        </div>
                        </HallCamera>
                        <ErrorBoundary label="ArrivalCard"><ArrivalCard /></ErrorBoundary>
                        </div>
                        {/**
                         * The hero bar, under both sides of the camera: on every screen, the
                         * Guild Hall's included. A crash in it stays local to it.
                         */}
                        {dockDrawn && (
                            <ErrorBoundary label="HeroDock">
                                <PerfProfiler id="HeroDock">
                                    <BottomHeroDock
                                        selectedHeroId={inspectHeroId}
                                        onSelectHero={pickHeroOnBar}
                                        onDoubleClickHero={inspectHeroOnBar}
                                    />
                                </PerfProfiler>
                            </ErrorBoundary>
                        )}
                    </div>
                    {menuRight && <BubbleMenu ui={ui} side="right" />}
                    {/* The Guild Hall's Upgrade drawer, opened by a click on a star. */}
                    <ErrorBoundary label="HallUpgradeDrawer">
                        <HallUpgradeDrawer
                            upgradeDef={isGuildView && hallStarId ? getUpgradeDef(hallStarId) : null}
                            menuRight={menuRight}
                            onClose={closeHallStar}
                        />
                    </ErrorBoundary>
                    {/**
                     * Loot flying off the mat: over the mat, under the drawers, the hero panel and
                     * the nav. ⚠️ Inside this overlay so its layer is compared with theirs; outside
                     * it, it is compared with the overlay as a whole. Nothing flies while the Bank
                     * is open: the mat is wholly under it and its Item drawer.
                     */}
                    {particlesDrawn && <ParticleOverlay disabled={ui.isAnyModalOpen || isBankOpen} />}
                    {/**
                     * The Hero drawer: a hero's panel rising from behind the hero bar, opened from
                     * the bar. A crash in it stays local.
                     */}
                    <ErrorBoundary label="HeroDrawer">
                        <HeroDrawer
                            menuRight={menuRight}
                            selectedHeroId={inspectHeroId}
                            onCloseHero={closeInspectHero}
                            onEditHero={(id) => ui.dock.openEdit(id)}
                        />
                    </ErrorBoundary>
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
                     * The World Map drawer: the side drawer, beside the Bank's, while the world map is
                     * open. Its screen, under the camera, hands it the chosen place.
                     */}
                    {drawersDrawn && <ErrorBoundary label="WorldDrawer">
                        <WorldDrawer open={isAtlasOpen} menuRight={menuRight} onClose={ui.fullscreen.close} />
                    </ErrorBoundary>}
                    {/**
                     * The Shop, rising from the bottom beside the nav. A crash here stays local
                     * to it too.
                     */}
                    {drawersDrawn && <ErrorBoundary label="ShopPanel">
                        <ShopPanel isOpen={ui.shop.isOpen} onClose={ui.shop.close} menuRight={menuRight} />
                    </ErrorBoundary>}
                </div>
            </div>

            {/* Debug Mode exists in dev and perf builds only; a shipped build has no QA tools. */}
            {(import.meta.env.DEV || (import.meta.env.MODE === 'perf' && debugMode)) && (
                <>
                    <TestDashboard />
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
            {/* The fight panel over the playmat; always mounted, so every fight's log is kept from its start. */}
            <FightPanelPopup onOpened={onClearInspect} />
            <SettingsModal isOpen={ui.settings.isOpen} onClose={ui.settings.close} />
            <SlotSelectionModal isOpen={ui.slotSelection.isOpen} onSelect={handleSlotSelect} />
            {ui.dock.editHeroId && (
                <HeroEditModal
                    heroId={ui.dock.editHeroId}
                    isOpen
                    onClose={ui.dock.closeEdit}
                />
            )}
            {/* Over everything: the loading bar while time away is caught up, then the summary. */}
            <CatchUpOverlay />

        </DeckDndProvider>
    );
};

export default ReactRoot;
