// the progression ledger's engines: when each entry is first reachable (reach) and what a made item costs to its origins (tree)

import { isPlanned, setTierOf } from './ledger.js';
import { isMapItem, isBaseMap, isModifier, recipeOf, givenByTutorial, upcycleOf, bountyWeightOf } from './mapItems.js';
import { normaliseStarterCamp } from '../../config/starterCampShape.js';
import { getUpgradeDef, WISHING_WELL_ITEM, wishingWellWater } from '../../config/guildUpgrades.js';
import { expandBearer } from '../effects/effectLibrary.js';
import { stationSkillOf, stationKindOf, KEYWORD } from '../effects/statements.js';
import {
    stationKindOffers, foundationTierMeets, growsTermsOf, respawnOf, cropTermsOf, fieldOf, PASSIVE_PRODUCTION_MS
} from '../../config/registries/tokenConstants.js';
import { catchPoolsOf, hasCatchPools } from '../../config/registries/catchPools.js';
import { toolOf, neededToolOf, toolMeets, starterToolIds } from '../../config/registries/toolKinds.js';

/**
 * Two engines over one picture of the content (`buildWorld`), shared by the CMS's ledger views and,
 * later, the game's encyclopedia and collection log:
 *
 * - **Reach** (`computeReach`): for every item, Token and recipe, the earliest tier at which a player
 *   can have it, the path that gets there ("Iron Ore ← Iron Vein (Mining 15) ← Volcano Map ← …"),
 *   the skill levels that path asks, and whether, at that tier, only luck gets it.
 * - **Tree** (`ingredientTree`): a made item's ingredients down to their origins, with the hero time
 *   it all takes at the content's own rates, the skills it touches, its depth and its origins.
 *
 * A tier is a stage of the owner's plan, not a game rule: 0 is the Starter Camp, and a map's Region
 * is the tier the owner set on that map (`ledger.tier`), or the tier its item is first had at when
 * none is set. Everything else follows from what makes what: a thing is reachable at the lowest
 * tier at which every one of its needs is.
 *
 * ⚠️ Reach must reason over everything that makes a thing appear, or it reports a false "never":
 * the Starter Camp (its Tokens, its Bank, the starter tools), the Guild Hall (Passive Production,
 * the Wishing Well, bounties), the Shop, spawners, growth and turning and regrowth, what each map and
 * modifier writes, how maps are had (drops, the tutorial, bounties, trading up), Foundations and the
 * buildings built on them, stations and their kinds, Fields and their crops, tool kinds and tiers,
 * catch pools and bait, drops (and first-kill drops), bonus drops and ambushes from rules. A new way
 * content appears belongs in `buildWorld`, as a rule.
 * ⚠️ A Planned entry is not in the world: it never reaches the game, so it makes nothing and nothing
 * makes it; its reach is null.
 *
 * Not modelled (each would move a reach later, never earlier): the tutorial's own steps before it
 * pays the first maps (a copper tool made, a goblin beaten), room under the Token cap, a placement
 * rule refusing a spot, the guild's roster.
 *
 * Pure apart from `mapItems.js`, which the CMS already imports: it reads only what it is handed.
 */

/** A drop under this chance (with no sure way to the same thing) is luck only. */
export const LUCK_BELOW = 0.05;

/**
 * How often a claimed bounty pays a map, before the pick by bounty weight.
 * ⚠️ Mirrors `BOUNTY_MAP_REWARD.chance` in `src/systems/quests/questBounties.js`, which this file cannot
 * import (it loads the game's data); `LedgerEngine.test.js` pins that the two agree.
 */
