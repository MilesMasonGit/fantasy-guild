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

import { isCombatSkill } from './skillRegistry.js';

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
    'promotion',  // ⚠️ an older Token with a retired Promotes rule; jobs are gone, no hero works it
    'spawner',    // puts other Tokens on the mat on a clock (Token lifecycle §3.1)
    'camp',       // heroes sent to it work the Tokens of its skill in its reach (brief 260)
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
export const FOUNDATION_KINDS = Object.freeze(['wood', 'stone', 'bench', 'farmland', 'excavation', 'battlefield']);

/**
 * The kinds of station, which split one skill's recipes between several stations of it: a
 * `stationKind` on the Token's `Works as` rule, `stationKinds` on a recipe. A skill's building
 * names no kind, so it offers every recipe of its skill, the list gated by level; only Farming
 * still splits its own (a Field and a Herb Garden each grow their crops, `cropTermsOf`; a Windmill
 * mills grain).
 *
 * ⚠️ Both sides are opt-in: a station with no kind offers its whole skill, and a recipe with no
 * kinds is offered by every station of its skill.
 */
export const STATION_KINDS = Object.freeze(['field', 'herb_garden', 'windmill']);

/** The skill each kind splits; the CMS offers a kind only on its own skill. */
const STATION_KIND_SKILLS = Object.freeze({ field: 'farming', herb_garden: 'farming', windmill: 'farming' });

/**
 * Kinds that used to split a craft skill between stations (a Furnace smelted, a Smithy made tools).
 *
 * ⚠️ They narrow nothing: a station or a recipe still naming one reads as naming none, so a station
 * left with one offers its whole skill until it is deleted, and the audits ask for the leftover to
 * be cleared. Their names still read, so an old rule still says what it named.
 */
export const RETIRED_STATION_KINDS = Object.freeze([
    'furnace', 'smithy', 'kitchen', 'brewery', 'tannery', 'workbench', 'alchemy_table', 'summoning_circle'
]);

/** Whether a kind is one of the retired ones (which narrow nothing). */
export function isRetiredStationKind(kind) {
    return RETIRED_STATION_KINDS.includes(kind);
}

/** The kinds that split one skill's recipes, in list order; none for a skill with one building. */
export function stationKindsOfSkill(skill) {
    return STATION_KINDS.filter(k => STATION_KIND_SKILLS[k] === skill);
}

const STATION_KIND_LABELS = Object.freeze({
    furnace: 'Furnace',
    smithy: 'Smithy',
    kitchen: 'Kitchen',
    brewery: 'Brewery',
    tannery: 'Tannery',
    workbench: 'Workbench',
    alchemy_table: 'Alchemy Table',
    summoning_circle: 'Summoning Circle',
    field: 'Field',
    herb_garden: 'Herb Garden',
    windmill: 'Windmill'
});

/** A station kind in words; an unknown kind shows its id rather than vanishing. */
export function stationKindLabel(kind) {
    return STATION_KIND_LABELS[kind] || kind || '';
}

/** Every kind a recipe names, retired ones too; none (or a malformed field) is an empty list. */
function namedStationKinds(recipe) {
    return Array.isArray(recipe?.stationKinds) ? recipe.stationKinds.filter(k => typeof k === 'string' && k) : [];
}

/** The station kinds that narrow a recipe: the ones it names, less the retired. */
export function recipeStationKinds(recipe) {
    return namedStationKinds(recipe).filter(k => !isRetiredStationKind(k));
}

/** The retired kinds a recipe still names: leftovers to clear, which narrow nothing. */
export function retiredStationKindsOf(recipe) {
    return namedStationKinds(recipe).filter(isRetiredStationKind);
}

/** Whether a station of this kind (null, or a retired kind: no kind) offers this recipe of its own skill. */
export function stationKindOffers(kind, recipe) {
    if (!kind || isRetiredStationKind(kind)) return true;
    const kinds = recipeStationKinds(recipe);
    return kinds.length === 0 || kinds.includes(kind);
}

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

