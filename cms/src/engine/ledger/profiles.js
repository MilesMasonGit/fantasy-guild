// the progression ledger's profiles: the boosts a Bare, a Typical and a Maxed player bring to each piece of work

import { statementsOf, KEYWORD } from '../../../../src/systems/effects/statements.js';
import { EFFECT_TYPES } from '../../../../src/systems/effects/constants.js';
import { expandBearer } from '../../../../src/systems/effects/effectLibrary.js';
import { reachOf, reachCovers, RELATION } from '../../../../src/config/registries/reachRegistry.js';
import { targetModeMatches, matchesFilters, FILTER_NEEDS } from '../../../../src/config/registries/filterRegistry.js';
import { respawnOf, growsTermsOf, campOf, fieldOf } from '../../../../src/config/registries/tokenConstants.js';
import { toolOf, toolMeets, toolItemFor } from '../../../../src/config/registries/toolKinds.js';
import { spotOf, arrivesByItself, spotRateOf } from '../../../../src/config/registries/fishingSpots.js';
import { getCategoryDef } from '../../../../src/config/registries/equipmentCategories.js';
import { isSpentCategory, isWorkMoment, workSkillMatches, doseKindsOf, DOSE } from '../../../../src/systems/core/consumableRule.js';
import { FACTOR, WORK } from './rates.js';
import { hallTracksOf, hallGraph, freeRanks, openingPath, starRulesOf, starMovesLap, RATE_AXES } from './hall.js';

/**
 * Three players the pace is read for, each a choice of boosts on every piece of work (owner,
 * 2026-10-29):
 *
 * - **Bare**: the levels and the basic tools. Only what the work needs to run at all: the
 *   neighbour its regrowth or refill needs (a Stump regrows only beside its Forest), the camp that
 *   spawns an enemy. One hero on one copy, the lowest tool that answers.
 * - **Typical**: a sensible investor. A building, a camp, a better tool or worn gear is taken when
 *   it pays for itself within the settings' payback time (its price, gathered at Bare rates, over
 *   the hours it saves an hour); a drink or a work potion when it pays for itself as it is drunk
 *   (the time it saves is worth more than the time spent making it). Chosen one at a time, the best
 *   payback first, each against what is already chosen.
 * - **Maxed**: every boost the stage offers that lifts the rate, whatever it costs: every support
 *   once, the camp, the best tool, the best drink or work potion (a hero holds one), the best gear for
 *   each slot, every Guild Hall rank. Only what the guild can make by then is on offer.
 *
 * Whether the guild can feed a boost (make enough of what the boosted work spends) is weighed on
 * the supply of the profile below ({@link FED_AS}): Typical on Bare's, Maxed on Typical's. The
 * work's materials are gathered by as many heroes as it needs (`pace.js`); a drink or a potion is
 * brewed by one, and one the guild cannot make fast enough starves its work and lifts nothing.
 *
 * **The Guild Hall** (brief 320): a star's ranks are on offer to every work its rules reach (its
 * skill, its Token, a Passive Production line at the Hall), a rank only from the tier the owner gave
 * it and only once its price can be had. Bare holds none (only the ranks a new guild holds, `hall.freeRanks`).
 * Typical takes a rank when it pays for itself within the payback curve at the level its tier opens
 * at (`hallHorizonHours`, where a building or a tool has two hours) **at Typical**: the hours to
 * gather its price at Typical rates against the hours it saves an hour of the work (its share of the
 * work's worth an hour; at the Hall, the hours its lines would take to gather). The price is gathered
 * at Typical's rates **before the Hall** ({@link BEFORE_HALL}): what a star boosts never prices the
 * star, so the pricing cannot loop. A star still closed by the neighbour rule is opened the cheapest
 * way: the stars on the way are lit at rank 1 and their price added. Maxed takes every rank.
 *
 * Milestone perks come with levels, so all three have them, read at the hero's level: the work's own
 * gate unless a `level` is asked, so a perk above the gate counts only where the pace asks for it (its
 * level tracks rate each level band at the band's perk level). Only boosts reachable by the stage
 * asked (`cap`) are on offer. A boost's value is what it adds an hour: the items' worth (each at
 * the Bare hours one takes to make, inputs and drinks taken off) plus XP (an hour's worth at the
 * rate before it).
 *
 * **A work site** (BALANCE_RULES sections 5 and 8): a camp works `campNodes` nodes in
 * turn (a vein, a Field: the layout's), or, for a node of a spawner's family (a Forest's trees, an
 * Orchard's, a Quarry's outcrops), the whole allowance of each of the layout's `campSpawners`
 * spawners, and stands within reach of them, so its own rules reach them too (a Sawmill's double
 * loot, a Mine Head's quicker rest). The site's `sitePlaces.places` hold its camp, its spawners and
 * every node it works, the one worked among them ({@link placesTaken}); the rest hold buildings, at most
 * `sitePlaces.buildings`, at most `sitePlaces.perKind` of them boosting one kind (speed, XP, yield
 * or rare finds, {@link supportKinds}), and the same building may stand in several of them: each
 * copy is chosen as any boost is, Typical's when it pays back, Maxed's while it lifts the rate and
 * the site has room. A neighbour the work needs that is not its spawner takes no place.
 *
 * Pure: reads only the rate book and what it is handed.
 */

export const PROFILE = Object.freeze({ BARE: 'bare', TYPICAL: 'typical', MAXED: 'maxed' });
/** Typical's choices with the Guild Hall left out: the rates a Hall rank's price is gathered at. Never shown. */
export const BEFORE_HALL = 'typical-before-hall';
export const PROFILES = Object.freeze([PROFILE.BARE, PROFILE.TYPICAL, PROFILE.MAXED]);

/**
 * The profile whose supply a profile weighs a boost's feed against: the one below, as a Hall rank's
 * price is gathered before the Hall. What a profile chooses never feeds its own choosing.
 * ⚠️ At a profile's own supply the choices loop through the drinks (a drink brewed from what the
 * work it boosts gathers): a choice made inside a loop reads a stand-in for the supply, is kept,
 * and so depends on which question was asked first.
 */
const FED_AS = Object.freeze({ [PROFILE.TYPICAL]: PROFILE.BARE, [BEFORE_HALL]: PROFILE.BARE, [PROFILE.MAXED]: PROFILE.TYPICAL });
export const PROFILE_TEXT = Object.freeze({ bare: 'Bare', typical: 'Typical', maxed: 'Maxed' });

/** How a boost is grouped in the per-skill breakdown and the boost targets. */
export const BOOST_KIND = Object.freeze({
    SUPPORT: 'support',
    CAMP: 'camp',
    CONSUMABLE: 'consumable',
    TOOL: 'tool',
    GEAR: 'gear',
    PERK: 'perk',
    HALL: 'hall',
    RARE_CONSUMABLE: 'rareConsumable',
    RARE_SUPPORT: 'rareSupport'
});
export const BOOST_KINDS = Object.freeze(Object.values(BOOST_KIND));
export const BOOST_KIND_TEXT = Object.freeze({
    support: 'Buildings', camp: 'Camps', consumable: 'Consumables', tool: 'Tools', gear: 'Gear', perk: 'Perks', hall: 'Guild Hall',
    rareConsumable: 'Rare-find potions', rareSupport: 'Rare Finds buildings'
});

