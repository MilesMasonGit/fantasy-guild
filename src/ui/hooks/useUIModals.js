import { useState, useEffect, useCallback } from 'react';
import { DOCK_MAX_PINNED } from '../components/dock/dockConstants.js';
import { EventBus } from '../../systems/core/EventBus.js';

/**
 * useUIModals
 * Centralizes the modal state management and EventBus subscriptions for the React layer.
 */

/**
 * ## Contract: `ui_modal:opened` — a UI→engine notification (CR2-094)
 *
 * ⚠️ **This hook is the ONLY publisher of `ui_modal:opened`, and the engine
 * depends on it.** `QuestManager` subscribes to it and maps three `modalId`
 * values onto tutorial quest targets:
 *
 * | `modalId`      | quest target       |
 * |----------------|--------------------|
 * | `bank`         | `open_bank`        |
 * | `vault`        | `open_vault`       |
 * | `cartographer` | `open_cartographer`|
 *
 * Three tutorial quests therefore advance **only** because this React hook
 * fires. The coupling is two string literals in two files that know nothing
 * about each other, so:
 *
 * - **Any new route that opens the Bank, Vault or Cartographer must publish
 *   this event**, or the quest silently never completes. There are two publish
 *   sites below — `openDrawerTab` (contextual auto-open) and `navToggle` (nav
 *   bubble click); a third route must join them.
 * - **Never rename these `modalId` strings** without changing
 *   `QuestManager.subscribeToEvents` in the same commit.
 * - Publishing for other targets (`guild`, `areas`, `settings`) is harmless —
 *   `QuestManager` ignores anything not in the table.
 *
 * `QuestManager` carries the matching note at its subscription.
 */

/**
 * Nav targets that open as a DRAWER PANE rather than a full-screen view.
 *
 * One set rather than a chain of `||` comparisons: this is checked in three
 * places (is-active, close, open) and a target added to two of the three is a
 * bubble that opens and then cannot be closed.
 */
const DRAWER_TARGETS = new Set(['bank', 'vault', 'cartographer']);

