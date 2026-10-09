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
 * Foundation tiers: `foundation.tier` on the Token and `foundationMinTier` on a building recipe,
 * both whole numbers from 1. A Foundation builds a recipe when its tier is at least the recipe's
 * minimum, the rule `requiresContext.minTier` applies to tools, so a higher tier builds everything a
 * lower one can.
 *
 * ⚠️ Absent or nonsense reads as 1 on both sides: content that sets no tier must keep building
 * exactly what it built before tiers existed. The content audit reports the nonsense.
 */
const tierValue = (value) => (Number.isInteger(value) && value >= 1 ? value : 1);

/** A Foundation Token's tier; 1 when unset. */
export function foundationTierOf(def) {
    return tierValue(def?.foundation?.tier);
}

/** The lowest Foundation tier a building recipe accepts; 1 when unset. */
export function foundationMinTierOf(recipe) {
    return tierValue(recipe?.foundationMinTier);
}

/** Whether a Foundation's tier reaches a building recipe's minimum. Kind and skill are not checked here. */
export function foundationTierMeets(def, recipe) {
    return foundationTierOf(def) >= foundationMinTierOf(recipe);
}

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
 * ⭐ **A Token that comes back after it runs out.** `respawn: { mode, afterMs?, into? }` on the
 * Token type:
 *
 * * `refill` — at 0 charges it stays where it stands, resting (nobody can work it), and after
 *   `afterMs` refills to its starting charges all at once.
 * * `regrow` — at 0 charges it becomes `into` (a felled Oak Tree becomes an Oak Sapling), and
 *   `into`'s own `grows` block brings it back, so the regrow time is set on `into`.
 *
 * A Token type without the block leaves the mat at 0, as it always has. The engine reads the
 * block only through {@link respawnOf}; the CMS's new-block factory and the content audit read
 * these defaults (the CMS across the boundary, see the header note).
 */
export const RESPAWN_MODES = Object.freeze(['refill', 'regrow']);

/** A refill's rest when the block names none, and what a new block in the CMS starts with. */
export const RESPAWN_DEFAULTS = Object.freeze({ mode: 'refill', afterMs: 12000 });

/** The shortest rest the engine honours. */
export const RESPAWN_MIN_MS = 1000;

/**
 * A Token type's respawn as `{ mode, afterMs, into }`, or null when it has none: no block, a mode
 * the game does not know, or a regrow that names nothing to regrow from. `afterMs` is a refill's
 * rest (defaulted, floored at {@link RESPAWN_MIN_MS}) and null on a regrow; `into` is null on a
 * refill.
 */
export function respawnOf(def) {
    const block = def?.respawn;
    if (!block || typeof block !== 'object') return null;
    if (block.mode === 'regrow') {
        const into = typeof block.into === 'string' ? block.into.trim() : '';
        return into ? { mode: 'regrow', afterMs: null, into } : null;
    }
    if (block.mode !== 'refill') return null;
    const ms = Number(block.afterMs);
    const afterMs = Number.isFinite(ms) && ms > 0 ? Math.max(RESPAWN_MIN_MS, ms) : RESPAWN_DEFAULTS.afterMs;
    return { mode: 'refill', afterMs, into: null };
}

/**
 * Passive Production's one timer: every line of a Token's `trickle` block (and the Wishing Well's
 * water on the Guild Hall) pays its quantity once per lap. A line's own `everyMs`, from before the
 * shared timer, is ignored.
 */
export const PASSIVE_PRODUCTION_MS = 5 * 60 * 1000;

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