const NO_IDS = Object.freeze([]);

/** Token type ids from an authored list, trimmed, blanks and repeats dropped. */
function typeIdList(list) {
    return Array.isArray(list)
        ? [...new Set(list.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))]
        : [];
}

/** A refill block's authored `needsNearby` list → the cleaned list, kept so it is the same array each ask. */
const refillNeedsMemo = new WeakMap();

function refillNeedsOf(block) {
    const src = block.needsNearby;
    if (!Array.isArray(src) || !src.length) return NO_IDS;
    const memo = refillNeedsMemo.get(block);
    if (memo && memo.src === src) return memo.list;
    const ids = typeIdList(src);
    const list = ids.length ? Object.freeze(ids) : NO_IDS;
    refillNeedsMemo.set(block, { src, list });
    return list;
}

/**
 * A Token type's respawn as `{ mode, afterMs, into, needsNearby }`, or null when it has none: no
 * block, a mode the game does not know, or a regrow that names nothing to regrow from. `afterMs` is
 * a refill's rest (defaulted, floored at {@link RESPAWN_MIN_MS}) and null on a regrow; `into` is
 * null on a refill. `needsNearby` is a refill's Token type ids, any one of which must stand within
 * reach (Near) for its rest to run (a Bare apple tree fruits again only beside an Orchard); empty
 * when it needs none, and always on a regrow. The same array each ask, so a resting Token's cached
 * answer (`TileModifiers.nearbyGateMet`) holds.
 */
export function respawnOf(def) {
    const block = def?.respawn;
    if (!block || typeof block !== 'object') return null;
    if (block.mode === 'regrow') {
        const into = typeof block.into === 'string' ? block.into.trim() : '';
        return into ? { mode: 'regrow', afterMs: null, into, needsNearby: NO_IDS } : null;
    }
    if (block.mode !== 'refill') return null;
    const ms = Number(block.afterMs);
    const afterMs = Number.isFinite(ms) && ms > 0 ? Math.max(RESPAWN_MIN_MS, ms) : RESPAWN_DEFAULTS.afterMs;
    return { mode: 'refill', afterMs, into: null, needsNearby: refillNeedsOf(block) };
}

const NO_TERMS = Object.freeze({ needsNearby: Object.freeze([]), cost: Object.freeze([]) });
const growsTermsMemo = new WeakMap();
let lastGrowsBlock = null;
let lastGrowsTerms = NO_TERMS;

/**
 * What a `grows` block asks before its Token may grow, as `{ needsNearby, cost }`:
 *
 * * `needsNearby` — Token type ids, any one of which must stand within reach (Near) for the
 *   growth's clock to run: a Stump regrows only beside a Forest of its species. Empty when it
 *   needs none (every growth today).
 * * `cost` — what the growth pays when it happens, from the Bank and then the loot on the mat,
 *   summed by item as `[{ itemId, quantity }]`: a Stump spends one seedling to become a Sapling.
 *   Empty when it is free.
 *
 * Kept per block object (frozen), so a growing Token asking every tick allocates nothing; a
 * content reload hands out new block objects.
 */
export function growsTermsOf(def) {
    const block = def?.grows;
    if (!block || typeof block !== 'object') return NO_TERMS;
    // The last block asked, first: a tick asks for the same type's block many times running.
    if (block === lastGrowsBlock) return lastGrowsTerms;
    let terms = growsTermsMemo.get(block);
    if (terms) {
        lastGrowsBlock = block;
        lastGrowsTerms = terms;
        return terms;
    }

    const nearby = Array.isArray(block.needsNearby)
        ? [...new Set(block.needsNearby.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))]
        : [];
    const total = new Map();
    for (const line of Array.isArray(block.cost) ? block.cost : []) {
        const q = Math.floor(Number(line?.quantity));
        if (typeof line?.itemId !== 'string' || !line.itemId || !(q > 0)) continue;
        total.set(line.itemId, (total.get(line.itemId) || 0) + q);
    }
    terms = (!nearby.length && !total.size) ? NO_TERMS : Object.freeze({
        needsNearby: Object.freeze(nearby),
        cost: Object.freeze([...total].map(([itemId, quantity]) => Object.freeze({ itemId, quantity })))
    });
    growsTermsMemo.set(block, terms);
    lastGrowsBlock = block;
    lastGrowsTerms = terms;
    return terms;
}