export const useUIModals = (engine) => {
    // --- Modal States ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSlotSelectionOpen, setIsSlotSelectionOpen] = useState(true);
    const [isSandboxOpen, setIsSandboxOpen] = useState(false);
    // The pack overlay went with the pack economy; the only thing that could
    // ever fill it was `ui:open_pack_overlay`, which nothing published
    // (CR2-132). Its state is gone with the subscription.
    //
    // The loot-table modal went the same way on 2026-08-26 (CR2-132): nothing
    // published `ui:open_loot_table`, and the drop table it would have shown is
    // already on screen in `TokenInspection`'s route block and `MapInspection`'s
    // pool, both with per-output percentages. ⚠️ The owner may want loot tables
    // on a modal again during development — that screen is to be built fresh for
    // the current Token/Map system, not restored from the retired card system's
    // data shape.

    // --- Bottom Drawer (UI overhaul Phase 2: multi-pane) ---
    // `panes` is the set of open panes (heroes/cards/bank) rendered side by
    // side; `filters` holds a per-pane auto-open filter (§12.B) — a fresh
    // object per open so panes can re-apply the same filter twice;
    // `maximized` names the pane expanded to full height (or null).
    const [drawerState, setDrawerState] = useState({ panes: [], filters: {}, maximized: null });

    // --- Hero Dock pinned cards (Hero Dock Phase 5) ---
    // An ORDERED list of pinned hero ids, oldest first, capped at
    // DOCK_MAX_PINNED. Order is what makes "pinning a third closes the oldest"
    // work, so this is an array rather than a Set.
    const [pinnedHeroIds, setPinnedHeroIds] = useState([]);

    // Which hero the Edit modal is open on, or null (Hero Dock Phase 7).
    const [editHeroId, setEditHeroId] = useState(null);

    // Which hero the Job modal is open on, or null. Separate from the Edit
    // modal because changing job is a decision with consequences, not a
    // profile tweak sitting beside "rename".
    const [jobHeroId, setJobHeroId] = useState(null);

    // 'equipment' | 'skills' — which half of a pinned dock card's body shows.
    // One value for the whole dock, not one per card; see `toggleBodyView`.
    const [bodyView, setBodyView] = useState('equipment');

    // --- Inspect selection state ---
    // Per-target/pane inspection memory so Bank, Vault, Cartographer, and Guild Hall
    // each remember their own last inspected item/token/map/upgrade without stomping or bleeding.
    const [inspectByPane, setInspectByPane] = useState({
        bank: null,
        vault: null,
        cartographer: null,
        guild: null
    });
    const [inspectSelection, setInspectSelection] = useState(null);

    // --- Full-screen drawers (UI overhaul Phase 4) ---
    // One at a time (spec §PRES-01 multi-open: No): 'guild' | 'areas' | null
    const [fullscreenView, setFullscreenView] = useState(null);

    // Helper function to open a bottom drawer tab (contextual auto-open —
    // e.g. a banner's "open the drawer" prompt. Deliberately independent of
    // the nav bar's exclusivity rule below: it only adds a pane, never
    // closes anything else.)
    // ⚠️ **One pane at a time** (D-239). Opening the Bank closes the Vault.
    //
    // This used to append, so several panes shared the drawer's width. The
    // drawer now comes from the SIDE at a fixed width (D-238), and splitting
    // that three ways leaves each pane about a third of the playmat — roughly
    // three columns of the Bank's 96px grid. `panes` stays an array so every
    // existing reader keeps working; it simply never holds more than one.
    const openDrawerTab = useCallback((tab, filter = null) => {
        setDrawerState(s => ({
            ...s,
            panes: [tab],
            filters: { ...s.filters, [tab]: filter ? { ...filter } : null },
            // A lone pane already fills the drawer, so maximise has nothing
            // left to do.
            maximized: null
        }));
        EventBus.publish('ui_modal:opened', { modalId: tab });
    }, []);

    // --- Nav bar exclusivity (bubble clicks only) ---
    // The nav bubbles share one "only one open at a time" rule: clicking a bubble
    // closes whatever any of the others has open, and clicking the active
    // one closes it. This is a property of the bubble click itself, not of
    // the underlying view — contextual auto-opens (e.g. a banner's "open
    // the drawer" prompt via openDrawerTab above) don't close other views
    // and aren't closed by them either.
    const isNavActive = useCallback((target) => {
        switch (target) {
            case 'guild': return fullscreenView === 'guild';
            case 'areas': return fullscreenView === 'areas';
            case 'bank': return drawerState.panes.includes('bank');
            case 'vault': return drawerState.panes.includes('vault');
            case 'cartographer': return drawerState.panes.includes('cartographer');
            case 'settings': return isSettingsOpen;
            default: return false;
        }
    }, [fullscreenView, drawerState.panes, isSettingsOpen]);

    const navToggle = useCallback((target) => {
        if (isNavActive(target)) {
            if (target === 'guild' || target === 'areas') setFullscreenView(null);
            else if (DRAWER_TARGETS.has(target)) setDrawerState({ panes: [], filters: {}, maximized: null });
            else if (target === 'settings') setIsSettingsOpen(false);
            return;
        }
        // Close everything now, then open the target next frame. Settings is
        // a Headless UI Dialog with its own "click outside closes me"
        // handling; switching straight into it in the same click races that
        // handling against this one and the dialog never actually shows.
        // Opening a frame later sidesteps the race — imperceptible.
        setFullscreenView(null);
        setDrawerState({ panes: [], filters: {}, maximized: null });
        setIsSettingsOpen(false);
        requestAnimationFrame(() => {
            setFullscreenView(target === 'guild' ? 'guild' : target === 'areas' ? 'areas' : null);
            setDrawerState(
                DRAWER_TARGETS.has(target)
                    ? { panes: [target], filters: {}, maximized: null }
                    : { panes: [], filters: {}, maximized: null }
            );
            setIsSettingsOpen(target === 'settings');
            EventBus.publish('ui_modal:opened', { modalId: target });
        });
    }, [isNavActive]);

    // --- Memoized Controls ---
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
        sandbox: {
            toggle: useCallback(() => setIsSandboxOpen(prev => !prev), []),
            close: useCallback(() => setIsSandboxOpen(false), []),
            isOpen: isSandboxOpen
        },
        fullscreen: {
            view: fullscreenView,
            isOpen: fullscreenView !== null,
            open: useCallback((view) => setFullscreenView(view), []),
            toggle: useCallback((view) => setFullscreenView(v => (v === view ? null : view)), []),
            close: useCallback(() => setFullscreenView(null), [])
        },
        drawer: {
            ...drawerState,
            isOpen: drawerState.panes.length > 0,
            // Ensure a pane is open and (re)apply its auto-open filter,
            // leaving other open panes alone (§12.B).
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
        dock: {
            pinned: pinnedHeroIds,
            isPinned: (heroId) => pinnedHeroIds.includes(heroId),
            // Click a tab: pin it, or unpin it if it's already open. A third
            // pin evicts the oldest (concept §3, strict 2-card comparison).
            togglePin: useCallback((heroId) => {
                setPinnedHeroIds(prev => {
                    if (prev.includes(heroId)) return prev.filter(id => id !== heroId);
                    return [...prev, heroId].slice(-DOCK_MAX_PINNED);
                });
            }, []),
            // Clicking anywhere outside the dock closes every card (D11).
            // Returns the same array when already empty so the state identity
            // is stable and this can be called freely from a global listener.
            unpinAll: useCallback(() => {
                setPinnedHeroIds(prev => (prev.length === 0 ? prev : []));
            }, []),
            // Which half of a pinned card's body is showing. SHARED across
            // every open card on purpose (owner decision 2026-08-02): the dock
            // allows two cards open precisely to compare two heroes, and a
            // comparison is only meaningful when both show the same side.
            // Defaults to the loadout, which is also the drag-and-drop target.
            bodyView,
            toggleBodyView: useCallback(() => {
                setBodyView(prev => (prev === 'equipment' ? 'skills' : 'equipment'));
            }, []),
            // The Edit modal — name, portrait, job (roadmap D8).
            editHeroId,
            openEdit: useCallback((heroId) => setEditHeroId(heroId), []),
            closeEdit: useCallback(() => setEditHeroId(null), []),
            // The Job modal — promote and re-train, which are one act (D-248).
            jobHeroId,
            openJob: useCallback((heroId) => setJobHeroId(heroId), []),
            closeJob: useCallback(() => setJobHeroId(null), [])
        },
        inspect: {
            selection: inspectSelection,
            byPane: inspectByPane,
            getByPane: useCallback((pane) => inspectByPane[pane] || null, [inspectByPane]),
            set: useCallback((type, id, source = null, pane = null) => {
                const effectivePane = pane || (
                    type === 'guild_upgrade' ? 'guild' :
                    type === 'map' ? 'cartographer' :
                    type === 'token' ? 'vault' :
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
            }, []),
            clear: useCallback((pane = null) => {
                if (pane) {
                    setInspectByPane(prev => ({ ...prev, [pane]: null }));
                    setInspectSelection(prev => (prev?.pane === pane ? null : prev));
                } else {
                    setInspectSelection(null);
                }
            }, [])
        },
        nav: {
            // 'guild' | 'bank' | 'vault' | 'cartographer' | 'areas' | 'settings'
            //
            // 'library' (the Collection Binder) was removed on 2026-08-24
            // (CR2-144). It was a nav target with no bubble and no screen —
            // nothing could set it, yet `isAnyModalOpen`, which gates the
            // particle overlay, depended on it.
            isActive: isNavActive,
            toggle: navToggle
        }
    };

    // --- Event Subscriptions ---
    useEffect(() => {
        if (!engine) return;

        // ⚠️ Every subscription below must have a publisher somewhere. Five
        // that did not were removed on 2026-08-26 (CR2-191, CR2-132):
        // `ui:card_tier_changed` (its `setCardTier` had already gone with
        // CR2-166, so the handler was a ReferenceError waiting on a publish),
        // `ui:open_settings` and `ui:open_hero_customize` (duplicate routes —
        // the nav bar and `ui.dock.openEdit` are the real ones),
        // `ui:open_pack_overlay` (the pack overlay is gone), and
        // `ui:open_loot_table` (the loot-table modal is gone — see above).
        const subs = [
            engine.EventBus.subscribe('dev:toggle-sandbox', () => setIsSandboxOpen(prev => !prev)),
            // Contextual auto-open from empty banner slots (§12.B). The
            // 'heroes' tab is gone — the dock is always on screen, so an empty
            // hero slot has nothing to open and just says so on the card.
            engine.EventBus.subscribe('ui:open_drawer', (data) => {
                const tab = data?.tab;
                if (!tab || tab === 'heroes') return;
                openDrawerTab(tab, data?.filter);
            })
        ];

        return () => subs.forEach(unsub => unsub());
    }, [engine]);

    const isAnyModalOpen = isSettingsOpen ||
                           isSandboxOpen ||
                           fullscreenView !== null;

    return { ...controls, isAnyModalOpen };
};
