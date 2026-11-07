// the progression ledger's profiles: the boosts a Bare, a Typical and a Maxed player bring to each piece of work

import { statementsOf, KEYWORD } from '../../effects/statements.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { expandBearer } from '../../effects/effectLibrary.js';
import { reachOf, reachCovers, RELATION } from '../../../config/registries/reachRegistry.js';
import { targetModeMatches, matchesFilters, FILTER_NEEDS } from '../../../config/registries/filterRegistry.js';
import { respawnOf, growsTermsOf, campOf, fieldOf } from '../../../config/registries/tokenConstants.js';
import { toolOf, toolMeets, toolItemFor } from '../../../config/registries/toolKinds.js';
import { getCategoryDef } from '../../../config/registries/equipmentCategories.js';
import { isSpentCategory, isWorkMoment, workSkillMatches } from '../../core/consumableRule.js';
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
 *   once, the camp, the best tool, the best drink, every work potion that helps, the best gear for
 *   each slot, every Guild Hall rank. Only what the guild can make by then is on offer.
 *
 * **The Guild Hall** (brief 320): a star's ranks are on offer to every work its rules reach (its
 * skill, its Token, a Passive Production line at the Hall), a rank only from the tier the owner gave
 * it and only once its price can be had. Bare holds none (only the built-in ranks that are free).
 * Typical takes a rank when it pays for itself within the Hall's own payback time (a day by default,
 * where a building or a tool has two hours) **at Typical**: the hours to
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
 * ⚠️ One copy of each support: stacking copies is the player's choice and the calculator cannot know
 * where things stand on the mat. A camp works `campMembers` copies of a refilling Token (a vein, a
 * Field) in turn, or every tree of a forest's family (its allowance).
 *
 * Pure: reads only the rate book and what it is handed.
 */

export const PROFILE = Object.freeze({ BARE: 'bare', TYPICAL: 'typical', MAXED: 'maxed' });
/** Typical's choices with the Guild Hall left out: the rates a Hall rank's price is gathered at. Never shown. */
export const BEFORE_HALL = 'typical-before-hall';
export const PROFILES = Object.freeze([PROFILE.BARE, PROFILE.TYPICAL, PROFILE.MAXED]);
export const PROFILE_TEXT = Object.freeze({ bare: 'Bare', typical: 'Typical', maxed: 'Maxed' });

/** How a boost is grouped in the per-skill breakdown and the boost targets. */
export const BOOST_KIND = Object.freeze({
    SUPPORT: 'support',
    CAMP: 'camp',
    CONSUMABLE: 'consumable',
    TOOL: 'tool',
    GEAR: 'gear',
    PERK: 'perk',
    HALL: 'hall'
});
export const BOOST_KINDS = Object.freeze(Object.values(BOOST_KIND));
export const BOOST_KIND_TEXT = Object.freeze({
    support: 'Buildings', camp: 'Camps', consumable: 'Consumables', tool: 'Tools', gear: 'Gear', perk: 'Perks', hall: 'Guild Hall'
});

