// the progression ledger's engines: when each entry is first reachable (reach) and what a made item costs to its origins (tree)

import { isPlanned, planOf, tierLabel, tierLevelsOf, tierLevelAt } from './plan.js';
import { materialsOfToken } from '../../world/materials.js';
import { chanceText } from '../../../utils/Formatters.js';
import { normaliseStarterCamp } from '../../../config/starterCampShape.js';
import { normaliseHallSky } from '../../../config/hallStars.js';
import { authoredStars, HALL_NODE, WISHING_WELL_STAR } from '../../../config/guildUpgrades.js';
import { ringStarsOf, ringOfStar } from '../../world/ringStars.js';
import { expandBearer } from '../../effects/effectLibrary.js';
import { stationSkillOf, stationKindOf, KEYWORD } from '../../effects/statements.js';
import {
    stationKindOffers, foundationTierMeets, growsTermsOf, respawnOf, spawnerUpkeepOf, cropTermsOf, fieldOf, outputRange, PASSIVE_LAP_BASE_MS
} from '../../../config/registries/tokenConstants.js';
import { catchPoolsOf, hasCatchPools, poolForTool, poolKeyOf, catchToolKinds, poolBites } from '../../../config/registries/catchPools.js';
import { fishBait, fishCycleMs, fishLevel } from '../../../config/registries/fishRules.js';
import { spotOf, arrivesByItself, groundWaterKinds, WATER_KIND } from '../../../config/registries/fishingSpots.js';
import { rareTableOf, rareEntryChances } from '../../../config/registries/rareTables.js';
import { toolOf, neededToolOf, toolMeets, starterToolIds } from '../../../config/registries/toolKinds.js';
import { STRICT_RINGS, SKILL_OF, kitBiome } from '../../../config/worldTablesShape.js';
import { biomeRow } from '../../../config/biomeTerrain.js';
import { normaliseEventTable, isRunnable } from '../../../config/eventTable.js';
import { EVENT_WAIT_MIN_MS, EVENT_WAIT_MAX_MS } from '../../../config/eventTiming.js';
import { allowsTerrain, TERRAIN } from '../../atlas/TerrainMap.js';
import { coinsOf, shopCoinsOf } from '../../../config/registries/coinCosts.js';
import { itemUseDropsOf, usedItemOfSource } from '../../../config/registries/itemUse.js';

/**
 * Two engines over one picture of the content (`buildWorld`), shared by the CMS's ledger views and
 * the game's encyclopedia:
 *
 * - **Reach** (`computeReach`): for every item, Token and recipe, the earliest tier at which a player
 *   can have it, the path that gets there ("Iron Ore ← Iron Vein (Mining 15) ← Ores ring 2 ← …"),
 *   the skill levels that path asks, and whether, at that tier, only luck gets it.
 * - **Tree** (`ingredientTree`): a made item's ingredients down to their origins, with the hero time
 *   it all takes at the content's own rates, the skills it touches, its depth and its origins.
 *
 * A tier is a stage of the owner's plan, not a game rule: 0 is the Starter Camp, and ring n of the
 * world map is tier n, or the later rung its origins' main material is planned for (levels by rung,
 * {@link worldRules}). Everything else follows from what makes what: a thing is reachable at the
 * lowest tier at which every one of its needs is.
 *
 * **The world map** (given `worldTables`, as the CMS always does): a cell of each wedge at each strict
 * ring is settled at its ring's price (the skill levels; a ring-n cell after one of ring n − 1 of its
 * wedge; from ring 2, once the Guild Hall star that opens the ring is lit, given `hallSky`: see
 * {@link hallStarRules}) and places what every world holds there: the origins its line's table lists for the ring,
 * the ring's key origins and guaranteed camps (through the wedges most likely to hold them). What a
 * world holds only sometimes (a kit's everyday and boss camps, the chests, the arrivals) is
 * placed by luck (`maybe`). Without `worldTables` nothing is placed beyond the start: the World plan
 * reads the content that way, then puts one seed's cells in itself.
 *
 * ⚠️ Reach must reason over everything that makes a thing appear, or it reports a false "never":
 * the Starter Camp (its Tokens, its Bank, the starter tools), the Guild Hall (Passive Production,
 * the Wishing Well), the Shop, spawners, growth and turning and regrowth, the world's cells,
 * Foundations and the
 * buildings built on them, stations and their kinds, Fields and their crops, tool kinds and tiers,
 * catch pools and bait, fishing spots drifting in on water (and the spot kinds an event lands, see
 * {@link spotArrivalRules}), drops, bonus drops and spawns from rules, an item's Use. A new way
 * content appears belongs in `buildWorld`, as a rule.
 * ⚠️ A Planned entry is not in the world: it never reaches the game, so it makes nothing and nothing
 * makes it; its reach is null.
 *
 * Not modelled (each would move a reach later, never earlier): the tutorial's own steps, a cell's
 * price in materials (the seed picks them), which wedge a seed's key origins and camps fall in, room
 * under the Token cap, a placement rule refusing a spot, the guild's roster.
 *
 * Pure apart from one live read: given no `hallSky`, `buildWorld` reads the Wishing Well from the
 * game's sky (the encyclopedia passes none).
 */

/**
 * A chance at or above this is a sure way, whatever the source. Under it, a source that wears out
 * (a Token with Charges nothing brings back) is luck; repeatable work is judged by finds a day.
 */
export const LUCK_BELOW = 0.05;

/**
 * Repeatable work under `LUCK_BELOW` is a steady source when one hero working it all day, unboosted,
 * finds at least this many a day (`findsPerDay`); under it the find is rare but steady, never luck.
 */
export const STEADY_FINDS_PER_DAY = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The Starter Camp's ground as fishing spots read it: a Region no map wrote is meadow
 * (`GroundRules.NO_MAP_BIOME`), and a new game digs its pond, fresh water, near the camp
 * (`StarterCamp.starterCampTerrain`). ⚠️ The game digs none where no spot keeps off every Token;
 * the ledger takes the pond as dug.
 */
export const STARTER_CAMP_GROUND = Object.freeze({ biome: 'meadow', waters: Object.freeze([WATER_KIND.FRESH]) });

/**
 * A wedge's ground is sure at a ring when at least this share of its cells stand on it (the share
 * its kits' lean gives the biome); under it, only some worlds hold it there.
 */
const SURE_GROUND_SHARE = 0.5;

/** The event clock's mean wait between events (`EventClock.drawWait`). */
export const MEAN_EVENT_WAIT_MS = (EVENT_WAIT_MIN_MS + EVENT_WAIT_MAX_MS) / 2;

/** How a give comes: a steady source, a rare but steady one, or luck. */
export const FIND = Object.freeze({ STEADY: 'steady', RARE: 'rare', LUCK: 'luck' });

/**
 * The pseudo-skill a fight is filed under. Its level is the enemy's level, which sets how hard the
 * fight is: the game checks no hero level to fight, so it is a measure of the path, not a gate.
 */
export const COMBAT = 'combat';

const GUILD_HALL = 'token_guild_hall';

/** The ways a rule makes things. */
export const HOW = Object.freeze({
    STARTER_CAMP: 'starter-camp',
    STARTER_BANK: 'starter-bank',
    STARTER_TOOL: 'starter-tool',
    HALL: 'guild-hall',
    UPGRADE: 'upgrade',
    SHOP: 'shop',
    SPAWN: 'spawn',
    GROW: 'grow',
    REGROW: 'regrow',
    WORK: 'work',
    CATCH: 'catch',
    DROP: 'drop',
    STATION: 'station',
    BUILD: 'build',
    CRAFT: 'craft',
    TRICKLE: 'trickle',
    BONUS: 'bonus',
    HOLD: 'hold',
    SETTLE: 'settle',
    WORLD: 'world',
    STAR: 'hall-star',
    ARRIVE: 'arrive',
    EVENT: 'event-lands',
    USE: 'use'
});

/** Author-facing words, kept together for translation. */
export const LEDGER_ENGINE_TEXT = Object.freeze({
    how: Object.freeze({
        'starter-camp': 'in the Starter Camp',
        'starter-bank': 'in the opening Bank',
        'starter-tool': 'a starter tool',
        'guild-hall': 'the Guild Hall',
        upgrade: 'a Guild Hall upgrade',
        shop: 'bought at the Shop',
        spawn: 'spawned',
        grow: 'grows',
        regrow: 'regrows',
        work: 'worked',
        catch: 'caught',
        drop: 'dropped',
        station: 'made at',
        build: 'built on',
        craft: 'made',
        trickle: 'Passive Production',
        bonus: 'a bonus drop',
        hold: 'held',
        settle: 'settled on the world map',
        world: 'on a world cell',
        'hall-star': 'a Guild Hall star lit',
        arrive: 'drifts in on the water by itself',
        'event-lands': 'lands with an event',
        use: 'used from the Bank'
    }),
    ring: (ring) => `Ring ${ring} opened`,
    someWorlds: 'in some worlds',
    level: (skill, level) => `${skill === COMBAT ? 'Combat' : skill.charAt(0).toUpperCase() + skill.slice(1)} ${level}`,
    /** A chance (0 to 1) by the game's chance rule: "40%", "12.5%", "0.25%", "0.014%", never "0%". */
    chance: (p) => chanceText(p * 100),
    /** Finds a day in words: "about 8.6 a day", "about 0.7 a day", "about 1 in 12 days"; "finds a day unknown" when null. */
    perDay: (n) => (!Number.isFinite(n) ? 'finds a day unknown'
        : n >= 10 ? `about ${Math.round(n)} a day`
            : n >= 0.1 ? `about ${Math.round(n * 10) / 10} a day`
                : n > 0 ? `about 1 in ${Math.round(1 / n)} days` : 'none a day'),
    never: 'never',
    planned: 'planned',
    wedge: (line, ring) => `${line} ring ${ring}`,
    rungWedge: (line, ring, tier) => `${line} ring ${ring}, ${tier}`
});

// ── keys ────────────────────────────────────────────────────────────────────────────────────────

