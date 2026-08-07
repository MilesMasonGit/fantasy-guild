import React from 'react';
import { BOARD_PX, TILE_PX, rowOf, colOf } from './boardConstants.js';
import { neighboursOf } from '../../../systems/board/adjacency.js';
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

/** Centre point of a tile, in board pixels. */
const centre = (index) => ({
    x: colOf(index) * TILE_PX + TILE_PX / 2,
    y: rowOf(index) * TILE_PX + TILE_PX / 2
});

/**
 * Every relationship touching `tile`, in both directions.
 *
 * Both directions matter: hovering a Forge should show the schematic driving it,
 * and hovering the schematic should show every station it serves — including the
 * fact that it serves three of them, which is what makes it wear three times as
 * fast (D-157).
 */
function relationshipsFor(tile) {
    const links = [];
    const self = BoardState.getToken(tile);
    if (!self) return links;

    const selfDef = getTokenType(self.typeId);

    // Outbound: this tile is support, and serves neighbours.
    if (selfDef?.provides?.length || selfDef?.buff) {
        const kind = selfDef.buff && !selfDef.provides?.length ? 'buff' : 'context';
        for (const served of RecipeResolver.servesFrom(tile)) {
            links.push({ from: tile, to: served, kind });
        }
    }

    // Inbound: neighbours that are supporting this tile.
    for (const n of neighboursOf(tile)) {
        const neighbour = BoardState.getToken(n);
        if (!neighbour) continue;
        const def = getTokenType(neighbour.typeId);
        if (!def?.provides?.length && !def?.buff) continue;
        if (def.buff?.target === 'hero') continue;      // hero buffs aren't tile links

        if (RecipeResolver.servesFrom(n).includes(tile)) {
            const kind = def.buff && !def.provides?.length ? 'buff' : 'context';
            links.push({ from: n, to: tile, kind });
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