export const BOUNTY_MAP_CHANCE = 0.25;

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
    MAP: 'map',
    MODIFIER: 'modifier',
    TUTORIAL: 'tutorial',
    BOUNTY: 'bounty',
    UPCYCLE: 'upcycle',
    SPAWN: 'spawn',
    GROW: 'grow',
    TURN: 'turn',
    REGROW: 'regrow',
    WORK: 'work',
    CATCH: 'catch',
    DROP: 'drop',
    STATION: 'station',
    BUILD: 'build',
    CRAFT: 'craft',
    TRICKLE: 'trickle',
    BONUS: 'bonus',
    HOLD: 'hold'
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
        map: 'written by a map',
        modifier: 'written by a modifier',
        tutorial: 'given by the tutorial',
        bounty: 'paid by a bounty',
        upcycle: 'traded up',
        spawn: 'spawned',
        grow: 'grows',
        turn: 'turns',
        regrow: 'regrows',
        work: 'worked',
        catch: 'caught',
        drop: 'dropped',
        station: 'made at',
        build: 'built on',
        craft: 'made',
        trickle: 'Passive Production',
        bonus: 'a bonus drop',
        hold: 'held'
    }),
    firstKill: 'first kill',
    level: (skill, level) => `${skill === COMBAT ? 'Combat' : skill.charAt(0).toUpperCase() + skill.slice(1)} ${level}`,
    chance: (p) => `${Math.round(p * 1000) / 10}%`,
    never: 'never',
    planned: 'planned',
    region: 'a Region'
});

// ── keys ────────────────────────────────────────────────────────────────────────────────────────

export const itemKey = (id) => `item:${id}`;
export const tokenKey = (id) => `token:${id}`;
export const recipeKey = (id) => `recipe:${id}`;
const toolKey = (need) => `tool:${(need.kinds || [need.kind]).join('|')}:${need.minTier}`;
const REGION = 'region:any';

/** `{ kind, id }` of a key: kind is item, token, recipe, tool or region. */
export function parseKey(key) {
    const at = key.indexOf(':');
    return { kind: key.slice(0, at), id: key.slice(at + 1) };
}

// ── the world ───────────────────────────────────────────────────────────────────────────────────

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback);
const text = (v) => (typeof v === 'string' && v ? v : null);