export const itemKey = (id) => `item:${id}`;
export const tokenKey = (id) => `token:${id}`;
export const recipeKey = (id) => `recipe:${id}`;
/** A cell of one wedge at one strict ring of the world map, as a place the guild settles. */
export const wedgeKey = (line, ring) => `wedge:${line}:${ring}`;
/** A Guild Hall star lit (its first rank bought). */
export const starKey = (id) => `star:${id}`;
/** A ring of the world map the guild may settle: its ring star lit. */
export const ringKey = (ring) => `ring:${ring}`;
/**
 * A fishing spot kind standing where one of its pools is the one fished (`catchPools.poolKeyOf`
 * names the pool): what that pool's catches need, so a spot's catch follows the water and biome it
 * stands on.
 */
export const spotPoolKey = (typeId, poolKey) => `spot:${typeId}|${poolKey}`;
const toolKey = (need) => `tool:${(need.kinds || [need.kind]).join('|')}:${need.minTier}`;

/** `{ kind, id }` of a key: kind is item, token, recipe, tool, wedge, star, ring or spot. */
export function parseKey(key) {
    const at = key.indexOf(':');
    return { kind: key.slice(0, at), id: key.slice(at + 1) };
}

// ── the world ───────────────────────────────────────────────────────────────────────────────────

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback);
const text = (v) => (typeof v === 'string' && v ? v : null);
/** A price's coins on its rule, `{ coins }`, only when it asks some: a rule asking none is as it always was. */
const coinsField = (coins) => (coins > 0 ? { coins } : {});

/** A collection (a list or an object) as an object keyed by each record's id, or its list place / key. */
export function keyed(collection) {
    const out = {};
    if (Array.isArray(collection)) {
        collection.forEach((def, i) => { if (isObject(def)) out[def.id ?? String(i)] = def; });
    } else if (isObject(collection)) {
        for (const [key, def] of Object.entries(collection)) if (isObject(def)) out[def.id ?? key] = def;
    }
    return out;
}

function recipeList({ recipes, recipePools }) {
    if (Array.isArray(recipes)) return recipes.filter(isObject);
    if (isObject(recipes)) return Object.values(recipes).filter(isObject);
    const out = [];
    for (const [skill, pool] of Object.entries(isObject(recipePools) ? recipePools : {})) {
        for (const recipe of list(pool)) out.push(recipe.skill ? recipe : { ...recipe, skill });
    }
    return out;
}

/** An output's chance as a fraction (`chance` is a percent, 100 when absent). */
function chanceOf(entry) {
    const percent = finite(Number(entry?.chance), 100);
    return Math.max(0, Math.min(1, percent / 100));
}

/** An output's expected quantity per successful roll: the middle of its range, as the game rolls it. */
function quantityOf(entry) {
    const fallback = finite(Number(entry?.quantity), 1);
    const min = finite(Number(entry?.minQty), fallback);
    const max = finite(Number(entry?.maxQty), fallback);
    return (min + max) / 2;
}

/** A level gate as a one-entry list, or none for a gate with no skill. */
function gate(skill, level) {
    if (!text(skill)) return [];
    return [{ skill, level: Math.max(1, Math.floor(finite(Number(level), 1))) }];
}

/** What an output names: an item or a Token key, or null (currency, nothing). */
function outputKey(entry) {
    if (text(entry?.itemId)) return itemKey(entry.itemId);
    if (text(entry?.tokenId)) return tokenKey(entry.tokenId);
    return null;
}

/** A spawn's or a turn's weight as the game's pick reads it (`weightedPick.js`): none, or none above 0, is never picked. */
const weightOf = (entry) => (Number(entry?.weight) > 0 ? Number(entry.weight) : 0);

/** An output's amount as the card reads it (`outputRange`): `{ min, max }`. */
const amountOf = (entry) => outputRange(entry);

/**
 * A Token's rare drop table as gives, read as chance lines: each entry at its own chance (the
 * table's, before Lucky, times its share of the table's weight). None without a table.
 */
function rareGivesOf(def) {
    return rareEntryChances(rareTableOf(def)).map(({ entry, chance }) => {
        const p = Math.max(0, Math.min(1, chance / 100));
        return { key: itemKey(entry.itemId), chance: p, perCycle: p * (entry.minQty + entry.maxQty) / 2, min: entry.minQty, max: entry.maxQty, rare: true };
    });
}

/** Whether a Token wears out for good: it has Charges and nothing brings it back (a chest). */
export function isOneOff(def) {
    return isObject(def) && def.uses !== undefined && def.uses !== null && !respawnOf(def) && !isObject(def.enemy);
}

/**
 * The content as the engines read it: every record by key, its name, and the rules that make
 * things. Planned records are kept by name only (`planned`) and make nothing.
 *
 * A rule: `{ id, how, via, needs: key[], tool: key|null, gives: [{ key, chance, perCycle, maybe, min, max, rare }],
 * floor, gates: [{ skill, level }], cycleMs, rollMs, inputs: [{ key, quantity }], passive, oneOff, repeatable }`,
 * a catch's `pool: { tool, bait }`, and `coins` on a price that asks coins beside its items (a Shop
 * Token's, a Guild Hall star's first rank, settling a ring: absent when it asks none, so a rule
 * without coins is exactly as it was). A give's `min` and `max` are its amount as the card shows it (where
 * known), `rare` marks a rare drop table's entry; the engines read neither.
 * `oneOff` marks the work of a one-off find (a chest the world places); `repeatable` work that keeps
 * rolling (not a one-off find, nor the work of a Token that wears out for good); `rollMs` the time
 * between its rolls when it is not `cycleMs` (a fight, a spawner, a bonus on one Token's work), for
 * finds a day; `maybe` a give only some worlds hold, never a sure way. It fires at the
 * lowest tier where every need (and its tool) is reached, and never below its `floor`. `via` is the
 * record that does the work, which a path follows back; `inputs` what one cycle spends, which a tree
 * follows down.
 *
 * @param {object} content  `{ items, tokens, recipes | recipePools, effects, starterCamp, worldTables, hallSky }`,
 *   as the CMS store or the game's `data/` files hold them (keyed objects or arrays). The Starter Camp
 *   is the one the game opens on; none means nothing is placed at the start. `worldTables`: the
 *   normalised world tables the world is generated from (with the plan's places laid on, as the
 *   World plan reads them), or none to place nothing beyond the start. `hallSky`: the Guild Hall's
 *   authored sky (`data/hallStars.json`'s shape), whose ring stars gate the rings they open.
 * @param {{ tierLevels?: {tier, level}[] }} [options]  the level each plan tier opens at (`plan.tierLevelsOf`;
 *   the ladder's when absent): what a world place of a later rung than its ring asks
 * @returns {{ items, tokens, recipes, rules, names, planned, worldTables: object|null, ringStars: Map<number, string[]>,
 *   rungs: Map<string, number>, ringRungs: Map<number, {first, last}>, tierLevels: {tier, level}[] }}
 *   `rungs` the plan tier of each world origin's main material ({@link rungsOf}); `ringRungs` each
 *   strict ring's first and last rung among the origins its tables list
 */
