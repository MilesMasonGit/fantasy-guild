import { useState, useEffect, useCallback, useMemo } from 'react';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../systems/core/engineEvents.js';

/** How many hero cards can be pinned open at once; pinning another closes the oldest. */
export const DOCK_MAX_PINNED = 2;

/**
 * The first promotion offer standing on the board, or null. Read from the Token instances (the
 * saved truth) through `BoardPromotion.getOffer`, which excludes declined offers.
 */
export function standingPromotionOffer(engine) {
    const BoardState = engine?.BoardState;
    const BoardPromotion = engine?.BoardPromotion;
    if (!BoardState?.tokens || !BoardPromotion?.getOffer) return null;
    try {
        for (const instance of BoardState.tokens()) {
            const offer = BoardPromotion.getOffer(instance.id);
            if (offer) return offer;
        }
    } catch {
    }
    return null;
}

/**
 * useUIModals
 * Modal state and EventBus subscriptions for the React layer.
 */

/**
 * ## Contract: `ui_modal:opened` - a UI to engine notification
 * ⚠️ **This hook is the ONLY publisher of `ui_modal:opened`, and the engine depends on it.**
 * `QuestManager` subscribes to it and maps two `modalId` values onto quest targets
 * (`shop` is the Shop's pane):
 *
 *  | `modalId`      | quest target       |
 *  |----------------|--------------------|
 *  | `bank`         | `open_bank`        |
 *  | `shop`         | `open_shop`        |
 *
 * The tutorial's Item Bank step advances **only** because this React hook fires. The coupling
 * is two string literals in two files that know nothing about each other, so:
 *
 * - **Any new route that opens the Bank or the Shop must publish this event**, or the quest
 * silently never completes. There are two publish sites below: `openDrawerTab` (contextual
 * auto-open) and `navToggle` (nav bubble click).
 * - **Never rename these `modalId` strings** without changing `QuestManager.subscribeToEvents`
 * in the same commit.
 * - Publishing for other targets (`guild`, `areas`, `settings`) is harmless; `QuestManager`
 * ignores anything not in the table.
 *
 * `QuestManager` carries the matching note at its subscription.
 */

/**
 * Nav targets that open as a drawer pane rather than a full-screen view. One set rather than a
 * chain of `||` comparisons: it is checked in three places (is-active, close, open) and a
 * target added to two of the three is a bubble that opens and then cannot be closed.
 */
const DRAWER_TARGETS = new Set(['bank']);

/**
 * The Shop's nav target. The Shop is its own drawer (`ShopDrawer`) with its own open flag
 * (`ui.shop`), not a pane of the Bank's drawer. The quest wiring and the tutorial read
 * this string.
 */
const SHOP_TARGET = 'shop';