/**
 * A consumable or building that only raises rare finds is a boost kind of its own, with its own
 * strength target (owner, 2026-11-07: a rare-find potion doubles finds, a Rare Finds building adds
 * x1.5), measured on the finds alone rather than on the work's whole worth.
 */
const RARE_FIND_KIND = Object.freeze({ [BOOST_KIND.CONSUMABLE]: BOOST_KIND.RARE_CONSUMABLE, [BOOST_KIND.SUPPORT]: BOOST_KIND.RARE_SUPPORT });
export const RARE_FIND_KINDS = Object.freeze(new Set(Object.values(RARE_FIND_KIND)));

/** Whether a rate's factor (`rates.js`) moves rare finds and nothing else: Lucky alone. */
export function isRareFindFactor(factor) {
    const axes = list(factor?.axes);
    return axes.length > 0 && axes.every(a => a === EFFECT_TYPES.LUCKY);
}

/**
 * The boost kind a profile's pick is counted under: its own, or its rare-find kind when, on the
 * profile's rate, its factor moves rare finds alone.
 */
export function pickKindOf(pick, rate) {
    const rare = RARE_FIND_KIND[pick?.kind];
    if (rare && isRareFindFactor(list(rate?.factors).find(f => f.id === pick.factor))) return rare;
    return pick?.kind;
}

/**
 * A hero holds one drink-type consumable at a time (owner, 2026-11-26): a drink, a work potion or an
 * elixir share one place. Poisons, bait, arrows and Motes are not boosts and are not held this way.
 * ⚠️ The game itself still lets a hero hold a drink beside any number of potions.
 */
const DOSE_SLOT = 'dose';
const HELD_DOSES = new Set([DOSE.DRINK, DOSE.POTION, DOSE.ELIXIR]);

/** The nodes a camp hands one hero by default: the sparse layout's (`settings.layouts`). */
const DEFAULT_CAMP_NODES = 2;

/** The spawners a site worked from one stands by default: the sparse layout's (`settings.layoutSpawners`). */
const DEFAULT_CAMP_SPAWNERS = 1;

/** A site's places by default (`settings.sitePlaces`). */
const DEFAULT_SITE_PLACES = Object.freeze({ places: 12, buildings: 8, perKind: 4 });

/** A spawner's allowance: the most of its family it keeps standing, at least one. */
function allowanceOf(book, id) {
    const n = Math.floor(Number(book.token(id)?.spawner?.allowance));
    return n >= 1 ? n : 1;
}

/**
 * The nodes a camp hands one hero at a work, and the spawners standing for them, for a layout's
 * `nodes` and `spawners`: a node of a spawner's family comes only by its spawner's allowance, so a
 * site worked from one counts each spawner's whole allowance (owner, 2026-11-26); fights take no camp.
 */
export function campNodesOf(book, ctx, { nodes, spawners }) {
    if (ctx?.family && ctx.kind !== WORK.FIGHT) return { nodes: spawners * allowanceOf(book, ctx.family), spawners };
    return { nodes, spawners: 0 };
}

/** The kind of boost each axis a building moves on a work is counted under, for the site's places a kind. */
const AXIS_KIND = Object.freeze({
    [EFFECT_TYPES.WORK_TIME]: 'speed', [EFFECT_TYPES.GROW_TIME]: 'speed',
    [EFFECT_TYPES.XP_BONUS]: 'xp',
    [EFFECT_TYPES.YIELD]: 'yield', [EFFECT_TYPES.DOUBLE_DROP]: 'yield', [EFFECT_TYPES.LOOT_MULT]: 'yield', [EFFECT_TYPES.CROP_LOAD]: 'yield',
    [EFFECT_TYPES.GIANT_HARVEST]: 'yield', [EFFECT_TYPES.INPUT_COST]: 'yield', [EFFECT_TYPES.FAIL_CHANCE]: 'yield', [EFFECT_TYPES.CATCH_WEIGHT]: 'yield',
    [EFFECT_TYPES.LUCKY]: 'rare', [EFFECT_TYPES.BONUS_DROP]: 'rare'
});

/** The copies of a support a setup names. */
function copiesIn(setup, id) {
    let n = 0;
    for (const e of list(setup.supports)) {
        if (typeof e === 'string') { if (e === id) n += 1; continue; }
        if (isObject(e) && e.id === id) n += Math.max(0, Math.floor(Number(e.count ?? 1)));
    }
    return n;
}

/** A setup with one more copy of a support standing by the work: its entry counted up, or a new one. */
function withCopy(setup, id) {
    const supports = list(setup.supports);
    const at = supports.findIndex(e => (typeof e === 'string' ? e : e?.id) === id);
    if (at < 0) return { ...setup, supports: [...supports, id] };
    const next = [...supports];
    next[at] = { id, count: copiesIn({ supports: [supports[at]] }, id) + 1 };
    return { ...setup, supports: next };
}

const AMBIENT = new Set([KEYWORD.PROVIDES, KEYWORD.GRANTS]);

/** The axes worn gear can move on a piece of work. */
const WORK_AXES = new Set([
    EFFECT_TYPES.WORK_TIME, EFFECT_TYPES.YIELD, EFFECT_TYPES.XP_BONUS, EFFECT_TYPES.LOOT_MULT, EFFECT_TYPES.DOUBLE_DROP,
    EFFECT_TYPES.INPUT_COST, EFFECT_TYPES.FAIL_CHANCE, EFFECT_TYPES.BONUS_DROP, EFFECT_TYPES.CATCH_WEIGHT, EFFECT_TYPES.GROW_TIME
]);
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

/** A boost's factor id, as `rates.js` names it (`support:token_copper_mine`). */
export function factorId(kind, id) {
    const prefix = kind === BOOST_KIND.SUPPORT ? FACTOR.SUPPORT : kind === BOOST_KIND.CONSUMABLE ? FACTOR.CONSUMABLE
        : kind === BOOST_KIND.TOOL ? FACTOR.TOOL : kind === BOOST_KIND.GEAR ? FACTOR.GEAR : kind;
    return `${prefix}:${id}`;
}

/** The boost kind of a factor id from a rate's factor list. */
export function boostKindOf(factor) {
    const kind = typeof factor === 'string' ? factor.split(':')[0] : factor?.kind;
    if (kind === FACTOR.SUPPORT) return BOOST_KIND.SUPPORT;
    if (kind === FACTOR.CONSUMABLE) return BOOST_KIND.CONSUMABLE;
    if (kind === FACTOR.TOOL) return BOOST_KIND.TOOL;
    if (kind === FACTOR.GEAR) return BOOST_KIND.GEAR;
    if (kind === FACTOR.PERK) return BOOST_KIND.PERK;
    if (kind === FACTOR.HALL || kind === FACTOR.GUILD) return BOOST_KIND.HALL;
    return null;
}

