import React from 'react';
import { BOARD_PX, TILE_PX, TILE_GAP_PX, TILE_STEP_PX, rowOf, colOf } from './boardConstants.js';
import { neighboursOf, neighboursOfFootprint } from '../../../systems/board/adjacency.js';
import { getTokenType, tokenName } from '../../../config/registries/tokenRegistry.js';
import * as RecipeResolver from '../../../systems/board/RecipeResolver.js';
import * as BoardState from '../../../systems/board/BoardState.js';

/**
 * ConnectionLines — what feeds this tile, what modifies it, what it modifies.
 *
 * ## Shown on hover or selection ONLY (D-84)
 * The board is clean by default. With adjacency doing three jobs across 48
 * Tokens, permanent lines would produce **exactly the unreadable mess that
 * killed the previous spatial playmat** (risk 7) — so nothing is drawn until
 * the player asks, by pointing at a tile.
 *
 * The accepted cost is that the whole machine cannot be seen at once. A
 * hold-to-reveal overlay is the natural addition if that ever frustrates.
 *
 * ## Two kinds of relationship, drawn differently
 * | Line | Means |
 * | :-- | :-- |
 * | Solid, gold | **Context** — this defines what that station makes (D-18) |
 * | Dashed, blue | **Buff** — this nudges that Token's numbers (D-119) |
 *
 * The distinction matters because they are different in kind, not degree:
 * context is binary and decisive, buffs are small optimisation. Drawing them
 * identically would suggest they are the same sort of thing.
 */

/** Centre point of a tile, in board pixels (centered over 1x1 or 2x2 footprint). */
const centre = (index) => {
    const occ = BoardState.getOccupyingToken(index);
    const size = occ?.instance?.typeId ? (getTokenType(occ.instance.typeId)?.size || 1) : 1;
    const anchor = occ ? occ.anchorIndex : index;
    const footSpan = size === 2 ? TILE_PX * 2 + TILE_GAP_PX : TILE_PX;
    return {
        x: colOf(anchor) * TILE_STEP_PX + footSpan / 2,
        y: rowOf(anchor) * TILE_STEP_PX + footSpan / 2
    };
};

/**
 * Every relationship touching `tile`, in both directions.
 */
function relationshipsFor(tile) {
    const links = [];
    const occ = BoardState.getOccupyingToken(tile);
    if (!occ?.instance) return links;
    const anchor = occ.anchorIndex;
    const self = occ.instance;
    const selfDef = getTokenType(self.typeId);
    const size = selfDef?.size || 1;

    // Outbound: this tile is support, and serves neighbours.
    if (selfDef?.provides?.length || selfDef?.buff) {
        const kind = selfDef.buff && !selfDef.provides?.length ? 'buff' : 'context';
        for (const served of RecipeResolver.servesFrom(anchor)) {
            links.push({ from: anchor, to: served, kind });
        }
    }

    // Inbound: neighbours that are supporting this tile.
    const neighbours = size === 1 ? neighboursOf(anchor) : neighboursOfFootprint(occ.footprint);
    for (const n of neighbours) {
        const nOcc = BoardState.getOccupyingToken(n);
        if (!nOcc?.instance) continue;
        const nAnchor = nOcc.anchorIndex;
        const def = getTokenType(nOcc.instance.typeId);
        if (!def?.provides?.length && !def?.buff) continue;
        if (def.buff?.target === 'hero') continue;      // hero buffs aren't tile links

        if (RecipeResolver.servesFrom(nAnchor).includes(anchor)) {
            const kind = def.buff && !def.provides?.length ? 'buff' : 'context';
            if (!links.some(l => l.from === nAnchor && l.to === anchor)) {
                links.push({ from: nAnchor, to: anchor, kind });
            }
        }
    }

    return links;
}


export const ConnectionLines = ({ tile }) => {
    if (tile == null) return null;

    const links = relationshipsFor(tile);
    if (!links.length) return null;

    // The active recipe, drawn on the line — hovering a Forge should say what
    // it is currently making, not just that something is connected (D-84).
    const self = BoardState.getToken(tile);
    const { recipe } = self ? RecipeResolver.resolveRecipe(tile, self) : { recipe: null };

    return (
        <svg
            width={BOARD_PX}
            height={BOARD_PX}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ zIndex: 60 }}
        >
            {links.map((link, i) => {
                const a = centre(link.from);
                const b = centre(link.to);
                const isContext = link.kind === 'context';
                return (
                    <line
                        key={i}
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={isContext ? '#fbbf24' : '#60a5fa'}
                        strokeWidth={isContext ? 3 : 2}
                        strokeDasharray={isContext ? undefined : '5 4'}
                        strokeLinecap="round"
                        opacity={0.9}
                    />
                );
            })}

            {recipe && (
                <text
                    x={centre(tile).x}
                    y={centre(tile).y - TILE_PX / 2 - 4}
                    textAnchor="middle"
                    className="fill-gi-primary"
                    style={{ fontSize: 11, fontWeight: 700, paintOrder: 'stroke' }}
                    stroke="rgba(0,0,0,0.85)"
                    strokeWidth={3}
                >
                    {recipe.id}
                </text>
            )}
        </svg>
    );
};

export default ConnectionLines;
