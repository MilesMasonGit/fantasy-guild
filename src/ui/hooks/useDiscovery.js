import { useState, useEffect } from 'react';
import { useEngine } from './useEngine.js';

/**
 * useDiscovery - Hook for accessing discovery state
 * 
 * Returns:
 * - discoveredItems: { [id]: true }
 * - discoveredEnemies: { [id]: true }
 * - itemCounts: { [id]: number }
 * - enemyKills: { [id]: number }
 * - isDiscovered: (type, id) => boolean
 */
export function useDiscovery() {
    const engine = useEngine();
    const [discovery, setDiscovery] = useState({
        items: engine.GameState.discoveredItems,
        enemies: engine.GameState.discoveredEnemies,
        itemCounts: engine.GameState.itemLifetimeCounts,
        enemyKills: engine.GameState.enemyKillCounts
    });

    useEffect(() => {
        if (!engine) return;

        const handleUpdate = () => {
            setDiscovery({
                items: engine.GameState.discoveredItems,
                enemies: engine.GameState.discoveredEnemies,
                itemCounts: engine.GameState.itemLifetimeCounts,
                enemyKills: engine.GameState.enemyKillCounts
            });
        };

        // Subscribe to state changes and discovery events
        const unsubState = engine.EventBus.subscribe('state_changed', handleUpdate);
        const unsubItem = engine.EventBus.subscribe('item_discovered', handleUpdate);
        const unsubEnemy = engine.EventBus.subscribe('enemy_discovered', handleUpdate);

        return () => {
            unsubState();
            unsubItem();
            unsubEnemy();
        };
    }, [engine]);

    /**
     * Check if an entity is discovered
     */
    const isDiscovered = (type, id) => {
        if (type === 'item') return !!discovery.items[id];
        if (type === 'enemy') return !!discovery.enemies[id];
        if (type === 'card') {
            // Cards use library.tasks as source of truth
            return engine.GameState.state?.library?.tasks?.includes(id);
        }
        return false;
    };

    return {
        ...discovery,
        isDiscovered
    };
}