export function buildWorld(content = {}, { tierLevels = null } = {}) {
    const library = isObject(content.effects) ? content.effects : {};
    const allItems = keyed(content.items);
    const allTokens = keyed(content.tokens);
    const allRecipes = recipeList(content);

    const names = new Map();
    const planned = new Set();
    const items = {};
    const tokens = {};
    const recipes = {};
    for (const [id, def] of Object.entries(allItems)) {
        names.set(itemKey(id), def.name || id);
        if (isPlanned(def)) planned.add(itemKey(id));
        else items[id] = def;
    }
    for (const [id, def] of Object.entries(allTokens)) {
        names.set(tokenKey(id), def.name || id);
        if (isPlanned(def)) planned.add(tokenKey(id));
        else tokens[id] = expandBearer(def, library);
    }
    for (const recipe of allRecipes) {
        if (!recipe.id) continue;
        names.set(recipeKey(recipe.id), recipe.name || recipe.id);
        if (isPlanned(recipe)) planned.add(recipeKey(recipe.id));
        else recipes[recipe.id] = recipe;
    }

    const rules = [];
    const add = (rule) => rules.push({
        needs: [], tool: null, gives: [], floor: 0, gates: [], cycleMs: null, rollMs: null, inputs: [], passive: false, oneOff: false, ...rule
    });
    const inputsOf = (entries) => list(entries)
        .filter(e => text(e.itemId))
        .map(e => ({ key: itemKey(e.itemId), quantity: Math.max(0, finite(Number(e.quantity), 1)) }));
    const needKeys = (inputs) => inputs.map(i => i.key);

    // Tools: a need is met by holding any tool item that answers it.
    const toolNeeds = new Map();
    const noteNeed = (need) => {
        const key = toolKey(need);
        toolNeeds.set(key, need);
        return key;
    };
    // ⚠️ The game asks for a tool only of a hero working a Token that names a skill: with no skill,
    // any hero works it, tool or none (`WorkCheck.heroReason`).
    const heroToolOf = (def) => {
        if (!text(def?.config?.skill)) return null;
        const need = neededToolOf(def);
        return need ? noteNeed(need) : null;
    };

    // The Starter Camp: its Tokens, its Bank and the starter tools, and the Guild Hall that always stands.
    const camp = normaliseStarterCamp(content.starterCamp);
    const campTokens = [...new Set((camp?.tokens || []).map(t => t.typeId))];
    if (campTokens.length) {
        add({ id: 'starter-camp', how: HOW.STARTER_CAMP, via: null, gives: campTokens.map(id => ({ key: tokenKey(id), chance: 1 })) });
    }
    const bank = Object.keys(camp?.bank || {});
    if (bank.length) {
        add({ id: 'starter-bank', how: HOW.STARTER_BANK, via: null, gives: bank.map(id => ({ key: itemKey(id), chance: 1 })) });
    }
    const starterTools = starterToolIds(items);
    if (starterTools.length) {
        add({ id: 'starter-tools', how: HOW.STARTER_TOOL, via: null, gives: starterTools.map(id => ({ key: itemKey(id), chance: 1 })) });
    }
    const hall = tokenKey(GUILD_HALL);
    if (tokens[GUILD_HALL]) {
        add({ id: 'guild-hall', how: HOW.HALL, via: null, gives: [{ key: hall, chance: 1 }] });
        // The Wishing Well adds its lines (Water) to the Hall's Passive Production from its first rank.
        // ⚠️ The one star whose Passive Production reach follows: the others' lines are not modelled.
        const well = wishingWellOf(content.hallSky);
        const first = well?.ranks?.[0];
        const lines = list(first?.lines).filter(l => items[l.itemId]);
        if (lines.length) {
            const price = inputsOf(first.price);
            add({
                id: `upgrade:${well.id}`, how: HOW.UPGRADE, via: hall, needs: [hall, ...needKeys(price)], passive: true,
                cycleMs: PASSIVE_LAP_BASE_MS, gives: lines.map(l => ({ key: itemKey(l.itemId), chance: 1, perCycle: l.quantity }))
            });
        }
    }

    // A fishing spot's catches are added after the loop, the kinds that arrive by themselves first:
    // where two kinds give a fish at the same tier, the one that drifts in every few minutes is the
    // path, not one an event lands now and then (reach keeps the first of equals).
    const spotCatches = [];
    for (const [id, def] of Object.entries(tokens)) {
        const self = tokenKey(id);
        const isEnemy = isObject(def.enemy);
        const isSpawner = isObject(def.spawner);
        const isFoundation = isObject(def.foundation);

        // The Shop sells Token types, for items and maybe coins, from the start.
        if (isObject(def.shop)) {
            const price = inputsOf(def.shop.price);
            add({ id: `shop:${id}`, how: HOW.SHOP, via: null, needs: needKeys(price), inputs: price, gives: [{ key: self, chance: 1 }], ...coinsField(shopCoinsOf(def)) });
        }

        // A spawner's spawns, paid by its upkeep (none for a Forest or an Orchard); no hero needed.
        if (isSpawner) {
            const spawns = list(def.spawner.spawns).filter(s => text(s.typeId) && weightOf(s) > 0);
            const total = spawns.reduce((sum, s) => sum + weightOf(s), 0);
            const upkeep = inputsOf(spawnerUpkeepOf(def, typeId => tokens[typeId], id));
            if (spawns.length) {
                add({
                    id: `spawn:${id}`, how: HOW.SPAWN, via: self, needs: [self, ...needKeys(upkeep)], inputs: upkeep,
                    rollMs: finite(Number(def.spawner.intervalMs), null),
                    gives: spawns.map(s => ({ key: tokenKey(s.typeId), chance: total > 0 ? weightOf(s) / total : 1 }))
                });
            }
        }

        // Growth, once its owner stands (a Stump's Forest, any one of those named), paying its cost.
        if (isObject(def.grows) && text(def.grows.into)) {
            const terms = growsTermsOf(def);
            const cost = terms.cost.map(c => ({ key: itemKey(c.itemId), quantity: c.quantity }));
            const nearby = terms.needsNearby.length ? terms.needsNearby : [null];
            nearby.forEach((near, i) => add({
                id: `grow:${id}:${i}`, how: HOW.GROW, via: self, needs: [self, ...(near ? [tokenKey(near)] : []), ...needKeys(cost)],
                inputs: cost, gives: [{ key: tokenKey(def.grows.into), chance: 1 }]
            }));
        }

        // A regrow: worked out, it becomes another type. The game refuses one on an enemy, a spawner or a Foundation.
        const respawn = respawnOf(def);
        if (respawn?.mode === 'regrow' && !isEnemy && !isSpawner && !isFoundation) {
            add({ id: `regrow:${id}`, how: HOW.REGROW, via: self, needs: [self], tool: heroToolOf(def), gates: gate(def.config?.skill, def.config?.skillRequired), gives: [{ key: tokenKey(respawn.into), chance: 1 }] });
        }

        // Passive Production: paid every lap of the shared timer, no hero needed; the first comes after a
        // whole base lap (a new game holds no lap star), and the pace reads later laps off the rates.
        const trickle = list(def.trickle).filter(l => text(l.itemId));
        if (trickle.length) {
            add({
                id: `trickle:${id}`, how: HOW.TRICKLE, via: self, needs: [self], passive: true, cycleMs: PASSIVE_LAP_BASE_MS,
                gives: trickle.map(l => {
                    const q = Math.max(0, finite(Number(l.quantity), 1));
                    return { key: itemKey(l.itemId), chance: 1, perCycle: q, min: q, max: q };
                })
            });
        }

        // A rare drop table rolls on every cycle or kill of the Token, beside its own lines.
        const rare = isFoundation ? [] : rareGivesOf(def);

        // An enemy's drops (items only), beaten in a fight, and its rare table.
        if (isEnemy) {
            const drops = list(def.config?.outputs).filter(o => text(o.itemId));
            if (drops.length || rare.length) {
                add({
                    id: `drop:${id}`, how: HOW.DROP, via: self, needs: [self], gates: gate(COMBAT, def.enemy.level),
                    // A tree does not price a fight, but its fight time still says how many kills a day bring.
                    cycleMs: null, rollMs: finite(Number(def.config?.cycleTimeMs), null),
                    gives: [...drops.map(o => ({ key: itemKey(o.itemId), chance: chanceOf(o), perCycle: quantityOf(o) * chanceOf(o), ...amountOf(o) })), ...rare]
                });
            }
            continue;
        }

        // Water: each pool, its tool and its Bait; one catch a cycle, by weight, as the lureless
        // roll lands it: the Bait its fish ask on average, at the longest catch time among them.
        // Each fish from its own level (`Fishing.catchLevelOf`): one rule per level the pool's fish
        // ask. A fishing spot's pool is fished only where it stands on water and in a biome it holds
        // for, so its catches need the spot standing there (`spotPoolKey`, given by
        // `spotArrivalRules`), and its path runs back through that place.
        if (hasCatchPools(def)) {
            const ownMs = finite(Number(def.config?.cycleTimeMs), null);
            const ownLevel = Math.max(1, Math.floor(finite(Number(def.config?.skillRequired), 1)));
            const isSpot = spotOf(def) !== null;
            const put = isSpot ? (rule) => spotCatches.push({ rule, first: arrivesByItself(spotOf(def)) }) : add;
            catchPoolsOf(def).forEach((pool, i) => {
                // A pool that never bites (a rod naming no Bait) lands nothing (`Fishing.fishingOf`).
                if (!poolBites(pool)) return;
                const total = pool.catches.reduce((sum, c) => sum + c.weight, 0);
                const asked = total > 0 ? pool.catches.reduce((sum, c) => sum + c.weight * fishBait(items[c.itemId]), 0) / total : 1;
                const bait = pool.bait && asked > 0 ? [{ key: itemKey(pool.bait), quantity: asked }] : [];
                const times = pool.catches.map(c => fishCycleMs(items[c.itemId], ownMs)).filter(ms => Number.isFinite(ms));
                const cycleMs = times.length ? Math.max(...times) : ownMs;
                const poolKey = poolKeyOf(pool);
                const stands = isSpot ? spotPoolKey(id, poolKey) : self;
                if (isSpot) names.set(stands, spotPoolName(def.name || id, pool));
                const byLevel = new Map();
                for (const c of pool.catches) {
                    const level = Math.max(ownLevel, fishLevel(items[c.itemId], ownLevel));
                    if (!byLevel.has(level)) byLevel.set(level, []);
                    byLevel.get(level).push(c);
                }
                [...byLevel].sort((a, b) => a[0] - b[0]).forEach(([level, catches], n) => put({
                    id: `catch:${id}:${i}${byLevel.size > 1 ? `:${level}` : ''}`, how: HOW.CATCH, via: self,
                    ...(isSpot ? { pathVia: stands } : {}), needs: [stands, ...needKeys(bait)], inputs: bait,
                    tool: noteNeed({ kind: pool.tool, minTier: 1 }), gates: gate(def.config?.skill, level), cycleMs,
                    pool: { tool: pool.tool, bait: pool.bait, key: poolKey },
                    gives: [
                        ...catches.map(c => ({ key: itemKey(c.itemId), chance: total > 0 ? c.weight / total : 0, perCycle: total > 0 ? c.weight / total : 0, min: 1, max: 1 })),
                        ...(n === 0 ? rare : [])
                    ]
                }));
            });
            continue;
        }

        // Work: a Token's own cycle (a vein, a tree, a chest), with its tool and its inputs.
        const outputs = list(def.config?.outputs).filter(o => outputKey(o));
        if ((outputs.length || rare.length) && !stationSkillOf(def) && !isFoundation) {
            const inputs = inputsOf(def.config?.inputs);
            add({
                id: `work:${id}`, how: HOW.WORK, via: self, needs: [self, ...needKeys(inputs)], inputs, tool: heroToolOf(def),
                gates: gate(def.config?.skill, def.config?.skillRequired), cycleMs: finite(Number(def.config?.cycleTimeMs), null),
                gives: [...outputs.map(o => ({ key: outputKey(o), chance: chanceOf(o), perCycle: quantityOf(o) * chanceOf(o), ...amountOf(o) })), ...rare]
            });
        }
    }

    for (const { rule } of [...spotCatches.filter(c => c.first), ...spotCatches.filter(c => !c.first)]) add(rule);

    // Recipes: offered by a working station of their skill and kind, or built on a Foundation of their kind.
    // ⚠️ A station is gated by its own skill, level and tool; the recipe's level gates only picking it.
    const stations = Object.entries(tokens)
        .map(([id, def]) => ({ id, def, skill: stationSkillOf(def), kind: stationKindOf(def) }))
        .filter(s => s.skill && isObject(s.def.config) && !isObject(s.def.foundation));
    const foundations = Object.entries(tokens).filter(([, def]) => isObject(def.foundation) && text(def.foundation.kind));
    for (const recipe of Object.values(recipes)) {
        const self = recipeKey(recipe.id);
        const building = Array.isArray(recipe.foundationKinds) && recipe.foundationKinds.length > 0;
        const crop = isObject(recipe.crop);
        const recipeGate = gate(recipe.skill, recipe.levelRequirement);
        const terms = crop ? cropTermsOf(recipe) : null;
        // A crop's seed is paid once a sowing, which then gives `load` harvests.
        const inputs = crop
            ? terms.seeds.map(s => ({ key: itemKey(s.itemId), quantity: s.quantity / terms.load }))
            : inputsOf(recipe.inputs);

        if (building) {
            for (const [fid, fdef] of foundations) {
                const skill = text(fdef.foundation.skill) || recipe.skill;
                if (recipe.skill !== skill || !recipe.foundationKinds.includes(fdef.foundation.kind) || !foundationTierMeets(fdef, recipe)) continue;
                const level = Math.max(finite(Number(fdef.config?.skillRequired), 1), finite(Number(recipe.levelRequirement), 1));
                const need = neededToolOf(fdef);
                add({
                    id: `build:${recipe.id}:${fid}`, how: HOW.BUILD, via: tokenKey(fid), needs: [tokenKey(fid), ...needKeys(inputs)], inputs,
                    tool: need ? noteNeed(need) : null, gates: gate(skill, level), gives: [{ key: self, chance: 1 }]
                });
            }
        } else {
            for (const s of stations) {
                if (s.skill !== recipe.skill || !stationKindOffers(s.kind, recipe)) continue;
                const gates = [...gate(s.def.config.skill, s.def.config.skillRequired), ...recipeGate];
                add({
                    id: `station:${recipe.id}:${s.id}`, how: HOW.STATION, via: tokenKey(s.id), needs: [tokenKey(s.id), ...needKeys(inputs)], inputs,
                    tool: heroToolOf(s.def), gates, gives: [{ key: self, chance: 1 }]
                });
                // A station's rare table rolls on each cycle of whatever recipe it works.
                const rare = rareGivesOf(s.def);
                if (rare.length) {
                    add({
                        id: `rare:${recipe.id}:${s.id}`, how: HOW.WORK, via: tokenKey(s.id), needs: [tokenKey(s.id), self],
                        tool: heroToolOf(s.def), gates, cycleMs: finite(Number(recipe.durationMs), null), gives: rare
                    });
                }
                // A Field that starts ripe with this crop (a wild wheat patch) needs no seed for its first harvests.
                if (crop && fieldOf(s.def)?.startsWith === recipe.id) {
                    add({
                        id: `station:${recipe.id}:${s.id}:ripe`, how: HOW.STATION, via: tokenKey(s.id), needs: [tokenKey(s.id)],
                        tool: heroToolOf(s.def), gates, gives: [{ key: self, chance: 1 }]
                    });
                }
            }
        }

        const outputs = list(recipe.outputs).filter(o => outputKey(o));
        if (outputs.length) {
            add({
                id: `craft:${recipe.id}`, how: HOW.CRAFT, via: self, needs: [self], inputs,
                cycleMs: finite(Number(recipe.durationMs), null),
                gives: outputs.map(o => ({ key: outputKey(o), chance: chanceOf(o), perCycle: quantityOf(o) * chanceOf(o), ...amountOf(o) }))
            });
        }
    }

    // An item's Use: one copy spent from the Bank pays its drops at once, with no hero, station or
    // time (`ItemUse.applyItemUse`). Its cycle is 0, so a tree charges it no hero time beyond the item's own.
    for (const [id, def] of Object.entries(items)) {
        const drops = itemUseDropsOf(def);
        if (!drops.length) continue;
        const self = itemKey(id);
        add({
            id: `use:${id}`, how: HOW.USE, via: self, needs: [self], inputs: [{ key: self, quantity: 1 }], cycleMs: 0,
            gives: drops.map(o => ({ key: itemKey(o.itemId), chance: chanceOf(o), perCycle: quantityOf(o) * chanceOf(o), ...amountOf(o) }))
        });
    }

    const ringStars = hallStarRules(content.hallSky, { add, names, inputsOf });
    const tables = isObject(content.worldTables) && Array.isArray(content.worldTables.lines) ? content.worldTables : null;
    const levels = tierLevelsOf(tierLevels);
    const { rungs, ringRungs } = tables ? worldRungs(tables, allTokens, allItems) : { rungs: new Map(), ringRungs: new Map() };
    if (tables) {
        worldRules(tables, {
            add, names, placeable: (id) => !!text(id) && !planned.has(tokenKey(id)),
            ringNeeds: (ring) => (ringStars.has(ring) ? [ringKey(ring)] : []),
            rungs, ringRungs, levelAt: (tier) => tierLevelAt(levels, tier)
        });
    }

    // Fishing spots drift in on each place's water: the Starter Camp's pond, and each wedge's ground.
    const spots = spotKindsOf(tokens, content.events);
    const places = [
        ...(camp ? [{ id: 'starter-camp', via: null, needs: [], floor: 0, ...STARTER_CAMP_GROUND, maybe: false }] : []),
        ...(tables ? wedgeGrounds(tables) : [])
    ];
    for (const place of places) for (const rule of spotArrivalRules({ tokens, spots }, place)) add(rule);

    // Things made on the side by rules: a bonus drop granted to the work in reach (or carried by a
    // hero, or lent for a cycle by a status an item applies), a Token a rule spawns. ⚠️ A rule that
    // names an enemy is counted though the game refuses it; the content audit names it.
    const grantsOf = (statement) => {
        const payload = isObject(statement?.payload) ? statement.payload : {};
        if (statement?.keyword === KEYWORD.GRANTS && text(payload.itemId)) return [payload];
        if (statement?.keyword === KEYWORD.APPLIES && text(payload.effectId)) {
            return list(library[payload.effectId]?.statements)
                .filter(s => s.keyword === KEYWORD.GRANTS && text(s.payload?.itemId)).map(s => s.payload);
        }
        return [];
    };
    const bearers = [
        ...Object.entries(tokens).map(([id, def]) => [tokenKey(id), def]),
        ...Object.entries(items).map(([id, def]) => [itemKey(id), expandBearer(def, library)])
    ];
    for (const [self, def] of bearers) {
        list(def.statements).forEach((statement, i) => {
            const target = statement.to?.mode === 'id' && text(statement.to.value) ? [tokenKey(statement.to.value)] : [];
            grantsOf(statement).forEach((payload, j) => {
                const chance = Math.max(0, Math.min(1, finite(Number(payload.chance), 100) / 100));
                const quantity = Math.max(0, finite(Number(payload.quantity), 1));
                // A bonus rolls on each cycle of the work it is granted to: known when the rule names one Token.
                const onWork = target.length ? tokens[parseKey(target[0]).id] : null;
                add({
                    id: `bonus:${self}:${i}:${j}`, how: HOW.BONUS, via: self, needs: [self, ...target],
                    rollMs: finite(Number(onWork?.config?.cycleTimeMs), null),
                    gives: [{ key: itemKey(payload.itemId), chance, perCycle: chance * quantity, min: quantity, max: quantity }]
                });
            });
            const payload = isObject(statement.payload) ? statement.payload : {};
            if (statement.keyword === KEYWORD.SPAWNS && text(payload.typeId)) {
                const { kind, id } = parseKey(self);
                const chance = Math.max(0, Math.min(1, finite(Number(payload.chance), 100) / 100));
                add({
                    id: `effect-spawn:${self}:${i}`, how: HOW.SPAWN, via: self, needs: [self],
                    tool: kind === 'token' ? heroToolOf(tokens[id]) : null, gives: [{ key: tokenKey(payload.typeId), chance }],
                    // A Token's spawn on its own cycle rolls once a cycle.
                    rollMs: kind === 'token' && statement.when?.event === 'SELF_CYCLE_COMPLETE' ? finite(Number(tokens[id]?.config?.cycleTimeMs), null) : null
                });
            }
        });
    }

    // Holding a tool answers every need it meets.
    for (const [id, def] of Object.entries(items)) {
        const tool = toolOf(def);
        if (!tool) continue;
        const gives = [...toolNeeds].filter(([, need]) => toolMeets(tool, need)).map(([key]) => ({ key, chance: 1 }));
        if (gives.length) add({ id: `hold:${id}`, how: HOW.HOLD, via: itemKey(id), needs: [itemKey(id)], gives });
    }
    // A one-off find: a Token that wears out for good, which only a map or a modifier places, or only
    // some worlds hold. Its work is there once, by chance, so reach keeps it on the side
    // rather than as a way in. One every world places for sure is had, however soon it wears out.
    const placedBy = new Map();
    for (const rule of rules) {
        for (const give of rule.gives) {
            if (!placedBy.has(give.key)) placedBy.set(give.key, []);
            placedBy.get(give.key).push(rule.how === HOW.WORLD && give.maybe !== true ? null : rule.how);
        }
    }
    for (const rule of rules) {
        if ((rule.how !== HOW.WORK && rule.how !== HOW.CATCH) || !rule.via?.startsWith('token:')) continue;
        const placers = placedBy.get(rule.via) || [];
        if (isOneOff(tokens[parseKey(rule.via).id]) && placers.length && placers.every(how => how === HOW.WORLD)) {
            rule.oneOff = true;
        }
    }
    // Repeatable work keeps rolling: none of a one-off find, nor of a Token that wears out for good.
    for (const rule of rules) {
        const viaToken = rule.via?.startsWith('token:') ? tokens[parseKey(rule.via).id] : null;
        rule.repeatable = !rule.oneOff && !(viaToken && isOneOff(viaToken));
    }

    for (const [key, need] of toolNeeds) names.set(key, need.kinds ? need.kinds.join(' or ') : `${need.kind} ${need.minTier}+`);

    return { items, tokens, recipes, rules, names, planned, worldTables: tables, ringStars, spots, rungs, ringRungs, tierLevels: levels };
}

