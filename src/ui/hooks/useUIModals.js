import { useState, useEffect, useCallback, useMemo } from 'react';
import { BOARD_EVENTS } from '../../systems/board/boardEvents.js';
import { EventBus, UI_LISTENER } from '../../systems/core/EventBus.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as BoardPromotion from '../../systems/board/BoardPromotion.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../systems/core/engineEvents.js';

/**
 * The first promotion offer standing on the board, or null. Read from the Token instances (the
 * saved truth) through `BoardPromotion.getOffer`, which excludes declined offers.
 */
export function standingPromotionOffer() {
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
 * silently never completes. There are two publish sites below: `openDrawerTab` (a direct
 * open) and `navToggle` (nav bubble click).
 * - **Never rename these `modalId` strings** without changing `QuestManager.subscribeToEvents`
 * in the same commit.
 * - Publishing for other targets (`guild`, `atlas`, `settings`) is harmless; `QuestManager`
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

/** Nav targets that open as a full-screen view (`ui.fullscreen.view`). The Atlas is an overlay over the mat. */
const FULLSCREEN_TARGETS = new Set(['guild', 'atlas']);

export const useUIModals = () => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSlotSelectionOpen, setIsSlotSelectionOpen] = useState(true);

    const [drawerState, setDrawerState] = useState({ panes: [] });

    const [isShopOpen, setIsShopOpen] = useState(false);

    const [editHeroId, setEditHeroId] = useState(null);

    // Separate from the Edit modal because changing job is a decision with consequences, not a
    // profile tweak.
    const [jobHeroId, setJobHeroId] = useState(null);

    // ⚠️ Holds only WHICH offer to draw. The offer itself is state on the Token instance
    // (`promotionPaused`), saved board state, so it is re-found on load
    // (`standingPromotionOffer`) rather than lost with the tab.
    const [promotionOffer, setPromotionOffer] = useState(null);

    const [inspectByPane, setInspectByPane] = useState({
        bank: null,
        shop: null,
        guild: null
    });
    const [inspectSelection, setInspectSelection] = useState(null);

    const [fullscreenView, setFullscreenView] = useState(null);

    // The Work Permissions drawer, and the hero whose row it opened lit (`open(heroId)`).
    const [flagRules, setFlagRules] = useState({ isOpen: false, heroId: null });

    // The Bank, Shop and Work Permissions drawers are one at a time: opening one closes the others.
    const closeBankPane = useCallback(() => setDrawerState({ panes: [] }), []);
    const closeRules = useCallback(() => setFlagRules({ isOpen: false, heroId: null }), []);
    const openRules = useCallback((heroId) => {
        closeBankPane();
        setIsShopOpen(false);
        setFlagRules({ isOpen: true, heroId: heroId || null });
    }, [closeBankPane]);
    const openShop = useCallback(() => {
        closeBankPane();
        closeRules();
        setIsShopOpen(true);
    }, [closeBankPane, closeRules]);

    // A direct open, outside the nav bar's toggle: it only adds a pane, never closes the nav's
    // other views.
    // ⚠️ One pane at a time: the drawer has a fixed width, and splitting it leaves each pane
    // too narrow. `panes` stays an array so existing readers keep working but never holds more
    // than one.
    const openDrawerTab = useCallback((tab) => {
        if (tab === SHOP_TARGET) {
            openShop();
            EventBus.publish(UI_EVENTS.UI_MODAL_OPENED, { modalId: tab });
            return;
        }
        closeRules();
        setIsShopOpen(false);
        setDrawerState(s => ({
            ...s,
            panes: [tab]
        }));
        EventBus.publish(UI_EVENTS.UI_MODAL_OPENED, { modalId: tab });
    }, [openShop, closeRules]);

    // The nav bubbles share an only-one-open rule: clicking a bubble closes whatever any other
    // has open, and clicking the active one closes it. Direct opens (`openDrawerTab`) neither
    // close other views nor are closed by them.
    const isNavActive = useCallback((target) => {
        switch (target) {
            case 'guild':
            case 'atlas': return fullscreenView === target;
            case 'bank': return drawerState.panes.includes('bank');
            case SHOP_TARGET: return isShopOpen;
            case 'settings': return isSettingsOpen;
            default: return false;
        }
    }, [fullscreenView, drawerState.panes, isSettingsOpen, isShopOpen]);

    const navToggle = useCallback((target) => {
        if (isNavActive(target)) {
            if (FULLSCREEN_TARGETS.has(target)) setFullscreenView(null);
            else if (DRAWER_TARGETS.has(target)) setDrawerState({ panes: [] });
            else if (target === SHOP_TARGET) setIsShopOpen(false);
            else if (target === 'settings') setIsSettingsOpen(false);
            return;
        }
        // Close everything now, then open the target next frame. Settings is a Headless UI
        // Dialog whose click-outside handling races a same-click switch, and the dialog never
        // shows.
        setFullscreenView(null);
        setDrawerState({ panes: [] });
        setIsSettingsOpen(false);
        setIsShopOpen(false);
        if (DRAWER_TARGETS.has(target) || target === SHOP_TARGET) closeRules();
        requestAnimationFrame(() => {
            setFullscreenView(FULLSCREEN_TARGETS.has(target) ? target : null);
            setDrawerState(
                DRAWER_TARGETS.has(target)
                    ? { panes: [target] }
                    : { panes: [] }
            );
            setIsSettingsOpen(target === 'settings');
            setIsShopOpen(target === SHOP_TARGET);
            EventBus.publish(UI_EVENTS.UI_MODAL_OPENED, { modalId: target });
        });
    }, [isNavActive, closeRules]);

    const fullscreenOpen = useCallback((view) => setFullscreenView(view), []);
    const fullscreenClose = useCallback(() => setFullscreenView(null), []);
    const fullscreen = useMemo(() => ({
        view: fullscreenView,
        open: fullscreenOpen,
        close: fullscreenClose
    }), [fullscreenView, fullscreenOpen, fullscreenClose]);

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
        getByPane: inspectGetByPane,
        set: inspectSet,
        clear: inspectClear
    }), [inspectSelection, inspectGetByPane, inspectSet, inspectClear]);

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
            closePane: useCallback(tab => {
                setDrawerState(s => ({ ...s, panes: s.panes.filter(p => p !== tab) }));
            }, [])
        },
        shop: {
            isOpen: isShopOpen,
            open: openShop,
            close: useCallback(() => setIsShopOpen(false), [])
        },
        dock: {
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
            isOpen: flagRules.isOpen,
            heroId: flagRules.heroId,
            open: openRules,
            toggle: useCallback(() => {
                if (flagRules.isOpen) closeRules();
                else openRules(null);
            }, [flagRules.isOpen, closeRules, openRules]),
            close: closeRules
        },
        inspect,
        nav: {
            isActive: isNavActive,
            toggle: navToggle
        }
    };

    useEffect(() => {
        // ⚠️ Every subscription below must have a publisher somewhere.
        const subs = [
            // Nothing has happened to the hero yet: the tile holds the offer open and this
            // only decides to draw it.
            EventBus.subscribe(BOARD_EVENTS.PROMOTION_READY, (data) => {
                if (data?.instanceId == null) return;
                setPromotionOffer(data);
            }, UI_LISTENER),
            // ⚠️ A loaded save can carry an offer nobody answered. Without this the hero would
            // stand on the Token forever with nothing asking. A declined offer is not
            // standing, so this never re-asks.
            EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => {
                setPromotionOffer(standingPromotionOffer());
            }, UI_LISTENER),
            // Likewise an offer made while a catch-up played with this listener quiet.
            EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, () => {
                setPromotionOffer((current) => current || standingPromotionOffer());
            }, UI_LISTENER)
        ];

        // Same, for a board already loaded when the UI mounted. Deferred a tick so it reads
        // after the engine has finished starting.
        const initial = setTimeout(() => {
            setPromotionOffer((current) => current || standingPromotionOffer());
        }, 0);

        return () => {
            clearTimeout(initial);
            subs.forEach(unsub => unsub());
        };
    }, []);

    const isAnyModalOpen = isSettingsOpen ||
                           fullscreenView !== null;

    return { ...controls, isAnyModalOpen };
};