/** Whether a support's ambient rules can reach a Token of this type at all (a loose test, before the calculator's exact one). */
function mayReach(supportDef, targetDefs) {
    return statementsOf(supportDef).some(s => AMBIENT.has(s?.keyword) && !s?.when?.event
        && (reachCovers(reachOf(s), RELATION.NEARBY) || reachCovers(reachOf(s), RELATION.DISTANT))
        && targetDefs.some(def => targetModeMatches(s.to, def)));
}

/** The Token types a worked Token passes through as it comes back (a tree's stump and sapling). */
function chainOf(book, def) {
    const out = [def];
    const respawn = respawnOf(def);
    let at = respawn?.mode === 'regrow' ? respawn.into : null;
    for (let step = 0; step < 8 && at && at !== def.id; step++) {
        const stepDef = book.token(at);
        if (!stepDef) break;
        out.push(stepDef);
        at = stepDef.grows?.into;
    }
    return out;
}

/** The spawner whose family a Token belongs to: it spawns the Token, or something that grows into it. */
function familySpawnerOf(book, def, spawners) {
    for (const id of spawners) {
        const spawns = list(book.token(id).spawner?.spawns).map(s => s.typeId).filter(Boolean);
        for (const start of spawns) {
            let at = start;
            for (let step = 0; step < 8 && at; step++) {
                if (at === def.id) return id;
                at = book.token(at)?.grows?.into;
            }
        }
    }
    return null;
}

/**
 * The choices one profile makes for each piece of work.
 *
 * @param {object} book  `buildRateBook(content)`
 * @param {object} options
 * @param {(key: string) => number|null} options.tierOf  the tier an entry (`token:id`, `item:id`) is first reachable at
 * @param {(itemId: string, cap: number) => number} options.unitHours  Bare hours one of an item takes to make (Infinity: none made)
 * @param {(key: string, cap: number) => number} options.costHours  Bare hours to get one more of a Token (a support, a camp)
 * @param {(cap: number) => number} options.horizonHours  how soon a one-off boost must pay for itself
 * @param {(cap: number, tier: number|null) => number} [options.hallHorizonHours]  how soon a Guild Hall rank of a tier
 *   must at a stage; the boosts' when absent
 * @param {(rate: object, cap: number, profile: string) => number} [options.inputScale]  the share of a rate
 *   the guild can feed at that profile (its materials in full where anything makes them, what its
 *   boosts spend by one hero on each): a boost that starves its work is worth that much less
 * @param {number} [options.campNodes]  the nodes a camp hands one hero (a vein, a Field)
 * @param {number} [options.campSpawners]  the spawners a site worked from one stands, each with its whole allowance (a Forest's trees)
 * @param {{ places: number, buildings: number, perKind: number }} [options.sitePlaces]  a work site's places round the node, the most
 *   that hold buildings, and the most boosting one kind
 * @param {(itemId: string, cap: number) => number} [options.hallUnitHours]  hours one of an item takes
 *   to gather at Typical before the Hall (a Hall rank's price); Bare's when absent
 * @param {(coins: number, cap: number) => number} [options.hallCoinHours]  hours `coins` take to earn at
 *   Typical before the Hall (a Hall rank's coins); never asked of a rank that asks none
 * @param {number|null} [options.batchPayback]  Typical (and Typical before the Hall) takes a drink or work
 *   potion on repeatable work only where its batch saves at least this many times its making
 *   ({@link batchPaybackOf}); none asked when null
 */