// ── fishing spots ───────────────────────────────────────────────────────────────────────────────

/** A spot pool's place in words, for its key's name: "Fishing Spot, coast", "Fishing Spot, sea". */
function spotPoolName(name, pool) {
    const where = [...(pool.water || []), ...(pool.biomes || [])].map(w => w.replace(/_/g, ' '));
    return where.length ? `${name}, ${where.join(', ')}` : name;
}

/**
 * The spot kinds (`fishingSpots.spotOf`: a Token type with a spot block) and the events that can
 * land, each with its Token: `{ kinds: [{ id, def, spot, byItself, tools }], events: [{ event, def }] }`.
 */
function spotKindsOf(tokens, rawEvents) {
    const kinds = [];
    for (const [id, def] of Object.entries(tokens)) {
        const spot = spotOf(def);
        if (spot) kinds.push({ id, def, spot, byItself: arrivesByItself(spot), tools: catchToolKinds(def) });
    }
    const events = Object.values(normaliseEventTable(rawEvents))
        .filter(event => isRunnable(event) && tokens[event.typeId])
        .map(event => ({ event, def: tokens[event.typeId] }));
    return { kinds, events };
}

/**
 * Each wedge's ground at each strict ring, as places spots may land: one per biome its cells may
 * stand on (`worldTablesShape.kitBiome` of each kit its line leans to, as the generation deals a
 * cell's kit), with the water that biome's terrain row may roll (`biomeRow`). A biome is sure when
 * at least {@link SURE_GROUND_SHARE} of the wedge's cells stand on it, else only some worlds'.
 */
