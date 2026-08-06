// Fantasy Guild — Hero Dock status pip logic

/**
 * The four states a hero can be in, as a colour and nothing else (owner design
 * 2026-08-02). The dock card face shows a bare pip — no label, no icon — and
 * the player learns the vocabulary by playing:
 *
 *   red    — injured
 *   yellow — on a tile but not progressing
 *   green  — actively working
 *   blue   — unplaced and available
 *
 * The location survives in the hover tooltip, which is what `label` is for.
 * Deliberately NO reason text anywhere on the face: "just show the pip, let the
 * player figure out what it means".
 *
 * ## This is D-172's yellow mark
 * The design gives idle heroes their own mark in their own colour, deliberately
 * distinct from the red "staffed but stuck" mark on a Token:
 *
 *   🔴 red on a Token — staffed but stuck. Fix the supply or the layout.
 *   🟡 yellow on a hero — this person has nothing to do. Move them, or restock.
 *
 * Two colours, two vocabularies, no overlap. The yellow one lives on the hero
 * rather than the tile, so it costs nothing against the tile's three-thing
 * information budget (D-85) — and it should stand out hard, because **spotting
 * idle people is the main thing a returning player needs to do**.
 *
 * ## Re-pointed from areas to tiles (playmat rework, Phase 1)
 * The shape is unchanged; only what it names has moved. `tile` replaces the
 * area id, and the area-name lookup is gone with `areaSetRegistry` — a tile has
 * no name, so the label is the Token being worked, falling back to the tile
 * itself. Phase 4 supplies the Token name once Tokens exist.
 */

export const DOCK_PIP = {
    INJURED: 'injured',
    BLOCKED: 'blocked',
    WORKING: 'working',
    AVAILABLE: 'available'
};

/**
 * Statuses that mean the hero is genuinely getting work done. Anything else on
 * a hero who IS on a tile is a stall the player may want to look at.
 *
 * Listing the good states rather than the bad ones is deliberate: `paused`,
 * `idle`, a null status on a freshly-placed Token and any status a future phase
 * adds all fall through to "stopped" without an edit here — which is the safe
 * direction to be wrong in. A false yellow is a wasted glance; a false green is
 * a hero silently doing nothing for an hour.
 */
const PROGRESSING = new Set(['running', 'in_combat']);

/**
 * Whether a placed hero is stopped rather than working.
 *
 * Yellow covers EVERY stopped state, not just the resource ones (owner decision
 * 2026-08-02): out of inputs, depleted Token, context conflict, below the skill
 * requirement. The rule the player learns is "yellow means this hero isn't
 * doing anything", which stays true without their having to know which of five
 * reasons applies.
 *
 * `blocked` is the alert signal (D-114) — the Token has a hero but cannot work.
 * It is passed in rather than read off the status because a Token can be
 * blocked without its status changing.
 */
function isStopped(activity) {
    if (activity.blocked) return true;
    return !PROGRESSING.has(activity.tileStatus);
}

/**
 * Which pip a hero shows, and the label the tooltip uses.
 *
 * Kept as a pure function, separate from the component, so every state is
 * unit-testable — the in-combat case in particular cannot be staged from the
 * outside, because the board runner owns tile status and rewrites it each tick.
 *
 * Precedence matters: a wounded hero reads red even while still on a tile,
 * because their condition is the thing the player needs to act on.
 *
 * ⚠️ Tile 0 is a valid index, so placement is tested with `== null`, never
 * truthiness.
 *
 * @param {{wounded?: boolean, tile?: number|null, tileStatus?: string|null,
 *          tokenName?: string|null, blocked?: boolean}} activity
 * @returns {{pip: string, label: string}}
 */
export function describeActivity(activity) {
    if (!activity) return { pip: DOCK_PIP.AVAILABLE, label: 'Reserve' };

    if (activity.wounded) return { pip: DOCK_PIP.INJURED, label: 'Injured' };
    if (activity.tile == null) return { pip: DOCK_PIP.AVAILABLE, label: 'Reserve' };

    // Placed: name what they are working. A tile has no name of its own, so the
    // Token is the meaningful thing — "Yew Grove" reads better than "tile 17".
    const label = activity.tokenName || `Tile ${activity.tile}`;

    return {
        pip: isStopped(activity) ? DOCK_PIP.BLOCKED : DOCK_PIP.WORKING,
        label
    };
}

/** Fill colour per pip state. */
export const PIP_TONE_CLASS = {
    [DOCK_PIP.INJURED]: 'bg-gi-danger',
    [DOCK_PIP.BLOCKED]: 'bg-gi-warning',
    [DOCK_PIP.WORKING]: 'bg-gi-success',
    [DOCK_PIP.AVAILABLE]: 'bg-gi-info'
};
