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
 * ## Extending it
 * Adding a value here makes it immediately available in the CMS's Token editor
 * with no CMS-side change — the same game-defines / CMS-provides-content split
 * CMS-32 sets out for trigger events. A Token category that does not exist yet
 * (Triggered Tokens, CMS-29) is deliberately absent until the runtime supports
 * it, so the CMS can never offer a category the board cannot run.
 */

/**
 * What a Token *is*, mechanically.
 *
 * ⚠️ **Corrected 2026-08-20 (CR2-039).** This comment used to say the list was
 * "load-bearing at runtime", naming `BoardCombat.js` and `RecipeResolver.js` as
 * readers. **Neither imports this file, and nothing in the running game does.**
 * The engine compares bare strings instead (`def.tokenType === 'enemy'`). The
 * only consumers of this file are the CMS and `ContentRules.test.js`.
 *
 * So treat it as **authoring vocabulary**: the closed list the CMS offers and
 * the test validates `data/tokens.json` against. Whether the engine ought to
 * import these constants — so a mistyped `'enemey'` fails loudly rather than
 * silently — is a real open question, but it is not what happens today.
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
 * How valuable a Token is meant to feel — **real, but essentially cosmetic**
 * (owner, 2026-08-18). It signals a more valuable drop to the player, and is
 * *not* necessarily connected to drop chance.
 *
 * ⚠️ Corrected 2026-08-18. This comment used to claim rarity was "drop
 * frequency and nothing more". That was false: nothing anywhere connects
 * rarity to drop chance. What it actually does, verified, is exactly two
 * things:
 *   - sets a Token's sell value — `SELL_VALUE` by rarity in `TokenBank.js`
 *   - gates the one-Mythic-placed-at-a-time rule in `Placement.js` (D-177)
 *
 * Rarity is still not a power tier: a Common producer may well outproduce a
 * Rare one, and charges are an independent axis.
 */
export const TOKEN_RARITIES = Object.freeze([
    'common',
    'uncommon',
    'rare',
    'mythic',
]);

/**
 * Which Map kit a Token belongs to — **a descriptive label, not a live axis**.
 *
 * ⚠️ **Corrected 2026-08-20 (CR2-039).** Theme was retired as a mechanic. A
 * Map's contents are an explicit `pool` list authored in `data/maps.json`;
 * nothing filters that pool by a Token's theme, and no other system reads the
 * field. The only place a Token's theme reaches the screen is the label in
 * `TokenInspection.jsx`.
 *
 * The list stays because the CMS needs a closed set for the field it still
 * writes. Do not build anything on top of it without wiring it up first.
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