function wedgeGrounds(tables) {
    const kits = Array.isArray(tables.kits) ? tables.kits : [];
    const out = [];
    for (const line of tables.lines) {
        const shares = new Map();
        const share = (biome, n) => shares.set(biome, (shares.get(biome) || 0) + n);
        const lean = Object.entries(isObject(line.kits) ? line.kits : {});
        const total = lean.reduce((n, [, w]) => n + (Number(w) > 0 ? Number(w) : 0), 0);
        if (lean.length && total > 0) for (const [kitId, w] of lean) { if (Number(w) > 0) share(kitBiome(tables, kitId), Number(w) / total); }
        else if (!lean.length && kits.length) for (const kit of kits) share(kitBiome(tables, kit.id), 1 / kits.length);
        else share(kitBiome(tables, null), 1);
        for (let ring = 1; ring <= STRICT_RINGS; ring++) {
            const at = wedgeKey(line.id, ring);
            for (const [biome, n] of shares) {
                const row = biomeRow(tables, biome);
                out.push({
                    id: `${line.id}:${ring}:${biome}`, via: at, needs: [at], floor: ring, biome,
                    waters: groundWaterKinds(row.sea[1], row.water), maybe: n < SURE_GROUND_SHARE
                });
            }
        }
    }
    return out;
}

/** Whether an event's Token may land on a place's ground: grass, and its water when it has some. */
function eventFits(event, def, place) {
    if (event.biomes.length && !event.biomes.includes(place.biome)) return false;
    const grounds = [TERRAIN.GRASS, ...(place.waters.length ? [TERRAIN.WATER] : [])];
    return grounds.some(t => allowsTerrain(def.standsOn, t) && (!event.ground.length || allowsTerrain(event.ground, t)));
}

/**
 * The rules by which fishing spots come to a place, `{ id, via, needs, floor, biome, waters, maybe }`
 * (the Starter Camp, a wedge's ground at a ring, a seed's cell):
 * - **By itself**: each spot kind that arrives by itself (`fishingSpots.arrivesByItself`) on water
 *   the place has, in a biome it lists (any, when it lists none), every `everyMinutes`.
 * - **With its event**: each event that lands a spot kind, where its event may land on the place's
 *   water (`EventClock.fitsHere`), at its share of the events that fit there, about once a wait.
 *
 * A rule gives the spot kind and, on each water it lands on there, for each tool its pools name,
 * the first pool that holds there (`catchPools.poolForTool`) when it bites, as {@link spotPoolKey}:
 * the pool a hero fishes there. The place's `maybe` marks a ground only some worlds hold.
 *
 * Not modelled: how many spots stand at once (a kind's `most`), the room on the water, a spot-rate
 * raiser in reach. The rate calculator reads the arrival rate and the stay.
 *
 * @param {{ tokens: object, spots: object }} world `buildWorld`'s (its `spots`)
 */
export function spotArrivalRules(world, place) {
    const { kinds = [], events = [] } = world?.spots || {};
    const out = [];
    const give = (key, chance) => (place.maybe ? { key, chance, maybe: true } : { key, chance });
    const poolsAt = (kind, waters) => {
        const keys = [];
        for (const water of waters) {
            const at = { water, biomes: [place.biome] };
            for (const tool of kind.tools) {
                // The first pool for the tool is the one fished; one that never bites lands nothing there (`Fishing.fishingOf`).
                const pool = poolForTool(kind.def, tool, at);
                const key = pool && poolBites(pool) ? spotPoolKey(kind.id, poolKeyOf(pool)) : null;
                if (key && !keys.includes(key)) keys.push(key);
            }
        }
        return keys;
    };
    for (const kind of kinds) {
        if (!kind.byItself) continue;
        if (kind.spot.biomes.length && !kind.spot.biomes.includes(place.biome)) continue;
        const waters = kind.spot.water.filter(w => place.waters.includes(w));
        if (!waters.length) continue;
        out.push({
            id: `arrive:${kind.id}:${place.id}`, how: HOW.ARRIVE, via: place.via, needs: place.needs, floor: place.floor,
            rollMs: kind.spot.everyMs, repeatable: true, gives: [tokenKey(kind.id), ...poolsAt(kind, waters)].map(key => give(key, 1))
        });
    }
    const fitting = events.filter(({ event, def }) => eventFits(event, def, place));
    const weight = fitting.reduce((n, { event }) => n + event.weight, 0);
    for (const { event, def } of fitting) {
        const kind = kinds.find(k => k.id === event.typeId);
        if (!kind || !place.waters.length) continue;
        const wet = allowsTerrain(def.standsOn, TERRAIN.WATER) && (!event.ground.length || allowsTerrain(event.ground, TERRAIN.WATER));
        if (!wet) continue;
        const chance = event.weight / weight;
        out.push({
            id: `event:${event.id}:${place.id}`, how: HOW.EVENT, via: place.via, needs: place.needs, floor: place.floor,
            rollMs: MEAN_EVENT_WAIT_MS, repeatable: true, event: event.id,
            gives: [tokenKey(kind.id), ...poolsAt(kind, place.waters)].map(key => give(key, chance))
        });
    }
    return out;
}

/** The Wishing Well's star (`hallStars.js` record): `hallSky`'s, or the game's sky's when there is no `hallSky`. */
function wishingWellOf(hallSky) {
    const stars = isObject(hallSky) ? normaliseHallSky(hallSky).stars : authoredStars();
    return stars.find(s => s.id === WISHING_WELL_STAR) || null;
}

/**
 * The Guild Hall's ring stars as rules (`hallStars.opensRing`, `world/ringStars.js`): lighting a star
 * pays its first rank's price once it is open, and a ring star's light opens its ring, which every
 * settle rule of that ring then needs. A star opens once a star it is linked to is lit, or at once when
 * linked to the Hall, so a star gets one rule per link and every star on the way to a ring star is
 * modelled too. Only those: the rest of the sky opens nothing the reach follows.
 *
 * A ring no star opens is open, as in the game.
 *
 * @returns {Map<number, string[]>} each ring a star opens, with the stars that open it
 */
function hallStarRules(hallSky, { add, names, inputsOf }) {
    const { stars } = normaliseHallSky(isObject(hallSky) ? hallSky : {});
    const byRing = ringStarsOf(stars);
    const out = new Map([...byRing].map(([ring, list]) => [ring, list.map(s => s.id)]));
    if (!byRing.size) return out;

    const byId = new Map(stars.map(s => [s.id, s]));
    const recordOf = (id) => {
        const star = byId.get(id);
        return star ? { id, name: star.name, links: star.links, price: star.ranks[0]?.price || [], coins: coinsOf(star.ranks[0]?.coins), ring: ringOfStar(star) } : null;
    };
    // A link counts from both ends: a star's neighbours are the ones it names and the ones naming it.
    const neighbours = (record) => [...record.links, ...stars.filter(s => s.links.includes(record.id)).map(s => s.id)];
    const modelled = new Map();
    const queue = [...byRing.values()].flat().map(s => s.id);
    while (queue.length) {
        const id = queue.shift();
        if (modelled.has(id)) continue;
        const record = recordOf(id);
        if (!record) continue;
        modelled.set(id, record);
        for (const link of neighbours(record)) if (link !== HALL_NODE && !modelled.has(link)) queue.push(link);
    }

    for (const [ring] of byRing) names.set(ringKey(ring), LEDGER_ENGINE_TEXT.ring(ring));
    for (const record of modelled.values()) {
        names.set(starKey(record.id), record.name);
        const inputs = inputsOf(record.price);
        const gives = [{ key: starKey(record.id), chance: 1 }, ...(record.ring !== null ? [{ key: ringKey(record.ring), chance: 1 }] : [])];
        const ways = new Set(neighbours(record).filter(l => l === HALL_NODE || modelled.has(l)));
        for (const way of ways) {
            add({
                id: `star:${record.id}:${way}`, how: HOW.STAR, via: null,
                needs: [...(way === HALL_NODE ? [] : [starKey(way)]), ...inputs.map(i => i.key)],
                inputs, gives, ...coinsField(record.coins)
            });
        }
    }
    return out;
}

/**
 * The rungs of the world tables' origins: `rungs`, each listed origin's owner's plan tier for its main
 * material (what its work yields as a matter of course, `world/materials.js`), the latest where it
 * yields several, else the origin's own plan tier, and an origin with neither left out; `ringRungs`,
 * each strict ring's first and last rung among the origins its lines list, never before the ring.
 * The game's own data carries no plan, so there every ring is its one rung, as the game generates it.
 *
 * @param {object} tables  normalised world tables
 * @param {Record<string, object>} tokensById  the records as authored, plan blocks and all
 * @param {Record<string, object>} itemsById
 * @returns {{ rungs: Map<string, number>, ringRungs: Map<number, {first: number, last: number}> }}
 */
