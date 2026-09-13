import { BOARD_PX, TILE_PX } from '../../../config/boardGeometry.js';
import { nearby, positionOf } from '../../../systems/board/nearby.js';
import { REACH } from '../../../config/registries/reachRegistry.js';
import { getTokenType, getProvidedTagsWithTiers, hasAdjacencyEffect } from '../../../config/registries/tokenRegistry.js';
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

/**
 * Centre point of whatever covers a tile, in mat units (= board pixels on the
 * grid) — the same position `nearby()` measures from (Free Playmat 1.2).
 */
const centre = (index) => positionOf(index);

/**
 * Every relationship touching `tile`, in both directions.
 */
/** Whether a Token serves its neighbours at all — a capability, or an effect. */
function isSupport(def) {
    if (!def) return false;
    return Object.keys(getProvidedTagsWithTiers(def)).length > 0 || hasAdjacencyEffect(def);
}

/** Which line to draw: a capability reads as context, a number reads as a buff. */
function kindOf(def) {
    return Object.keys(getProvidedTagsWithTiers(def)).length ? 'context' : 'buff';
}

function relationshipsFor(tile) {
    const links = [];
    const occ = BoardState.getOccupyingToken(tile);
    if (!occ?.instance) return links;
    const anchor = occ.anchorIndex;
    const self = occ.instance;
    const selfDef = getTokenType(self.typeId);

    // Outbound: this tile is support, and serves neighbours.
    //
    // ⚠️ Reads the MERGED capability helper rather than the raw `def.provides`
    // array (bug B2). A Token whose capability was authored anywhere but that
    // one top-level field used to work mechanically and draw no line at all —
    // the Copper Pickaxe fed its Ore Vein while the board showed nothing
    // between them.
    if (isSupport(selfDef)) {
        const kind = kindOf(selfDef);
        for (const served of RecipeResolver.servesFrom(anchor)) {
            links.push({ from: anchor, to: served, kind });
        }
    }

    // Inbound: Tokens within Near that are supporting this tile — measured
    // centre to centre (Free Playmat 1.2, FP-41). `nearby` names each Token once.
    // ⚠️ Until slice 1.3 converts `RecipeResolver.servesFrom`, a line is drawn
    // only where both agree, so a 2×2 Token's corner-diagonal inbound lines drop.
    for (const nAnchor of nearby(anchor, REACH.ADJACENT)) {
        const nInstance = BoardState.getToken(nAnchor);
        if (!nInstance) continue;
        const def = getTokenType(nInstance.typeId);
        if (!isSupport(def)) continue;

        if (RecipeResolver.servesFrom(nAnchor).includes(anchor)) {
            const kind = kindOf(def);
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
