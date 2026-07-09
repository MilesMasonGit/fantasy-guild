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

    // --- Bottom Folder Drawer (Phase 7, USE_DECK_LOOP) ---
    // `filter` is a fresh object per open so tab components can re-apply an
    // auto-open filter (§12.B) even if the same one fires twice.
    const [drawerState, setDrawerState] = useState({ isOpen: false, tab: 'heroes', filter: null });

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
        drawer: {
            ...drawerState,
            open: useCallback((tab, filter = null) => {
                setDrawerState({ isOpen: true, tab, filter: filter ? { ...filter } : null });
            }, []),
            close: useCallback(() => setDrawerState(s => ({ ...s, isOpen: false })), []),
            // Folder-tab click: open to the tab, switch tabs, or collapse the active one.
            toggleTab: useCallback(tab => {
                setDrawerState(s => (s.isOpen && s.tab === tab)
                    ? { ...s, isOpen: false }
                    : { isOpen: true, tab, filter: null });
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
                    // Customize lives in the drawer's Heroes tab now (Phase 7)
                    setDrawerState({ isOpen: true, tab: 'heroes', filter: { heroId: data.heroId } });
                } else {
                    setActiveHeroId(data.heroId);
                    setIsHeroCustomizeOpen(true);
                }
            }),
            // Contextual auto-open from empty banner slots (§12.B, Phase 7)
            engine.EventBus.subscribe('ui:open_drawer', (data) => {
                setDrawerState({
                    isOpen: true,
                    tab: data?.tab || 'heroes',
                    filter: data?.filter ? { ...data.filter } : null
                });
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
                           !!packResults;

    return { ...controls, isAnyModalOpen };
};
