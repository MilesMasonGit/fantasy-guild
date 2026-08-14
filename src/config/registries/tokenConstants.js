// Fantasy Guild — Token vocabulary

/**
 * The canonical sets a Token's classification fields may draw from.
 *
 * ## Why this exists (CMS rework Phase 0, CMS-89)
 * `tokenType`, `rarity` and `theme` were free strings: every value in
 * `data/tokens.json` was authored by hand with nothing declaring which values
 * are legal. That was survivable while Tokens were hand-edited JavaScript and
 * one person held the list in their head. It stops being survivable the moment
 * the CMS offers these as dropdowns — CMS-5 requires the CMS to read its
 * vocabulary **from the game**, never to keep a second copy, because a second
 * copy is exactly how the old CMS ended up offering skills (`industry`,
 * `culinary`, `nautical`) that the game had never heard of.
 *
 * `CARD_RARITIES` in `cardConstants.js` is **not** this list and must not be
 * reused for it: it is card-era, has no `mythic`, and carries `epic`/
 * `legendary` which no Token uses.
 *
 * ## Extending it
 * Adding a value here makes it immediately available in the CMS's Token editor
 * with no CMS-side change — the same game-defines / CMS-provides-content split
 * CMS-32 sets out for trigger events. A Token category that does not exist yet
 * (Triggered Tokens, CMS-29) is deliberately absent until the runtime supports
 * it, so the CMS can never offer a category the board cannot run.
 */

/**
 * What a Token *is*, mechanically. Load-bearing at runtime: `BoardCombat.js`
 * reads it to know a Token should start a fight at all, and `RecipeResolver.js`
 * reads it too. Secondary as an authoring decision (CMS-62) — which sidebars
 * and effect blocks are populated is what really shapes a Token — but required.
 */
export const TOKEN_TYPES = Object.freeze([
    'resource',   // creates from nothing (D-51)
    'station',    // transforms, so it costs (D-97)
    'passive',    // Passive Generator — unstaffed, strictly worse (D-116)
    'context',    // defines what an adjacent station makes (D-18), or gates it (D-213)
    'buff',       // adjacency modifiers, deliberately tiny (D-119/D-120)
    'manager',    // restocks its neighbours, never depletes (D-140)
    'market',     // output is currency (D-141)
    'enemy',      // runs the combat engine; still just a Token (D-104)
    'map',        // a consumable that bursts into a kit (D-155)
]);

/**
 * How often a Token is found — **drop frequency and nothing more** (D-175).
 *
 * ⚠️ Rarity is not a power tier and must never become one. A Common Riverlands
 * producer far outproduces a Rare Woodland one; that is the design working.
 * Charges (how long it lasts) and theme (how strong it is) are independent
 * axes — see `token_content_notes.md` Part 1.
 */
export const TOKEN_RARITIES = Object.freeze([
    'common',
    'uncommon',
    'rare',
    'mythic',
]);

/**
 * Which Map kit a Token belongs to.
 *
 * **A Map's loot pool is the only meaning "biome" has** — there are no biome
 * systems, bonuses or mechanics anywhere in the game. Names are flavour.
 */
export const TOKEN_THEMES = Object.freeze([
    'woodland',
    'riverlands',
]);

/** Whether a value is a known Token type. */
export function isTokenType(value) {
    return TOKEN_TYPES.includes(value);
}

/** Whether a value is a known rarity. */
export function isTokenRarity(value) {
    return TOKEN_RARITIES.includes(value);
}

/** Whether a value is a known theme. */
export function isTokenTheme(value) {
    return TOKEN_THEMES.includes(value);
}