export function buildProfiles(book, {
    tierOf, unitHours, costHours, horizonHours, hallHorizonHours = horizonHours, inputScale = () => 1, campNodes = DEFAULT_CAMP_NODES,
    campSpawners = DEFAULT_CAMP_SPAWNERS, sitePlaces = DEFAULT_SITE_PLACES, hallUnitHours = unitHours, hallCoinHours = () => Infinity,
    batchPayback = null
}) {
    const site = { ...DEFAULT_SITE_PLACES, ...sitePlaces };
    const tokenIds = book.tokenIds();
    const supports = tokenIds.filter(id => {
        const def = book.token(id);
        return !isObject(def.enemy) && !isObject(def.foundation) && statementsOf(def).some(s => AMBIENT.has(s?.keyword) && !s?.when?.event);
    });
    const camps = tokenIds.filter(id => campOf(book.token(id)));
    // A Token that brings fishing spots more often in its reach (a Chum Station): a support of the spots that arrive by themselves.
    const raisers = tokenIds.filter(id => {
        const def = book.token(id);
        return !isObject(def.enemy) && !isObject(def.foundation) && spotRateOf(def) > 0;
    });
    const spawners = tokenIds.filter(id => isObject(book.token(id).spawner));
    const items = Object.values(book.items).filter(isObject);
    const withEffects = items.filter(def => list(def.effects).length);
    const consumables = withEffects.filter(def => isSpentCategory(def.equipSlot));
    const worksOnWork = (def) => statementsOf(expandBearer(def, book.library)).some(s =>
        AMBIENT.has(s?.keyword) && !s?.when?.event && WORK_AXES.has(s.payload?.type));
    const gear = withEffects.filter(def => !isSpentCategory(def.equipSlot) && !toolOf(def) && worksOnWork(def));
    const tools = items.filter(def => toolOf(def));
    const tiers = { token: new Map(), item: new Map() };
    const tierBy = (kind, id) => {
        const kept = tiers[kind];
        if (kept.has(id)) return kept.get(id);
        const tier = tierOf(`${kind}:${id}`);
        kept.set(id, tier);
        return tier;
    };
    const tokenTier = (id) => tierBy('token', id);
    const itemTier = (id) => tierBy('item', id);
    const within = (tier, cap) => Number.isInteger(tier) && tier <= cap;
    const tracks = hallTracksOf(book);
    const trackById = new Map(tracks.map(t => [t.id, t]));
    const graph = hallGraph(tracks);

    const contexts = new Map();
    /** What a piece of work needs to run and every boost that may reach it, before any stage is asked. */
    function contextOf(target) {
        const key = targetKey(target);
        if (contexts.has(key)) return contexts.get(key);
        const def = book.token(target.token);
        const kind = book.workKindOf(target).kind ?? null;
        const ctx = { key, target, kind, def, skill: null, required: [], family: null, camps: [], supports: [], consumables: [], gear: [], tools: [], hall: [] };
        contexts.set(key, ctx);
        if (kind === WORK.PASSIVE) {
            // The Guild Hall's Passive Production grows with its stars' lines (the Wishing Well's Water and the rest) and a shorter lap.
            ctx.hall = tracks.filter(t => t.star.ranks.some(r => r.lines.length) || starMovesLap(t.star));
            return ctx;
        }
        if (!def || !kind) return ctx;
        const probe = book.rateOf(target, {});
        ctx.skill = probe.skill ?? null;
        ctx.gate = probe.gates?.needed ?? 1;
        const chain = chainOf(book, def);
        const made = new Set([...Object.keys(probe.perCycle || {}), ...Object.keys(probe.items || {})]);
        ctx.hall = tracks.filter(t => starReaches(t.star, ctx.skill, chain, made));
        if (kind === WORK.FIGHT) {
            ctx.family = familySpawnerOf(book, def, spawners);
            return ctx;
        }

        // What it needs to come back at all: the neighbour of its refill, or of any step of its regrowth.
        const respawn = respawnOf(def);
        const needs = [...(respawn?.mode === 'refill' ? respawn.needsNearby : []), ...chain.slice(1).flatMap(step => growsTermsOf(step).needsNearby)];
        ctx.family = familySpawnerOf(book, def, spawners);
        for (const id of new Set(needs)) if (book.token(id)) ctx.required.push(id);
        if (ctx.family && !ctx.required.includes(ctx.family) && needs.length === 0) {
            // A family's spawner stands among its trees anyway: its rules reach them.
            ctx.required.push(ctx.family);
        }

        const comesBack = respawn?.mode === 'refill' || respawn?.mode === 'regrow' || kind === WORK.FIELD;
        if (ctx.skill && (kind === WORK.GATHER || kind === WORK.WATER || kind === WORK.FIELD) && (comesBack || kind === WORK.WATER)) {
            ctx.camps = camps.filter(id => campOf(book.token(id)).skill === ctx.skill && (kind !== WORK.FIELD || !!fieldOf(def)));
        }
        const reachable = chain.length ? chain : [def];
        ctx.supports = supports.filter(id => !ctx.required.includes(id) && !camps.includes(id) && mayReach(book.token(id), reachable));
        if (kind === WORK.WATER && arrivesByItself(spotOf(def))) for (const id of raisers) if (!ctx.supports.includes(id)) ctx.supports.push(id);
        if (ctx.skill) {
            ctx.consumables = consumables.filter(item => statementsOf(expandBearer(item, book.library)).some(s =>
                s?.keyword === KEYWORD.APPLIES && isWorkMoment(s.when?.event) && workSkillMatches(s.when, ctx.skill))).map(i => i.id);
            ctx.gear = gear.map(i => i.id);
            const need = probe.gates?.need;
            ctx.tools = need ? tools.filter(t => toolMeets(toolOf(t), need)).map(t => t.id) : [];
            ctx.baseTool = need ? toolItemFor(need, book.items) : null;
        }
        return ctx;
    }

    const kindsMemo = new Map();
    /**
     * The kinds of boost a building moves on a piece of work, for the site's places a kind: the axes
     * of its ambient rules that may reach the work (its Token or a step of its regrowth, narrowed to
     * nothing, the work's skill or an item), each counted under its kind ({@link AXIS_KIND}); a
     * fishing-spot raiser's, speed (its spots come sooner). Empty when none is one the budget counts.
     */
    function supportKinds(ctx, id) {
        const key = `${ctx.key}|${id}`;
        if (kindsMemo.has(key)) return kindsMemo.get(key);
        const def = book.token(id);
        const targets = chainOf(book, ctx.def);
        const kinds = new Set();
        for (const s of statementsOf(def)) {
            if (!AMBIENT.has(s?.keyword) || s?.when?.event || !AXIS_KIND[s.payload?.type]) continue;
            if (!targets.some(t => targetModeMatches(s.to, t))) continue;
            const cat = s.payload.category;
            if (cat && cat !== 'all' && cat !== ctx.skill && !book.items[cat]) continue;
            kinds.add(AXIS_KIND[s.payload.type]);
        }
        if (spotRateOf(def) > 0) kinds.add('speed');
        const out = Object.freeze([...kinds].sort());
        kindsMemo.set(key, out);
        return out;
    }

    /** The nodes a camp hands one hero at a work in the layout timed, and the spawners standing for them ({@link campNodesOf}). */
    const siteNodesOf = (ctx) => campNodesOf(book, ctx, { nodes: campNodes, spawners: campSpawners });

    /**
     * The places a work site's own Tokens take (BALANCE_RULES section 5: a gathering site spends 6 or
     * 7 of its 12 on its camp, its spawner and its 4 or 5 nodes): where a camp may work it, the camp,
     * the layout's spawners and every node it works, the one worked among them (a vein's camp and its
     * five veins; a Logging Camp, its Forest and the Forest's four trees); else the work's own spawner
     * and its whole allowance, or none. Counted the same whether or not a profile has its camp yet.
     */
    function placesTaken(ctx) {
        if (ctx.camps.length) {
            const own = siteNodesOf(ctx);
            return 1 + own.spawners + own.nodes;
        }
        if (ctx.family && ctx.kind !== WORK.FIGHT) return 1 + allowanceOf(book, ctx.family);
        return 0;
    }

    /** A work site's building places: what its own Tokens leave of the places round it, at most `sitePlaces.buildings`. */
    const roomOf = (ctx) => Math.max(0, Math.min(site.buildings, site.places - placesTaken(ctx)));

    /**
     * Whether a work site has a place for one more copy of a building: fewer buildings than its
     * building places ({@link roomOf}), and fewer than the most a kind may hold boosting each kind the
     * building moves. The neighbour the work needs is not a building.
     */
    function siteHasRoom(ctx, setup, offer) {
        let total = 0;
        const byKind = {};
        for (const id of ctx.supports) {
            const n = copiesIn(setup, id);
            if (!n) continue;
            total += n;
            for (const k of supportKinds(ctx, id)) byKind[k] = (byKind[k] || 0) + n;
        }
        if (total >= roomOf(ctx)) return false;
        return offer.kinds.every(k => (byKind[k] || 0) < site.perKind);
    }

    /** The setup every profile starts from: what the work needs to run, one copy, the lowest tool, the Hall ranks a new guild holds. */
    function bareSetup(ctx, cap, level) {
        const setup = { supports: ctx.required.filter(id => within(tokenTier(id), cap) || tokenTier(id) === null) };
        if (ctx.hall.length) setup.hallRanks = Object.fromEntries(ctx.hall.map(t => [t.id, freeRanks(t)]));
        if (level) setup.level = level;
        if (ctx.family) setup.family = ctx.kind === WORK.FIGHT ? { spawner: ctx.family } : { spawner: ctx.family, members: 1 };
        if (ctx.baseTool) setup.tool = ctx.baseTool;
        return setup;
    }

    /** Every boost on offer for a piece of work at a stage, each as a change to a setup. */
    function offers(ctx, cap) {
        const out = [];
        for (const t of ctx.hall) {
            for (let rank = freeRanks(t) + 1; rank <= t.maxRank; rank++) {
                if (!rankWithin(t, rank, cap)) break;
                out.push({
                    kind: BOOST_KIND.HALL, id: `${t.id}:${rank}`, factor: factorId(BOOST_KIND.HALL, t.id), oneOff: true, rank, price: t.price(rank), after: rank - 1, upgrade: t.id,
                    apply: (s) => withRanks(s, { [t.id]: rank })
                });
            }
        }
        for (const id of ctx.supports) {
            if (!within(tokenTier(id), cap)) continue;
            out.push({ kind: BOOST_KIND.SUPPORT, id, factor: factorId(BOOST_KIND.SUPPORT, id), oneOff: true, kinds: supportKinds(ctx, id), apply: (s) => withCopy(s, id) });
        }
        for (const id of ctx.camps) {
            if (!within(tokenTier(id), cap)) continue;
            const family = ctx.family ? { spawner: ctx.family } : undefined;
            // The camp stands by the nodes it works, so its own rules reach them; a hero works from one camp, so it takes another's place.
            const members = siteNodesOf(ctx).nodes;
            out.push({
                kind: BOOST_KIND.CAMP, id, factor: factorId(BOOST_KIND.SUPPORT, id), oneOff: true, camp: true,
                apply: (s) => ({
                    ...s, supports: [...list(s.supports).filter(e => !ctx.camps.includes(typeof e === 'string' ? e : e?.id)), id],
                    camp: { id, members }, ...(family ? { family } : {})
                })
            });
        }
        for (const id of ctx.tools) {
            if (id === ctx.baseTool || !within(itemTier(id), cap)) continue;
            out.push({ kind: BOOST_KIND.TOOL, id, factor: factorId(BOOST_KIND.TOOL, id), oneOff: true, slot: 'tool', apply: (s) => ({ ...s, tool: id }) });
        }
        for (const id of ctx.consumables) {
            if (!within(itemTier(id), cap)) continue;
            const def = book.items[id];
            const slot = def?.equipSlot;
            const held = doseKindsOf(slot, statementsOf(expandBearer(def, book.library))).some(k => HELD_DOSES.has(k));
            const capped = getCategoryDef(slot)?.cap === 1;
            out.push({ kind: BOOST_KIND.CONSUMABLE, id, factor: factorId(BOOST_KIND.CONSUMABLE, id), oneOff: false, slot: held ? DOSE_SLOT : capped ? slot : null, apply: (s) => ({ ...s, consumables: [...(s.consumables || []), id] }) });
        }
        for (const id of ctx.gear) {
            if (!within(itemTier(id), cap)) continue;
            out.push({ kind: BOOST_KIND.GEAR, id, factor: factorId(BOOST_KIND.GEAR, id), oneOff: true, slot: book.items[id]?.equipSlot || null, apply: (s) => ({ ...s, gear: [...(s.gear || []), id] }) });
        }
        return out;
    }

    /**
     * What a rate is worth an hour to a profile choosing for it, in Bare hours: its items less what it
     * spends (`gross`: not less), plus its XP against a base rate, as much of it as the guild can feed
     * at the profile below ({@link FED_AS}).
     */
    function valueOf(rate, cap, baseXp, { gross = false, profile = PROFILE.BARE } = {}) {
        if (!rate?.ok) return 0;
        let worth = 0;
        for (const [item, n] of Object.entries(rate.items || {})) {
            const h = unitHours(item, cap);
            if (Number.isFinite(h)) worth += n * h;
        }
        for (const [item, n] of Object.entries(rate.inputs || {})) {
            if (!(n > 0)) continue;
            const h = unitHours(item, cap);
            // An input nobody can make at this stage cannot be spent: the setup does not run.
            if (!Number.isFinite(h)) return -Infinity;
            if (!gross) worth -= n * h;
        }
        const xp = Object.values(rate.xp || {}).reduce((a, b) => a + b, 0);
        return (worth + (baseXp > 0 ? xp / baseXp : 0)) * inputScale(rate, cap, FED_AS[profile] ?? PROFILE.BARE);
    }

    /** A boost's price in Bare hours: a support or camp as its Token is had, a tool or gear as one is made. */
    function priceOf(offer, cap) {
        if (offer.kind === BOOST_KIND.SUPPORT || offer.kind === BOOST_KIND.CAMP) return costHours(`token:${offer.id}`, cap);
        return unitHours(offer.id, cap);
    }

    // ── the Guild Hall ─────────────────────────────────────────────────────────────────────────

    /** Whether a track's rank is on offer at a stage: its tier reached and its price had by then. */
    function rankWithin(track, rank, cap) {
        const tier = track.tier(rank);
        if (tier !== null && tier > cap) return false;
        return track.price(rank).every(p => within(itemTier(p.itemId), cap));
    }

    /** Hours to gather a Hall price at Typical before the Hall: one hero's hours on each item, added, and on its coins. */
    function hallPriceHours(price, cap, coins = 0) {
        const items = price.reduce((sum, p) => sum + p.quantity * hallUnitHours(p.itemId, cap), 0);
        return coins > 0 ? items + hallCoinHours(coins, cap) : items;
    }

    /** A track's rank in a setup, its free ranks counted. */
    function heldRank(setup, id) {
        return Math.max(Math.floor(Number(setup.hallRanks?.[id]) || 0), freeRanks(trackById.get(id)));
    }

    /** What lighting a track (its rank 1) costs at a stage, in hours at Typical before the Hall. */
    function lightCost(id, cap) {
        const t = trackById.get(id);
        if (!t || !rankWithin(t, 1, cap)) return Infinity;
        return hallPriceHours(t.price(1), cap, t.coins(1));
    }

    /**
     * A Hall rank taken on a setup: `{ next, price, path }`, the setup with the rank (with the ranks
     * below it not yet held, and the stars its neighbour gate needs lit first, `path`), and the
     * price of all of them in hours; null when it is held already or no star on the way can be had.
     * A rank below that gives this work nothing (the XP floor can make two ranks equal) is bought
     * on the way to the one above, as a player buying for that one would.
     */
    function hallStep(setup, offer, cap) {
        const held = heldRank(setup, offer.upgrade);
        if (held >= offer.rank) return null;
        const track = trackById.get(offer.upgrade);
        let next = offer.apply(setup);
        let price = 0;
        for (let r = held + 1; r <= offer.rank; r++) price += hallPriceHours(track.price(r), cap, track.coins(r));
        let path = [];
        if (held === 0) {
            const opening = openingPath(offer.upgrade, graph, (id) => heldRank(setup, id), (id) => lightCost(id, cap));
            if (!opening) return null;
            path = opening.path;
            price += opening.cost;
            if (path.length) next = withRanks(next, Object.fromEntries(path.map(id => [id, 1])));
        }
        return { next, price, path };
    }

    /**
     * The hours a Hall rank saves an hour of a work, from one rate to the next: at the Hall, the hours
     * its new lines would take to gather at Typical before the Hall; on other work, its share of the
     * work's worth an hour (what it makes, at its gross, and its XP).
     */
    function hallSaves(ctx, r0, r1, cap, baseXp, profile) {
        if (!r0?.ok || !r1?.ok) return 0;
        let saves = 0;
        if (ctx.kind === WORK.PASSIVE) {
            for (const item of new Set([...Object.keys(r0.items || {}), ...Object.keys(r1.items || {})])) {
                const d = (r1.items?.[item] || 0) - (r0.items?.[item] || 0);
                if (d > 0) saves += d * hallUnitHours(item, cap);
            }
        } else {
            const v0 = valueOf(r0, cap, baseXp, { gross: true, profile });
            const v1 = valueOf(r1, cap, baseXp, { gross: true, profile });
            saves = v0 > 0 ? v1 / v0 - 1 : 0;
        }
        // Float noise from a rate the rank did not move is no saving (it would price a payback of millennia).
        return saves > 1e-9 ? saves : 0;
    }

    /**
     * A drink or work potion's batch payback on this work as Typical weighs it, from the setup it holds
     * to the same with the dose ({@link batchPaybackOf}); null where it is not held to it (a build, a
     * fight or Passive Production) or there is none. Each one goes in `judged`, the last for a dose
     * standing (one that saves nothing there clears it): the batch-payback check reads these, so the
     * check and Typical never measure apart.
     */
    function judgeBatch(ctx, r0, r1, id, cap, judged) {
        if (!(batchPayback > 0) || !repeatedByHero(ctx.kind)) return null;
        const b = batchPaybackOf(r0, r1, id, (item) => unitHours(item, cap));
        if (b) judged.set(id, b);
        else judged.delete(id);
        return b;
    }

    /** Slots that hold one: a second offer for a full slot replaces nothing and is skipped. */
    function slotFull(chosen, offer) {
        if (!offer.slot) return false;
        if (offer.slot === 'tool' || offer.slot === DOSE_SLOT) return chosen.some(c => c.slot === offer.slot);
        const cap = getCategoryDef(offer.slot)?.cap;
        if (!Number.isFinite(cap)) return false;
        return chosen.filter(c => c.slot === offer.slot).length >= cap;
    }

    const memo = new Map();
    const busy = new Set();
    /**
     * One profile's setup for a piece of work at a stage: `{ setup, rate, chosen }`, `chosen` each boost
     * taken with why (`payback` hours for a one-off, `gain` an hour for one drunk as it is used).
     * Maxed starts from Typical's choices. Pricing a boost reads the supply of its inputs at the
     * profile below ({@link FED_AS}), so no profile's choice reads its own profile's choices.
     */
    function profileOf(target, profile, cap, level = null) {
        const ctx = contextOf(target);
        const key = `${ctx.key}|${profile}|${cap}|${level ?? ''}`;
        if (memo.has(key)) return memo.get(key);
        // ⚠️ Never met while each profile is fed by the one below: a guard against recursing forever, not a model.
        if (busy.has(key)) return profileOf(target, PROFILE.BARE, cap, level);
        busy.add(key);
        const bare = bareSetup(ctx, cap, level);
        let setup = bare;
        // Each setup weighed is rated for its numbers alone (`numbersOf`); the one chosen is rated in full at the end.
        let rate = profile === PROFILE.BARE ? book.rateOf(target, setup) : book.numbersOf(target, setup);
        let full = profile === PROFILE.BARE ? rate : null;
        let chosen = [];
        // The drinks and potions Typical would take but for their batch payback: Maxed takes them all the same.
        const declined = [];
        const judged = new Map();
        if (profile !== PROFILE.BARE && rate.ok) {
            const baseXp = Object.values(rate.xp || {}).reduce((a, b) => a + b, 0);
            const pool = offers(ctx, cap).filter(o => profile !== BEFORE_HALL || o.kind !== BOOST_KIND.HALL);
            if (profile === PROFILE.MAXED) {
                const typical = profileOf(target, PROFILE.TYPICAL, cap, level);
                setup = typical.setup;
                rate = typical.rate;
                full = typical.rate;
                chosen = [...typical.chosen];
                // A hero holds one dose: Typical's gives up its place, and Maxed holds the one that lifts the rate most,
                // Typical's own and those it declined for their batch on offer whatever they lift.
                const typicalDose = chosen.find(c => c.slot === DOSE_SLOT);
                if (typicalDose) {
                    chosen = chosen.filter(c => c !== typicalDose);
                    const consumables = [...(setup.consumables || [])];
                    consumables.splice(consumables.indexOf(typicalDose.id), 1);
                    setup = { ...setup, consumables };
                    rate = book.numbersOf(target, setup);
                    full = null;
                }
                const endorsed = new Set([typicalDose?.id, ...typical.declined].filter(Boolean));
                const doseValue = (r) => valueOf(r, cap, baseXp, { gross: true, profile });
                let bestDose = null;
                for (const o of pool) {
                    if (o.slot !== DOSE_SLOT) continue;
                    const next = o.apply(setup);
                    const r = book.numbersOf(target, next);
                    const gain = doseValue(r) - doseValue(rate);
                    if (!(gain > 1e-9) && !endorsed.has(o.id)) continue;
                    if (!bestDose || gain > bestDose.gain) bestDose = { o, next, r, gain };
                }
                if (bestDose) {
                    setup = bestDose.next;
                    rate = bestDose.r;
                    full = null;
                    chosen.push({ kind: bestDose.o.kind, id: bestDose.o.id, factor: bestDose.o.factor, slot: DOSE_SLOT });
                }
                for (const id of typical.declined) {
                    const o = pool.find(x => x.kind === BOOST_KIND.CONSUMABLE && x.id === id);
                    if (!o || o.slot === DOSE_SLOT || slotFull(chosen, o)) continue;
                    setup = o.apply(setup);
                    rate = book.numbersOf(target, setup);
                    full = null;
                    chosen.push({ kind: o.kind, id: o.id, factor: o.factor, slot: o.slot ?? null });
                }
                // Then every boost that lifts the rate whatever it costs, the best of each one-slot kind (a drink, a tool, a hat),
                // each building in as many places as still lift it and the site has room for,
                // then every Hall rank in rank order (a rank waits for the one before it), each fed as the guild feeds Typical.
                const value = (r) => valueOf(r, cap, baseXp, { gross: true, profile });
                const taken = new Set(chosen.map(c => c.id));
                const ranked = pool.filter(o => (o.kind === BOOST_KIND.SUPPORT || !taken.has(o.id)) && o.kind !== BOOST_KIND.HALL)
                    .filter(o => o.kind !== BOOST_KIND.SUPPORT || siteHasRoom(ctx, setup, o)).map(o => {
                        const r = book.numbersOf(target, o.apply(setup));
                        return { o, gain: value(r) - value(rate) };
                    }).filter(x => x.gain > 1e-9).sort((x, y) => y.gain - x.gain);
                const hallOffers = pool.filter(o => !taken.has(o.id) && o.kind === BOOST_KIND.HALL).sort((x, y) => x.rank - y.rank);
                for (const o of [...ranked.map(x => x.o), ...hallOffers]) {
                    for (;;) {
                        if (slotFull(chosen, o)) break;
                        if (o.kind === BOOST_KIND.SUPPORT && !siteHasRoom(ctx, setup, o)) break;
                        const step = o.kind === BOOST_KIND.HALL ? hallStep(setup, o, cap) : { next: o.apply(setup), path: [] };
                        if (!step) break;
                        const r = book.numbersOf(target, step.next);
                        if (!(value(r) - value(rate) > 1e-9)) break;
                        setup = step.next;
                        rate = r;
                        full = null;
                        chosen.push({ kind: o.kind, id: o.id, factor: o.factor, slot: o.slot ?? null, ...hallPick(o, step) });
                        if (o.kind !== BOOST_KIND.SUPPORT) break;
                    }
                }
            } else {
                const horizon = horizonHours(cap);
                const hallHorizon = (o) => hallHorizonHours(cap, trackById.get(o.upgrade)?.tier(o.rank) ?? null);
                const value = (r) => valueOf(r, cap, baseXp, { profile });
                let left = [...pool];
                for (;;) {
                    const before = value(rate);
                    let best = null;
                    // A star is weighed at its next rank that saves anything (`left` holds its ranks in order); the ones above wait their turn.
                    const weighed = new Set();
                    for (const o of left) {
                        if (slotFull(chosen, o)) continue;
                        if (o.kind === BOOST_KIND.SUPPORT && !siteHasRoom(ctx, setup, o)) continue;
                        let next;
                        let r;
                        let gain;
                        let price;
                        let step = null;
                        if (o.kind === BOOST_KIND.HALL) {
                            if (weighed.has(o.upgrade)) continue;
                            step = hallStep(setup, o, cap);
                            if (!step) continue;
                            next = step.next;
                            r = book.numbersOf(target, next);
                            gain = hallSaves(ctx, rate, r, cap, baseXp, profile);
                            price = step.price;
                            if (gain > 1e-9) weighed.add(o.upgrade);
                        } else {
                            next = o.apply(setup);
                            r = book.numbersOf(target, next);
                            gain = value(r) - before;
                            // Drunk as it is used, a consumable's cost is already in the rate's inputs: any gain pays at once.
                            price = o.oneOff ? priceOf(o, cap) : 0;
                            const batch = o.kind === BOOST_KIND.CONSUMABLE ? judgeBatch(ctx, rate, r, o.id, cap, judged) : null;
                            if (gain > 1e-9 && batch && batch.ratio < batchPayback - 1e-9) {
                                if (!declined.includes(o.id)) declined.push(o.id);
                                continue;
                            }
                        }
                        if (!(gain > 1e-9)) continue;
                        const payback = price / gain;
                        if (!(payback <= (o.kind === BOOST_KIND.HALL ? hallHorizon(o) : horizon))) continue;
                        if (!best || payback < best.payback || (payback === best.payback && gain > best.gain)) best = { o, next, r, gain, payback, price, step };
                    }
                    if (!best) {
                        // A drink costs nothing up front, so it is taken first, on a nearly bare setup: judged again on
                        // the setup held now, it is dropped once its batch stops paying back, and its place offered again.
                        const short = chosen.filter(c => c.kind === BOOST_KIND.CONSUMABLE).find(c => {
                            const consumables = [...(setup.consumables || [])];
                            consumables.splice(consumables.indexOf(c.id), 1);
                            const base = { ...setup, consumables };
                            const r0 = book.numbersOf(target, base);
                            const batch = judgeBatch(ctx, r0, rate, c.id, cap, judged);
                            if (!(batch && batch.ratio < batchPayback - 1e-9)) return false;
                            setup = base;
                            rate = r0;
                            return true;
                        });
                        if (!short) break;
                        chosen = chosen.filter(c => c !== short);
                        if (!declined.includes(short.id)) declined.push(short.id);
                        continue;
                    }
                    setup = best.next;
                    rate = best.r;
                    chosen.push({ kind: best.o.kind, id: best.o.id, factor: best.o.factor, slot: best.o.slot ?? null, gain: best.gain, payback: best.payback, price: best.price, ...hallPick(best.o, best.step) });
                    // A building stays on offer for its next place.
                    if (best.o.kind !== BOOST_KIND.SUPPORT) left = left.filter(o => o !== best.o);
                }
                // A drink kept out by the one holding its place is judged on the same setup, in that one's place,
                // so no judgement it leaves is the early, nearly bare one.
                for (const o of pool) {
                    if (o.kind !== BOOST_KIND.CONSUMABLE || !o.slot || chosen.some(c => c.id === o.id) || !slotFull(chosen, o)) continue;
                    const mates = new Set(chosen.filter(c => c.slot === o.slot).map(c => c.id));
                    const base = { ...setup, consumables: (setup.consumables || []).filter(id => !mates.has(id)) };
                    judgeBatch(ctx, book.numbersOf(target, base), book.numbersOf(target, o.apply(base)), o.id, cap, judged);
                }
            }
        }
        busy.delete(key);
        const out = { setup, rate: full ?? book.rateOf(target, setup), chosen, declined: declined.filter(id => !chosen.some(c => c.id === id)), batches: judged, context: ctx };
        memo.set(key, out);
        return out;
    }

    /** A work's rate with every boost on offer at once, slots ignored: what it could ever make. Prices nothing. */
    function everythingOf(target, cap) {
        const ctx = contextOf(target);
        let setup = bareSetup(ctx, cap);
        for (const o of offers(ctx, cap)) setup = o.apply(setup);
        return book.rateOf(target, setup);
    }

    /**
     * What one Hall rank does for a work at a stage at Typical, the payback check's measure: the
     * work's Typical setup with the track at the rank before and at the rank, everything else as
     * Typical chose. `{ saves, r0, r1, setup, opening }`, `saves` the hours it saves an hour (as Typical
     * weighs a rank), `opening` what lighting the stars on the way costs when the star is still
     * closed there (`{ path, cost }`, as Typical pays it; `cost` Infinity when no way can be had);
     * null when the work is not rated there.
     */
    const rankRates = new Map();
    function hallRankOn(target, cap, trackId, rank) {
        const ctx = contextOf(target);
        const typical = profileOf(target, PROFILE.TYPICAL, cap);
        if (!typical.rate.ok) return null;
        const at = (r) => ({ ...typical.setup, hallRanks: { ...(typical.setup.hallRanks || {}), [trackId]: r } });
        // Rank r's rate after is rank r + 1's before.
        const rateAt = (r) => {
            const key = `${ctx.key}|${cap}|${trackId}|${r}`;
            if (!rankRates.has(key)) rankRates.set(key, book.rateOf(target, at(r)));
            return rankRates.get(key);
        };
        const r0 = rateAt(rank - 1);
        const r1 = rateAt(rank);
        const bare = profileOf(target, PROFILE.BARE, cap).rate;
        const baseXp = Object.values(bare.xp || {}).reduce((a, b) => a + b, 0);
        // Opening it counts the stars Typical lit only on the way to it, not those it holds for their own sake.
        const picks = typical.chosen.filter(c => c.kind === BOOST_KIND.HALL);
        const onTheWay = (picks.find(c => c.upgrade === trackId)?.path || [])
            .filter(id => !picks.some(c => c.upgrade === id || (c.upgrade !== trackId && (c.path || []).includes(id))));
        const before = at(rank - 1);
        const unlit = { ...before, hallRanks: { ...before.hallRanks, ...Object.fromEntries(onTheWay.map(id => [id, 0])) } };
        const opening = heldRank(unlit, trackId) >= 1
            ? { path: [], cost: 0 }
            : openingPath(trackId, graph, (id) => heldRank(unlit, id), (id) => lightCost(id, cap)) || { path: [], cost: Infinity };
        return { saves: hallSaves(ctx, r0, r1, cap, baseXp, PROFILE.TYPICAL), r0, r1, setup: at(rank), opening };
    }

    /**
     * The buildings a setup stands round a piece of work, in its site's places: `{ places, room,
     * taken, perKind, byKind, buildings: [{ id, count, kinds }], camp }`, `places` the copies
     * standing, `room` the site's building places, `taken` the places its camp, other nodes and
     * spawners take ({@link placesTaken}), `camp` the camp it works from, the nodes that hands it and
     * the spawners they stand for.
     */
    function siteOf(target, setup) {
        const ctx = contextOf(target);
        const buildings = [];
        const byKind = {};
        let places = 0;
        for (const id of ctx.supports) {
            const count = copiesIn(setup, id);
            if (!count) continue;
            const kinds = supportKinds(ctx, id);
            buildings.push({ id, count, kinds: [...kinds] });
            places += count;
            for (const k of kinds) byKind[k] = (byKind[k] || 0) + count;
        }
        const spawners = siteNodesOf(ctx).spawners;
        const camp = isObject(setup.camp) ? { id: setup.camp.id, nodes: setup.camp.members ?? null, spawners }
            : typeof setup.camp === 'string' ? { id: setup.camp, nodes: null, spawners } : null;
        return { places, room: roomOf(ctx), taken: placesTaken(ctx), perKind: site.perKind, byKind, buildings, camp };
    }

    return {
        contextOf, profileOf, bareSetup, offers, valueOf, everythingOf, siteOf, supportKinds,
        /** The nodes a camp hands one hero at a work for a layout's nodes and spawners ({@link campNodesOf}). */
        campNodesOf: (target, layout) => campNodesOf(book, contextOf(target), layout),
        hallTracks: tracks, hallTrack: (id) => trackById.get(id) || null, hallPriceHours, hallRankOn, rankWithin
    };
}

