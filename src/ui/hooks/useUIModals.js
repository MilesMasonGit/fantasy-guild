import { useState, useEffect, useCallback } from 'react';

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
                setActiveHeroId(data.heroId);
                setIsHeroCustomizeOpen(true);
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
