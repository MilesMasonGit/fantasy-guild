import { useState, useEffect, useCallback } from 'react';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';

/**
 * useUIModals
 * Centralizes the modal state management and EventBus subscriptions for the React layer.
 */
export const useUIModals = (engine) => {
    // --- Modal States ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSpawnEntityOpen, setIsSpawnEntityOpen] = useState(false);
    const [isSlotSelectionOpen, setIsSlotSelectionOpen] = useState(true);
    const [isWorldMapOpen, setIsWorldMapOpen] = useState(false);
    const [isTavernOpen, setIsTavernOpen] = useState(false);
    const [isCardLibraryOpen, setIsCardLibraryOpen] = useState(false);
    const [isCodexOpen, setIsCodexOpen] = useState(false);
    const [isBonusOpen, setIsBonusOpen] = useState(false);
    const [isSandboxOpen, setIsSandboxOpen] = useState(false);
    const [isHeroCustomizeOpen, setIsHeroCustomizeOpen] = useState(false);
    const [activeHeroId, setActiveHeroId] = useState(null);
    const [packResults, setPackResults] = useState(null);

    // --- Bottom Drawer (UI overhaul Phase 2: multi-pane) ---
    // `panes` is the set of open panes (heroes/cards/bank) rendered side by
    // side; `filters` holds a per-pane auto-open filter (§12.B) — a fresh
    // object per open so panes can re-apply the same filter twice;
    // `maximized` names the pane expanded to full height (or null).
    const [drawerState, setDrawerState] = useState({ panes: [], filters: {}, maximized: null });

    // --- Full-screen drawers (UI overhaul Phase 4) ---
    // One at a time (spec §PRES-01 multi-open: No): 'guild' | 'packs' | 'areas' | null
    const [fullscreenView, setFullscreenView] = useState(null);

    // --- Memoized Controls ---
    const controls = {
        heroCustomize: {
            open: useCallback((heroId) => {
                setActiveHeroId(heroId);
                setIsHeroCustomizeOpen(true);
            }, []),
            close: useCallback(() => {
                setIsHeroCustomizeOpen(false);
                setActiveHeroId(null);
            }, []),
            isOpen: isHeroCustomizeOpen,
            heroId: activeHeroId
        },
        settings: {
            open: useCallback(() => setIsSettingsOpen(true), []),
            close: useCallback(() => setIsSettingsOpen(false), []),
            isOpen: isSettingsOpen
        },
        spawnEntity: {
            open: useCallback(() => setIsSpawnEntityOpen(true), []),
            close: useCallback(() => setIsSpawnEntityOpen(false), []),
            isOpen: isSpawnEntityOpen
        },
        slotSelection: {
            close: useCallback(() => setIsSlotSelectionOpen(false), []),
            isOpen: isSlotSelectionOpen
        },
        worldMap: {
            toggle: useCallback(() => setIsWorldMapOpen(prev => !prev), []),
            close: useCallback(() => setIsWorldMapOpen(false), []),
            isOpen: isWorldMapOpen
        },
        tavern: {
            toggle: useCallback(() => setIsTavernOpen(prev => !prev), []),
            close: useCallback(() => setIsTavernOpen(false), []),
            isOpen: isTavernOpen
        },
        cardLibrary: {
            open: useCallback(() => setIsCardLibraryOpen(true), []),
            close: useCallback(() => setIsCardLibraryOpen(false), []),
            isOpen: isCardLibraryOpen
        },
        codex: {
            toggle: useCallback(() => setIsCodexOpen(prev => !prev), []),
            close: useCallback(() => setIsCodexOpen(false), []),
            isOpen: isCodexOpen
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
        drawer: {
            ...drawerState,
            isOpen: drawerState.panes.length > 0,
            // Ensure a pane is open and (re)apply its auto-open filter,
            // leaving other open panes alone (§12.B).
            open: useCallback((tab, filter = null) => {
                setDrawerState(s => ({
                    ...s,
                    panes: s.panes.includes(tab) ? s.panes : [...s.panes, tab],
                    filters: { ...s.filters, [tab]: filter ? { ...filter } : null }
                }));
            }, []),
            close: useCallback(() => setDrawerState({ panes: [], filters: {}, maximized: null }), []),
            // Bubble click: open the pane alongside any others, or close it.
            toggleTab: useCallback(tab => {
                setDrawerState(s => s.panes.includes(tab)
                    ? {
                        ...s,
                        panes: s.panes.filter(p => p !== tab),
                        maximized: s.maximized === tab ? null : s.maximized
                    }
                    : { ...s, panes: [...s.panes, tab], filters: { ...s.filters, [tab]: null } });
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
        }
    };

    // --- Event Subscriptions ---
    useEffect(() => {
        if (!engine) return;

        const subs = [
            engine.EventBus.subscribe('dev:open-spawn-item', () => setIsSpawnEntityOpen(true)),
            engine.EventBus.subscribe('dev:open-spawn-entity', () => setIsSpawnEntityOpen(true)),
            engine.EventBus.subscribe('ui:toggle-world-map', () => setIsWorldMapOpen(prev => !prev)),
            engine.EventBus.subscribe('dev:toggle-sandbox', () => setIsSandboxOpen(prev => !prev)),
            engine.EventBus.subscribe('ui:toggle_tavern', () => setIsTavernOpen(prev => !prev)),
            engine.EventBus.subscribe('ui:toggle_codex', () => setIsCodexOpen(prev => !prev)),
            engine.EventBus.subscribe('ui:toggle_bonuses', () => setIsBonusOpen(prev => !prev)),
            engine.EventBus.subscribe('ui:open_settings', () => setIsSettingsOpen(true)),
            engine.EventBus.subscribe('ui:open_pack_overlay', (data) => setPackResults(data)),
            engine.EventBus.subscribe('ui:open_hero_customize', (data) => {
                if (USE_DECK_LOOP) {
                    // Customize lives in the drawer's Heroes pane now (Phase 7)
                    setDrawerState(s => ({
                        ...s,
                        panes: s.panes.includes('heroes') ? s.panes : [...s.panes, 'heroes'],
                        filters: { ...s.filters, heroes: { heroId: data.heroId } }
                    }));
                } else {
                    setActiveHeroId(data.heroId);
                    setIsHeroCustomizeOpen(true);
                }
            }),
            // Contextual auto-open from empty banner slots (§12.B) — adds the
            // pane alongside any already open and re-applies its filter.
            engine.EventBus.subscribe('ui:open_drawer', (data) => {
                const tab = data?.tab || 'heroes';
                setDrawerState(s => ({
                    ...s,
                    panes: s.panes.includes(tab) ? s.panes : [...s.panes, tab],
                    filters: { ...s.filters, [tab]: data?.filter ? { ...data.filter } : null }
                }));
            })
        ];

        return () => subs.forEach(unsub => unsub());
    }, [engine]);

    // Area-Specific Spawn (Area spawning card)
    useEffect(() => {
        if (!engine) return;
        return engine.EventBus.subscribe('dev:open-spawn-card', () => {
            setIsSpawnEntityOpen(true);
        });
    }, [engine]);

    const isAnyModalOpen = isSettingsOpen || isSpawnEntityOpen ||
                           isWorldMapOpen || isCardLibraryOpen || isCodexOpen ||
                           isBonusOpen || isSandboxOpen || isHeroCustomizeOpen ||
                           !!packResults || fullscreenView !== null;

    return { ...controls, isAnyModalOpen };
};
