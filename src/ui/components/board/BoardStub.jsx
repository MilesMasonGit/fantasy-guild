import React, { useMemo } from 'react';
import {
    BOARD_SIZE, TILE_COUNT, TILE_PX, BOARD_PX, GUILD_HALL_TILE
} from './boardConstants.js';

/**
 * BoardStub — a static, inert 7×7 board.
 *
 * ## Why this exists
 * The playmat rework is a clean break with **no feature flag**, so Phase 1
 * deletes the entire deck loop before anything replaces it. Without something in
 * the centre slot the app would not boot, and on a branch with no flag-off
 * comparison "it still boots" is the only cheap signal that the demolition
 * didn't take something with it (roadmap decision `G-16`).
 *
 * So this renders the board's *shape* and nothing else: 49 tiles, the centre
 * marked as the permanent Guild Hall (D-106), real playmat floor art. **No
 * state, no interaction, no Tokens.** All of that arrives in Phase 2, which
 * replaces this file with the real `Board.jsx`.
 *
 * The grid is deliberately **real but invisible** (D-143) — no drawn gridlines.
 * Tokens are meant to read as solid objects resting on a surface, not as cells
 * in a spreadsheet, and that reading starts with the floor.
 */

/** Floor sprites, cycled so the surface has texture rather than one flat tile. */
const FLOOR_SPRITES = [
    'pm_board_guild_hall_1', 'pm_board_guild_hall_2', 'pm_board_guild_hall_3',
    'pm_board_guild_hall_4', 'pm_board_guild_hall_5'
];

const floorFor = (index) =>
    `/assets/playmat/tiles/${FLOOR_SPRITES[index % FLOOR_SPRITES.length]}.png`;

export const BoardStub = () => {
    // Stable across renders — the stub has no state to invalidate it.
    const tiles = useMemo(() => Array.from({ length: TILE_COUNT }, (_, i) => i), []);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div
                className="grid shrink-0"
                style={{
                    gridTemplateColumns: `repeat(${BOARD_SIZE}, ${TILE_PX}px)`,
                    width: BOARD_PX,
                    height: BOARD_PX,
                    // Pixel art: never let the browser smooth it.
                    imageRendering: 'pixelated'
                }}
            >
                {tiles.map(i => (
                    <div
                        key={i}
                        style={{
                            width: TILE_PX,
                            height: TILE_PX,
                            backgroundImage: `url(${floorFor(i)})`,
                            backgroundSize: 'cover',
                            imageRendering: 'pixelated'
                        }}
                        className="relative"
                    >
                        {i === GUILD_HALL_TILE && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                                <span className="text-[10px] font-bold tracking-wide text-white/80 text-center leading-tight">
                                    GUILD<br />HALL
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <p className="text-[11px] text-gi-muted tracking-wide">
                7×7 board — 48 usable tiles. Placement arrives in Phase 2.
            </p>
        </div>
    );
};

export default BoardStub;