export function worldRungs(tables, tokensById = {}, itemsById = {}) {
    const rungs = new Map();
    for (const line of tables.lines) {
        for (let ring = 1; ring <= STRICT_RINGS; ring++) {
            for (const o of list(line.origins?.[ring])) {
                if (rungs.has(o.id) || !isObject(tokensById[o.id])) continue;
                const own = materialsOfToken(tokensById[o.id]).map(id => planOf(itemsById[id]).tier).filter(Number.isInteger);
                const tier = own.length ? Math.max(...own) : planOf(tokensById[o.id]).tier;
                if (Number.isInteger(tier)) rungs.set(o.id, tier);
            }
        }
    }
    const ringRungs = new Map();
    for (let ring = 1; ring <= STRICT_RINGS; ring++) {
        const at = tables.lines.flatMap(line => list(line.origins?.[ring]).map(o => Math.max(ring, rungs.get(o.id) ?? ring)));
        ringRungs.set(ring, at.length ? { first: Math.min(...at), last: Math.max(...at) } : { first: ring, last: ring });
    }
    return { rungs, ringRungs };
}

/** A world place of a later rung than its ring: the cells of one wedge and ring whose main material is of that rung. */
export const rungWedgeKey = (line, ring, rung) => `${wedgeKey(line, ring)}:${rung}`;

/**
 * The world map's rules (see the file's head): a settle rule per wedge and strict ring, then what
 * every world places there, then what only some worlds do (`maybe`).
 *
 * **Levels by rung** (the ladder, T-294): a ring may hold several rungs (ring 3 mythril to darkmetal).
 * A ring's place is settled at its first rung (the earliest rung any of its origins is of, never
 * before the ring) and its template; an origin of a later rung stands on a place of its own
 * ({@link rungWedgeKey}), settled at that rung, asking the template or the rung's opening level in
 * the line's skill, whichever is higher, at the template's coins. Its price's goods are the seed's,
 * which the World plan reads by rung. With no rungs known (the game's data) every ring is one rung,
 * exactly as before.
 *
 * ⚠️ Which wedge a seed puts a key origin, a camp, an extra or an arrival in is the seed's: it is
 * placed through every wedge that may hold it, those whose tables list work by that ring first, then
 * the likeliest by kit (reach keeps the first of equals), so its path names that wedge's skill. A
 * `specialty` price slot follows the seed's specialty and is left out.
 */
function worldRules(tables, { add, names, placeable, ringNeeds = () => [], rungs = new Map(), ringRungs = new Map(), levelAt = () => 1 }) {
    const lines = tables.lines;
    const kits = Array.isArray(tables.kits) ? tables.kits : [];
    const rings = Array.from({ length: STRICT_RINGS }, (_, i) => i + 1);
    const rungAt = (id, ring) => Math.max(ring, rungs.get(id) ?? ring);

    // Each line's origins of each ring, by the place they stand on: the ring's own, or a later rung's.
    const standing = new Map();
    for (const ring of rings) {
        const template = tables.prices?.[ring] || {};
        const first = ringRungs.get(ring).first;
        for (const line of lines) {
            const key = wedgeKey(line.id, ring);
            names.set(key, LEDGER_ENGINE_TEXT.wedge(line.name || line.id, ring));
            const top = new Map();
            for (const slot of list(template.skills)) {
                const skill = slot.skill === SKILL_OF.LINE ? line.skill : slot.skill === SKILL_OF.SPECIALTY ? null : slot.skill;
                for (const g of gate(skill, slot.level)) top.set(g.skill, Math.max(top.get(g.skill) || 0, g.level));
            }
            const needs = [...(ring > 1 ? [wedgeKey(line.id, ring - 1)] : []), ...ringNeeds(ring)];
            const settle = (id, give, rung) => {
                const gates = new Map(top);
                if (rung > ring) for (const g of gate(line.skill, levelAt(rung))) gates.set(g.skill, Math.max(gates.get(g.skill) || 0, g.level));
                add({
                    id, how: HOW.SETTLE, via: null, floor: rung, ring, needs,
                    gates: [...gates].map(([skill, level]) => ({ skill, level })),
                    gives: [{ key: give, chance: 1 }], ...coinsField(coinsOf(template.coins))
                });
            };
            settle(`settle:${line.id}:${ring}`, key, first);

            const byRung = new Map([[first, []]]);
            for (const o of list(line.origins?.[ring])) {
                const rung = Math.max(first, rungAt(o.id, ring));
                if (!byRung.has(rung)) byRung.set(rung, []);
                byRung.get(rung).push(o.id);
            }
            standing.set(key, byRung);
            for (const rung of [...byRung.keys()].filter(r => r > first).sort((a, b) => a - b)) {
                const rungKey = rungWedgeKey(line.id, ring, rung);
                names.set(rungKey, LEDGER_ENGINE_TEXT.rungWedge(line.name || line.id, ring, tierLabel(rung)));
                settle(`settle:${line.id}:${ring}:${rung}`, rungKey, rung);
            }
        }
    }

    const placeAt = (id, via, floor, typeIds, maybe = false) => {
        const gives = [...new Set(typeIds)].filter(placeable).map(t => (maybe ? { key: tokenKey(t), chance: 1, maybe: true } : { key: tokenKey(t), chance: 1 }));
        if (gives.length) add({ id, how: HOW.WORLD, via, needs: [via], floor, gives });
    };
    const place = (id, line, ring, typeIds, maybe = false) => placeAt(id, wedgeKey(line, ring), ring, typeIds, maybe);
    // A kit's share of a line's cells: its lean over the lean's total, or an even share when the line leans to none.
    const shareOf = (line, kitId) => {
        const lean = Object.entries(line.kits || {});
        if (!lean.length) return kits.length ? 1 / kits.length : 0;
        const total = lean.reduce((n, [, w]) => n + w, 0);
        return total > 0 ? (Number(line.kits[kitId]) || 0) / total : 0;
    };
    // A wedge whose tables list nothing by a ring gives its skill no work to level there: it comes last.
    const stocked = (line, ring) => rings.some(n => n <= ring && (line.origins?.[n] || []).length > 0);
    const order = (list, ring, shareOfLine = () => 1) => list
        .map((line, i) => ({ line, i, share: shareOfLine(line), stocked: stocked(line, ring) }))
        .filter(x => x.share > 0)
        .sort((a, b) => b.stocked - a.stocked || b.share - a.share || a.i - b.i)
        .map(x => x.line);
    const linesFor = (kitIds, ring) => order(lines, ring, (line) => Math.max(0, ...kitIds.map(k => shareOf(line, k))));

    const listedBy = new Map();
    for (const ring of rings) {
        for (const line of lines) {
            const ids = (line.origins?.[ring] || []).map(o => o.id);
            for (const id of ids) if (!listedBy.has(id)) listedBy.set(id, ring);
            const first = ringRungs.get(ring).first;
            for (const [rung, at] of standing.get(wedgeKey(line.id, ring))) {
                if (rung === first) place(`world:${line.id}:${ring}`, line.id, ring, at);
                else placeAt(`world:${line.id}:${ring}:${rung}`, rungWedgeKey(line.id, ring, rung), rung, at);
            }
        }
    }
    for (const ring of rings) {
        // A key origin no line lists by its ring still stands within a step of every cell one ring in.
        const keys = list(tables.keys?.[ring]).filter(id => !(listedBy.get(id) <= ring));
        if (keys.length) for (const line of order(lines, ring)) place(`key:${line.id}:${ring}`, line.id, ring, keys);
        for (const camp of list(tables.camps?.[ring])) {
            const kitIds = camp.kits?.length ? camp.kits : kits.filter(k => k.camps.includes(camp.id) || k.bossCamps.includes(camp.id)).map(k => k.id);
            const holders = kitIds.length ? linesFor(kitIds, ring) : [];
            for (const line of holders.length ? holders : order(lines, ring)) place(`camp:${camp.id}:${ring}:${line.id}`, line.id, ring, [camp.id]);
        }
    }

    // Only in some worlds: a kit's camps (its everyday ones where it has combat work or combat is a
    // specialty, its boss camps with a combat specialty), the arrivals.
    const combatSpecialty = list(tables.specialties).includes(COMBAT);
    for (const kit of kits) {
        const ids = [...((kit.work?.[COMBAT] > 0 || combatSpecialty) ? kit.camps : []), ...(combatSpecialty ? kit.bossCamps : [])];
        if (!ids.length) continue;
        for (const ring of rings) for (const line of linesFor([kit.id], ring)) place(`kit:${kit.id}:${line.id}:${ring}`, line.id, ring, ids, true);
    }
    for (const ring of rings) {
        const arrival = tables.arrival?.[ring];
        const ids = list(arrival?.enemies).map(e => e.id);
        if (!ids.length || !(arrival.count?.[1] > 0)) continue;
        for (const line of order(lines, ring)) place(`arrival:${line.id}:${ring}`, line.id, ring, ids, true);
    }
}

// ── reach ───────────────────────────────────────────────────────────────────────────────────────

/** Reach values compare tier first, then steady before rare before luck, then the lower level gate, then the shorter path. */
function better(a, b) {
    if (!b) return true;
    if (a.tier !== b.tier) return a.tier < b.tier;
    if (a.luck !== b.luck) return !a.luck;
    if (a.rare !== b.rare) return !a.rare;
    if (a.gate !== b.gate) return a.gate < b.gate;
    return a.depth < b.depth;
}

/**
 * Finds a day of one give for one hero working its source all day, unboosted: the rolls a day times
 * the chance. Null when the rule has no known time between rolls.
 */
