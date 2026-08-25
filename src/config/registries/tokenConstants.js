// Fantasy Guild — Token vocabulary

/**
 * The canonical sets a Token's classification fields may draw from.
 *
 * ## Why this exists (CMS rework Phase 0, CMS-89)
 * `tokenType` and `rarity` were free strings: every value in
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

/*
 * ⚠️ **`TOKEN_THEMES` / `isTokenTheme` were removed here on 2026-08-24
 * (CR2-125, CR2-039).** `theme` was never a feature — `concept_audit.md` §A
 * rules it NOT REAL — but it survived as a two-value vocabulary
 * (`woodland`, `riverlands`) that no authored content ever used, plus a CMS
 * dropdown offering those values. Every Token and Map in `data/` carried
 * `theme: ""`.
 *
 * Before removing it, all three sites that read the field were checked and
 * each was found inert: `mapRegistry.listMaps()` and `Cartographer.rollBurst()`
 * tested for `theme === 'guild_hall'`, and both tests were already covered by
 * the conditions beside them (`price > 0`, and the `map_guild_hall` id checks);
 * `TokenInspection.jsx` folded the value into its tag chips, where an empty
 * string never rendered.
 *
 * Do not reintroduce this field. If Maps ever need to be grouped, group them
 * by something the engine actually reads.
 */

/**
 * What a production output may pay out **instead of an item** (D-141).
 *
 * `BoardRunner` credits an output entry carrying `currency` through
 * `CurrencyManager` rather than dropping a sprite: gold is not an item, has no
 * sprite and no Bank slot, so there is nothing for the floor to hold. That is
 * the *only* thing in the running game that makes a Market a Market — and until
 * now no CMS field wrote it, so `token_shrimp_market` ate Raw Shrimp and
 * produced nothing at all.
 *
 * Gold is the only entry because gold is the only currency the game has —
 * Influence was cut (owner decision 2026-08-19, CR2-093). Adding a currency
 * later is one row here plus a starting balance in `StateSchema`.
 *
 * @type {ReadonlyArray<{id: string, label: string}>}
 */
export const OUTPUT_CURRENCIES = Object.freeze([
    { id: 'gold', label: 'Gold' },
]);

/** Whether a value is a currency a production output may pay in. */
export function isOutputCurrency(value) {
    return OUTPUT_CURRENCIES.some(c => c.id === value);
}

/** Whether a value is a known Token type. */
export function isTokenType(value) {
    return TOKEN_TYPES.includes(value);
}

/** Whether a value is a known rarity. */
export function isTokenRarity(value) {
    return TOKEN_RARITIES.includes(value);
}