/** Work a hero repeats, where a batch of drinks or potions is drunk over its cycles: not a build, a fight or Passive Production. */
export const repeatedByHero = (kind) => kind !== WORK.PASSIVE && kind !== WORK.FIGHT && kind !== WORK.BUILD;

/**
 * How much better a rate is than another: the larger of its items' worth (each at the hours one
 * takes) and its XP, as a fraction (0.25 is 25 % better). What it spends is the boost's price, not
 * its strength, so it is left out.
 */
export function gainOf(r0, r1, unitHours) {
    if (!r0?.ok || !r1?.ok) return 0;
    const worth = (r) => {
        let w = 0;
        for (const [item, n] of Object.entries(r.items || {})) { const h = unitHours(item); if (Number.isFinite(h)) w += n * h; }
        return w;
    };
    const xp = (r) => Object.values(r.xp || {}).reduce((a, b) => a + b, 0);
    const w0 = worth(r0);
    const w1 = worth(r1);
    const items = w0 > 0 ? w1 / w0 - 1 : 0;
    const x0 = xp(r0);
    const xpGain = x0 > 0 ? xp(r1) / x0 - 1 : 0;
    return Math.max(items, xpGain);
}

/**
 * A drink or work potion's batch payback on one work (BALANCE_RULES section 5), from the rate
 * without it to the rate with it: `gain` the work it saves an hour ({@link gainOf}), `doses` what it
 * spends of it an hour, `doseCycles` the cycles one lasts, `unitHours` the hours one takes to make
 * with its ingredients, `spends` the hours an hour its doses take to make, and `ratio` the one over
 * the other. Null where it spends none, saves nothing, or cannot be made.
 */
