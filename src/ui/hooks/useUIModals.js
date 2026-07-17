import { useState, useEffect, useCallback } from 'react';

/**
 * useUIModals
 * Centralizes the modal state management and EventBus subscriptions for the React layer.
 */
export const useUIModals = (engine) => {
    // --- Modal States ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSlotSelectionOpen, setIsSlotSelectionOpen] = useState(true);
    const [isCardLibraryOpen, setIsCardLibraryOpen] = useState(false);
    const [isBonusOpen, setIsBonusOpen] = useState(false);
    const [isSandboxOpen, setIsSandboxOpen] = useState(false);
    const [packResults, setPackResults] = useState(null);

    // --- Bottom Drawer (UI overhaul Phase 2: multi-pane) ---
    // `panes` is the set of open panes (heroes/cards/bank) rendered side by
    // side; `filters` holds a per-pane auto-open filter (§12.B) — a fresh
    // object per open so panes can re-apply the same filter twice;
    // `maximized` names the pane expanded to full height (or null).
    const [drawerState, setDrawerState] = useState({ panes: [], filters: {}, maximized: null });

    // --- Hero side drawer (owner design 2026-07-14) ---
    // The Heroes pane lives in a full-height drawer off the bubble bar's
    // side, not the bottom drawer. `focusHeroId` preselects a hero.
    const [heroPanelState, setHeroPanelState] = useState({ isOpen: false, focusHeroId: null });

    // --- Inspect selection state ---
    const [inspectSelection, setInspectSelection] = useState(null);

    // --- Card tier sizing (responsive) ---
    const [cardTier, setCardTier] = useState('md');
    // Auto-clear selection when both drawers are closed
    useEffect(() => {
        if (!heroPanelState.isOpen && !drawerState.panes.length) {
            setInspectSelection(null);
        }
    }, [heroPanelState.isOpen, drawerState.panes.length]);

    // --- Full-screen drawers (UI overhaul Phase 4) ---
    // One at a time (spec §PRES-01 multi-open: No): 'guild' | 'packs' | 'areas' | null
    const [fullscreenView, setFullscreenView] = useState(null);

    // Helper function to open the Heroes side drawer (closes Cards tab if open)
    const openHeroes = useCallback((heroId = null) => {
        setHeroPanelState({ isOpen: true, focusHeroId: heroId });
        setDrawerState(s => ({
            ...s,
            panes: s.panes.filter(p => p !== 'cards'),
            maximized: s.maximized === 'cards' ? null : s.maximized
        }));
    }, []);

    // Helper function to toggle the Heroes side drawer (closes Cards tab if opening)
    const toggleHeroes = useCallback(() => {
        setHeroPanelState(s => {
            const nextOpen = !s.isOpen;
            if (nextOpen) {
                setDrawerState(d => ({
                    ...d,
                    panes: d.panes.filter(p => p !== 'cards'),
                    maximized: d.maximized === 'cards' ? null : d.maximized
                }));
            }
            return { isOpen: nextOpen, focusHeroId: null };
        });
    }, []);

    // Helper function to open a bottom drawer tab with mutual exclusivity rules
    const openDrawerTab = useCallback((tab, filter = null) => {
        setDrawerState(s => {
            let nextPanes = s.panes.includes(tab) ? s.panes : [...s.panes, tab];
            if (tab === 'cards') {
                nextPanes = nextPanes.filter(p => p !== 'bank');
                setHeroPanelState({ isOpen: false, focusHeroId: null });
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
        bonuses: {
            toggle: useCallback(() => setIsBonusOpen(prev => !prev), []),
            close: useCallback(() => setIsBonusOpen(false), []),
            open: useCallback(() => setIsBonusOpen(true), []),
            isOpen: isBonusOpen
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
        heroPanel: {
            isOpen: heroPanelState.isOpen,
            focusHeroId: heroPanelState.focusHeroId,
            open: openHeroes,
            toggle: toggleHeroes,
            close: useCallback(() => setHeroPanelState({ isOpen: false, focusHeroId: null }), [])
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
                            setHeroPanelState({ isOpen: false, focusHeroId: null });
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
        inspect: {
            selection: inspectSelection,
            set: useCallback((type, id) => setInspectSelection({ type, id }), []),
            clear: useCallback(() => setInspectSelection(null), [])
        }
    };

    // --- Event Subscriptions ---
    useEffect(() => {
        if (!engine) return;

        const subs = [
            engine.EventBus.subscribe('ui:card_tier_changed', (size) => setCardTier(size)),
            engine.EventBus.subscribe('dev:toggle-sandbox', () => setIsSandboxOpen(prev => !prev)),
            engine.EventBus.subscribe('ui:toggle_bonuses', () => setIsBonusOpen(prev => !prev)),
            engine.EventBus.subscribe('ui:open_settings', () => setIsSettingsOpen(true)),
            engine.EventBus.subscribe('ui:open_pack_overlay', (data) => setPackResults(data)),
            // Heroes live in the side drawer (owner design 2026-07-14)
            engine.EventBus.subscribe('ui:open_hero_customize', (data) => {
                openHeroes(data.heroId || null);
            }),
            // Contextual auto-open from empty banner slots (§12.B). Heroes
            // route to the side drawer; cards/bank to the bottom drawer.
            engine.EventBus.subscribe('ui:open_drawer', (data) => {
                const tab = data?.tab || 'heroes';
                if (tab === 'heroes') {
                    openHeroes(data?.filter?.heroId || null);
                    return;
                }
                openDrawerTab(tab, data?.filter);
            })
        ];

        return () => subs.forEach(unsub => unsub());
    }, [engine]);

    const isAnyModalOpen = isSettingsOpen || isCardLibraryOpen ||
                           isBonusOpen || isSandboxOpen ||
                           !!packResults || fullscreenView !== null;

    return { ...controls, isAnyModalOpen, cardTier };
};
