// Fantasy Guild — Token vocabulary
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY.
// `cms/src/utils/constants.js` takes `TOKEN_TYPES` and `TOKEN_RARITIES`, and
// `cms/src/components/layout/SupplyChainColumn.jsx` takes `OUTPUT_CURRENCIES`,
// by relative path. The CMS is a separate app: `npm run build` does not
// compile it, it has no test suite of its own, and the reachability tool does
// not know it exists — so an export here can look dead to every tool in the
// project while being the only thing filling a dropdown in the authoring tool.
// `TOKEN_TYPES` and `TOKEN_RARITIES` are in exactly that position today.
//
// `src/tests/CMSBoundary.test.js` is the actual guard: it scans the CMS for
// these imports and fails if a named export goes missing. This comment only
// exists to explain that failure to whoever hits it.

/**
 * The canonical sets a Token's classification fields may draw from.
 *
 * ## Why this exists
 * `tokenType` and `rarity` are closed vocabularies. The CMS must read its vocabulary **from the game**,
 * never keep a second copy — a second copy is how the old CMS ended up offering skills (`industry`,
 * `culinary`, `nautical`) that the game had never heard of.
 *
 * ## Extending it
 * Adding a value here makes it immediately available in the CMS's Token editor
 * with no CMS-side change — the same game-defines / CMS-provides-content split
 * as trigger events. A Token category the runtime does not support yet is
 * deliberately absent, so the CMS can never offer a category the board cannot run.
 */

/**
 * What a Token *is*, mechanically.
 *
 * ⚠️ **Nothing in the running game imports this constant** — the engine compares bare strings
 * (`def.tokenType === 'enemy'`). Its only readers are the CMS and `ContentRules.test.js`.
 * Treat it as **authoring vocabulary**: the closed list the CMS offers and the test validates
 * `data/tokens.json` against.
 */
export const TOKEN_TYPES = Object.freeze([
    'resource',   // creates from nothing (D-51)
    'station',    // transforms, so it costs (D-97)
    'passive',    // Passive Generator — unstaffed, strictly worse (D-116)
    'context',    // defines what a nearby station makes (D-18), or gates it (D-213)
    'buff',       // adjacency modifiers, deliberately tiny (D-119/D-120)
    'manager',    // restocks its neighbours, never depletes (D-140)
    'market',     // output is currency (D-141)
    'enemy',      // runs the combat engine; still just a Token (D-104)
    'map',        // a consumable that bursts into a kit (D-155)
    'promotion',  // trains the hero on it into one job, and IS that job's price (PR-6)
    'spawner',    // puts other Tokens on the mat on a clock (Token lifecycle §3.1)
]);

/**
 * How valuable a Token is meant to feel — **real, but essentially cosmetic**.
 * It signals a more valuable drop to the player, and is
 * *not* necessarily connected to drop chance.
 *
 * ⚠️ Rarity is **not** drop frequency: nothing connects rarity to drop chance. What it does is gate the
 * one-Mythic-placed-at-a-time rule in `Placement.js`.
 *
 * Rarity is still not a power tier: a Common producer may well outproduce a
 * Rare one, and charges are an independent axis.
 *
 * ⚠️ **The array order IS the tier order** — common → mythic, cheapest to most valuable.
 */
export const TOKEN_RARITIES = Object.freeze([
    'common',
    'uncommon',
    'rare',
    'epic',
    'mythic',
]);

/**
 * What a production output may pay out **instead of an item**.
 *
 * ⚠️ Gold is retired: `BoardRunner` now pays nothing for an output carrying
 * `currency`. The
 * list stays because the CMS Outputs column, the content audit and the
 * `market` type derivation still read it.
 *
 * Gold is the only entry.
 * Adding a currency
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

/**
 * The kinds of Foundation a Token can be.
 *
 * A Token with `foundation: { kind, skill }` is bought at the Shop and built on
 * with a recipe whose `foundationKinds` includes its `kind`. This is the one
 * place the list lives: the CMS's Foundation dropdown and its recipe picker
 * import it across the boundary (see the header note), and the engine and the
 * content audit read the same list.
 */
export const FOUNDATION_KINDS = Object.freeze(['wood', 'stone', 'bench', 'farmland']);

/**
 * ⭐ **A self-transforming Token rolls a chance.**
 * `turns: { into, everyMs, chance }` on the Token type:
 *
 * * `everyMs` — the roll cycle. Once per `everyMs` the Token rolls.
 * * `chance`  — the percent chance (0 < chance ≤ 100, like every other
 *   `chance` in the content files) that a roll succeeds.
 *
 * The same two numbers are used **both ways**: a Coast rolls to become a
 * Shrimp Coast, and the Shrimp Coast (which carries `turnedFrom`) rolls with
 * the Coast's numbers to turn back. Authored once, on the Coast.
 *
 * An absent field reads as its default here: 1 minute and 30%, so a Coast
 * flips roughly every three minutes each way.
 *
 * This is the one place the defaults live: the engine (`TimedChanges`), the
 * inspection lines, the content audit and the CMS's new-block factory all read
 * them from here (the CMS across the boundary, see the header note).
 */
export const TURN_DEFAULTS = Object.freeze({ everyMs: 60000, chance: 30 });

/**
 * The roll cycle and chance of a `turns` block, defaults filled in:
 * `{ everyMs, chance }`, `chance` a percent. A non-number or non-positive
 * `everyMs` reads as the default; `chance` is clamped to 0–100.
 */
export function turnTiming(turns) {
    const every = Number(turns?.everyMs);
    const everyMs = Number.isFinite(every) && every > 0 ? every : TURN_DEFAULTS.everyMs;
    const raw = turns?.chance;
    const c = raw === undefined || raw === null || raw === '' ? TURN_DEFAULTS.chance : Number(raw);
    const chance = Number.isFinite(c) ? Math.min(100, Math.max(0, c)) : TURN_DEFAULTS.chance;
    return { everyMs, chance };
}
