import React, { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { useGameState } from '../../hooks/useGameState.js';
import {
    BOARD_SIZE, TILE_COUNT, BOARD_PX, TILE_PX, TILE_GAP_PX, GUILD_HALL_TILE
} from './boardConstants.js';
import {
    getUpgradeDefByTile, isTileAccessible, toRoman, getUpgradeCost
} from '../../../config/guildUpgrades.js';
import { useBoardScale } from '../../hooks/useBoardScale.js';

const FLOOR = [
    'pm_board_guild_hall_1', 'pm_board_guild_hall_2', 'pm_board_guild_hall_3',
    'pm_board_guild_hall_4', 'pm_board_guild_hall_5'
];
const floorFor = (i) => `/assets/playmat/tiles/${FLOOR[i % FLOOR.length]}.png`;

/**
 * GuildHallBoard — pure playmat view for Guild Hall Upgrades.
 * Visually identical to the token playmat, rendering upgrade sprites on bare tile floors.
 */
export const GuildHallBoard = ({
    selectedTileIndex,
    onSelectTile,
    onClose
}) => {
    const [hoveredTileIndex, setHoveredTileIndex] = useState(null);
    const ranks = useGameState(
        state => state.progress?.guildUpgrades || {},
        ['guild_upgrades_updated', 'state_changed']
    );
    const gold = useGameState(
        state => state.currency?.gold || 0,
        ['currency_changed', 'state_changed']
    );

    const fit = useBoardScale();

    return (
        // Same fit-to-window treatment as the playmat (CR2-179) — this view is
        // the same 944px grid and went off-screen in exactly the same way.
        <div
            ref={fit.ref}
            className="w-full h-full min-w-0 min-h-0 flex items-center justify-center p-8 overflow-hidden select-none"
        >
            <div className="relative shrink-0" style={{ width: fit.size, height: fit.size }}>
            <div
                data-board-origin
                data-guild-hall-board="true"
                className="relative shrink-0"
                style={{
                    width: BOARD_PX,
                    height: BOARD_PX,
                    transform: `scale(${fit.scale})`,
                    transformOrigin: 'top left'
                }}
            >
                <div
                    className="grid shrink-0"
                    style={{
                        gridTemplateColumns: `repeat(${BOARD_SIZE}, ${TILE_PX}px)`,
                        gap: `${TILE_GAP_PX}px`,
                        width: BOARD_PX,
                        height: BOARD_PX,
                        imageRendering: 'pixelated'
                    }}
                >
                    {Array.from({ length: TILE_COUNT }, (_, index) => {
                        const isCenter = index === GUILD_HALL_TILE;
                        const def = getUpgradeDefByTile(index);
                        const isSelected = selectedTileIndex === index;
                        const rank = def ? (ranks[def.id] || 0) : 0;
                        const accessible = def ? isTileAccessible(index, ranks) : false;
                        const isMax = def ? rank >= def.maxRank : false;
                        const cost = def && !isMax ? getUpgradeCost(def, rank) : null;
                        const canAfford = def && accessible && !isMax && cost != null && gold >= cost;

                        return (
                            <div
                                key={index}
                                id={def?.id === 'roster_size' ? "guild-roster-upgrade-node" : def?.id === 'wishing_well' ? "guild-wishing-well-upgrade-node" : undefined}
                                data-guild-roster-upgrade={def?.id === 'roster_size' ? "true" : undefined}
                                data-guild-wishing-well-upgrade={def?.id === 'wishing_well' ? "true" : undefined}
                                onMouseEnter={() => setHoveredTileIndex(index)}
                                onMouseLeave={() => setHoveredTileIndex(null)}
                                onClick={() => {
                                    if (isCenter) {
                                        onClose?.();
                                    } else if (def) {
                                        onSelectTile?.(index, def);
                                    }
                                }}
                                style={{
                                    width: TILE_PX,
                                    height: TILE_PX,
                                    backgroundImage: `url(${floorFor(index)})`,
                                    backgroundSize: 'cover',
                                    imageRendering: 'pixelated'
                                }}
                                className={cn(
                                    'relative select-none',
                                    isCenter && 'cursor-pointer',
                                    def && 'cursor-pointer',
                                    isSelected && 'ring-2 ring-gi-gold'
                                )}
                            >
                                {/* Center Guild Hall Tile */}
                                {isCenter && (
                                    <div
                                        className={cn(
                                            "absolute inset-0 flex items-center justify-center transition-[filter] duration-150",
                                            hoveredTileIndex === index && "gi-token-hover-pulse"
                                        )}
                                    >
                                        <img
                                            src="/assets/tokens/token_guildhall.png"
                                            alt="Guild Hall"
                                            className="w-32 h-32 object-contain drop-shadow-md"
                                            style={{ imageRendering: 'pixelated' }}
                                        />
                                    </div>
                                )}

                                {/* Affordable Upgrade Alert Badge (Top Left with Token Alert glow and bob) */}
                                {canAfford && (
                                    <div
                                        data-upgrade-available="true"
                                        className="absolute top-1.5 left-[2px] z-[100] pointer-events-none"
                                    >
                                        <div className="relative w-8 h-8 flex items-center justify-center">
                                            <img
                                                src="/assets/ui/ui_upgrade.png"
                                                alt="Upgrade Available"
                                                className="w-8 h-8 object-contain select-none animate-bounce drop-shadow-[0_0_8px_rgba(234,179,8,0.9)]"
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    imageRendering: 'pixelated',
                                                    animationDuration: '2s',
                                                    transform: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Accessible Upgrade Sprite (128px) & Roman Numeral Rank */}
                                {def && accessible && (
                                    <>
                                        <div
                                            className={cn(
                                                "absolute inset-0 flex items-center justify-center pointer-events-none transition-[filter] duration-150",
                                                hoveredTileIndex === index && "gi-token-hover-pulse"
                                            )}
                                        >
                                            <img
                                                src={def.sprite}
                                                alt={def.name}
                                                className="w-32 h-32 object-contain pointer-events-auto"
                                                style={{ imageRendering: 'pixelated' }}
                                            />
                                        </div>
                                        {/* Silkscreen Roman Numeral Level Badge with Black Outline */}
                                        <div
                                            className="absolute bottom-1 right-1.5 select-none pointer-events-none text-white text-[11px] font-bold"
                                            style={{
                                                fontFamily: "'Silkscreen', cursive, monospace",
                                                textShadow: '0 1px 0 #000, 1px 0 0 #000, 0 -1px 0 #000, -1px 0 0 #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 3px rgba(0,0,0,0.95)'
                                            }}
                                        >
                                            {toRoman(rank)}
                                        </div>
                                    </>
                                )}

                                {/* Locked Upgrade Tile: pixel art ui_lock sprite in center */}
                                {def && !accessible && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <img
                                            src="/assets/ui/ui_lock.png"
                                            alt="Locked"
                                            className="w-16 h-16 object-contain opacity-70 drop-shadow-md"
                                            style={{ imageRendering: 'pixelated' }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            </div>
        </div>
    );
};

export default GuildHallBoard;