/**
 * ⭐ **A camp** (brief 260 O2): `camp: { skill }` on a Token built like a station. A hero sent to it
 * works the Tokens of `skill` within the one standard reach of its centre, centre to centre
 * (`systems/board/Camps.js`, `reachRegistry.STANDARD_REACH_U`).
 *
 * ⚠️ A `reach` key some blocks still carry in `data/` is not read: every camp works the standard
 * reach.
 *
 * A Token type's camp terms, `{ skill }`, or null for a type that is not a camp (no block, or no skill).
 */
export function campOf(def) {
    const block = def?.camp;
    if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
    const skill = typeof block.skill === 'string' ? block.skill.trim() : '';
    if (!skill) return null;
    return { skill };
}

/**
 * ⭐ **A War Camp** is a camp whose skill is one of the combat styles (`camp: { skill: 'melee' }`,
 * any of the four). A hero sent to it fights every enemy in its reach, one at a time, in the style of
 * the weapon in their hands: the style the block names is only the mark, never a limit
 * (`systems/board/Camps.js`).
 */
export function isWarCampBlock(block) {
    return !!block && isCombatSkill(block.skill);
}

/** Whether a Token type is a War Camp ({@link isWarCampBlock}). */
export function isWarCamp(def) {
    return isWarCampBlock(campOf(def));
}

/**
 * ⭐ **A Field grows its own crop** (brief 230 S4). `field: { emptySprite?, growingSprite?,
 * startsWith? }` on a Token that works as a station (Farming, kind `field` or `herb_garden`): its
 * recipes are the crops it can sow (`cropTermsOf`), the player picks one on the Field, and the Field
 * goes empty → growing → ripe by itself (`Fields.js`).
 *
 * * `emptySprite`, `growingSprite` — the shared pictures of an empty and a growing Field; absent,
 *   the Token's own art. A ripe Field is drawn as its crop's `ripeSprite`.
 * * `startsWith` — a crop recipe id: a new copy starts ripe with that crop, which is also its pick
 *   (a map's wild wheat patch). Absent, a new copy starts empty with nothing picked.
 *
 * Returns the block's terms with the blanks dropped, or null for a Token without the block.
 */
export function fieldOf(def) {
    const block = def?.field;
    if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
    let terms = fieldTermsMemo.get(block);
    if (!terms) {
        const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
        terms = Object.freeze({
            emptySprite: text(block.emptySprite),
            growingSprite: text(block.growingSprite),
            startsWith: text(block.startsWith)
        });
        fieldTermsMemo.set(block, terms);
    }
    return terms;
}
const fieldTermsMemo = new WeakMap();

/** A crop's terms when its recipe names none: about an hour to grow, ten harvests. */
export const CROP_DEFAULTS = Object.freeze({ growMs: 60 * 60 * 1000, load: 10 });

/** The shortest growth the engine honours. */
export const CROP_MIN_GROW_MS = 1000;

/**
 * What a crop recipe asks of the Field that grows it, as `{ growMs, load, ripeSprite, seeds }`:
 *
 * * `growMs` — how long it grows before it is ripe (`crop.growMs`, defaulted, floored at
 *   {@link CROP_MIN_GROW_MS}); Grow Time from Tokens in reach (a Well) shortens it.
 * * `load` — how many harvest cycles a ripe Field holds (`crop.load`, a whole number from 1); a
 *   Crop Load rule in reach (a Composter) adds to it as it ripens.
 * * `ripeSprite` — the picture of a ripe Field of this crop, or null (the Token's own art).
 * * `seeds` — the recipe's `inputs`, summed by item: what one sowing costs, paid from the Bank once
 *   per planting, never per harvest.
 *
 * Kept per recipe object (frozen), so a Field asking every tick allocates nothing.
 */