export function batchPaybackOf(r0, r1, id, unitHours) {
    const doses = r1?.boostInputs?.[id] || 0;
    if (!r0?.ok || !r1?.ok || !(doses > 0)) return null;
    const unit = unitHours(id);
    if (!Number.isFinite(unit)) return null;
    const gain = gainOf(r0, r1, unitHours);
    if (!(gain > 1e-9)) return null;
    const spends = doses * unit;
    return { gain, doses, doseCycles: r1.cyclesPerHour / doses, unitHours: unit, spends, ratio: spends > 0 ? gain / spends : Infinity };
}

/** A setup with some Hall ranks raised (never lowered). */
function withRanks(setup, ranks) {
    const next = { ...(setup.hallRanks || {}) };
    for (const [id, rank] of Object.entries(ranks)) next[id] = Math.max(rank, Math.floor(Number(next[id]) || 0));
    return { ...setup, hallRanks: next };
}

/** What a chosen Hall rank carries beside the others: its rank and the ranks it set (the stars lit to open it too). */
function hallPick(offer, step) {
    if (offer.kind !== BOOST_KIND.HALL) return {};
    return {
        rank: offer.rank, upgrade: offer.upgrade, path: step?.path || [],
        hallRanks: { ...Object.fromEntries((step?.path || []).map(id => [id, 1])), [offer.upgrade]: offer.rank }
    };
}

/**
 * Whether a star's rules can move a piece of work: a rule on an axis the calculator reads, guild-wide
 * and narrowed to nothing, to the work's skill or to an item it makes, or aimed at the work's Token
 * or a step of its regrowth.
 */
function starReaches(star, skill, chain, made) {
    for (const r of starRulesOf(star)) {
        if (!RATE_AXES.has(r.type)) continue;
        if (r.aimed) {
            if (chain.some(def => targetModeMatches(r.to, def) && matchesFilters(r.to, { def }, new Set([FILTER_NEEDS.DEF])))) return true;
            continue;
        }
        if (!r.category || r.category === skill || made.has(r.category)) return true;
    }
    return false;
}

/** A work target as one string: `token`, `token|recipe`, `token|pool`. */
export function targetKey(target) {
    return [target.token, target.recipe || '', target.pool || ''].join('|');
}