export function findsPerDay(rule, give) {
    const every = Number.isFinite(rule?.rollMs) && rule.rollMs > 0 ? rule.rollMs : rule?.cycleMs;
    if (!(Number.isFinite(every) && every > 0) || !Number.isFinite(give?.chance)) return null;
    return (DAY_MS / every) * give.chance;
}

/**
 * How a give comes (`FIND`). A world that holds it only sometimes, or a one-off find, is luck; a
 * chance at or over `luckBelow` is steady. Under it, repeatable work is steady at `steadyPerDay`
 * finds a day or more and rare but steady below that (or when its time between rolls is unknown);
 * work that wears out is luck.
 */
export function findClassOf(rule, give, { luckBelow = LUCK_BELOW, steadyPerDay = STEADY_FINDS_PER_DAY } = {}) {
    if (give.maybe === true || rule.oneOff) return FIND.LUCK;
    if (give.chance >= luckBelow) return FIND.STEADY;
    if (!rule.repeatable) return FIND.LUCK;
    const perDay = findsPerDay(rule, give);
    return perDay !== null && perDay >= steadyPerDay ? FIND.STEADY : FIND.RARE;
}

const needsOf = (rule) => (rule.tool ? [...rule.needs, rule.tool] : rule.needs);
const STEADY_OR_RARE = 'steady-or-rare';

/**
 * The fixpoint: for every key the best way in (`better`), over the rules, steady gives only when
 * `only` is 'steady', steady and rare ones when 'steady-or-rare'; a one-off find's work left out, or
 * taken as luck when `finds`. Values only ever improve and are finitely many, so it ends; a key
 * nothing reaches is absent.
 */
function settle(world, { classes, only = null, finds = false }) {
    const best = new Map();
    let changed = true;
    while (changed) {
        changed = false;
        for (const rule of world.rules) {
            if (rule.oneOff && !finds) continue;
            let tier = rule.floor;
            let luck = false;
            let rare = false;
            let gateLevel = rule.gates.reduce((top, g) => Math.max(top, g.level), 0);
            let depth = 0;
            let ok = true;
            for (const need of needsOf(rule)) {
                const at = best.get(need);
                if (!at) { ok = false; break; }
                tier = Math.max(tier, at.tier);
                luck = luck || at.luck;
                rare = rare || at.rare;
                gateLevel = Math.max(gateLevel, at.gate);
                depth = Math.max(depth, at.depth);
            }
            if (!ok) continue;
            rule.gives.forEach((give, i) => {
                const cls = classes.get(rule)[i];
                if (only === FIND.STEADY && cls !== FIND.STEADY) return;
                if (only === STEADY_OR_RARE && cls === FIND.LUCK) return;
                const cand = { tier, luck: luck || cls === FIND.LUCK, rare: rare || cls === FIND.RARE, gate: gateLevel, depth: depth + 1, rule, give };
                if (better(cand, best.get(give.key))) {
                    best.set(give.key, cand);
                    changed = true;
                }
            });
        }
    }
    return best;
}

/**
 * When every entry is first reachable.
 *
 * A one-off find (`rule.oneOff`) is no way in: reach is worked out without it, and an entry it gives
 * earliest carries it on the side (`oneOffFind`). An entry only a one-off find gets, itself or down
 * its chain, is reached through it, as luck only (`oneOffOnly`).
 *
 * @returns {Map<string, {key, kind, id, name, planned, tier, sureTier, luckOnly, rareOnly, oneOffOnly, oneOffFind, how, via, chance, findsPerDay, maybe, levels, gate, depth, rule}>}
 *   one entry per item, Token and recipe key (and the tool and wedge keys rules need). `tier` is
 *   null when it is never reachable; `sureTier` the lowest tier by steady sources alone (null: never
 *   that way); `luckOnly` that at its tier only luck gets it (`findClassOf`: a source that wears out
 *   under `luckBelow`, a one-off find, a world that holds it only sometimes; luck anywhere on its
 *   path counts); `rareOnly` that at its tier, without luck, only a rare but steady find gets it;
 *   `findsPerDay` the finds a day of the give that reaches it (null when its time is unknown); `maybe` that the world holds it only sometimes; `levels` the highest level per skill the whole path asks (`combat`: the toughest
 *   enemy on it), `gate` the highest single one; `depth` the steps from an origin. A Planned entry
 *   has `planned: true` and no tier.
 */
export function computeReach(world, { luckBelow = LUCK_BELOW, steadyPerDay = STEADY_FINDS_PER_DAY } = {}) {
    const classes = new Map(world.rules.map(rule => [rule, rule.gives.map(give => findClassOf(rule, give, { luckBelow, steadyPerDay }))]));
    const any = settle(world, { classes });
    const sure = settle(world, { classes, only: FIND.STEADY });
    const noLuck = settle(world, { classes, only: STEADY_OR_RARE });
    const withFinds = world.rules.some(r => r.oneOff) ? settle(world, { classes, finds: true }) : any;
    const bestOf = (key) => any.get(key) ?? withFinds.get(key);

    const levelsMemo = new Map();
    const levelsOf = (key, seen) => {
        if (levelsMemo.has(key)) return levelsMemo.get(key);
        const at = bestOf(key);
        const out = {};
        if (!at || seen.has(key)) return out;
        seen.add(key);
        for (const g of at.rule.gates) out[g.skill] = Math.max(out[g.skill] || 0, g.level);
        for (const need of needsOf(at.rule)) {
            for (const [skill, level] of Object.entries(levelsOf(need, seen))) out[skill] = Math.max(out[skill] || 0, level);
        }
        seen.delete(key);
        levelsMemo.set(key, out);
        return out;
    };

    const keys = new Set([
        ...Object.keys(world.items).map(itemKey),
        ...Object.keys(world.tokens).map(tokenKey),
        ...Object.keys(world.recipes).map(recipeKey),
        ...world.planned,
        ...any.keys()
    ]);
    const out = new Map();
    for (const key of keys) {
        const { kind, id } = parseKey(key);
        const base = { key, kind, id, name: world.names.get(key) ?? id };
        const at = world.planned.has(key) ? null : bestOf(key);
        if (!at) {
            out.set(key, {
                ...base, planned: world.planned.has(key), tier: null, sureTier: null, luckOnly: false, rareOnly: false, oneOffOnly: false, oneOffFind: null,
                how: null, via: null, chance: null, findsPerDay: null, maybe: false, levels: {}, gate: null, depth: 0, rule: null
            });
            continue;
        }
        const surely = sure.get(key);
        const unlucky = noLuck.get(key);
        const luckOnly = !unlucky || unlucky.tier > at.tier;
        const levels = levelsOf(key, new Set());
        const top = Object.entries(levels).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        out.set(key, {
            ...base,
            planned: false,
            tier: at.tier,
            sureTier: surely ? surely.tier : null,
            luckOnly,
            rareOnly: !luckOnly && (!surely || surely.tier > at.tier),
            oneOffOnly: !any.has(key),
            oneOffFind: null,
            how: at.rule.how,
            via: at.rule.via,
            chance: at.give.chance,
            findsPerDay: findsPerDay(at.rule, at.give),
            maybe: at.give.maybe === true,
            levels,
            gate: top ? { skill: top[0], level: top[1] } : null,
            depth: at.depth,
            rule: at.rule
        });
    }

    for (const rule of world.rules) {
        if (!rule.oneOff) continue;
        let tier = rule.floor;
        for (const need of needsOf(rule)) tier = Math.max(tier, out.get(need)?.tier ?? NaN);
        if (!Number.isInteger(tier)) continue;
        for (const give of rule.gives) {
            const entry = out.get(give.key);
            if (entry && entry.tier !== null && !(entry.oneOffFind && entry.oneOffFind.tier <= tier)) {
                entry.oneOffFind = { tier, via: rule.via, name: world.names.get(rule.via) ?? parseKey(rule.via).id };
            }
        }
    }
    return out;
}

/**
 * The one-off find an entry only it gets is reached through (the chest itself, or the chest an
 * ingredient comes from): its key, or null when the entry has a way in without one.
 */
export function oneOffFindOf(reach, key) {
    const seen = new Set();
    const walk = (k) => {
        const at = reach.get(k);
        if (!at?.oneOffOnly || !at.rule || seen.has(k)) return null;
        seen.add(k);
        if (at.rule.oneOff) return at.rule.via;
        for (const need of needsOf(at.rule)) {
            const hit = walk(need);
            if (hit) return hit;
        }
        return null;
    };
    return walk(key);
}

/**
 * The chain that first reaches a key, from it back to an origin: each step the thing reached, how,
 * and the gates and chance of the rule that reached it. Follows each rule's `via` (the Token that
 * works or drops it, the recipe that makes it, the station or Foundation a recipe runs on, the map
 * that writes it), or its `pathVia` where it has one (a fishing spot's catch: the spot standing
 * where that pool is fished, whose place says where it came).
 *
 * @returns {{key, name, how, via, tier, chance, maybe, gates}[]}
 */
export function reachPath(reach, key) {
    const steps = [];
    const seen = new Set();
    let at = reach.get(key);
    while (at && at.tier !== null && !seen.has(at.key)) {
        seen.add(at.key);
        const via = at.rule?.pathVia ?? at.via;
        steps.push({
            key: at.key, name: at.name, how: at.how, via, tier: at.tier,
            chance: at.chance, maybe: at.maybe === true, gates: at.rule?.gates || []
        });
        at = via ? reach.get(via) : null;
    }
    return steps;
}

/** A step's detail in words: "(Mining 15)", "(Combat 20)", "(3%)", "(in some worlds)". */
function stepDetail(step, luckBelow) {
    const parts = step.gates.map(g => LEDGER_ENGINE_TEXT.level(g.skill, g.level));
    if (step.maybe) parts.push(LEDGER_ENGINE_TEXT.someWorlds);
    else if (Number.isFinite(step.chance) && step.chance < 1 && step.chance < luckBelow * 4) parts.push(LEDGER_ENGINE_TEXT.chance(step.chance));
    return parts.length ? ` (${[...new Set(parts)].join(', ')})` : '';
}

