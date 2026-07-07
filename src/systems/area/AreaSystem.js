import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as AreaStateManager from './AreaStateManager.js';
import * as CardManager from '../cards/CardManager.js';
import { effectEngine } from '../effects/EffectEngine.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { logger } from '../../utils/Logger.js';

/**
 * AreaSystem - Orchestrates biome transitions
 */
export const AreaSystem = {
    /**
     * Switch the active area board.
     *
     * Flow:
     *   1. Snapshot current board → areaStates
     *   2. Update activeAreaId
     *   3. Restore target board ← areaStates
     *   4. Rebuild card cache
     *   5. Emit area_switched event
     *
     * @param {string} targetAreaId — The area to switch to
     * @returns {{ success: boolean, error?: string }}
     */
    switchArea(targetAreaId) {
        const currentAreaId = GameState.activeAreaId;

        // Guard: Don't switch to the same area
        if (targetAreaId === currentAreaId) {
            return { success: false, error: 'ALREADY_ACTIVE' };
        }

        // Guard: Area must be unlocked
        const unlocked = GameState.collection?.unlockedAreaSets || [];
        if (!unlocked.includes(targetAreaId)) {
            logger.warn('AreaSystem', `Attempted to switch to locked area: ${targetAreaId}`);
            return { success: false, error: 'AREA_LOCKED' };
        }

        logger.info('AreaSystem', `Switching biome: "${currentAreaId}" → "${targetAreaId}"`);

        // 0. Play transition sound
        EventBus.publish('audio:play', { clip: 'biome_switch', type: 'ui' });

        // 1. Freeze current board
        AreaStateManager.snapshot(currentAreaId);

        // 2. Update the focus pointer
        GameState.state.ui.activeAreaId = targetAreaId;

        // 3. Thaw target board
        AreaStateManager.restore(targetAreaId);

        // 4. Rebuild the card lookup cache
        //    After snapshot() empties and restore() refills cards.active,
        //    the _cardById Map is stale. Rebuild it.
        GameState.rebuildCardCache();

        // 5. Initialize the grid configuration and place unpositioned cards
        this.initGridForArea(targetAreaId);

        // 6. Notify the world
        EventBus.publish('area_switched', {
            from: currentAreaId,
            to: targetAreaId
        });

        return { success: true };
    },

    /**
     * Initialize grid state for an area without performing a full swap.
     * Used on boot or reset.
     * @param {string} areaId 
     */
    initGridForArea(areaId) {
        const areaSet = getAreaSet(areaId);
        const state = GameState.state;

        if (areaSet && areaSet.gridConfig) {
            const savedCells = state.areaStates[areaId]?.validCells;
            const basePlayableCells = (savedCells && savedCells.length > 0)
                ? [...savedCells]
                : [...(areaSet.gridConfig.validCells || [])];

            // --- Gutter Logic: Calculate adjacency contour ---
            const validKeys = new Set(basePlayableCells.map(c => `${c.x},${c.y}`));
            const gutterNeighbors = [];

            basePlayableCells.forEach(cell => {
                // 4-way adjacency (North, South, East, West)
                const neighbors = [
                    [1, 0], [-1, 0], [0, 1], [0, -1]
                ];

                neighbors.forEach(([dx, dy]) => {
                    const nx = cell.x + dx;
                    const ny = cell.y + dy;
                    const key = `${nx},${ny}`;
                    if (!validKeys.has(key)) {
                        gutterNeighbors.push(key);
                    }
                });
            });

            // Deduplicate and create gutter cell objects
            const uniqueGutterKeys = [...new Set(gutterNeighbors)];
            const gutterCells = uniqueGutterKeys.map(key => {
                const [x, y] = key.split(',').map(Number);
                return { x, y, isGutter: true, tileId: 'gutter' };
            });

            // Merge into final grid state
            const finalCells = [...basePlayableCells, ...gutterCells];

            console.log(`[AreaSystem] Grid Init: ${basePlayableCells.length} playable, ${gutterCells.length} gutter.`);

            state.grid = {
                ...areaSet.gridConfig,
                validCells: finalCells,
                tileMap: { ...(areaSet.gridConfig.tileMap || {}) },
                propsMap: { ...(areaSet.gridConfig.propsMap || {}) },
                center: areaSet.gridConfig.center || areaSet.gridConfig.hubPosition || { x: 0, y: 0 }
            };
        } else {
            console.warn('[AreaSystem] No gridConfig found for area:', areaId);
        }

        // --- Tile System: Trigger EffectEngine pulse for the new area ---
        effectEngine.pulse();

        // --- Phase 3: Assign initial positions to any cards that lack them ---
        const unplacedCards = GameState.state.cards.active.filter(c => !c.position || (c.position.x === null && c.position.y === null));

        for (const card of unplacedCards) {
            const emptyCell = CardManager.findFirstEmptyCell();
            if (emptyCell) {
                CardManager.updateCardPosition(card.id, emptyCell.x, emptyCell.y);
            }
        }

        // --- Phase 3: Notify the UI that the grid configuration is ready ---
        EventBus.publish('state_changed', { source: 'init_grid' });
    }
};
