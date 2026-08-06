import React from 'react';
import { cn } from '../../utils/cn.js';
import { TILE_PX, GUILD_HALL_TILE } from './boardConstants.js';
import { tokenName, tokenSpritePath } from '../../../config/registries/tokenRegistry.js';
import { useEntityDrag, useEntityDrop, mergeRefs } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';

/**
 * BoardTile — one of the 49 tiles.
 *
 * ## The grid is real but invisible (D-143)
 * No drawn gridlines. Tokens sit on an implied lattice and read as **solid
 * objects resting on a surface**, not as cells in a spreadsheet. The floor art
 * does the work; the only borders that ever appear are transient drag cues.
 *
 * ## What a tile shows (D-85)
 * Exactly three things, always: Token art, the hero on it, and one alert mark.
 * Phase 2 has the first two — the progress ring and the alert mark arrive with
 * Token behaviour in Phase 4, because until a Token can work there is nothing
 * to be making progress on or stuck about.
 *
 * ⚠️ **An unstaffed Token is not an error** (D-149). With ~8 heroes on 48 tiles
 * most of the board is unstaffed at any moment, so an empty tile is quietly
 * dimmed rather than flagged. Alerts appear only when a Token *has* a hero and
 * still cannot work.
 */

/** Floor sprites, cycled so the surface has texture rather than one flat tile. */
const FLOOR = [
    'pm_board_guild_hall_1', 'pm_board_guild_hall_2', 'pm_board_guild_hall_3',
    'pm_board_guild_hall_4', 'pm_board_guild_hall_5'
];
const floorFor = (i) => `/assets/playmat/tiles/${FLOOR[i % FLOOR.length]}.png`;

export const BoardTile = ({ index, token, heroName, onPlaceToken, onPlaceHero, onPickUp }) => {
    const isGuildHall = index === GUILD_HALL_TILE;

    // A placed Token can be dragged straight to another tile — tile-to-tile is
    // one drag, not a trip through the Tray.
    const drag = useEntityDrag({
        id: `tile-token-${index}`,
        kind: DRAG_KIND.TOKEN,
        payload: { typeId: token?.typeId, from: { tile: index } },
        sourceSurface: DND_SURFACE.BOARD,
        disabled: !token || isGuildHall
    });

    const drop = useEntityDrop({
        id: `tile-${index}`,
        surface: DND_SURFACE.BOARD,
        // The Guild Hall accepts nothing (D-106) — a real rule, so the tile
        // shows the red "no" cue rather than silently swallowing the drop.
        accepts: (p) => !isGuildHall && (p.kind === DRAG_KIND.TOKEN || p.kind === DRAG_KIND.HERO),
        onDrop: (p) => {
            if (p.kind === DRAG_KIND.TOKEN) onPlaceToken?.(index, p);
            else if (p.kind === DRAG_KIND.HERO) onPlaceHero?.(index, p);
        },
        disabled: isGuildHall
    });

    const art = token ? tokenSpritePath(token.typeId) : null;
    const label = token ? tokenName(token.typeId) : null;

    // Charges are deliberately NOT drawn on the tile. D-85 budgets a tile at
    // exactly three things — Token art, the hero on it, and one alert mark —
    // and lists "uses remaining" as **hover only**. A full board is 48 tiles;
    // a counter on each was 36 extra numbers competing for attention, which is
    // precisely the visual clutter that killed the previous spatial playmat
    // (risk 7). It lives in the tooltip instead.

    return (
        <div
            ref={mergeRefs(drag.setNodeRef, drop.setNodeRef)}
            {...drop.droppableProps}
            {...(token && !isGuildHall ? drag.handleProps : {})}
            title={
                isGuildHall ? 'Guild Hall'
                    : token
                        ? `${label} — ${token.usesRemaining == null ? 'unlimited use' : `${token.usesRemaining} uses left`}`
                        : `Tile ${index}`
            }
            style={{
                width: TILE_PX,
                height: TILE_PX,
                backgroundImage: `url(${floorFor(index)})`,
                backgroundSize: 'cover',
                imageRendering: 'pixelated'
            }}
            className={cn(
                'relative select-none',
                token && !isGuildHall && 'cursor-grab active:cursor-grabbing',
                // Transient drag cues only — no permanent gridlines (D-143).
                drop.valid && 'ring-2 ring-inset ring-gi-success/80',
                drop.invalid && 'ring-2 ring-inset ring-gi-danger/80',
                drag.isDragging && 'opacity-40'
            )}
        >
            {isGuildHall && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <span className="text-[10px] font-bold tracking-wide text-white/80 text-center leading-tight">
                        GUILD<br />HALL
                    </span>
                </div>
            )}

            {token && (
                <>
                    <img
                        src={art}
                        alt={label}
                        draggable={false}
                        className="absolute inset-0 m-auto pointer-events-none"
                        style={{ width: 96, height: 96, imageRendering: 'pixelated' }}
                    />
                    {/* ⚠️ TEMPORARY — a crutch for placeholder art, not a design
                        element. D-85's tile budget has no name label in it: the
                        Token's own art is meant to identify it. Right now the
                        art is skill icons standing in for Token sprites, so
                        without a name a Forest and a Fishing Hole are
                        indistinguishable. **Remove this when real Token art
                        lands in Phase 9/10** and check the board again. */}
                    <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 text-[9px] font-bold text-center text-white bg-black/65 truncate pointer-events-none">
                        {label}
                    </span>
                </>
            )}

            {/* The hero OVERLAYS the Token they work (D-57) — they stand on top
                of it, so this sits above the art rather than beside it.

                Its own drag source, nested inside the tile's: heroes move
                TILE-TO-TILE directly, without a trip through the Dock (D-134),
                because reassigning the workforce is the game's most frequent
                action and must cost one drag, not two. Clicking instead recalls
                them — the 8px activation distance on the shared sensor is what
                separates the two. */}
            {token?.heroId && (
                <HeroBadge
                    index={index}
                    heroId={token.heroId}
                    heroName={heroName}
                    onPickUp={onPickUp}
                />
            )}
        </div>
    );
};

/** The hero standing on a Token: drag to redeploy, click to recall. */
const HeroBadge = ({ index, heroId, heroName, onPickUp }) => {
    const drag = useEntityDrag({
        id: `tile-hero-${index}`,
        kind: DRAG_KIND.HERO,
        payload: { heroId, name: heroName, from: { tile: index } },
        sourceSurface: DND_SURFACE.BOARD
    });

    return (
        <button
            ref={drag.setNodeRef}
            {...drag.handleProps}
            type="button"
            onClick={(e) => { e.stopPropagation(); onPickUp?.(index); }}
            title={`${heroName || 'Hero'} — drag to another tile, or click to recall`}
            className={cn(
                'absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-gi-primary/90 text-black',
                'text-[9px] font-bold max-w-[80%] truncate pointer-events-auto',
                'cursor-grab active:cursor-grabbing hover:bg-gi-primary',
                drag.isDragging && 'opacity-40'
            )}
        >
            {heroName || 'Hero'}
        </button>
    );
};

export default BoardTile;
