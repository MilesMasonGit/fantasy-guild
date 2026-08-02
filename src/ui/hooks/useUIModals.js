import { useState, useEffect, useCallback } from 'react';
import { DOCK_MAX_PINNED } from '../components/dock/dockConstants.js';

/**
 * useUIModals
 * Centralizes the modal state management and EventBus subscriptions for the React layer.
 */
export const useUIModals = (engine) => {
    // --- Modal States ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSlotSelectionOpen, setIsSlotSelectionOpen] = useState(true);
    const [isCardLibraryOpen, setIsCardLibraryOpen] = useState(false);
    const [isSandboxOpen, setIsSandboxOpen] = useState(false);
    const [packResults, setPackResults] = useState(null);

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

    // --- Inspect selection state ---
    const [inspectSelection, setInspectSelection] = useState(null);

    // --- Card tier sizing (responsive) ---
    const [cardTier, setCardTier] = useState('md');

    // Auto-clear the inspection selection once the bottom drawer is closed.
    useEffect(() => {
        if (!drawerState.panes.length) setInspectSelection(null);
    }, [drawerState.panes.length]);

    // --- Full-screen drawers (UI overhaul Phase 4) ---
    // One at a time (spec §PRES-01 multi-open: No): 'guild' | 'packs' | 'areas' | null
    const [fullscreenView, setFullscreenView] = useState(null);

    // Helper function to open a bottom drawer tab with mutual exclusivity rules
    const openDrawerTab = useCallback((tab, filter = null) => {
        setDrawerState(s => {
            let nextPanes = s.panes.includes(tab) ? s.panes : [...s.panes, tab];
            if (tab === 'cards') {
                nextPanes = nextPanes.filter(p => p !== 'bank');
            } else if (tab === 'bank') {
                nextPanes = nextPanes.filter(p => p !== 'cards');
            }
            return {
                ...s,
                panes: nextPanes,
                filters: { ...s.filters, [tab]: filter ? { ...filter } : null },
                maximized: (tab === 'cards' && s.maximized === 'bank') || (tab === 'bank' && s.maximized === 'cards') ? null : s.maximized
            };
        });
    }, []);

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
            // Bubble click: open the pane alongside any others, or close it.
            toggleTab: useCallback(tab => {
                setDrawerState(s => {
                    if (s.panes.includes(tab)) {
                        return {
                            ...s,
                            panes: s.panes.filter(p => p !== tab),
                            maximized: s.maximized === tab ? null : s.maximized
                        };
                    } else {
                        let nextPanes = [...s.panes, tab];
                        if (tab === 'cards') {
                            nextPanes = nextPanes.filter(p => p !== 'bank');
                        } else if (tab === 'bank') {
                            nextPanes = nextPanes.filter(p => p !== 'cards');
                        }
                        return {
                            ...s,
                            panes: nextPanes,
                            filters: { ...s.filters, [tab]: null },
                            maximized: (tab === 'cards' && s.maximized === 'bank') || (tab === 'bank' && s.maximized === 'cards') ? null : s.maximized
                        };
                    }
                });
            }, []),
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
            // The Edit modal — name, portrait, retire (roadmap D8).
            editHeroId,
            openEdit: useCallback((heroId) => setEditHeroId(heroId), []),
            closeEdit: useCallback(() => setEditHeroId(null), [])
        },
        inspect: {
            selection: inspectSelection,
            // Bail when the same thing is already selected (CR-055): the
            // controls object is rebuilt every render, so effects that depend
            // on it re-fire constantly — storing a fresh {type,id} each time
            // turned that into an infinite render loop.
            set: useCallback((type, id) => setInspectSelection(prev => (
                prev && prev.type === type && prev.id === id ? prev : { type, id }
            )), []),
            clear: useCallback(() => setInspectSelection(prev => (prev === null ? prev : null)), [])
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