export const useUIModals = (engine) => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSlotSelectionOpen, setIsSlotSelectionOpen] = useState(true);

    // `filters` is a fresh object per open so panes can re-apply the same filter twice.
    const [drawerState, setDrawerState] = useState({ panes: [], filters: {}, maximized: null });

    const [isShopOpen, setIsShopOpen] = useState(false);

    // Ordered, oldest first, so that pinning a third closes the oldest; hence an array rather
    // than a Set.
    const [pinnedHeroIds, setPinnedHeroIds] = useState([]);

    const [editHeroId, setEditHeroId] = useState(null);

    // Separate from the Edit modal because changing job is a decision with consequences, not a
    // profile tweak.
    const [jobHeroId, setJobHeroId] = useState(null);

    // ⚠️ Holds only WHICH offer to draw. The offer itself is state on the Token instance
    // (`promotionPaused`), saved board state, so it is re-found on load
    // (`standingPromotionOffer`) rather than lost with the tab.
    const [promotionOffer, setPromotionOffer] = useState(null);

    const [flagRulesHeroId, setFlagRulesHeroId] = useState(null);

    // One value for the whole dock, not one per card; see `toggleBodyView`.
    const [bodyView, setBodyView] = useState('equipment');

    const [inspectByPane, setInspectByPane] = useState({
        bank: null,
        shop: null,
        guild: null
    });
    const [inspectSelection, setInspectSelection] = useState(null);

    const [fullscreenView, setFullscreenView] = useState(null);

    // Contextual auto-open (e.g. a banner's open-the-drawer prompt). Independent of the nav
    // bar's exclusivity rule: it only adds a pane, never closes anything else.
    // ⚠️ One pane at a time: the drawer has a fixed width, and splitting it leaves each pane
    // too narrow. `panes` stays an array so existing readers keep working but never holds more
    // than one.
    const openDrawerTab = useCallback((tab, filter = null) => {
        if (tab === SHOP_TARGET) {
            setIsShopOpen(true);
            EventBus.publish(UI_EVENTS.UI_MODAL_OPENED, { modalId: tab });
            return;
        }
        setDrawerState(s => ({
            ...s,
            panes: [tab],
            filters: { ...s.filters, [tab]: filter ? { ...filter } : null },
            // A lone pane already fills the drawer, so maximise has nothing
            // left to do.
            maximized: null
        }));
        EventBus.publish(UI_EVENTS.UI_MODAL_OPENED, { modalId: tab });
    }, []);

    // The nav bubbles share an only-one-open rule: clicking a bubble closes whatever any other
    // has open, and clicking the active one closes it. Contextual auto-opens (`openDrawerTab`)
    // neither close other views nor are closed by them.
    const isNavActive = useCallback((target) => {
        switch (target) {
            case 'guild': return fullscreenView === 'guild';
            case 'areas': return fullscreenView === 'areas';
            case 'bank': return drawerState.panes.includes('bank');
            case SHOP_TARGET: return isShopOpen;
            case 'settings': return isSettingsOpen;
            default: return false;
        }
    }, [fullscreenView, drawerState.panes, isSettingsOpen, isShopOpen]);

    const navToggle = useCallback((target) => {
        if (isNavActive(target)) {
            if (target === 'guild' || target === 'areas') setFullscreenView(null);
            else if (DRAWER_TARGETS.has(target)) setDrawerState({ panes: [], filters: {}, maximized: null });
            else if (target === SHOP_TARGET) setIsShopOpen(false);
            else if (target === 'settings') setIsSettingsOpen(false);
            return;
        }
        // Close everything now, then open the target next frame. Settings is a Headless UI
        // Dialog whose click-outside handling races a same-click switch, and the dialog never
        // shows.
        setFullscreenView(null);
        setDrawerState({ panes: [], filters: {}, maximized: null });
        setIsSettingsOpen(false);
        setIsShopOpen(false);
        requestAnimationFrame(() => {
            setFullscreenView(target === 'guild' ? 'guild' : target === 'areas' ? 'areas' : null);
            setDrawerState(
                DRAWER_TARGETS.has(target)
                    ? { panes: [target], filters: {}, maximized: null }
                    : { panes: [], filters: {}, maximized: null }
            );
            setIsSettingsOpen(target === 'settings');
            setIsShopOpen(target === SHOP_TARGET);
            EventBus.publish(UI_EVENTS.UI_MODAL_OPENED, { modalId: target });
        });
    }, [isNavActive]);

    const fullscreenOpen = useCallback((view) => setFullscreenView(view), []);
    const fullscreenToggle = useCallback((view) => setFullscreenView(v => (v === view ? null : view)), []);
    const fullscreenClose = useCallback(() => setFullscreenView(null), []);
    const fullscreen = useMemo(() => ({
        view: fullscreenView,
        isOpen: fullscreenView !== null,
        open: fullscreenOpen,
        toggle: fullscreenToggle,
        close: fullscreenClose
    }), [fullscreenView, fullscreenOpen, fullscreenToggle, fullscreenClose]);

    const inspectGetByPane = useCallback((pane) => inspectByPane[pane] || null, [inspectByPane]);
    const inspectSet = useCallback((type, id, source = null, pane = null) => {
        const effectivePane = pane || (
            type === 'guild_upgrade' ? 'guild' :
            type === 'token' ? 'shop' :
            type === 'item' ? 'bank' : null
        );
        const nextSelection = { type, id, source, pane: effectivePane };

        setInspectSelection(prev => (
            prev && prev.type === type && prev.id === id && prev.source?.rect?.top === source?.rect?.top && prev.pane === effectivePane
                ? prev
                : nextSelection
        ));

        if (effectivePane) {
            setInspectByPane(prev => (
                prev[effectivePane] && prev[effectivePane].type === type && prev[effectivePane].id === id
                    ? prev
                    : { ...prev, [effectivePane]: nextSelection }
            ));
        }
    }, []);
    const inspectClear = useCallback((pane = null) => {
        if (pane) {
            setInspectByPane(prev => ({ ...prev, [pane]: null }));
            setInspectSelection(prev => (prev?.pane === pane ? null : prev));
        } else {
            setInspectSelection(null);
        }
    }, []);
    const inspect = useMemo(() => ({
        selection: inspectSelection,
        byPane: inspectByPane,
        getByPane: inspectGetByPane,
        set: inspectSet,
        clear: inspectClear
    }), [inspectSelection, inspectByPane, inspectGetByPane, inspectSet, inspectClear]);

    const controls = {
        settings: {
            open: useCallback(() => setIsSettingsOpen(true), []),
            close: useCallback(() => setIsSettingsOpen(false), []),
            isOpen: isSettingsOpen
        },
        slotSelection: {
            close: useCallback(() => setIsSlotSelectionOpen(false), []),
            isOpen: isSlotSelectionOpen
        },
        fullscreen,
        drawer: {
            ...drawerState,
            isOpen: drawerState.panes.length > 0,
            open: openDrawerTab,
            close: useCallback(() => setDrawerState({ panes: [], filters: {}, maximized: null }), []),
            closePane: useCallback(tab => {
                setDrawerState(s => ({
                    ...s,
                    panes: s.panes.filter(p => p !== tab),
                    maximized: s.maximized === tab ? null : s.maximized
                }));
            }, []),
            toggleMaximize: useCallback(tab => {
                setDrawerState(s => ({ ...s, maximized: s.maximized === tab ? null : tab }));
            }, [])
        },
        shop: {
            isOpen: isShopOpen,
            open: useCallback(() => setIsShopOpen(true), []),
            close: useCallback(() => setIsShopOpen(false), [])
        },
        dock: {
            pinned: pinnedHeroIds,
            isPinned: (heroId) => pinnedHeroIds.includes(heroId),
            // Click a tab: pin it, or unpin it if already open. A third pin evicts the oldest.
            togglePin: useCallback((heroId) => {
                setPinnedHeroIds(prev => {
                    if (prev.includes(heroId)) return prev.filter(id => id !== heroId);
                    return [...prev, heroId].slice(-DOCK_MAX_PINNED);
                });
            }, []),
            // Returns the same array when already empty so state identity is stable; safe to
            // call from a global listener.
            unpinAll: useCallback(() => {
                setPinnedHeroIds(prev => (prev.length === 0 ? prev : []));
            }, []),
            // Shared across every open card on purpose: the dock allows two cards open to
            // compare heroes, which only works if both show the same side. Defaults to the
            // loadout, the drag-and-drop target.
            bodyView,
            toggleBodyView: useCallback(() => {
                setBodyView(prev => (prev === 'equipment' ? 'skills' : 'equipment'));
            }, []),
            editHeroId,
            openEdit: useCallback((heroId) => setEditHeroId(heroId), []),
            closeEdit: useCallback(() => setEditHeroId(null), []),
            jobHeroId,
            openJob: useCallback((heroId) => setJobHeroId(heroId), []),
            closeJob: useCallback(() => setJobHeroId(null), []),
            // Closing only stops drawing: the ceremony's own buttons accept or decline, and an
            // offer closed any other way is still standing on the tile.
            promotionOffer,
            closePromotion: useCallback(() => setPromotionOffer(null), [])
        },
        flagRules: {
            heroId: flagRulesHeroId,
            open: useCallback((heroId) => setFlagRulesHeroId(heroId || null), []),
            close: useCallback(() => setFlagRulesHeroId(null), [])
        },
        inspect,
        nav: {
            isActive: isNavActive,
            toggle: navToggle
        }
    };

    useEffect(() => {
        if (!engine) return;

        // ⚠️ Every subscription below must have a publisher somewhere.
        const subs = [
            engine.EventBus.subscribe(UI_EVENTS.UI_OPEN_DRAWER, (data) => {
                const tab = data?.tab;
                if (!tab || tab === 'heroes') return;
                openDrawerTab(tab, data?.filter);
            }, UI_LISTENER),
            engine.EventBus.subscribe(UI_EVENTS.UI_OPEN_FLAG_RULES, (data) => {
                if (data?.heroId) setFlagRulesHeroId(data.heroId);
            }, UI_LISTENER),
            // Nothing has happened to the hero yet: the tile holds the offer open and this
            // only decides to draw it.
            engine.EventBus.subscribe(BOARD_EVENTS.PROMOTION_READY, (data) => {
                if (data?.instanceId == null) return;
                setPromotionOffer(data);
            }, UI_LISTENER),
            // ⚠️ A loaded save can carry an offer nobody answered. Without this the hero would
            // stand on the Token forever with nothing asking. A declined offer is not
            // standing, so this never re-asks.
            engine.EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => {
                setPromotionOffer(standingPromotionOffer(engine));
            }, UI_LISTENER),
            // Likewise an offer made while a catch-up played with this listener quiet.
            engine.EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, () => {
                setPromotionOffer((current) => current || standingPromotionOffer(engine));
            }, UI_LISTENER)
        ];

        // Same, for a board already loaded when the UI mounted. Deferred a tick so it reads
        // after the engine has finished starting.
        const initial = setTimeout(() => {
            setPromotionOffer((current) => current || standingPromotionOffer(engine));
        }, 0);

        return () => {
            clearTimeout(initial);
            subs.forEach(unsub => unsub());
        };
    }, [engine]);

    const isAnyModalOpen = isSettingsOpen ||
                           fullscreenView !== null;

    return { ...controls, isAnyModalOpen };
};