function keyed(collection) {
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

const weightOf = (entry) => Math.max(0, finite(Number(entry?.weight), 1));

/**
 * The content as the engines read it: every record by key, its name, and the rules that make
 * things. Planned records are kept by name only (`planned`) and make nothing.
 *
 * A rule: `{ id, how, via, needs: key[], tool: key|null, gives: [{ key, chance, firstKill, perCycle }],
 * floor, gates: [{ skill, level }], cycleMs, inputs: [{ key, quantity }], passive }`. It fires at the
 * lowest tier where every need (and its tool) is reached, and never below its `floor`. `via` is the
 * record that does the work, which a path follows back; `inputs` what one cycle spends, which a tree
 * follows down.
 *
 * @param {object} content  `{ items, tokens, recipes | recipePools, effects, starterCamp }`, as the CMS
 *   store or the game's `data/` files hold them (keyed objects or arrays). The Starter Camp is the one
 *   the game opens on; none means nothing is placed at the start.
 */
export function buildWorld(content = {}, { bountyMapChance = BOUNTY_MAP_CHANCE } = {}) {
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
        needs: [], tool: null, gives: [], floor: 0, gates: [], cycleMs: null, inputs: [], passive: false, ...rule
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
        // The Wishing Well adds Water to the Hall's Passive Production from its first rank.
        const well = getUpgradeDef('wishing_well');
        if (well && items[WISHING_WELL_ITEM]) {
            const price = inputsOf(well.prices?.[0]);
            add({
                id: 'upgrade:wishing_well', how: HOW.UPGRADE, via: hall, needs: [hall, ...needKeys(price)], passive: true,
                cycleMs: PASSIVE_PRODUCTION_MS, gives: [{ key: itemKey(WISHING_WELL_ITEM), chance: 1, perCycle: wishingWellWater(1) }]
            });
        }
    }

    for (const [id, def] of Object.entries(tokens)) {
        const self = tokenKey(id);
        const isEnemy = isObject(def.enemy);
        const isSpawner = isObject(def.spawner);
        const isFoundation = isObject(def.foundation);

        // The Shop sells Token types, for items, from the start.
        if (isObject(def.shop)) {
            const price = inputsOf(def.shop.price);
            add({ id: `shop:${id}`, how: HOW.SHOP, via: null, needs: needKeys(price), inputs: price, gives: [{ key: self, chance: 1 }] });
        }

        // A spawner's spawns, paid by its upkeep; no hero needed.
        if (isSpawner) {
            const spawns = list(def.spawner.spawns).filter(s => text(s.typeId));
            const total = spawns.reduce((sum, s) => sum + weightOf(s), 0);
            const upkeep = inputsOf(def.spawner.upkeep);
            if (spawns.length) {
                add({
                    id: `spawn:${id}`, how: HOW.SPAWN, via: self, needs: [self, ...needKeys(upkeep)], inputs: upkeep,
                    gives: spawns.map(s => ({ key: tokenKey(s.typeId), chance: total > 0 ? weightOf(s) / total : 1 }))
                });
            }
        }

        // Growth, once any one Token it needs nearby stands, paying its cost.
        if (isObject(def.grows) && text(def.grows.into)) {
            const terms = growsTermsOf(def);
            const cost = terms.cost.map(c => ({ key: itemKey(c.itemId), quantity: c.quantity }));
            const nearby = terms.needsNearby.length ? terms.needsNearby : [null];
            nearby.forEach((near, i) => add({
                id: `grow:${id}:${i}`, how: HOW.GROW, via: self, needs: [self, ...(near ? [tokenKey(near)] : []), ...needKeys(cost)],
                inputs: cost, gives: [{ key: tokenKey(def.grows.into), chance: 1 }]
            }));
        }

        // Turning into another type, at a chance each roll, its targets weighted.
        if (isObject(def.turns)) {
            const into = list(def.turns.into).filter(t => text(t.typeId));
            const total = into.reduce((sum, t) => sum + weightOf(t), 0);
            if (into.length) {
                add({
                    id: `turn:${id}`, how: HOW.TURN, via: self, needs: [self],
                    gives: into.map(t => ({ key: tokenKey(t.typeId), chance: total > 0 ? weightOf(t) / total : 1 }))
                });
            }
        }

        // A regrow: worked out, it becomes another type. The game refuses one on an enemy, a spawner or a Foundation.
        const respawn = respawnOf(def);
        if (respawn?.mode === 'regrow' && !isEnemy && !isSpawner && !isFoundation) {
            add({ id: `regrow:${id}`, how: HOW.REGROW, via: self, needs: [self], tool: heroToolOf(def), gates: gate(def.config?.skill, def.config?.skillRequired), gives: [{ key: tokenKey(respawn.into), chance: 1 }] });
        }

        // Passive Production: paid every lap of the shared timer, no hero needed.
        const trickle = list(def.trickle).filter(l => text(l.itemId));
        if (trickle.length) {
            add({
                id: `trickle:${id}`, how: HOW.TRICKLE, via: self, needs: [self], passive: true, cycleMs: PASSIVE_PRODUCTION_MS,
                gives: trickle.map(l => ({ key: itemKey(l.itemId), chance: 1, perCycle: Math.max(0, finite(Number(l.quantity), 1)) }))
            });
        }

        // An enemy's drops (items only), beaten in a fight; a first-kill line drops for certain once.
        if (isEnemy) {
            const drops = list(def.config?.outputs).filter(o => text(o.itemId));
            if (drops.length) {
                add({
                    id: `drop:${id}`, how: HOW.DROP, via: self, needs: [self], gates: gate(COMBAT, def.enemy.level),
                    // No fight time is authored, so a drop has no cycle a tree could price.
                    cycleMs: null,
                    gives: drops.map(o => ({ key: itemKey(o.itemId), chance: chanceOf(o), firstKill: o.firstKill === true, perCycle: quantityOf(o) * chanceOf(o) }))
                });
            }
            continue;
        }

        // Water: each pool, its tool and its bait; one catch a cycle, by weight.
        if (hasCatchPools(def)) {
            const cycleMs = finite(Number(def.config?.cycleTimeMs), null);
            const gates = gate(def.config?.skill, def.config?.skillRequired);
            catchPoolsOf(def).forEach((pool, i) => {
                const total = pool.catches.reduce((sum, c) => sum + c.weight, 0);
                const bait = pool.bait ? [{ key: itemKey(pool.bait), quantity: 1 }] : [];
                add({
                    id: `catch:${id}:${i}`, how: HOW.CATCH, via: self, needs: [self, ...needKeys(bait)], inputs: bait,
                    tool: noteNeed({ kind: pool.tool, minTier: 1 }), gates, cycleMs,
                    gives: pool.catches.map(c => ({ key: itemKey(c.itemId), chance: total > 0 ? c.weight / total : 0, perCycle: total > 0 ? c.weight / total : 0 }))
                });
            });
            continue;
        }

        // Work: a Token's own cycle (a vein, a tree, a chest), with its tool and its inputs.
        const outputs = list(def.config?.outputs).filter(o => outputKey(o));
        if (outputs.length && !stationSkillOf(def) && !isFoundation) {
            const inputs = inputsOf(def.config?.inputs);
            add({
                id: `work:${id}`, how: HOW.WORK, via: self, needs: [self, ...needKeys(inputs)], inputs, tool: heroToolOf(def),
                gates: gate(def.config?.skill, def.config?.skillRequired), cycleMs: finite(Number(def.config?.cycleTimeMs), null),
                gives: outputs.map(o => ({ key: outputKey(o), chance: chanceOf(o), perCycle: quantityOf(o) * chanceOf(o) }))
            });
        }
    }

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
                // A Field that starts ripe with this crop (a map's wild wheat patch) needs no seed for its first harvests.
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
                gives: outputs.map(o => ({ key: outputKey(o), chance: chanceOf(o), perCycle: quantityOf(o) * chanceOf(o) }))
            });
        }
    }

    // Maps: a Base Map writes its Region; a Modifier changes a Base Map's. And how maps are had.
    const bountyMaps = [];
    for (const [id, def] of Object.entries(items)) {
        if (!isMapItem(def)) continue;
        const self = itemKey(id);
        const floor = setTierOf(def) ?? 0;
        if (isBaseMap(def)) {
            const recipe = recipeOf(def);
            const writes = [...recipe.nodes, ...(recipe.camps || []), ...(recipe.treasures || [])].map(r => r.typeId);
            add({ id: `map:${id}`, how: HOW.MAP, via: self, needs: [self], floor, gives: [...new Set(writes)].map(t => ({ key: tokenKey(t), chance: 1 })) });
            add({ id: `region:${id}`, how: HOW.MAP, via: self, needs: [self], floor, gives: [{ key: REGION, chance: 1 }] });
            if (givenByTutorial(def)) add({ id: `tutorial:${id}`, how: HOW.TUTORIAL, via: null, gives: [{ key: self, chance: 1 }] });
        } else if (isModifier(def)) {
            const writes = [];
            for (const effect of list(recipeOf(def).effects)) {
                if (effect.kind === 'replace') { if (text(effect.to)) writes.push(effect.to); }
                else if (text(effect.typeId)) writes.push(effect.typeId);
            }
            add({ id: `modifier:${id}`, how: HOW.MODIFIER, via: self, needs: [self, REGION], floor, gives: [...new Set(writes)].map(t => ({ key: tokenKey(t), chance: 1 })) });
        }
        const upcycle = upcycleOf(def);
        if (upcycle) {
            add({ id: `upcycle:${id}`, how: HOW.UPCYCLE, via: self, needs: [self], inputs: [{ key: self, quantity: upcycle.ratio }], gives: [{ key: itemKey(upcycle.itemId), chance: 1 }] });
        }
        if (bountyWeightOf(def) > 0) bountyMaps.push({ id, weight: bountyWeightOf(def) });
    }
    if (bountyMaps.length && tokens[GUILD_HALL]) {
        // Bounties come to the Hall from the start; a claimed one pays a map at `bountyMapChance`, picked by weight.
        const total = bountyMaps.reduce((sum, m) => sum + m.weight, 0);
        add({ id: 'bounty', how: HOW.BOUNTY, via: hall, needs: [hall], gives: bountyMaps.map(m => ({ key: itemKey(m.id), chance: bountyMapChance * m.weight / total })) });
    }

    // Things made on the side by rules: a bonus drop granted to the work in reach (or carried by a
    // hero, or lent for a cycle by a status an item applies), a Token spawned by an ambush.
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
                add({
                    id: `bonus:${self}:${i}:${j}`, how: HOW.BONUS, via: self, needs: [self, ...target],
                    gives: [{ key: itemKey(payload.itemId), chance, perCycle: chance * Math.max(0, finite(Number(payload.quantity), 1)) }]
                });
            });
            const payload = isObject(statement.payload) ? statement.payload : {};
            if (statement.keyword === KEYWORD.SPAWNS && text(payload.typeId)) {
                const { kind, id } = parseKey(self);
                const chance = Math.max(0, Math.min(1, finite(Number(payload.chance), 100) / 100));
                add({
                    id: `effect-spawn:${self}:${i}`, how: HOW.SPAWN, via: self, needs: [self],
                    tool: kind === 'token' ? heroToolOf(tokens[id]) : null, gives: [{ key: tokenKey(payload.typeId), chance }]
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
    for (const [key, need] of toolNeeds) names.set(key, need.kinds ? need.kinds.join(' or ') : `${need.kind} ${need.minTier}+`);
    names.set(REGION, LEDGER_ENGINE_TEXT.region);

    return { items, tokens, recipes, rules, names, planned };
}

// ── reach ───────────────────────────────────────────────────────────────────────────────────────

/** Reach values compare tier first, then sure before luck, then the lower level gate, then the shorter path. */
function better(a, b) {
    if (!b) return true;
    if (a.tier !== b.tier) return a.tier < b.tier;
    if (a.luck !== b.luck) return !a.luck;
    if (a.gate !== b.gate) return a.gate < b.gate;
    return a.depth < b.depth;
}

const isSure = (give, luckBelow) => give.firstKill === true || give.chance >= luckBelow;
const needsOf = (rule) => (rule.tool ? [...rule.needs, rule.tool] : rule.needs);

/**
 * The fixpoint: for every key the best way in (`better`), over the rules, sure gives only when
 * `sureOnly`. Values only ever improve and are finitely many, so it ends; a key nothing reaches is absent.
 */
function settle(world, { luckBelow, sureOnly }) {
    const best = new Map();
    let changed = true;
    while (changed) {
        changed = false;
        for (const rule of world.rules) {
            let tier = rule.floor;
            let luck = false;
            let gateLevel = rule.gates.reduce((top, g) => Math.max(top, g.level), 0);
            let depth = 0;
            let ok = true;
            for (const need of needsOf(rule)) {
                const at = best.get(need);
                if (!at) { ok = false; break; }
                tier = Math.max(tier, at.tier);
                luck = luck || at.luck;
                gateLevel = Math.max(gateLevel, at.gate);
                depth = Math.max(depth, at.depth);
            }
            if (!ok) continue;
            for (const give of rule.gives) {
                const sure = isSure(give, luckBelow);
                if (sureOnly && !sure) continue;
                const cand = { tier, luck: luck || !sure, gate: gateLevel, depth: depth + 1, rule, give };
                if (better(cand, best.get(give.key))) {
                    best.set(give.key, cand);
                    changed = true;
                }
            }
        }
    }
    return best;
}

/**
 * When every entry is first reachable.
 *
 * @returns {Map<string, {key, kind, id, name, planned, tier, sureTier, luckOnly, how, via, chance, firstKill, levels, gate, depth, rule}>}
 *   one entry per item, Token and recipe key (and the tool and Region keys rules need). `tier` is
 *   null when it is never reachable; `sureTier` the lowest tier without luck (null: only ever by luck,
 *   or never); `luckOnly` that at its tier only a drop under `luckBelow` gets it (luck anywhere on its
 *   path counts); `levels` the highest level per skill the whole path asks (`combat`: the toughest
 *   enemy on it), `gate` the highest single one; `depth` the steps from an origin. A Planned entry
 *   has `planned: true` and no tier.
 */
export function computeReach(world, { luckBelow = LUCK_BELOW } = {}) {
    const any = settle(world, { luckBelow, sureOnly: false });
    const sure = settle(world, { luckBelow, sureOnly: true });

    const levelsMemo = new Map();
    const levelsOf = (key, seen) => {
        if (levelsMemo.has(key)) return levelsMemo.get(key);
        const at = any.get(key);
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
        const at = world.planned.has(key) ? null : any.get(key);
        if (!at) {
            out.set(key, {
                ...base, planned: world.planned.has(key), tier: null, sureTier: null, luckOnly: false,
                how: null, via: null, chance: null, firstKill: false, levels: {}, gate: null, depth: 0, rule: null
            });
            continue;
        }
        const surely = sure.get(key);
        const levels = levelsOf(key, new Set());
        const top = Object.entries(levels).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        out.set(key, {
            ...base,
            planned: false,
            tier: at.tier,
            sureTier: surely ? surely.tier : null,
            luckOnly: !surely || surely.tier > at.tier,
            how: at.rule.how,
            via: at.rule.via,
            chance: at.give.chance,
            firstKill: at.give.firstKill === true,
            levels,
            gate: top ? { skill: top[0], level: top[1] } : null,
            depth: at.depth,
            rule: at.rule
        });
    }
    return out;
}

/**
 * The chain that first reaches a key, from it back to an origin: each step the thing reached, how,
 * and the gates and chance of the rule that reached it. Follows each rule's `via` (the Token that
 * works or drops it, the recipe that makes it, the station or Foundation a recipe runs on, the map
 * that writes it).
 *
 * @returns {{key, name, how, via, tier, chance, firstKill, gates}[]}
 */
export function reachPath(reach, key) {
    const steps = [];
    const seen = new Set();
    let at = reach.get(key);
    while (at && at.tier !== null && !seen.has(at.key)) {
        seen.add(at.key);
        steps.push({
            key: at.key, name: at.name, how: at.how, via: at.via, tier: at.tier,
            chance: at.chance, firstKill: at.firstKill, gates: at.rule?.gates || []
        });
        at = at.via ? reach.get(at.via) : null;
    }
    return steps;
}

/** A step's detail in words: "(Mining 15)", "(Combat 20, first kill)", "(3%)". */
function stepDetail(step, luckBelow) {
    const parts = step.gates.map(g => LEDGER_ENGINE_TEXT.level(g.skill, g.level));
    if (step.firstKill) parts.push(LEDGER_ENGINE_TEXT.firstKill);
    else if (Number.isFinite(step.chance) && step.chance < 1 && step.chance < luckBelow * 4) parts.push(LEDGER_ENGINE_TEXT.chance(step.chance));
    return parts.length ? ` (${[...new Set(parts)].join(', ')})` : '';
}

/**
 * The path in one line: "Iron Ore ← Iron Vein (Mining 15) ← Volcano Map ← Goblin Chief (Combat 20, first kill) ← …",
 * ending with how the chain starts ("in the Starter Camp", "given by the tutorial"); "never" or "planned".
 * Each rule's gates and chance sit on the thing that did the work.
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
    const start = last && !last.via ? LEDGER_ENGINE_TEXT.how[last.how] : null;
    return start ? `${parts.join(' ← ')} ← ${start}` : parts.join(' ← ');
}

// ── trees ───────────────────────────────────────────────────────────────────────────────────────

/** The rules a tree may follow: ones that make an item over a cycle. */
const PRODUCING = new Set([HOW.WORK, HOW.CATCH, HOW.DROP, HOW.CRAFT, HOW.TRICKLE, HOW.UPGRADE]);

/**
 * The rule a tree follows for one item: the simulator's anchor (`valueSource`, the source the item's
 * price comes from) when it names one that makes it, else the rule that first reaches it if that one
 * produces it, else the first reachable rule that does, else any. Null for an origin (the Bank, a
 * starter tool, a map given by the tutorial) or an item nothing makes.
 */
function sourceRule(world, reach, itemId) {
    const key = itemKey(itemId);
    const making = world.rules.filter(r => PRODUCING.has(r.how) && r.gives.some(g => g.key === key && g.perCycle > 0));
    if (!making.length) return null;
    const anchor = world.items[itemId]?.valueSource;
    if (anchor) {
        const hit = making.find(r => r.via === tokenKey(anchor) || r.via === recipeKey(anchor));
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

/**
 * The ledger over a whole workspace or `data/`: the world, every entry's reach, and a tree (with its
 * figures) for any item asked.
 *
 * @returns {{ world, reach, reachOf(key), pathOf(key), treeOf(itemId) }}
 */
export function buildLedger(content, { luckBelow = LUCK_BELOW, cycleTimeOf = null, bountyMapChance = BOUNTY_MAP_CHANCE } = {}) {
    const world = buildWorld(content, { bountyMapChance });
    const reach = computeReach(world, { luckBelow });
    return {
        world,
        reach,
        reachOf: (key) => reach.get(key) ?? null,
        pathOf: (key) => describePath(reach, key, { luckBelow }),
        treeOf: (itemId) => {
            const tree = ingredientTree(world, reach, itemId, { cycleTimeOf });
            return { tree, ...treeSummary(tree, reach) };
        }
    };
}