/**
 * The path in one line: "Iron Ore ← Iron Vein (Mining 15) ← Ores ring 2 ← settled on the world map (Mining 15)",
 * ending with how the chain starts ("in the Starter Camp", "settled on the world map") and what that
 * start asks; "never" or "planned". Each rule's gates and chance sit on the thing that did the work.
 */
export function describePath(reach, key, { luckBelow = LUCK_BELOW } = {}) {
    const at = reach.get(key);
    if (!at) return LEDGER_ENGINE_TEXT.never;
    if (at.planned) return LEDGER_ENGINE_TEXT.planned;
    if (at.tier === null) return LEDGER_ENGINE_TEXT.never;
    const steps = reachPath(reach, key);
    const parts = [];
    steps.forEach((step, i) => {
        const made = steps[i - 1];
        // A recipe named like what it makes ("Lavender ← Lavender ← Herb Garden") says nothing: its station follows.
        if (parseKey(step.key).kind === 'recipe' && made && step.name === made.name) return;
        parts.push(`${step.name}${made && made.via === step.key ? stepDetail(made, luckBelow) : ''}`);
    });
    const last = steps[steps.length - 1];
    const start = last && !last.via ? `${LEDGER_ENGINE_TEXT.how[last.how]}${stepDetail(last, luckBelow)}` : null;
    return start ? `${parts.join(' ← ')} ← ${start}` : parts.join(' ← ');
}

// ── trees ───────────────────────────────────────────────────────────────────────────────────────

/** The rules a tree may follow: ones that make an item over a cycle. */
const PRODUCING = new Set([HOW.WORK, HOW.CATCH, HOW.DROP, HOW.CRAFT, HOW.TRICKLE, HOW.UPGRADE, HOW.USE]);

/**
 * The rule a tree follows for one item: the simulator's anchor (`valueSource`, the source the item's
 * price comes from, an item's Use as `use:<item>`) when it names one that makes it, else the rule
 * that first reaches it if that one produces it, else the first reachable rule that does, else any.
 * Null for an origin (the Bank, a starter tool) or an item nothing makes.
 */
function sourceRule(world, reach, itemId) {
    const key = itemKey(itemId);
    const making = world.rules.filter(r => PRODUCING.has(r.how) && r.gives.some(g => g.key === key && g.perCycle > 0));
    if (!making.length) return null;
    const anchor = world.items[itemId]?.valueSource;
    if (anchor) {
        const used = usedItemOfSource(anchor);
        const hit = used
            ? making.find(r => r.how === HOW.USE && r.via === itemKey(used))
            : making.find(r => r.via === tokenKey(anchor) || r.via === recipeKey(anchor));
        if (hit) return hit;
    }
    const first = reach?.get(key)?.rule;
    if (first && making.includes(first)) return first;
    const reachable = making.filter(r => Number.isInteger(reach?.get(r.via)?.tier));
    return (reachable.length ? reachable : making)[0];
}

/**
 * A made item's tree down to its origins, for one unit of it.
 *
 * Each node: `{ key, id, name, quantity, source, effortMs, children, tools, origin, cycle, unknown }`.
 * `source` is `{ how, via, viaName, at, skill, level, cycleMs, perCycle }` (`at`: the station a recipe
 * is first run at), or null for an origin. `effortMs` is the hero time the node's quantity costs, its
 * ingredients included: its source's cycle over what one cycle yields of it, plus its inputs' own
 * effort. Passive Production costs no hero time. `unknown` marks an item nothing reaches, or a
 * source with no cycle time (a fight); `cycle` an ingredient already on the way up (seeds that make
 * seeds), counted once.
 * ⚠️ A cycle that makes several things charges its whole time to the one the tree follows, so a
 * co-product's tree overstates; a tool is listed, never priced.
 *
 * @param {{cycleTimeOf?: (rule) => number|null}} options  the cycle a source runs at; the record's own
 *   (`config.cycleTimeMs`, `durationMs`) by default, which a Recalculate writes from the simulator
 */
export function ingredientTree(world, reach, itemId, { cycleTimeOf = null } = {}) {
    const name = (key) => world.names.get(key) ?? parseKey(key).id;
    const cycleOf = (rule) => {
        const own = cycleTimeOf ? cycleTimeOf(rule) : null;
        return Number.isFinite(own) ? own : rule.cycleMs;
    };

    const build = (id, quantity, path) => {
        const key = itemKey(id);
        const node = { key, id, name: name(key), quantity, source: null, effortMs: 0, children: [], tools: [], origin: false, cycle: false, unknown: false };
        if (path.has(id)) {
            node.cycle = true;
            return node;
        }
        const rule = sourceRule(world, reach, id);
        if (!rule) {
            node.origin = true;
            node.unknown = !Number.isInteger(reach?.get(key)?.tier);
            return node;
        }
        const give = rule.gives.find(g => g.key === key);
        const at = rule.how === HOW.CRAFT ? reach?.get(rule.via)?.via ?? null : null;
        const gateOf = rule.how === HOW.CRAFT ? reach?.get(rule.via)?.rule?.gates : rule.gates;
        const top = [...(gateOf || [])].sort((a, b) => b.level - a.level)[0] || null;
        node.source = {
            how: rule.how,
            via: rule.via,
            viaName: rule.via ? name(rule.via) : null,
            at: at ? name(at) : null,
            skill: top?.skill ?? null,
            level: top?.level ?? null,
            cycleMs: cycleOf(rule),
            perCycle: give.perCycle
        };
        const toolRule = rule.how === HOW.CRAFT ? reach?.get(rule.via)?.rule : rule;
        if (toolRule?.tool) {
            const holder = reach?.get(toolRule.tool);
            if (holder?.via) node.tools = [parseKey(holder.via).id];
        }
        const cycles = give.perCycle > 0 ? quantity / give.perCycle : 0;
        const ms = rule.passive ? 0 : cycleOf(rule);
        if (!Number.isFinite(ms)) node.unknown = true;
        node.effortMs = Number.isFinite(ms) ? ms * cycles : 0;
        const nextPath = new Set(path).add(id);
        for (const input of rule.inputs) {
            const child = build(parseKey(input.key).id, input.quantity * cycles, nextPath);
            node.children.push(child);
            node.effortMs += child.effortMs;
        }
        if (!rule.inputs.length) node.origin = true;
        return node;
    };

    return build(itemId, 1, new Set());
}

/**
 * A tree in figures: `{ effortMs, skills, depth, origins: [{ id, name, tier }], complete }`.
 * `skills` every skill a source in it asks (a fight as `combat`), `depth` the longest chain of
 * sources (an ore from a vein is 1, an ingot smelted from it 2), `origins` the items the tree starts
 * from with their earliest tiers, `complete` false when some part has no effort (a fight, a source
 * with no cycle time, an ingredient nothing reaches), so `effortMs` is a floor.
 */
export function treeSummary(tree, reach = null) {
    const skills = new Set();
    const origins = new Map();
    let complete = true;
    const walk = (node) => {
        if (node.unknown) complete = false;
        if (node.source?.skill) skills.add(node.source.skill);
        if (node.origin && !node.cycle) origins.set(node.id, { id: node.id, name: node.name, tier: reach?.get(node.key)?.tier ?? null });
        let below = 0;
        for (const child of node.children) below = Math.max(below, walk(child));
        return (node.source ? 1 : 0) + below;
    };
    const depth = walk(tree);
    return { effortMs: tree.effortMs, skills: [...skills].sort(), depth, origins: [...origins.values()], complete };
}

/** The rules whose inputs make an item a hub: what a cycle, a build, a growth, an upkeep or a purchase spends. */
const SPENDING = new Set([HOW.CRAFT, HOW.BUILD, HOW.WORK, HOW.CATCH, HOW.SPAWN, HOW.GROW, HOW.SHOP]);

/**
 * Items ranked by how many things spend them (where balance hinges): `[{ id, name, uses, consumers }]`,
 * most used first, then by name. A consumer is a recipe, or a Token that spends it working, spawning
 * or growing, or the Token a Shop price buys; each is counted once.
 */
export function hubsOf(world) {
    const consumers = new Map();
    for (const rule of world.rules) {
        if (!SPENDING.has(rule.how)) continue;
        // A recipe's station rule and its craft rule spend the same inputs: both name the recipe.
        const consumer = rule.how === HOW.BUILD ? rule.gives[0]?.key : rule.how === HOW.SHOP ? rule.gives[0]?.key : rule.via;
        for (const input of rule.inputs) {
            if (!input.key.startsWith('item:') || input.key === consumer) continue;
            if (!consumers.has(input.key)) consumers.set(input.key, new Set());
            consumers.get(input.key).add(consumer);
        }
    }
    return [...consumers].map(([key, set]) => ({
        id: parseKey(key).id,
        name: world.names.get(key) ?? parseKey(key).id,
        uses: set.size,
        consumers: [...set].sort()
    })).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
}

/**
 * The ledger over a whole workspace or `data/`: the world, every entry's reach, and a tree (with its
 * figures) for any item asked.
 *
 * @returns {{ world, reach, reachOf(key), pathOf(key), findClass(rule, give), hubs(), treeOf(itemId) }}
 */
export function buildLedger(content, { luckBelow = LUCK_BELOW, steadyPerDay = STEADY_FINDS_PER_DAY, cycleTimeOf = null, tierLevels = null } = {}) {
    const world = buildWorld(content, { tierLevels });
    const reach = computeReach(world, { luckBelow, steadyPerDay });
    return {
        world,
        reach,
        reachOf: (key) => reach.get(key) ?? null,
        pathOf: (key) => describePath(reach, key, { luckBelow }),
        /** How a rule's give comes (`FIND`), by this ledger's luck line and steady threshold. */
        findClass: (rule, give) => findClassOf(rule, give, { luckBelow, steadyPerDay }),
        hubs: () => hubsOf(world),
        treeOf: (itemId) => {
            const tree = ingredientTree(world, reach, itemId, { cycleTimeOf });
            return { tree, ...treeSummary(tree, reach) };
        }
    };
}
