// the progression ledger's profiles: the boosts a Bare, a Typical and a Maxed player bring to each piece of work

import { statementsOf, KEYWORD } from '../../effects/statements.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { expandBearer } from '../../effects/effectLibrary.js';
import { reachOf, reachCovers, RELATION } from '../../../config/registries/reachRegistry.js';
import { targetModeMatches } from '../../../config/registries/filterRegistry.js';
import { respawnOf, growsTermsOf, campOf, fieldOf } from '../../../config/registries/tokenConstants.js';
import { neededToolOf, toolOf, toolMeets, toolItemFor } from '../../../config/registries/toolKinds.js';
import { getCategoryDef } from '../../../config/registries/equipmentCategories.js';
import { isSpentCategory, isWorkMoment, workSkillMatches } from '../../core/consumableRule.js';
import { FACTOR, WORK } from './rates.js';
import { GUILD_UPGRADES, getUpgradePrice } from '../../../config/guildUpgrades.js';

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
 *   each slot. Only what the guild can make by then is on offer.
 *
 * Milestone perks come with levels, so all three have them. Only boosts reachable by the stage
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
const text = (v) => (typeof v === 'string' && v ? v : null);

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
    if (kind === FACTOR.GUILD || kind === FACTOR.REGION) return BOOST_KIND.HALL;
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
 * @param {(rate: object, cap: number, profile: string) => number} [options.inputScale]  the share of a rate
 *   the guild can feed at that profile (one hero on each input): a boost that starves its work is
 *   worth that much less
 * @param {number} [options.campMembers]  copies of a refilling Token a camp hands one hero
 */
export function buildProfiles(book, { tierOf, unitHours, costHours, horizonHours, inputScale = () => 1, campMembers = DEFAULT_CAMP_MEMBERS }) {
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
            // The Guild Hall's Passive Production grows with the Wishing Well's ranks.
            ctx.hall = GUILD_UPGRADES.filter(u => u.id === 'wishing_well');
            return ctx;
        }
        if (!def || !kind) return ctx;
        const probe = book.rateOf(target, {});
        ctx.skill = probe.skill ?? null;
        ctx.gate = probe.gates?.needed ?? 1;
        if (kind === WORK.FIGHT) {
            ctx.family = familySpawnerOf(book, def, spawners);
            return ctx;
        }

        // What it needs to come back at all: the neighbour of its refill, or of any step of its regrowth.
        const chain = chainOf(book, def);
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

    /** The setup every profile starts from: what the work needs to run, one copy, the lowest tool, the Hall ranks that are free. */
    function bareSetup(ctx, cap, level) {
        const setup = { supports: ctx.required.filter(id => within(tokenTier(id), cap) || tokenTier(id) === null) };
        if (ctx.hall.length) setup.hallRanks = Object.fromEntries(ctx.hall.map(u => [u.id, freeRanks(u)]));
        if (level) setup.level = level;
        if (ctx.family) setup.family = ctx.kind === WORK.FIGHT ? { spawner: ctx.family } : { spawner: ctx.family, members: 1 };
        if (ctx.baseTool) setup.tool = ctx.baseTool;
        return setup;
    }

    /** Every boost on offer for a piece of work at a stage, each as a change to a setup. */
    function offers(ctx, cap) {
        const out = [];
        for (const u of ctx.hall) {
            for (let rank = freeRanks(u) + 1; rank <= u.maxRank; rank++) {
                const price = getUpgradePrice(u, rank - 1) || [];
                if (!price.every(p => within(itemTier(p.itemId), cap))) break;
                out.push({
                    kind: BOOST_KIND.HALL, id: `${u.id}:${rank}`, factor: `${FACTOR.GUILD}:${u.id}`, oneOff: true, rank, price, after: rank - 1, upgrade: u.id,
                    apply: (s) => ({ ...s, hallRanks: { ...(s.hallRanks || {}), [u.id]: Math.max(rank, s.hallRanks?.[u.id] || 0) } })
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

    /** A boost's price in Bare hours: a support or camp as its Token is had, a tool or gear as one is made, a Hall rank its price. */
    function priceOf(offer, cap) {
        if (offer.kind === BOOST_KIND.HALL) return offer.price.reduce((sum, p) => sum + p.quantity * unitHours(p.itemId, cap), 0);
        if (offer.kind === BOOST_KIND.SUPPORT || offer.kind === BOOST_KIND.CAMP) return costHours(`token:${offer.id}`, cap);
        return unitHours(offer.id, cap);
    }

    /** A Hall rank is bought after the one before it. */
    function rankOpen(setup, offer) {
        return offer.kind !== BOOST_KIND.HALL || (setup.hallRanks?.[offer.upgrade] || 0) >= offer.after;
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
            const pool = offers(ctx, cap);
            if (profile === PROFILE.MAXED) {
                const typical = profileOf(target, PROFILE.TYPICAL, cap, level);
                setup = typical.setup;
                rate = typical.rate;
                chosen = [...typical.chosen];
                // Then every boost that lifts the rate whatever it costs, the best of each one-slot kind (a drink, a tool, a hat).
                const value = (r) => valueOf(r, cap, baseXp, { gross: true, profile });
                const taken = new Set(chosen.map(c => c.id));
                const ranked = pool.filter(o => !taken.has(o.id)).map(o => {
                    const r = book.rateOf(target, o.apply(setup));
                    return { o, gain: value(r) - value(rate) };
                }).filter(x => x.gain > 1e-9).sort((x, y) => (x.o.rank || 0) - (y.o.rank || 0) || y.gain - x.gain);
                for (const { o } of ranked) {
                    if (slotFull(chosen, o) || !rankOpen(setup, o)) continue;
                    const next = o.apply(setup);
                    const r = book.rateOf(target, next);
                    if (!(value(r) - value(rate) > 1e-9)) continue;
                    setup = next;
                    rate = r;
                    chosen.push({ kind: o.kind, id: o.id, factor: o.factor, slot: o.slot ?? null });
                }
            } else {
                const horizon = horizonHours(cap);
                const value = (r) => valueOf(r, cap, baseXp, { profile });
                let left = [...pool];
                for (;;) {
                    const before = value(rate);
                    let best = null;
                    for (const o of left) {
                        if (slotFull(chosen, o) || !rankOpen(setup, o)) continue;
                        const next = o.apply(setup);
                        const r = book.rateOf(target, next);
                        const gain = value(r) - before;
                        if (!(gain > 1e-9)) continue;
                        // Drunk as it is used, a consumable's cost is already in the rate's inputs: any gain pays at once.
                        const price = o.oneOff ? priceOf(o, cap) : 0;
                        const payback = price / gain;
                        if (!(payback <= horizon)) continue;
                        if (!best || payback < best.payback || (payback === best.payback && gain > best.gain)) best = { o, next, r, gain, payback, price };
                    }
                    if (!best) break;
                    setup = best.next;
                    rate = best.r;
                    chosen.push({ kind: best.o.kind, id: best.o.id, factor: best.o.factor, slot: best.o.slot ?? null, gain: best.gain, payback: best.payback, price: best.price });
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

    return { contextOf, profileOf, bareSetup, offers, valueOf, everythingOf };
}

/** The ranks of an upgrade a new guild has for free: the first ones whose price is nothing. */
function freeRanks(upgrade) {
    let rank = 0;
    while (rank < upgrade.maxRank && (getUpgradePrice(upgrade, rank) || [null]).length === 0) rank++;
    return rank;
}

/** A work target as one string: `token`, `token|recipe`, `token|pool`. */
export function targetKey(target) {
    return [target.token, target.recipe || '', target.pool || ''].join('|');
}