/** The default copies a camp hands one hero of a refilling Token (a vein, a Field). */
export const DEFAULT_CAMP_MEMBERS = 3;

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
    if (kind === FACTOR.HALL || kind === FACTOR.GUILD || kind === FACTOR.REGION) return BOOST_KIND.HALL;
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
 * @param {(cap: number) => number} [options.hallHorizonHours]  how soon a Guild Hall rank must; the boosts' when absent
 * @param {(rate: object, cap: number, profile: string) => number} [options.inputScale]  the share of a rate
 *   the guild can feed at that profile (one hero on each input): a boost that starves its work is
 *   worth that much less
 * @param {number} [options.campMembers]  copies of a refilling Token a camp hands one hero
 * @param {(itemId: string, cap: number) => number} [options.hallUnitHours]  hours one of an item takes
 *   to gather at Typical before the Hall (a Hall rank's price); Bare's when absent
 */
export function buildProfiles(book, { tierOf, unitHours, costHours, horizonHours, hallHorizonHours = horizonHours, inputScale = () => 1, campMembers = DEFAULT_CAMP_MEMBERS, hallUnitHours = unitHours }) {
    const tokenIds = book.tokenIds();
    const supports = tokenIds.filter(id => {
        const def = book.token(id);
        return !isObject(def.enemy) && !isObject(def.foundation) && statementsOf(def).some(s => AMBIENT.has(s?.keyword) && !s?.when?.event);
    });
    const camps = tokenIds.filter(id => campOf(book.token(id)));
    const spawners = tokenIds.filter(id => isObject(book.token(id).spawner));
    const items = Object.values(book.items).filter(isObject);
    const withEffects = items.filter(def => list(def.effects).length);
    const consumables = withEffects.filter(def => isSpentCategory(def.equipSlot));
    const worksOnWork = (def) => statementsOf(expandBearer(def, book.library)).some(s =>
        AMBIENT.has(s?.keyword) && !s?.when?.event && WORK_AXES.has(s.payload?.type));
    const gear = withEffects.filter(def => !isSpentCategory(def.equipSlot) && !toolOf(def) && worksOnWork(def));
    const tools = items.filter(def => toolOf(def));
    const tokenTier = (id) => tierOf(`token:${id}`);
    const itemTier = (id) => tierOf(`item:${id}`);
    const within = (tier, cap) => Number.isInteger(tier) && tier <= cap;
    const tracks = hallTracksOf(book);
    const trackById = new Map(tracks.map(t => [t.id, t]));
    const graph = hallGraph(tracks);
    const wishingWell = trackById.get('wishing_well');

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
            // The Guild Hall's Passive Production grows with the Wishing Well's ranks, the Well's other lines and a shorter lap.
            ctx.hall = [wishingWell, ...tracks.filter(t => t.star && (t.star.ranks.some(r => r.lines.length) || starMovesLap(t.star)))].filter(Boolean);
            return ctx;
        }
        if (!def || !kind) return ctx;
        const probe = book.rateOf(target, {});
        ctx.skill = probe.skill ?? null;
        ctx.gate = probe.gates?.needed ?? 1;
        const chain = chainOf(book, def);
        const made = new Set([...Object.keys(probe.perCycle || {}), ...Object.keys(probe.items || {})]);
        ctx.hall = tracks.filter(t => t.star && starReaches(t.star, ctx.skill, chain, made));
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

    /** The setup every profile starts from: what the work needs to run, one copy, the lowest tool, the built-in Hall ranks that are free. */
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
            out.push({ kind: BOOST_KIND.SUPPORT, id, factor: factorId(BOOST_KIND.SUPPORT, id), oneOff: true, apply: (s) => ({ ...s, supports: [...s.supports, id] }) });
        }
        for (const id of ctx.camps) {
            if (!within(tokenTier(id), cap)) continue;
            const members = ctx.family ? null : campMembers;
            const family = ctx.family ? { spawner: ctx.family } : undefined;
            out.push({
                kind: BOOST_KIND.CAMP, id, factor: factorId(BOOST_KIND.SUPPORT, id), oneOff: true, camp: true,
                apply: (s) => ({ ...s, camp: members ? { id, members } : id, ...(family ? { family } : {}) })
            });
        }
        for (const id of ctx.tools) {
            if (id === ctx.baseTool || !within(itemTier(id), cap)) continue;
            out.push({ kind: BOOST_KIND.TOOL, id, factor: factorId(BOOST_KIND.TOOL, id), oneOff: true, slot: 'tool', apply: (s) => ({ ...s, tool: id }) });
        }
        for (const id of ctx.consumables) {
            if (!within(itemTier(id), cap)) continue;
            const slot = book.items[id]?.equipSlot;
            const capped = getCategoryDef(slot)?.cap === 1;
            out.push({ kind: BOOST_KIND.CONSUMABLE, id, factor: factorId(BOOST_KIND.CONSUMABLE, id), oneOff: false, slot: capped ? slot : null, apply: (s) => ({ ...s, consumables: [...(s.consumables || []), id] }) });
        }
        for (const id of ctx.gear) {
            if (!within(itemTier(id), cap)) continue;
            out.push({ kind: BOOST_KIND.GEAR, id, factor: factorId(BOOST_KIND.GEAR, id), oneOff: true, slot: book.items[id]?.equipSlot || null, apply: (s) => ({ ...s, gear: [...(s.gear || []), id] }) });
        }
        return out;
    }

    /**
     * What a rate is worth an hour, in Bare hours: its items less what it spends (`gross`: not less),
     * plus its XP against a base rate.
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
        return (worth + (baseXp > 0 ? xp / baseXp : 0)) * inputScale(rate, cap, profile);
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

    /** Hours to gather a Hall price at Typical before the Hall: one hero's hours on each item, added. */
    function hallPriceHours(price, cap) {
        return price.reduce((sum, p) => sum + p.quantity * hallUnitHours(p.itemId, cap), 0);
    }

    /** A track's rank in a setup, its free ranks counted. */
    function heldRank(setup, id) {
        return Math.max(Math.floor(Number(setup.hallRanks?.[id]) || 0), freeRanks(trackById.get(id)));
    }

    /** What lighting a track (its rank 1) costs at a stage, in hours at Typical before the Hall. */
    function lightCost(id, cap) {
        const t = trackById.get(id);
        if (!t || !rankWithin(t, 1, cap)) return Infinity;
        return hallPriceHours(t.price(1), cap);
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
        for (let r = held + 1; r <= offer.rank; r++) price += hallPriceHours(track.price(r), cap);
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

    /** Slots that hold one: a second offer for a full slot replaces nothing and is skipped. */
    function slotFull(chosen, offer) {
        if (!offer.slot) return false;
        if (offer.slot === 'tool') return chosen.some(c => c.slot === 'tool');
        const cap = getCategoryDef(offer.slot)?.cap;
        if (!Number.isFinite(cap)) return false;
        return chosen.filter(c => c.slot === offer.slot).length >= cap;
    }

    const memo = new Map();
    const busy = new Set();
    /**
     * One profile's setup for a piece of work at a stage: `{ setup, rate, chosen }`, `chosen` each boost
     * taken with why (`payback` hours for a one-off, `gain` an hour for one drunk as it is used).
     * Maxed starts from Typical's choices, so it is never the slower of the two by its own choice.
     * ⚠️ Pricing a boost reads the supply of its inputs, which reads other work's profiles; a profile
     * asked again while it is being chosen (a loop through the supply) answers Bare.
     */
    function profileOf(target, profile, cap, level = null) {
        const ctx = contextOf(target);
        const key = `${ctx.key}|${profile}|${cap}|${level ?? ''}`;
        if (memo.has(key)) return memo.get(key);
        if (busy.has(key)) return profileOf(target, PROFILE.BARE, cap, level);
        busy.add(key);
        const bare = bareSetup(ctx, cap, level);
        let setup = bare;
        let rate = book.rateOf(target, setup);
        let chosen = [];
        if (profile !== PROFILE.BARE && rate.ok) {
            const baseXp = Object.values(rate.xp || {}).reduce((a, b) => a + b, 0);
            const pool = offers(ctx, cap).filter(o => profile !== BEFORE_HALL || o.kind !== BOOST_KIND.HALL);
            if (profile === PROFILE.MAXED) {
                const typical = profileOf(target, PROFILE.TYPICAL, cap, level);
                setup = typical.setup;
                rate = typical.rate;
                chosen = [...typical.chosen];
                // Then every boost that lifts the rate whatever it costs, the best of each one-slot kind (a drink, a tool, a hat),
                // then every Hall rank in rank order (a rank waits for the one before it).
                const value = (r) => valueOf(r, cap, baseXp, { gross: true, profile });
                const taken = new Set(chosen.map(c => c.id));
                const ranked = pool.filter(o => !taken.has(o.id) && o.kind !== BOOST_KIND.HALL).map(o => {
                    const r = book.rateOf(target, o.apply(setup));
                    return { o, gain: value(r) - value(rate) };
                }).filter(x => x.gain > 1e-9).sort((x, y) => y.gain - x.gain);
                const hallOffers = pool.filter(o => !taken.has(o.id) && o.kind === BOOST_KIND.HALL).sort((x, y) => x.rank - y.rank);
                for (const o of [...ranked.map(x => x.o), ...hallOffers]) {
                    if (slotFull(chosen, o)) continue;
                    const step = o.kind === BOOST_KIND.HALL ? hallStep(setup, o, cap) : { next: o.apply(setup), path: [] };
                    if (!step) continue;
                    const r = book.rateOf(target, step.next);
                    if (!(value(r) - value(rate) > 1e-9)) continue;
                    setup = step.next;
                    rate = r;
                    chosen.push({ kind: o.kind, id: o.id, factor: o.factor, slot: o.slot ?? null, ...hallPick(o, step) });
                }
            } else {
                const horizon = horizonHours(cap);
                const hallHorizon = hallHorizonHours(cap);
                const value = (r) => valueOf(r, cap, baseXp, { profile });
                let left = [...pool];
                for (;;) {
                    const before = value(rate);
                    let best = null;
                    // A star is weighed at its next rank that saves anything (`left` holds its ranks in order); the ones above wait their turn.
                    const weighed = new Set();
                    for (const o of left) {
                        if (slotFull(chosen, o)) continue;
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
                            r = book.rateOf(target, next);
                            gain = hallSaves(ctx, rate, r, cap, baseXp, profile);
                            price = step.price;
                            if (gain > 1e-9) weighed.add(o.upgrade);
                        } else {
                            next = o.apply(setup);
                            r = book.rateOf(target, next);
                            gain = value(r) - before;
                            // Drunk as it is used, a consumable's cost is already in the rate's inputs: any gain pays at once.
                            price = o.oneOff ? priceOf(o, cap) : 0;
                        }
                        if (!(gain > 1e-9)) continue;
                        const payback = price / gain;
                        if (!(payback <= (o.kind === BOOST_KIND.HALL ? hallHorizon : horizon))) continue;
                        if (!best || payback < best.payback || (payback === best.payback && gain > best.gain)) best = { o, next, r, gain, payback, price, step };
                    }
                    if (!best) break;
                    setup = best.next;
                    rate = best.r;
                    chosen.push({ kind: best.o.kind, id: best.o.id, factor: best.o.factor, slot: best.o.slot ?? null, gain: best.gain, payback: best.payback, price: best.price, ...hallPick(best.o, best.step) });
                    left = left.filter(o => o !== best.o);
                }
            }
        }
        busy.delete(key);
        const out = { setup, rate, chosen, context: ctx };
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

    return {
        contextOf, profileOf, bareSetup, offers, valueOf, everythingOf,
        hallTracks: tracks, hallTrack: (id) => trackById.get(id) || null, hallPriceHours, hallRankOn, rankWithin
    };
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