export function cropTermsOf(recipe) {
    if (!recipe || typeof recipe !== 'object') return DEFAULT_CROP_TERMS;
    let terms = cropTermsMemo.get(recipe);
    if (terms) return terms;
    const crop = recipe.crop && typeof recipe.crop === 'object' ? recipe.crop : {};
    const grow = Number(crop.growMs);
    const load = Math.floor(Number(crop.load));
    const sprite = typeof crop.ripeSprite === 'string' && crop.ripeSprite.trim() ? crop.ripeSprite.trim() : null;
    const total = new Map();
    for (const line of Array.isArray(recipe.inputs) ? recipe.inputs : []) {
        const q = Math.floor(Number(line?.quantity ?? 1));
        if (typeof line?.itemId !== 'string' || !line.itemId || !(q > 0)) continue;
        total.set(line.itemId, (total.get(line.itemId) || 0) + q);
    }
    terms = Object.freeze({
        growMs: Number.isFinite(grow) && grow > 0 ? Math.max(CROP_MIN_GROW_MS, grow) : CROP_DEFAULTS.growMs,
        load: load >= 1 ? load : CROP_DEFAULTS.load,
        ripeSprite: sprite,
        seeds: Object.freeze([...total].map(([itemId, quantity]) => Object.freeze({ itemId, quantity })))
    });
    cropTermsMemo.set(recipe, terms);
    return terms;
}
const cropTermsMemo = new WeakMap();
const DEFAULT_CROP_TERMS = Object.freeze({ ...CROP_DEFAULTS, ripeSprite: null, seeds: Object.freeze([]) });

/**
 * Passive Production's one timer, before any Guild Hall star shortens it: every line of a Token's
 * `trickle` block (and the Wishing Well's water on the Guild Hall) pays its quantity once per lap.
 * A line's own `everyMs`, from before the shared timer, is ignored. ⚠️ The live lap is
 * `PassiveProduction.lapMs()`; this is only its starting length.
 */
export const PASSIVE_LAP_BASE_MS = 10 * 60 * 1000;

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

/**
 * An output entry's quantity range, as `{ min, max }`.
 *
 * ## Why a range
 * The CMS authors outputs as
 * `{ itemId, chance, minQty, maxQty }` so a Token can yield "2–4 Oak Wood"
 * rather than always exactly 2 — the variability that makes a completion worth
 * watching.
 *
 * **Backwards compatible on purpose:** an entry with only `quantity` reads as
 * the degenerate range `{ min: q, max: q }`.
 *
 * ⚠️ Per-entry `chance` is a **separate** axis and already independent — each
 * output rolls its own chance, so one cycle can yield several different items
 * This is deliberately not the legacy "pick exactly one" cluster
 * behaviour, which stays orphaned.
 */
export function outputRange(output) {
    const fallback = output?.quantity ?? 1;
    const min = output?.minQty ?? fallback;
    const max = output?.maxQty ?? fallback;
    // Tolerate an inverted range rather than silently yielding nothing.
    return min <= max ? { min, max } : { min: max, max: min };
}

/**
 * A uniform roll within an output's range — what the runtime actually yields
 * before adjacency modifiers are applied.
 */
export function rollOutputQuantity(output, random = Math.random) {
    const { min, max } = outputRange(output);
    return min + Math.floor(random() * (max - min + 1));
}

/**
 * An output's average quantity per successful roll, ignoring `chance`.
 *
 * Content validation reasons about rates rather than single rolls, so it needs
 * the expected value where the runtime needs a sample.
 */
export function expectedOutputQuantity(output) {
    const { min, max } = outputRange(output);
    return (min + max) / 2;
}
