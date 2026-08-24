import { useState, useEffect, useCallback } from 'react';
import { DOCK_MAX_PINNED } from '../components/dock/dockConstants.js';
import { EventBus } from '../../systems/core/EventBus.js';

/**
 * useUIModals
 * Centralizes the modal state management and EventBus subscriptions for the React layer.
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
    const [isCardLibraryOpen, setIsCardLibraryOpen] = useState(false);
    const [isSandboxOpen, setIsSandboxOpen] = useState(false);
    const [packResults, setPackResults] = useState(null);
    const [lootTableData, setLootTableData] = useState(null);

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

    // --- Card tier sizing (responsive) ---
    const [cardTier, setCardTier] = useState('md');

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
            case 'library': return isCardLibraryOpen;
            case 'settings': return isSettingsOpen;
            default: return false;
        }
    }, [fullscreenView, drawerState.panes, isCardLibraryOpen, isSettingsOpen]);

    const navToggle = useCallback((target) => {
        if (isNavActive(target)) {
            if (target === 'guild' || target === 'areas') setFullscreenView(null);
            else if (DRAWER_TARGETS.has(target)) setDrawerState({ panes: [], filters: {}, maximized: null });
            else if (target === 'library') setIsCardLibraryOpen(false);
            else if (target === 'settings') setIsSettingsOpen(false);
            return;
        }
        // Close everything now, then open the target next frame. Settings and
        // Collection Binder are Headless UI Dialogs with their own "click
        // outside closes me" handling; switching directly from one straight
        // to the other in the same click races that handling against this
        // one and the new dialog never actually shows. Opening a frame later
        // sidesteps the race — imperceptible to the player.
        setFullscreenView(null);
        setDrawerState({ panes: [], filters: {}, maximized: null });
        setIsCardLibraryOpen(false);
        setIsSettingsOpen(false);
        requestAnimationFrame(() => {
            setFullscreenView(target === 'guild' ? 'guild' : target === 'areas' ? 'areas' : null);
            setDrawerState(
                DRAWER_TARGETS.has(target)
                    ? { panes: [target], filters: {}, maximized: null }
                    : { panes: [], filters: {}, maximized: null }
            );
            setIsCardLibraryOpen(target === 'library');
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
        cardLibrary: {
            open: useCallback(() => setIsCardLibraryOpen(true), []),
            close: useCallback(() => setIsCardLibraryOpen(false), []),
            isOpen: isCardLibraryOpen
        },
        sandbox: {
            toggle: useCallback(() => setIsSandboxOpen(prev => !prev), []),
            close: useCallback(() => setIsSandboxOpen(false), []),
            isOpen: isSandboxOpen
        },
        lootTable: {
            data: lootTableData,
            open: useCallback((data) => setLootTableData(data), []),
            close: useCallback(() => setLootTableData(null), []),
            isOpen: !!lootTableData
        },
        pack: {
            setResults: setPackResults,
            results: packResults
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
            // The Edit modal — name, portrait, retire (roadmap D8).
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
            // 'guild' | 'bank' | 'vault' | 'cartographer' | 'library' | 'areas' | 'settings'
            isActive: isNavActive,
            toggle: navToggle
        }
    };

    // --- Event Subscriptions ---
    useEffect(() => {
        if (!engine) return;

        const subs = [
            engine.EventBus.subscribe('ui:card_tier_changed', (size) => setCardTier(size)),
            engine.EventBus.subscribe('dev:toggle-sandbox', () => setIsSandboxOpen(prev => !prev)),
            engine.EventBus.subscribe('ui:open_settings', () => setIsSettingsOpen(true)),
            engine.EventBus.subscribe('ui:open_pack_overlay', (data) => setPackResults(data)),
            // Hero customization now means the dock's Edit modal (Phase 7).
            engine.EventBus.subscribe('ui:open_hero_customize', (data) => {
                if (data?.heroId) setEditHeroId(data.heroId);
            }),
            engine.EventBus.subscribe('ui:open_loot_table', (data) => setLootTableData(data)),
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

    const isAnyModalOpen = isSettingsOpen || isCardLibraryOpen ||
                           isSandboxOpen ||
                           !!packResults || fullscreenView !== null;

    return { ...controls, isAnyModalOpen, cardTier };
};
