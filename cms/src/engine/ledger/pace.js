// the progression ledger's pace: supply, level times and path time at each profile, and checks D

import { buildRateBook, LIFECYCLE, WORK, FACTOR } from './rates.js';
import { EFFECT_TYPES } from '../../../../src/systems/effects/constants.js';
import { buildProfiles, targetKey, PROFILE, PROFILES, PROFILE_TEXT, BOOST_KIND, BOOST_KIND_TEXT, boostKindOf, BEFORE_HALL, pickKindOf, RARE_FIND_KINDS, gainOf, repeatedByHero } from './profiles.js';
import { starAddsRate } from './hall.js';
import { settingsOf, minutesPerLevelAt, minutesToReach, formatMinutes, levelAtMinutes, coinMinutesAt, COIN_CURVE, boostBudgetAt, BOOST_BUDGET_KINDS, heroesAt, chainHeroesAt, paybackHoursAt } from './settings.js';
import { ledgerCoinWorth } from './coins.js';
import { restRuleBusyShare } from '../balanceRules.js';
import { HOW, COMBAT, LUCK_BELOW, parseKey, itemKey, tokenKey, recipeKey, wedgeKey, starKey, spotPoolKey, LEDGER_ENGINE_TEXT } from '../../../../src/systems/progression/ledger/engine.js';
import { spotOf } from '../../../../src/config/registries/fishingSpots.js';
import { ringOfStar } from '../../../../src/systems/world/ringStars.js';
import { HALL_NODE, ROSTER_STAR } from '../../../../src/config/guildUpgrades.js';
import { planOf, PLAN_STATUS, tierLabel, tierLevelAt } from '../../../../src/systems/progression/ledger/plan.js';
import { xpForLevel, MAX_SKILL_LEVEL } from '../../../../src/utils/XPCurve.js';
import { SKILLS, SKILL_LAYERS } from '../../../../src/config/registries/skillRegistry.js';
import { STRICT_RINGS } from '../../../../src/config/worldTablesShape.js';
import { stationKindOf } from '../../../../src/systems/effects/statements.js';
import { HIDEOUT_KIND, stealOf, crimeLevelOf, caughtCurveOf, caughtChance } from '../../../../src/config/registries/crime.js';
import { shopCoinsOf, enemyCoinDropOf } from '../../../../src/config/registries/coinCosts.js';

/**
 * How the game is paced for the target player, worked out statically from the content at the three
 * profiles (`profiles.js`), every step shown (owner, 2026-10-29: "pathing and a rate calculator",
 * no pretend player):
 *
 * - **Supply**: how fast the guild gets each item at a stage: the best source reachable by then,
 *   one hero on it, its materials gathered by as many heroes on the best source of each as it needs
 *   (a smith fed by two smelters, each fed by three miners: the gatherers a crafter needs, T-338
 *   part 2), counted down the chain ({@link heroesOf}); the drinks and potions its boosts spend
 *   brewed by one hero on theirs, as the profile weighed them (a boost the guild cannot brew fast
 *   enough starves its work). A loop (seeds that make seeds) takes its own input as in stock. An
 *   input nothing makes by then holds a work back.
 * - **The reference guild** (BALANCE_RULES section 8): its heroes arrive about one a tier
 *   (`settings.heroesByTier`), and one chain has at most one maker and `gatherersPerMaker`
 *   gatherers; fewer heroes than that run one chain together, each doing everything in turn. A work
 *   whose chain needs more heroes than it has (its maker, the gatherers down its chain and the
 *   brewers of its drinks) runs at their share ({@link staffingOf}). The guild's time is spent once:
 *   a stage is had no sooner than its heroes can do all its work, every level and every price on the
 *   way, one hero-hour at a time ({@link arrivalOf}).
 * - **Level tracks**: for each skill, the hours each level takes: the XP it needs over the best
 *   XP an hour any work of the skill gives at that level (with the milestone perks held by then),
 *   fed the same way, among the work reachable by the stage that first asks for that level, with
 *   the profile's boosts or a lower profile's, whichever levels faster.
 * - **Path time**: for each entry, when it is first had from a new game: along the path the reach
 *   engine shows, a step starts once everything it needs is had and its level gates are reached
 *   (skills level side by side, each by its own hero: one job per hero), then takes its own time
 *   (gathering what it spends, a build, a cycle, a chance at average luck).
 * - **Coins** (brief 870 C3): the guild's coin supply at a stage, the best one hero earns
 *   ({@link COINS}: selling what a work makes at its coin worth less what it spends, a kill's Coin
 *   drop, a Hideout's thefts); a price that asks coins (a Shop Token, a Guild Hall rank, settling a
 *   ring) gathers them beside its items, so its step waits for them; a coin cost proposed from its
 *   coin curve, everyday or big by kind of purchase (`coinPrices`).
 * - **The curve's player is Maxed** ({@link TARGET}, owner 2026-11-07: the curve describes a well-
 *   optimized player): walls, long waits, the stages and the ring stars are read at Maxed; Typical
 *   and Bare are held to their bounds against the curve.
 * - **Checks D**: walls (a level far slower than the pace curve), a long wait for one unlock, a
 *   stage's time against its budget, Typical, Bare and Maxed out of their bounds, a Guild Hall rank
 *   slow to pay back, a boost off its target strength, boosts held over the boost budget, a coin
 *   price nothing earns, and what the calculator cannot read; and three the balance rules promise
 *   (sections 1 and 5): a chain's XP per raw unit far off its tier's median, a drink or work
 *   potion's batch paying back under its factor, and a Hall rank off the payback curve over all the
 *   work it boosts.
 * - **The Guild Hall**: every rank's payback at Typical (the hours to gather its price against the
 *   hours it saves an hour on the work it pays best on, at the tier the owner gave it), and a
 *   proposed price for it (a preview: brief 290's rule, until the calculator is seen to agree with
 *   real play). A ring star adds no rate: it is priced so its ring opens when the stage before the
 *   ring ends ({@link ringBudgetTier}), and a ring that opens well before then is a finding.
 *
 * Average luck only. Hours are hero-work hours: heroes keep working through the player's check-ins
 * and the night, so a level grind runs around the clock; a step that waits on the player is not
 * delayed (an attentive player).
 *
 * Pure: reads only the content, the ledger and the settings it is handed.
 */

const HOUR_MS = 3_600_000;

/** The player the pace curve and the stage budgets describe: Maxed, the well-optimized player (brief 880 L3). */
export const TARGET = PROFILE.MAXED;
const AT_TARGET = PROFILE_TEXT[TARGET];

/**
 * The guild's coins where an item would stand: a step's `gather.item` when its coins set its time,
 * a fed rate's `short` when coins hold it back (a build paying its Foundation's coins).
 */
export const COINS = 'coins';

/** A star open already: no star to light on the way. */
const OPEN = Object.freeze({ path: Object.freeze([]), cost: 0 });

/** A fighting style (melee, magic…): levelled by fights, never by work. */
const isCombatStyle = (skill) => SKILLS[skill]?.layer === SKILL_LAYERS.COMBAT;

/** The profiles whose setups a hero levelling at a profile may work with, its own first: the ones with no more on offer. */
const levelledAs = (profile) => {
    const at = PROFILES.indexOf(profile);
    return at < 0 ? [profile] : PROFILES.slice(0, at + 1).reverse();
};

/** The kinds of boost a profile chooses per piece of work (perks come with levels). */
const BOOSTED = [
    BOOST_KIND.SUPPORT, BOOST_KIND.CAMP, BOOST_KIND.CONSUMABLE, BOOST_KIND.TOOL, BOOST_KIND.GEAR, BOOST_KIND.HALL,
    BOOST_KIND.RARE_CONSUMABLE, BOOST_KIND.RARE_SUPPORT
];

/** Author-facing words, kept together for translation. */
export const PACE_TEXT = Object.freeze({
    hours: (h) => (Number.isFinite(h) ? formatMinutes(h * 60) : 'never'),
    /** As `hours`, with a time under a minute in seconds: a Hall price can take seconds to gather. */
    short: (h) => (Number.isFinite(h) && h > 0 && h * 60 < 0.5 ? `${Math.max(1, Math.round(h * 3600))} s` : PACE_TEXT.hours(h)),
    /** Hours saved an hour, in words: "12 min an hour", "40 s an hour". */
    saves: (h) => (!(h > 0) ? 'nothing' : h * 60 >= 1 ? `${formatMinutes(h * 60)} an hour` : `${Math.max(1, Math.round(h * 3600))} s an hour`),
    times: (r) => `${r >= 10 ? Math.round(r) : Math.round(r * 10) / 10}×`,
    opensRing: (ring) => `opens ring ${ring} of the world map`,
    skill: (s) => (s === COMBAT ? 'Combat' : s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'),
    waits: Object.freeze({ need: 'waits for', level: 'levels', own: 'its own time' }),
    coins: (n) => `${n} ${n === 1 ? 'coin' : 'coins'}`,
    heroes: (n) => `${n} ${n === 1 ? 'hero' : 'heroes'}`,
    /** A count of a named thing: "1 Oak Forest", "2 Quarries". */
    count: (n, name) => `${n} ${n === 1 ? name : /[^aeiou]y$/i.test(name) ? `${name.slice(0, -1)}ies` : /(s|x|ch|sh)$/i.test(name) ? `${name}es` : `${name}s`}`,
    rate: (n) => (n >= 100 ? `${Math.round(n)}` : n >= 10 ? n.toFixed(1) : n.toFixed(2)),
    /** A number to two places, no trailing zeros: "4.67", "2". */
    figure: (n) => `${Math.round(n * 100) / 100}`,
    pieces: (n) => (n === 1 ? 'one piece of work' : `${n} pieces of work`),
    earning: (n) => `earning ${n} ${n === 1 ? 'coin' : 'coins'}`,
    noCoins: 'nothing earns its coins by then',
    coinSupply: (name, coins, stage) => `${name} asks ${coins} ${coins === 1 ? 'coin' : 'coins'}, but nothing the guild has by ${stage} earns coins: give what its work makes a coin worth (a value), an enemy a Coin drop or a steal table coins.`,
    theft: (enemy, hideout) => `thefts from ${enemy} at ${hideout}`,
    noCurve: (curve, stage) => `no ${curve} coin curve point at or before ${stage}`,
    noIncome: (stage) => `nothing the guild has by ${stage} earns coins by selling`,
    notReached: 'never reached',
    hallByPayback: 'a Guild Hall rank is judged by its payback, its items and coins together (the hall-guild-payback check), not by a coin curve',
    /** Why a way out is a floor (`gateOf(...).floor`): the real one asks more. */
    wayOutFloor: Object.freeze({
        goods: 'its goods price (the world seed\'s) is not counted',
        fights: 'a level it asks is trained by fights, which are not timed'
    })
});

/**
 * Why a way out's time is a floor (`gateOf(...).floor`). ⚠️ A place's goods are the world seed's,
 * which the settle rule does not carry: while it carries none, every way out is a floor.
 */
export const WAY_OUT_FLOOR = Object.freeze({ GOODS: 'goods', FIGHTS: 'fights' });

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The stage a ring of the world map opens after, so its Guild Hall star is priced to be lit then:
 * the ring before's last tier. On the ladder a ring holds several rungs (ring 2 iron and silver), so
 * that is the tier before the ring's own first rung (`ringRungs`, the engine's `worldRules`); a ring
 * whose tables list nothing (a wild ring) opens after the last rung of the ring before. With no
 * rungs (`ringRungs` absent, or every ring one rung), ring n opens when stage n − 1 ends.
 * ⚠️ The ring's first rung rather than the last of the ring before, so an origin planned later than
 * the ring that lists it (a tier-3 bush in ring 1) leaves the next ring where it is.
 *
 * @param {number} ring
 * @param {Map<number, {first, last}>} [ringRungs]  the ledger world's
 */
export function ringBudgetTier(ring, ringRungs = null) {
    const own = ringRungs?.get(ring);
    if (own) return own.first - 1;
    const before = ringRungs?.get(ring - 1);
    return before ? before.last : ring - 1;
}
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** The fewest chains a tier needs for its median to say anything (the chain XP check). */
const CHAIN_MEDIAN_MIN = 3;
const medianOf = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** A boost-strength target at a tier, in percent: the last point at or before it, else null. */
export function boostTargetAt(settings, kind, tier) {
    const points = list(settingsOf(settings).boostTargets?.[kind]).filter(p => Number.isInteger(p.tier) && Number.isFinite(p.pct));
    let out = null;
    for (const p of [...points].sort((a, b) => a.tier - b.tier)) if (p.tier <= tier) out = p.pct;
    return out;
}

/**
 * The pace of the whole content.
 *
 * @param {object} content  as the ledger was built from (`{ items, tokens, recipes | recipePools, effects, skillPerks }`)
 * @param {object} ledger   `buildLedger(content)`
 * @param {object} [rawSettings]  the Ledger settings (`settings.js`)
 * @param {{ book?: object, records?: Map<string, object> }} [options]  a rate book already built; the
 *   records by entry key, for their plan blocks (read from `content` when absent)
 */
export function buildPace(content, ledger, rawSettings = null, { book = null, records = null } = {}) {
    const settings = settingsOf(rawSettings);
    const rates = book || buildRateBook(content);
    const reach = ledger.reach;
    const budgetTierOf = (ring) => ringBudgetTier(ring, ledger.world.ringRungs);
    const tierOfKey = (key) => {
        const t = reach.get(key)?.tier;
        return Number.isInteger(t) ? t : null;
    };
    const plans = records || recordsOf(content);
    const effTier = (key) => planOf(plans.get(key)).tier ?? tierOfKey(key);
    const statusOf = (key) => planOf(plans.get(key)).status;

    // ── the work ───────────────────────────────────────────────────────────────────────────────
    const works = [];
    const byKey = new Map();
    for (const target of rates.workTargets()) {
        const entry = target.recipe ? recipeKey(target.recipe) : tokenKey(target.token);
        const parts = [tierOfKey(entry), tierOfKey(tokenKey(target.token))];
        if (target.pool) {
            const bait = target.pool.split('|')[1];
            if (bait) parts.push(tierOfKey(itemKey(bait)));
            // A fishing spot's pool is fished once the spot stands where it holds.
            if (spotOf(rates.token(target.token))) parts.push(tierOfKey(spotPoolKey(target.token, target.pool)));
        }
        const tier = parts.some(t => t === null) ? null : Math.max(...parts);
        const work = { target, key: targetKey(target), entry, tier };
        works.push(work);
        byKey.set(work.key, work);
    }
    // Only the content's own entries: a world cell, a tool need or a Token the world tables name but
    // the content lacks sets no stage and asks no level. The pace goes as far as the content reaches,
    // or is planned or set for (an entry's tier, a Guild Hall rank's), never past the last stage: the
    // stages run to the ladder's last tier whatever the content holds, and a stage nothing is planned
    // for has nothing to work there.
    const isEntry = (key) => plans.has(key);
    const tiers = new Set([...reach.values()].filter(a => isEntry(a.key)).map(a => a.tier).filter(Number.isInteger));
    const named = [...tiers];
    for (const key of plans.keys()) {
        const { tier, status } = planOf(plans.get(key));
        if (Number.isInteger(tier) && status !== PLAN_STATUS.PLANNED && status !== PLAN_STATUS.PARKED) named.push(tier);
    }
    for (const star of rates.hall?.stars || []) for (const rank of list(star.ranks)) if (Number.isInteger(rank.tier)) named.push(rank.tier);
    const lastStage = Math.max(0, ...settings.stages.map(s => s.tier));
    const maxTier = Math.max(tiers.size ? Math.max(...tiers) : 0, Math.min(lastStage, Math.max(0, ...named)));

    // ── supply: Bare first (it prices every boost), then the profiles that buy them ─────────────
    // Kept in maps by profile, stage and item (a fed rate by work, profile, stage and level), the stage
    // and level as text, as one joined key spelled them: asked millions of times, nearly always kept.
    const supplyMemo = new Map();
    const fedMemo = new Map();
    const level2 = (memo, a, b) => {
        let m = memo.get(a);
        if (!m) memo.set(a, (m = new Map()));
        const k = String(b);
        let n = m.get(k);
        if (!n) m.set(k, (n = new Map()));
        return n;
    };
    const suppliesAt = (profile, cap) => level2(supplyMemo, profile, cap);
    const fedAt = (work, profile, cap) => {
        let byProfile = fedMemo.get(work.key);
        if (!byProfile) fedMemo.set(work.key, (byProfile = new Map()));
        return level2(byProfile, profile, cap);
    };
    // Per open supply or fed question, innermost last: the outermost question it read an item in stock
    // from (that question's place here), Infinity while it read none: its answer then stands on its own.
    const open = [];
    // Beside each, a number no other question gets: whether the question at a place is still the same one.
    const asks = [];
    let asked = 0;
    const enter = () => {
        asks.push(asked++);
        return open.push(Infinity) - 1;
    };
    /** Closes the innermost question: the outermost question it read a stand-in from, Infinity when none. */
    const leave = () => {
        asks.pop();
        return open.pop();
    };
    /** The item asked at `at` read in stock: every open question inside its making read a stand-in. */
    const readInStock = (at) => {
        for (let i = at + 1; i < open.length; i++) if (open[i] > at) open[i] = at;
    };
    // A supply answer that read a stand-in, by key: kept inside the loop it was asked in, until the
    // outermost question it read in stock (at `at`, its number `ask`) is answered, then forgotten with it.
    // ⚠️ Worked out afresh down every path through a loop instead, a loop of many drinks and potions asks
    // its answers once per path: the paths multiply with each drink, and the pace never finishes.
    const inLoop = new Map();
    const madeBy = new Map();
    // What each item's Use gives, by the item given: `{ from, per, tier }`, `per` how many one copy
    // gives on average, `tier` when the item used is first had.
    const usesGiving = new Map();
    for (const rule of ledger.world.rules) {
        if (rule.how !== HOW.USE) continue;
        for (const give of rule.gives) {
            const id = parseKey(give.key).id;
            if (!usesGiving.has(id)) usesGiving.set(id, []);
            usesGiving.get(id).push({ from: parseKey(rule.via).id, per: give.perCycle, tier: tierOfKey(rule.via) });
        }
    }
    let profiles = null;
    let indexed = false;
    const indexMakers = () => {
        if (indexed) return;
        indexed = true;
        // What each work can make with or without every boost, read without pricing anything (pricing reads this index);
        // a water, every fish its pool lands, at whatever level.
        for (const work of works) {
            if (work.tier === null) continue;
            const r = profiles.everythingOf(work.target, maxTier);
            const b = profiles.profileOf(work.target, PROFILE.BARE, maxTier).rate;
            const fish = rates.catchesOf(work.target).map(c => c.itemId);
            for (const item of new Set([...Object.keys(r.items || {}), ...Object.keys(b.items || {}), ...fish])) {
                if (!madeBy.has(item)) madeBy.set(item, []);
                madeBy.get(item).push(work);
            }
        }
    };

    /**
     * A work's rate fed by the guild: its materials by as many heroes on the best source of each as
     * it spends (`gatherers`, by item: `{ heroes, work, perHour }`, a share of one hero or several);
     * what its boosts spend (`rate.boostInputs`, its drinks and potions) by one hero on the best
     * source of each (`brewers`, the same shape, never past one hero), the scarcest setting its scale
     * (`scale`, `short`), as an input nothing makes by then does, to what the work makes of it itself.
     * `level`: the working hero's level (its milestone perks), the work's own gate when null.
     */
    function fed(work, profile, cap, stack, level = null) {
        const kept = fedAt(work, profile, cap);
        const levelKey = String(level ?? '');
        const hit = kept.get(levelKey);
        if (hit) return hit;
        enter();
        const { rate } = profiles.profileOf(work.target, profile, cap, level);
        let out;
        if (!rate.ok) {
            out = { rate, scale: 0, items: {}, xp: {}, tokens: {}, inputs: {}, short: null, gatherers: {}, brewers: {} };
        } else {
            let scale = 1;
            let short = null;
            const sources = [];
            for (const [item, need] of Object.entries(rate.inputs || {})) {
                // What the work makes of its own input (a felled tree's seedlings for its regrowth) comes first.
                const own = rate.items?.[item] || 0;
                if (!(need > own)) continue;
                const s = supplyOf(item, profile, cap, stack);
                const boost = Math.min(need - own, rate.boostInputs?.[item] || 0);
                if (s.perHour > 0) {
                    sources.push({ item, material: need - own - boost, boost, s });
                    if (boost > 0 && s.perHour / boost < scale) {
                        scale = s.perHour / boost;
                        short = item;
                    }
                    continue;
                }
                if (own / need < scale) {
                    scale = own / need;
                    short = item;
                }
            }
            scale = Math.max(0, Math.min(1, scale));
            const gatherers = {};
            const brewers = {};
            for (const { item, material, boost, s } of sources) {
                // In stock inside a loop (Infinity) asks no one.
                const per = (n) => (Number.isFinite(s.perHour) ? (n * scale) / s.perHour : 0);
                if (material > 0) gatherers[item] = { heroes: per(material), work: s.work, perHour: s.perHour };
                if (boost > 0) brewers[item] = { heroes: Math.min(1, per(boost)), work: s.work, perHour: s.perHour };
            }
            const times = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, v * scale]));
            out = { rate, scale, items: times(rate.items), xp: times(rate.xp), tokens: times(rate.tokens), inputs: times(rate.inputs), short, gatherers, brewers };
            if (rate.coins !== undefined) out.coins = rate.coins * scale;
        }
        if (leave() === Infinity) kept.set(levelKey, out);
        return out;
    }

    /** How fast the guild gets an item at a stage: `{ perHour, work }`, the best source then. */
    function supplyOf(itemId, profile, cap, stack = null) {
        const kept = suppliesAt(profile, cap);
        const hit = kept.get(itemId);
        if (hit) return hit;
        if (stack === null) stack = new Map();
        const key = `${itemId}|${profile}|${cap}`;
        // An item asked for inside its own making (seeds for the tree that drops them) is in stock, for
        // every question inside that making: their answers are kept only inside the loop (`inLoop`).
        if (stack.has(itemId)) {
            readInStock(stack.get(itemId));
            return { perHour: Infinity, work: null, loop: true };
        }
        const held = inLoop.get(key);
        if (held && held.stack === stack && asks[held.at] === held.ask) {
            // It leans on what it read in stock: the questions inside that making are not kept either.
            readInStock(held.at);
            return held.best;
        }
        indexMakers();
        stack.set(itemId, enter());
        let best = { perHour: 0, work: null };
        for (const work of madeBy.get(itemId) || []) {
            if (work.tier === null || work.tier > cap) continue;
            const f = fed(work, profile, cap, stack, catchLevel(work, itemId));
            const n = f.items[itemId] || 0;
            if (n > best.perHour) best = { perHour: n, work };
        }
        // A Use takes no hero: what it gives comes as fast as the item used, by the same work.
        for (const use of usesGiving.get(itemId) || []) {
            if (use.tier === null || use.tier > cap || !(use.per > 0)) continue;
            const s = supplyOf(use.from, profile, cap, stack);
            const n = s.perHour * use.per;
            if (n > best.perHour) best = { perHour: n, work: s.work };
        }
        stack.delete(itemId);
        const at = leave();
        if (at === Infinity) kept.set(itemId, best);
        else inLoop.set(key, { best, stack, at, ask: asks[at] });
        return best;
    }

    /**
     * The level a hero fishes a water at to land `itemId`: the fish's own, where it is above the
     * pool's lowest (a pool's rate at its gate lands only the fish open there). Null for other work.
     */
    function catchLevel(work, itemId) {
        if (!work.target.pool) return null;
        const level = rates.catchesOf(work.target).find(c => c.itemId === itemId)?.level ?? null;
        return level !== null && level > (profiles.contextOf(work.target).gate ?? 1) ? level : null;
    }

    /**
     * Hero-hours one of an item takes at a profile and stage: its best source's heroes, the gatherers
     * down its chain counted ({@link heroesOf}), over what it makes an hour. In stock (a loop) is free.
     */
    const heroHoursOf = (itemId, profile, cap) => {
        const s = supplyOf(itemId, profile, cap);
        if (!(s.perHour > 0)) return Infinity;
        if (!Number.isFinite(s.perHour)) return 0;
        return (s.work ? heroesOf(s.work, profile, cap) : 1) / s.perHour;
    };
    const unitHours = (itemId, cap) => heroHoursOf(itemId, PROFILE.BARE, cap);
    const hallUnitHours = (itemId, cap) => heroHoursOf(itemId, BEFORE_HALL, cap);
    /**
     * Hours `coins` take to earn at a profile and stage, starting `hours` into a new game
     * ({@link coinHoursFrom}); a price no path times starts as its stage begins. 0 for none.
     */
    const coinCostHours = (coins, profile, cap, hours = stageStartHours(cap)) => (coins > 0 ? coinHoursFrom(profile, cap, coins, hours) : 0);
    /** Bare hero-hours to have one of a Token: free where the camp or a Region places it (or it drifts in), else its price and its build. */
    const costHours = (key, cap) => {
        const at = reach.get(key);
        if (!at?.rule) return Infinity;
        const rule = at.rule;
        if ([HOW.STARTER_CAMP, HOW.WORLD, HOW.HALL, HOW.SPAWN, HOW.GROW, HOW.REGROW, HOW.ARRIVE, HOW.EVENT].includes(rule.how)) return 0;
        if (rule.how === HOW.SHOP) return sum(rule.inputs.map(i => i.quantity * unitHours(parseKey(i.key).id, cap))) + coinCostHours(rule.coins, PROFILE.BARE, cap);
        if (rule.how === HOW.CRAFT) {
            const recipe = rates.recipes[parseKey(rule.via).id];
            const build = reach.get(rule.via)?.rule;
            const foundation = build?.how === HOW.BUILD ? reach.get(build.via)?.rule : null;
            const price = foundation?.how === HOW.SHOP ? foundation.inputs : [];
            const coins = foundation?.how === HOW.SHOP ? coinCostHours(foundation.coins, PROFILE.BARE, cap) : 0;
            return sum([...rule.inputs, ...price].map(i => i.quantity * unitHours(parseKey(i.key).id, cap))) + (Number(recipe?.durationMs) || 0) / HOUR_MS + coins;
        }
        return Infinity;
    };
    profiles = buildProfiles(rates, {
        tierOf: tierOfKey, unitHours, costHours, hallUnitHours, horizonHours: () => settings.paybackHours, hallHorizonHours: (cap, tier) => paybackHoursAt(tierLevelAt(settings.tierLevels, tier ?? cap)),
        hallCoinHours: (coins, cap) => coinCostHours(coins, BEFORE_HALL, cap),
        batchPayback: settings.batchPayback,
        campNodes: settings.layouts[settings.layout],
        campSpawners: settings.layoutSpawners[settings.layout],
        sitePlaces: settings.sitePlaces,
        // As `fed` feeds it: materials in full by the gatherers they need, what boosts spend by one hero on each.
        inputScale: (rate, cap, profile) => {
            let scale = 1;
            for (const [item, need] of Object.entries(rate.inputs || {})) {
                const own = rate.items?.[item] || 0;
                if (!(need > own)) continue;
                const s = supplyOf(item, profile, cap).perHour;
                const boost = Math.min(need - own, rate.boostInputs?.[item] || 0);
                if (!(s > 0)) scale = Math.min(scale, own / need);
                else if (boost > 0) scale = Math.min(scale, s / boost);
            }
            return Math.max(0, scale);
        }
    });

    /** A work's profile rate at a stage, fed. */
    const workAt = (work, profile, cap, level = null) => fed(work, profile, cap, new Map(), level);

    /**
     * The guild's heroes an hour of a work takes at a profile and stage: its own hero and the
     * gatherers its materials need, each with the gatherers their own work needs, down the chain (the
     * solver's guild time). The brewers of what boosts spend (`brewers`) are left out: at Maxed every
     * brewer drinks the potions it brews for, so their count has no end while a work potion lasts one
     * cycle (T-338 part 1). A work met again down its own chain, or past twelve steps, counts its one
     * hero (a loop's input is in stock).
     */
    const heroMemo = new Map();
    function heroesOf(work, profile, cap, level = null, seen = null) {
        if (!work) return 1;
        // Asked afresh (not inside a chain), the answer depends on nothing else: kept.
        const key = seen ? null : `${work.key}|${profile}|${cap}|${level ?? ''}`;
        if (key && heroMemo.has(key)) return heroMemo.get(key);
        const path = seen || new Set();
        if (path.has(work.key) || path.size > 12) return 1;
        path.add(work.key);
        let heroes = 1;
        for (const g of Object.values(workAt(work, profile, cap, level).gatherers || {})) {
            if (g.heroes > 0) heroes += g.heroes * heroesOf(g.work, profile, cap, null, path);
        }
        path.delete(work.key);
        if (key) heroMemo.set(key, heroes);
        return heroes;
    }

    /**
     * The brewers a work's boosts need an hour at a profile and stage: each drink or potion it spends
     * by the share of one hero on its best source that brewing it takes, that hero's gatherers down
     * the chain counted ({@link heroesOf}). What the profile weighed its boosts at, now spent.
     */
    function brewersOf(work, profile, cap, level = null) {
        let out = 0;
        for (const b of Object.values(workAt(work, profile, cap, level).brewers || {})) {
            if (b.heroes > 0) out += b.heroes * heroesOf(b.work, profile, cap);
        }
        return out;
    }

    const staffMemo = new Map();
    /**
     * How a work's chain is staffed at a profile and stage (BALANCE_RULES section 8): the heroes it
     * needs to run in full (`need`: its maker, its `gatherers` down the chain, its `brewers`), the
     * heroes one chain has there (`have`, {@link chainHeroesAt}: the guild's heroes, at most one maker
     * and `gatherersPerMaker` gatherers), and the share of its full pace it runs at (`scale`: 1 while
     * it needs no more than it has, else what it has over what it needs, each hero doing its share of
     * everything in turn). Level times, path steps and prices gathered run at it; the gatherers
     * counted ({@link heroesOf}) stay the full need.
     */
    function staffingOf(work, profile, cap, level = null) {
        const key = `${work.key}|${profile}|${cap}|${level ?? ''}`;
        let out = staffMemo.get(key);
        if (!out) {
            const gatherers = heroesOf(work, profile, cap, level) - 1;
            const brewers = brewersOf(work, profile, cap, level);
            const need = 1 + gatherers + brewers;
            const have = chainHeroesAt(settings, cap);
            out = { need, gatherers, brewers, have, scale: need > have ? have / need : 1 };
            staffMemo.set(key, out);
        }
        return out;
    }
    const chainScale = (work, profile, cap, level = null) => staffingOf(work, profile, cap, level).scale;
    /** A fed rate as the reference chain runs it: its items, Tokens, XP and scale at {@link chainScale}. */
    const paced = (work, profile, cap, level = null) => {
        const f = workAt(work, profile, cap, level);
        const chain = chainScale(work, profile, cap, level);
        if (chain === 1) return f;
        const times = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, v * chain]));
        return { ...f, chain, scale: f.scale * chain, items: times(f.items), tokens: times(f.tokens), xp: times(f.xp), inputs: times(f.inputs) };
    };
    /**
     * What the guild gets of an item an hour on its best source as the reference chain runs it, with
     * the profile's setups or a lower profile's, whichever gathers more: a chain short of heroes may
     * leave off a drink whose brewing it cannot staff, as a hero levelling may.
     */
    const pacedSupply = (itemId, profile, cap) => {
        let best = 0;
        for (const as of levelledAs(profile)) {
            const s = supplyOf(itemId, as, cap);
            const n = s.work && Number.isFinite(s.perHour) ? s.perHour * chainScale(s.work, as, cap) : s.perHour;
            if (n > best) best = n;
        }
        return best;
    };

    // ── coins ──────────────────────────────────────────────────────────────────────────────────
    /** One copy's coin worth, as Recalculate writes it (`coins.js`). */
    const worthOf = (itemId) => ledgerCoinWorth(rates.items[itemId]);

    /** A fed work's coins an hour: what it makes at its worth, less what it spends at theirs, and its own coins (a kill's drop). */
    function coinRateOf(f) {
        if (!f?.rate?.ok) return 0;
        let n = f.coins || 0;
        for (const [item, q] of Object.entries(f.items || {})) n += q * worthOf(item);
        for (const [item, q] of Object.entries(f.inputs || {})) n -= q * worthOf(item);
        return n;
    }

    const tierWithin = (key, cap) => {
        const t = tierOfKey(key);
        return t !== null && t <= cap;
    };
    /**
     * Hours from a new game at which the pace curve has a player at `level` (`settings.minutesToReach`).
     * ⚠️ The curve, not the pace's own level tracks: a coin price is asked inside a profile's choices,
     * which the level tracks are built from, so reading them here would go round in a circle.
     */
    const curveMemo = new Map();
    const curveHoursTo = (level) => {
        if (!(level > 1)) return 0;
        if (!curveMemo.has(level)) curveMemo.set(level, minutesToReach(settings, level) / 60);
        return curveMemo.get(level);
    };
    /** Hours from a new game at which a stage begins: the budget of the latest stage before it, 0 for the first. */
    function stageStartHours(tier) {
        let minutes = 0;
        for (const st of settings.stages) if (st.tier < tier) minutes = Math.max(minutes, st.budgetMinutes);
        return minutes / 60;
    }

    const bossCamps = new Set((ledger.world.worldTables?.kits || []).flatMap(k => list(k?.bossCamps)));
    const theftMemo = new Map();
    /**
     * Thefts that take coins by stage `cap`: each Hideout had by then robbing each camp had by then
     * whose enemy's steal table takes coins (the camp's enemy is the first its spawns name that
     * carries a table, `Hideouts.js`; a boss camp is never robbed). A theft a cycle at the Hideout's
     * own time, less those caught at its curve, the thief at the Hideout's own level against the
     * camp's Crime level: `[{ hideout, enemy, camp, skill, level, thefts, coins, perHour }]`. Not
     * modelled: the time a guard stands on the camp after a catch, Quiet, Coin Find at the Hideout.
     */
    function theftsAt(cap) {
        if (theftMemo.has(cap)) return theftMemo.get(cap);
        const out = [];
        const hideouts = Object.keys(ledger.world.tokens).filter(id => stationKindOf(rates.token(id)) === HIDEOUT_KIND && tierWithin(tokenKey(id), cap));
        if (hideouts.length) {
            const robbed = [];
            for (const [campId, def] of Object.entries(ledger.world.tokens)) {
                if (!isObject(def.spawner) || bossCamps.has(campId) || !tierWithin(tokenKey(campId), cap)) continue;
                const enemyId = list(def.spawner.spawns).map(sp => sp.typeId).find(id => isObject(rates.token(id)?.enemy) && stealOf(rates.token(id)));
                const enemy = enemyId ? rates.token(enemyId) : null;
                const coins = enemy ? stealOf(enemy).coins : 0;
                if (coins > 0 && tierWithin(tokenKey(enemyId), cap)) robbed.push({ camp: campId, enemy: enemyId, def: enemy, coins });
            }
            for (const hideout of hideouts) {
                const def = rates.token(hideout);
                const cycleMs = Number(def.config?.cycleTimeMs);
                if (!(cycleMs > 0)) continue;
                const level = Math.max(1, Math.floor(Number(def.config?.skillRequired) || 1));
                for (const r of robbed) {
                    const caught = caughtChance(level, crimeLevelOf(r.def), caughtCurveOf(def)) / 100;
                    const thefts = (HOUR_MS / cycleMs) * (1 - caught);
                    out.push({ hideout, enemy: r.enemy, camp: r.camp, skill: def.config?.skill || null, level, thefts, coins: r.coins, perHour: thefts * r.coins });
                }
            }
        }
        theftMemo.set(cap, out);
        return out;
    }

    /** The ways a hero earns coins: selling what a work makes, a kill's Coin drop, a Hideout's thefts. */
    const EARN = Object.freeze({ SELL: 'sell', KILL: 'kill', THEFT: 'theft' });
    const NO_COINS = Object.freeze({ perHour: 0, kind: null, work: null, theft: null, readyHours: 0 });
    const sourceMemo = new Map();
    const sourceBusy = new Set();
    /**
     * Every way one hero earns coins at a profile and stage, the most an hour first: `[{ perHour,
     * kind, work, theft, readyHours }]` (`kind` {@link EARN}: a fight is a kill, whatever its loot
     * sells for), each a work's net coins fed as the guild feeds it
     * ({@link coinRateOf}) or a Hideout's thefts ({@link theftsAt}), with the hours from a new game
     * the pace curve reaches its level gate at ({@link curveHoursTo}; a fight's, its enemy's level). A work
     * that pays coins (a build on a Foundation that asks them) earns none here. Asked only of a price
     * that asks coins, so content without coin costs never reads it.
     */
    function coinSourcesOf(profile, cap) {
        const key = `${profile}|${cap}`;
        if (sourceMemo.has(key)) return sourceMemo.get(key);
        // ⚠️ A guard, never met while no coin income asks for coins itself.
        if (sourceBusy.has(key)) return [];
        sourceBusy.add(key);
        const out = [];
        for (const work of works) {
            if (work.tier === null || work.tier > cap) continue;
            const { rate, context } = profiles.profileOf(work.target, profile, cap);
            if (!rate.ok || rate.coins < 0) continue;
            const perHour = coinRateOf(workAt(work, profile, cap));
            if (!(perHour > 0)) continue;
            // A fight is had at its enemy's level, as the reach reads a fight's difficulty.
            const enemy = rates.token(work.target.token)?.enemy;
            const gate = isObject(enemy) ? Math.max(1, Number(enemy.level) || 1) : context.skill ? (context.gate ?? 1) : 1;
            out.push({ perHour, kind: isObject(enemy) ? EARN.KILL : EARN.SELL, work, theft: null, readyHours: curveHoursTo(gate) });
        }
        for (const t of theftsAt(cap)) {
            if (t.perHour > 0) out.push({ perHour: t.perHour, kind: EARN.THEFT, work: null, theft: t, readyHours: curveHoursTo(t.level) });
        }
        out.sort((a, b) => b.perHour - a.perHour || a.readyHours - b.readyHours);
        sourceBusy.delete(key);
        sourceMemo.set(key, out);
        return out;
    }

    /**
     * The guild's coins an hour at a profile and stage, `hours` into a new game: the most one hero
     * earns on a way to earn them whose level the guild has by then, `{ perHour, work, theft,
     * readyHours }` ({@link coinSourcesOf}); every way, whatever its level, when `hours` is left out.
     */
    function coinSupplyOf(profile, cap, hours = Infinity) {
        for (const src of coinSourcesOf(profile, cap)) if (src.readyHours <= hours) return src;
        return NO_COINS;
    }

    /**
     * A worker's selling at a profile and stage, `hours` into a new game: the best-paying work whose
     * output is sold, among the work whose level the guild has by then ({@link coinSourcesOf}), the
     * best at that moment, never an average. What a coin price is set on (BALANCE_RULES section 7):
     * a fighter's kills and a Hideout's thefts are priced at half of it, so they never set it.
     */
    function sellingSupplyOf(profile, cap, hours = Infinity) {
        for (const src of coinSourcesOf(profile, cap)) if (src.kind === EARN.SELL && src.readyHours <= hours) return src;
        return NO_COINS;
    }

    /**
     * Hours to earn `coins` from `hours` into a new game: on the way that has them soonest, waiting
     * first for its level where a better way is worth the wait. Infinity when nothing earns coins.
     * ⚠️ Each way at its own level's rate: a hero levelling while they earn is not counted.
     */
    function coinHoursFrom(profile, cap, coins, hours) {
        let best = Infinity;
        for (const src of coinSourcesOf(profile, cap)) {
            const h = Math.max(0, src.readyHours - hours) + coins / src.perHour;
            if (h < best) best = h;
        }
        return best;
    }

    /**
     * The level a hero levelling `skill` at `level` works a piece of work at, as far as its rate goes:
     * the last of the skill's milestone perks they hold, or the work's own gate when that is higher.
     * Null when that is the gate (the work's default). Levels between two perks rate the same.
     */
    const perkLevels = (skill) => (rates.perkTables?.[skill] || []).map(r => r.level);
    function bandLevel(work, skill, level) {
        const held = perkLevels(skill).filter(l => l <= level);
        const band = held.length ? Math.max(...held) : 0;
        const gate = profiles.contextOf(work.target).gate ?? 1;
        return band > gate ? band : null;
    }
    /** The band a level falls in: the last milestone perk of the skill at or below it, 0 below the first. */
    const bandOf = (skill, level) => Math.max(0, ...perkLevels(skill).filter(l => l <= level));

    // ── level tracks ───────────────────────────────────────────────────────────────────────────
    const askedAt = new Map();
    for (const [key, at] of reach) {
        if (!Number.isInteger(at.tier) || at.planned || !isEntry(key)) continue;
        // A Parked entry's levels still count: a live path may run through it.
        const tier = effTier(key);
        for (const [skill, level] of Object.entries(at.levels || {})) {
            if (skill === COMBAT || isCombatStyle(skill)) continue;
            if (!askedAt.has(skill)) askedAt.set(skill, []);
            askedAt.get(skill).push({ level, tier, key });
        }
    }
    const skillsOfWork = new Map();
    for (const work of works) {
        if (work.tier === null) continue;
        const skill = profiles.contextOf(work.target).skill;
        if (!skill) continue;
        if (!skillsOfWork.has(skill)) skillsOfWork.set(skill, []);
        skillsOfWork.get(skill).push(work);
    }

    const trackMemo = new Map();
    /**
     * One skill's level track: for each level from 1 to the highest any entry asks, the stage that
     * first asks it, the hours it takes at each profile, the cumulative hours, the source, and the
     * curve's minutes.
     */
    function trackOf(skill) {
        if (trackMemo.has(skill)) return trackMemo.get(skill);
        const asks = askedAt.get(skill) || [];
        const top = Math.min(MAX_SKILL_LEVEL, Math.max(1, ...asks.map(a => a.level)));
        const levels = [];
        const total = { bare: 0, typical: 0, maxed: 0 };
        const spent = { bare: 0, typical: 0, maxed: 0 };
        for (let level = 1; level < top; level++) {
            const needing = asks.filter(a => a.level > level);
            const tier = needing.length ? Math.min(...needing.map(a => a.tier).filter(Number.isInteger)) : maxTier;
            const cap = Number.isFinite(tier) ? tier : maxTier;
            const xp = xpForLevel(level + 1) - xpForLevel(level);
            // `work`: the guild's hero-hours the level takes, its chain's heroes at work all the while (its maker, gatherers and
            // brewers, as many as it has); `made`: what its work makes meanwhile, free for a price (its inputs are its gatherers').
            const row = { level, tier: cap, xp, curveMinutes: minutesPerLevelAt(settings, level), hours: {}, cumulative: {}, work: {}, cumulativeWork: {}, made: {}, source: {} };
            for (const profile of PROFILES) {
                const best = bestXp(skill, level, profile, cap);
                const hours = best.xp > 0 ? xp / best.xp : Infinity;
                const work = hours * (best.work ? Math.min(best.need, best.have) : 1);
                total[profile] += hours;
                spent[profile] += work;
                row.hours[profile] = hours;
                row.cumulative[profile] = total[profile];
                row.work[profile] = work;
                row.cumulativeWork[profile] = spent[profile];
                row.source[profile] = best;
                const made = {};
                if (best.work && Number.isFinite(hours)) {
                    const f = workAt(best.work, best.profile, cap, best.at);
                    for (const [item, n] of Object.entries(f.items || {})) if (n > 0) made[item] = n * best.chain * hours;
                }
                row.made[profile] = made;
            }
            levels.push(row);
        }
        const out = { skill, top, levels, asks };
        trackMemo.set(skill, out);
        return out;
    }

    const bestMemo = new Map();
    /**
     * The best XP an hour any work of a skill gives a hero at a level, at a profile and stage: each
     * work rated with the milestone perks the hero holds by then (`at`: the level it was rated at,
     * null for its own gate), so the ranking is kept per level band. A hero levelling at a profile
     * works each piece of work with its profile's setup or a lower profile's (`profile` on the
     * answer), whichever gives more XP: a profile chooses boosts for the work's worth, and one that
     * adds worth can slow the levelling (a potion that starves the work for more loot). So a level
     * never takes longer at Maxed than at Typical, nor at Typical than at Bare.
     */
    function bestXp(skill, level, profile, cap) {
        let best = { xp: 0, work: null };
        for (const r of rankedXp(skill, level, profile, cap)) if (r.gate <= level && r.xp > best.xp) best = r;
        return best;
    }

    /** Every work of a skill rated as {@link bestXp} rates it for a level's band, lowest gate first (some not open at the level). */
    function rankedXp(skill, level, profile, cap) {
        const band = bandOf(skill, level);
        const key = `${skill}|${profile}|${cap}|${band}`;
        let ranked = bestMemo.get(key);
        if (!ranked) {
            ranked = (skillsOfWork.get(skill) || [])
                .filter(w => w.tier !== null && w.tier <= cap)
                .flatMap(w => {
                    const at = bandLevel(w, skill, band);
                    return levelledAs(profile).map(as => {
                        const f = workAt(w, as, cap, at);
                        const staff = staffingOf(w, as, cap, at);
                        return {
                            work: w, at, profile: as, gate: f.rate.gates?.needed ?? 1, xp: (f.xp[skill] || 0) * staff.scale, scale: f.scale, short: f.short,
                            chain: staff.scale, need: staff.need, have: staff.have
                        };
                    });
                })
                .filter(x => x.xp > 0)
                .sort((a, b) => a.gate - b.gate);
            bestMemo.set(key, ranked);
        }
        return ranked;
    }

    /** Hours from a new game to a skill level at a profile: the track's cumulative hours. */
    function levelHours(skill, level, profile) {
        if (level <= 1) return 0;
        const track = trackOf(skill);
        const row = track.levels[Math.min(level, track.top) - 2];
        if (!row) return 0;
        return level > track.top ? Infinity : row.cumulative[profile];
    }

    /** The guild's hero-hours from a new game to a skill level at a profile: the track's cumulative work. */
    function levelWork(skill, level, profile) {
        if (level <= 1) return 0;
        const track = trackOf(skill);
        const row = track.levels[Math.min(level, track.top) - 2];
        if (!row) return 0;
        return level > track.top ? Infinity : row.cumulativeWork[profile];
    }

    /**
     * As {@link levelHours}, but on past the highest level any entry asks: those levels are worked
     * at the best source open by stage `cap` (the last stage by default). What a level gate moved
     * higher than today's top would take.
     */
    function hoursToLevel(skill, level, profile = PROFILE.TYPICAL, cap = null) {
        const target = Math.min(MAX_SKILL_LEVEL, Math.floor(level));
        if (target <= 1) return 0;
        const track = trackOf(skill);
        const within = Math.min(target, track.top);
        let hours = within >= 2 ? track.levels[within - 2].cumulative[profile] : 0;
        for (let l = Math.max(1, track.top); l < target && Number.isFinite(hours); l++) {
            const best = bestXp(skill, l, profile, cap ?? maxTier);
            hours += best.xp > 0 ? (xpForLevel(l + 1) - xpForLevel(l)) / best.xp : Infinity;
        }
        return hours;
    }

    /** The highest level of a skill had within `hours` of a new game at a profile ({@link hoursToLevel}), from 1. */
    function levelAtHours(skill, hours, profile = PROFILE.TYPICAL, cap = null) {
        let level = 1;
        while (level < MAX_SKILL_LEVEL && hoursToLevel(skill, level + 1, profile, cap) <= hours) level++;
        return level;
    }

    // ── path time ──────────────────────────────────────────────────────────────────────────────
    const gatherHours = (inputs, profile, cap, coins = 0, from = undefined) => {
        // One hero on each item, and one earning its coins: the slowest sets the time.
        let worst = 0;
        let item = null;
        for (const { key, quantity } of inputs) {
            if (!(quantity > 0)) continue;
            const s = pacedSupply(parseKey(key).id, profile, cap);
            const h = s > 0 ? quantity / s : Infinity;
            if (h > worst) { worst = h; item = key; }
        }
        if (!(coins > 0)) return { hours: worst, item };
        const h = coinCostHours(coins, profile, cap, from);
        if (h > worst) { worst = h; item = COINS; }
        return { hours: worst, item, coins };
    };
    const priceWhy = (g) => (Number.isFinite(g.hours) ? null : g.item === COINS ? PACE_TEXT.noCoins : 'its price is never made');

    /**
     * The own time of the step that gives `give` by `rule` at a profile: `{ hours, complete, why }`.
     * `start`: hours from a new game the step may begin, from when its coins are earned.
     */
    function stepOf(rule, give, profile, cap, start) {
        const done = (hours, why = null, extra = {}) => ({ hours, complete: Number.isFinite(hours), why, ...extra });
        const ratedBy = (target) => {
            const work = byKey.get(targetKey(target));
            return work ? paced(work, profile, Math.max(cap, work.tier ?? cap)) : null;
        };
        const firstOf = (f, what) => {
            if (!f || !f.rate.ok) return done(Infinity, f?.rate?.reason ? `not worked: ${f.rate.reason}` : 'not rated');
            const { id, kind } = parseKey(what);
            const perHour = kind === 'item' ? f.items[id] : f.tokens[id];
            if (perHour > 0) return done(1 / perHour, null, { perHour });
            if (f.rate.lifecycle?.kind === LIFECYCLE.ONE_OFF) {
                const per = kind === 'item' ? f.rate.perCycle?.[id] : null;
                const cycles = f.rate.lifecycle.cycles || 1;
                if (per > 0 && 1 / per <= cycles) return done((f.rate.cycleMs / HOUR_MS) / per, null, { oneOff: true });
                return done(Infinity, 'a one-off find that may not give it');
            }
            return done(Infinity, f.short ? `short of ${parseKey(itemKey(f.short)).id}` : 'never made at this stage');
        };
        switch (rule.how) {
        case HOW.WORK:
        case HOW.DROP: {
            const def = rates.token(parseKey(rule.via).id);
            if (!def) return done(Infinity, 'no such Token');
            const f = ratedBy({ token: def.id });
            return firstOf(f, give.key);
        }
        case HOW.CATCH: {
            const id = parseKey(rule.via).id;
            // A fishing spot's catch is its own pool's, where the spot stands; a fixed water's, its best pool's.
            const own = rule.pathVia ? rule.pool?.key : null;
            const pools = works.filter(w => w.target.token === id && w.target.pool && (!own || w.target.pool === own));
            // The hero fishes at the level the fish asks, or the pool's lowest fish's if that is higher:
            // a water's own gate may be under every fish it holds, and no catch lands there.
            const asks = rule.gates.reduce((top, g) => Math.max(top, g.level), 0);
            let best = done(Infinity, 'no pool catches it');
            for (const w of pools) {
                const level = Math.max(asks, profiles.contextOf(w.target).gate ?? 1);
                const r = firstOf(paced(w, profile, Math.max(cap, w.tier ?? cap), level > 1 ? level : null), give.key);
                if (r.hours < best.hours) best = r;
            }
            return best;
        }
        case HOW.CRAFT: {
            const recipeId = parseKey(rule.via).id;
            const recipe = rates.recipes[recipeId];
            if (list(recipe?.foundationKinds).length) {
                // A build is paid once: gather its inputs, then build.
                const g = gatherHours(rule.inputs, profile, cap);
                return done(g.hours + (Number(recipe.durationMs) || 0) / HOUR_MS, Number.isFinite(g.hours) ? null : 'an input is never made', { gather: g });
            }
            const station = reach.get(rule.via)?.via;
            if (!station) return done(Infinity, 'no station');
            return firstOf(ratedBy({ token: parseKey(station).id, recipe: recipeId }), give.key);
        }
        case HOW.SHOP:
        case HOW.STAR: {
            const g = gatherHours(rule.inputs, profile, cap, rule.coins, start);
            return done(g.hours, priceWhy(g), { gather: g });
        }
        case HOW.SETTLE: {
            // A ring's coins are earned with what the rings before it give: settling is the way in.
            if (!(rule.coins > 0)) return done(0);
            const g = gatherHours([], profile, Math.min(cap, budgetTierOf(rule.ring ?? rule.floor)), rule.coins, start);
            return done(g.hours, priceWhy(g), { gather: g });
        }
        case HOW.SPAWN: {
            const def = rates.token(parseKey(rule.via).id);
            const every = Number(def?.spawner?.intervalMs);
            const g = gatherHours(rule.inputs, profile, cap);
            if (every > 0 && give.chance > 0) return done(every / give.chance / HOUR_MS + g.hours);
            return done(Infinity, 'a spawn with no time');
        }
        case HOW.GROW: {
            const def = rates.token(parseKey(rule.via).id);
            const g = gatherHours(rule.inputs, profile, cap);
            return done((Number(def?.grows?.afterMs) || 0) / HOUR_MS + g.hours);
        }
        case HOW.REGROW: {
            const f = ratedBy({ token: parseKey(rule.via).id });
            const cycles = f?.rate?.lifecycle?.cycles;
            return f?.rate?.ok && cycles ? done(cycles * f.rate.cycleMs / HOUR_MS) : done(0);
        }
        case HOW.TRICKLE: {
            const f = ratedBy({ token: parseKey(rule.via).id });
            return firstOf(f, give.key);
        }
        case HOW.UPGRADE:
            return done(rule.cycleMs ? rule.cycleMs / HOUR_MS : 0);
        case HOW.USE: {
            // Its step waits for the first copy (a need); the first one it gives asks the copies past that.
            if (!(give.perCycle > 0)) return done(Infinity, 'a Use that never gives it');
            const g = gatherHours([{ key: rule.via, quantity: Math.max(0, 1 / give.perCycle - 1) }], profile, cap);
            return done(g.hours, Number.isFinite(g.hours) ? null : 'the item used is never made', { gather: g });
        }
        case HOW.BONUS: {
            const target = rule.needs.find(n => n !== rule.via && n.startsWith('token:'));
            const f = target ? ratedBy({ token: parseKey(target).id }) : null;
            const cph = f?.rate?.ok ? f.rate.cyclesPerHour * f.scale : 0;
            return cph > 0 && give.chance > 0 ? done(1 / (cph * give.chance)) : done(Infinity, 'a bonus on work not timed');
        }
        default:
            return done(0);
        }
    }

    const pathMemo = new Map();
    /**
     * When an entry is first had at a profile: `{ hours, complete, start, own, waitsOn, gates, why }`.
     * `start` is when its step may begin (everything it needs had, its levels reached), `own` the
     * step's own time, `waitsOn` what set the start (a need's key, a skill level, or nothing).
     */
    function readyOf(key, profile, seen = new Set()) {
        const memoKey = `${key}|${profile}`;
        if (pathMemo.has(memoKey)) return pathMemo.get(memoKey);
        const at = reach.get(key);
        if (!at || at.planned || !Number.isInteger(at.tier) || !at.rule) {
            return { key, hours: Infinity, complete: false, start: Infinity, own: Infinity, waitsOn: null, gates: [], why: at?.planned ? 'planned' : 'never reached' };
        }
        if (seen.has(key)) return { key, hours: 0, complete: false, start: 0, own: 0, waitsOn: null, gates: [], why: 'a loop' };
        seen.add(key);
        const rule = at.rule;
        let start = 0;
        let waitsOn = null;
        let complete = true;
        for (const need of rule.tool ? [...rule.needs, rule.tool] : rule.needs) {
            const r = readyOf(need, profile, seen);
            if (!r.complete) complete = false;
            if (r.hours > start) { start = r.hours; waitsOn = { need }; }
        }
        const gates = [];
        for (const g of rule.gates) {
            if (g.skill === COMBAT) {
                gates.push({ ...g, hours: null });
                continue;
            }
            // A fighting style is trained by fights, which the calculator does not time: a floor.
            if (isCombatStyle(g.skill)) {
                gates.push({ ...g, hours: null });
                complete = false;
                continue;
            }
            const h = levelHours(g.skill, g.level, profile);
            gates.push({ ...g, hours: h });
            if (h > start) { start = h; waitsOn = { skill: g.skill, level: g.level }; }
        }
        const give = rule.gives.find(g => g.key === key) || { key, chance: at.chance ?? 1 };
        const own = stepOf(rule, give, profile, at.tier, start);
        if (!own.complete) complete = false;
        seen.delete(key);
        const out = {
            key, hours: start + own.hours, complete: complete && Number.isFinite(start + own.hours), start, own: own.hours,
            waitsOn, gates, why: own.why, how: rule.how, via: rule.via, step: own
        };
        pathMemo.set(memoKey, out);
        return out;
    }

    /** The chain of steps that sets an entry's time, latest first: each step and what it waited for. */
    function criticalPath(key, profile) {
        const steps = [];
        const seen = new Set();
        let at = key;
        while (at && !seen.has(at)) {
            seen.add(at);
            const r = readyOf(at, profile);
            steps.push(r);
            at = r.waitsOn?.need ?? null;
        }
        return steps;
    }

    // ── the guild's time, spent once ─────────────────────────────────────────────────────────────
    const NO_WORK = Object.freeze({ levels: Object.freeze({}), steps: Object.freeze(new Set()) });
    const workMemo = new Map();
    /**
     * Everything an entry's path asks of the guild at a profile: the highest level of each skill on
     * the way (`levels`) and every step on it (`steps`, keys), each once however many steps need it.
     */
    function pathWorkOf(key, profile, seen = new Set()) {
        const memoKey = `${key}|${profile}`;
        if (workMemo.has(memoKey)) return workMemo.get(memoKey);
        const at = reach.get(key);
        if (!at || at.planned || !Number.isInteger(at.tier) || !at.rule || seen.has(key)) return NO_WORK;
        seen.add(key);
        const rule = at.rule;
        const levels = {};
        const steps = new Set([key]);
        for (const need of rule.tool ? [...rule.needs, rule.tool] : rule.needs) {
            const w = pathWorkOf(need, profile, seen);
            for (const skill in w.levels) if (!(levels[skill] >= w.levels[skill])) levels[skill] = w.levels[skill];
            for (const k of w.steps) steps.add(k);
        }
        for (const g of rule.gates) {
            if (g.skill === COMBAT || isCombatStyle(g.skill)) continue;
            if (!(levels[g.skill] >= g.level)) levels[g.skill] = g.level;
        }
        seen.delete(key);
        const out = { levels, steps };
        workMemo.set(memoKey, out);
        return out;
    }

    const NO_PARTS = Object.freeze({ goods: Object.freeze([]), coins: 0, coinCap: 0, cap: 0, fixed: 0, own: 0, gives: null });
    const partsMemo = new Map();
    /**
     * What one step asks of the guild at a profile: the goods its price takes (a Shop Token, a Guild
     * Hall star, a build's materials, what a spawn or a growth spends) and its coins, a build's own
     * time (`fixed`), and a hero's own time on a piece of work (`own`: the first of something, a find
     * at average luck) with what it gives (`gives`). A clock no hero works (a spawn's wait, a growth,
     * a regrowth, a trickle) asks none.
     */
    function stepPartsOf(key, profile) {
        const memoKey = `${key}|${profile}`;
        if (partsMemo.has(memoKey)) return partsMemo.get(memoKey);
        const at = reach.get(key);
        const rule = at?.rule;
        let out = NO_PARTS;
        if (rule && Number.isInteger(at.tier)) {
            const cap = at.tier;
            const base = { ...NO_PARTS, cap, coinCap: cap };
            const own = () => {
                const h = readyOf(key, profile).own;
                return Number.isFinite(h) ? h : 0;
            };
            const gives = parseKey(key).kind === 'item' ? parseKey(key).id : null;
            switch (rule.how) {
            case HOW.SHOP:
            case HOW.STAR:
                out = { ...base, goods: rule.inputs || [], coins: rule.coins || 0 };
                break;
            case HOW.SETTLE:
                out = { ...base, coins: rule.coins || 0, coinCap: Math.min(cap, budgetTierOf(rule.ring ?? rule.floor)) };
                break;
            case HOW.CRAFT: {
                const recipe = rates.recipes[parseKey(rule.via).id];
                out = list(recipe?.foundationKinds).length
                    ? { ...base, goods: rule.inputs || [], fixed: (Number(recipe.durationMs) || 0) / HOUR_MS }
                    : { ...base, own: own(), gives };
                break;
            }
            case HOW.SPAWN:
            case HOW.GROW:
                out = { ...base, goods: rule.inputs || [] };
                break;
            case HOW.USE: {
                const per = rule.gives.find(g => g.key === key)?.perCycle;
                out = { ...base, goods: per > 0 && per < 1 ? [{ key: rule.via, quantity: 1 / per - 1 }] : [] };
                break;
            }
            case HOW.WORK:
            case HOW.DROP:
            case HOW.CATCH:
            case HOW.BONUS:
                out = { ...base, own: own(), gives };
                break;
            default:
                out = base;
            }
        }
        partsMemo.set(memoKey, out);
        return out;
    }

    /**
     * The guild's hero-hours one step takes at a profile, its goods drawn first from `stock` (what the
     * levels on the way made, which it takes from): what is left gathered at its hero-hours, its
     * gatherers down the chain counted, and its coins earned. A hero's own time on a piece of work is
     * spent only when the stock holds none of what it gives.
     */
    function stepWork(key, profile, stock) {
        const p = stepPartsOf(key, profile);
        let out = p.fixed;
        for (const { key: k, quantity } of p.goods) {
            if (!(quantity > 0)) continue;
            const id = parseKey(k).id;
            const free = Math.min(quantity, stock.get(id) || 0);
            if (free > 0) stock.set(id, stock.get(id) - free);
            const h = quantity > free ? (quantity - free) * heroHoursOf(id, profile, p.cap) : 0;
            if (Number.isFinite(h)) out += h;
        }
        if (p.coins > 0) {
            const c = coinCostHours(p.coins, profile, p.coinCap);
            if (Number.isFinite(c)) out += c;
        }
        if (p.own > 0 && !((stock.get(p.gives) || 0) >= 1)) out += p.own;
        return out;
    }

    const madeMemo = new Map();
    /** What a skill's levels make from a new game to `level` at a profile, at their best sources: `Map<itemId, count>`. */
    function levelMade(skill, level, profile) {
        const track = trackOf(skill);
        const to = Math.min(level, track.top);
        const key = `${skill}|${to}|${profile}`;
        if (madeMemo.has(key)) return madeMemo.get(key);
        const out = to > 2 ? new Map(levelMade(skill, to - 1, profile)) : new Map();
        const row = to >= 2 ? track.levels[to - 2] : null;
        for (const [item, n] of Object.entries(row?.made?.[profile] || {})) out.set(item, (out.get(item) || 0) + n);
        madeMemo.set(key, out);
        return out;
    }

    /**
     * The guild's hero-hours for a path's work at a profile, its time spent once: its levels' hero-
     * hours (each skill once, to the highest asked), and its steps', each price taken first from what
     * those levels made on the way (a forester levelling fells the wood a build asks).
     * `{ heroHours, levelHeroHours, stepHeroHours, steps: [{ key, heroHours }] }`.
     */
    function workFor(work, profile) {
        const stock = new Map();
        let levelHeroHours = 0;
        for (const skill in work.levels) {
            const h = levelWork(skill, work.levels[skill], profile);
            if (Number.isFinite(h)) levelHeroHours += h;
            for (const [item, n] of levelMade(skill, work.levels[skill], profile)) stock.set(item, (stock.get(item) || 0) + n);
        }
        let stepHeroHours = 0;
        const steps = [];
        for (const key of work.steps) {
            const h = stepWork(key, profile, stock);
            stepHeroHours += h;
            if (h > 0) steps.push({ key, heroHours: h });
        }
        return { heroHours: levelHeroHours + stepHeroHours, levelHeroHours, stepHeroHours, steps };
    }
    const heroHoursFor = (work, profile) => workFor(work, profile).heroHours;

    /**
     * The guild's heroes by stage, each from when the curve reaches it to when the curve leaves it
     * (the stages' budgets): `[{ tier, from, to, heroes }]` in hours. The reference guild's heroes
     * arrive as the curve's player gets to each tier.
     */
    const heroSpans = (() => {
        const out = [];
        let from = 0;
        for (const st of [...settings.stages].sort((a, b) => a.tier - b.tier)) {
            const to = Math.max(from, st.budgetMinutes / 60);
            out.push({ tier: st.tier, from, to, heroes: heroesAt(settings, st.tier) });
            from = to;
        }
        return out;
    })();
    /** Hours from a new game the guild's heroes take to put in `heroHours` of work, each stage's heroes over its span ({@link heroSpans}). */
    function hoursForWork(heroHours) {
        if (!(heroHours > 0)) return 0;
        let done = 0;
        for (const span of heroSpans) {
            const room = (span.to - span.from) * span.heroes;
            if (done + room >= heroHours) return span.from + (heroHours - done) / span.heroes;
            done += room;
        }
        const last = heroSpans[heroSpans.length - 1] || { to: 0, heroes: 1 };
        return last.to + (heroHours - done) / last.heroes;
    }

    const arrivalMemo = new Map();
    /**
     * When an entry is first had at a profile with the reference guild's heroes: its path's time
     * ({@link readyOf}: every skill levelled side by side, each price by its own hero), and never before
     * the guild's heroes can put in all the work its path asks, one hero-hour at a time
     * ({@link hoursForWork}). `{ hours, pathHours, heroHours, workHours, byWork }`, `byWork` when the
     * heroes set it.
     */
    function arrivalOf(key, profile) {
        const memoKey = `${key}|${profile}`;
        if (arrivalMemo.has(memoKey)) return arrivalMemo.get(memoKey);
        const r = readyOf(key, profile);
        let out;
        if (!Number.isFinite(r.hours)) {
            out = { hours: r.hours, pathHours: r.hours, heroHours: null, workHours: null, byWork: false, complete: r.complete };
        } else {
            const heroHours = heroHoursFor(pathWorkOf(key, profile), profile);
            const workHours = hoursForWork(heroHours);
            out = { hours: Math.max(r.hours, workHours), pathHours: r.hours, heroHours, workHours, byWork: workHours > r.hours, complete: r.complete };
        }
        arrivalMemo.set(memoKey, out);
        return out;
    }

    // ── the rings ──────────────────────────────────────────────────────────────────────────────
    const ringLines = ledger.world.worldTables?.lines || [];
    const ringMemo = new Map();
    /**
     * When ring `ring` is first settled at a profile: the earliest of its wedges whose path is fully
     * timed, else the earliest of any (a floor: a gate the pace cannot time, such as a fighting
     * style's level), `{ hours, key, complete }`, each at its arrival with the reference guild's
     * heroes ({@link arrivalOf}); Infinity with no wedge of that ring in the reach (a wild ring: the
     * reach places the strict ones).
     */
    function ringOpensAt(ring, profile = PROFILE.TYPICAL) {
        const memoKey = `${ring}|${profile}`;
        if (ringMemo.has(memoKey)) return ringMemo.get(memoKey);
        let timed = null;
        let any = null;
        for (const line of ringLines) {
            const key = wedgeKey(line.id, ring);
            if (!reach.has(key)) continue;
            const r = arrivalOf(key, profile);
            const at = { hours: r.hours, key, complete: r.complete };
            if (!any || r.hours < any.hours) any = at;
            if (r.complete && (!timed || r.hours < timed.hours)) timed = at;
        }
        const best = timed || any || { hours: Infinity, key: null, complete: false };
        ringMemo.set(memoKey, best);
        return best;
    }
    /**
     * Hours from a new game at which the stage ring `ring` opens after ends (its budget), or null with
     * none set. A wild ring has none: the ladder's stages all lie in the strict rings, so its star
     * grows from the one before (`wild.priceGrowth`).
     */
    const ringBudgetHours = (ring) => {
        if (ring > STRICT_RINGS) return null;
        const stage = settings.stages.find(s => s.tier === budgetTierOf(ring));
        return stage ? stage.budgetMinutes / 60 : null;
    };

    // ── stages ─────────────────────────────────────────────────────────────────────────────────
    const entryKeys = [...plans.keys()].filter(k => /^(item|token|recipe):/.test(k));
    const counted = (key) => {
        const status = statusOf(key);
        return status !== PLAN_STATUS.PLANNED && status !== PLAN_STATUS.PARKED;
    };
    const stageWorkMemo = new Map();
    /** Everything planned for a stage and the ones before it at the curve's player, each level and step once: `{ levels, steps }`. */
    function stageWorkOf(tier) {
        if (stageWorkMemo.has(tier)) return stageWorkMemo.get(tier);
        const before = tier > 0 ? stageWorkOf(tier - 1) : NO_WORK;
        const levels = { ...before.levels };
        const steps = new Set(before.steps);
        for (const key of entryKeys) {
            if (!counted(key) || effTier(key) !== tier || !Number.isFinite(readyOf(key, TARGET).hours)) continue;
            const w = pathWorkOf(key, TARGET);
            for (const skill in w.levels) if (!(levels[skill] >= w.levels[skill])) levels[skill] = w.levels[skill];
            for (const k of w.steps) steps.add(k);
        }
        const out = { levels, steps };
        stageWorkMemo.set(tier, out);
        return out;
    }

    // ── the way out of a stage ─────────────────────────────────────────────────────────────────
    /** The world's places by the tier they are of (a settle rule's rung): `Map<tier, key[]>`. */
    const placesByTier = new Map();
    for (const [key, at] of reach) {
        const rule = at?.rule;
        if (rule?.how !== HOW.SETTLE || at.planned || !Number.isInteger(at.tier) || !Number.isInteger(rule.floor)) continue;
        if (!placesByTier.has(rule.floor)) placesByTier.set(rule.floor, []);
        placesByTier.get(rule.floor).push(key);
    }

    /**
     * Hours from a new game to a skill level at a profile with no work later than stage `cap`, and the
     * guild's hero-hours they take: each level as its track has it ({@link trackOf}: at the stage that
     * first asks past it), but at `cap` where that stage is later, and on past the track's top.
     * `{ hours, work }`. A way out is levelled with its own stage's work, never the next stage's.
     */
    function levelTimeTo(skill, level, profile, cap) {
        const target = Math.min(MAX_SKILL_LEVEL, Math.floor(level));
        const track = trackOf(skill);
        let hours = 0;
        let work = 0;
        for (let l = 1; l < target && Number.isFinite(hours); l++) {
            const row = track.levels[l - 1];
            if (row && row.tier <= cap) {
                hours += row.hours[profile];
                work += row.work[profile];
                continue;
            }
            const best = bestXp(skill, l, profile, cap);
            const h = best.xp > 0 ? (xpForLevel(l + 1) - xpForLevel(l)) / best.xp : Infinity;
            hours += h;
            work += h * (best.work ? Math.min(best.need, best.have) : 1);
        }
        return { hours, work };
    }

    /**
     * Settling one place as the way out of stage `tier` at the curve's player: its level in each
     * skill it asks (each by its own hero, with no work past the stage: {@link levelTimeTo}), then its
     * price (`priceHours`: its coins, earned from then), the path (`pathHours`); and the guild's
     * hero-hours for both (`heroHours`: each level's work and the price once), put in by the guild's
     * heroes ({@link hoursForWork}). What else settling it needs (the place before, the ring's star)
     * is left out: it has its own times. `levels` (`{ skill: level }`) and `coins` time it as if it
     * asked those instead.
     */
    function placeWayOut(key, tier, { levels = null, coins = null } = {}) {
        const at = reach.get(key);
        const base = at.rule;
        // The same place asking other levels or coins: what a settle level or a ring's coins moved would give.
        const rule = levels || coins !== null
            ? { ...base, gates: base.gates.map(g => ({ ...g, level: levels?.[g.skill] ?? g.level })), coins: coins ?? base.coins }
            : base;
        let start = 0;
        let complete = true;
        let levelHeroHours = 0;
        const asks = [];
        const floor = [];
        // ⚠️ Its goods are the world seed's: the rule carries none, so its price here is its coins alone.
        if (!list(rule.inputs).length) floor.push(WAY_OUT_FLOOR.GOODS);
        for (const g of rule.gates) {
            // Combat and a fighting style are trained by fights, which the calculator does not time: a floor.
            if (g.skill === COMBAT || isCombatStyle(g.skill)) {
                asks.push({ skill: g.skill, level: g.level, hours: null });
                complete = false;
                if (!floor.includes(WAY_OUT_FLOOR.FIGHTS)) floor.push(WAY_OUT_FLOOR.FIGHTS);
                continue;
            }
            const { hours, work } = levelTimeTo(g.skill, g.level, TARGET, tier);
            asks.push({ skill: g.skill, level: g.level, hours });
            if (hours > start) start = hours;
            levelHeroHours += work;
        }
        const give = rule.gives.find(x => x.key === key) || { key, chance: 1 };
        const price = stepOf(rule, give, TARGET, at.tier, start);
        const pathHours = start + price.hours;
        // A settle step's work is its coins earned (`stepWork`), worked out here for the coins asked.
        const priceWork = rule === base ? stepWork(key, TARGET, new Map())
            : rule.coins > 0 ? coinCostHours(rule.coins, TARGET, Math.min(at.tier, budgetTierOf(rule.ring ?? rule.floor))) : 0;
        const heroHours = levelHeroHours + priceWork;
        const workHours = Number.isFinite(heroHours) ? hoursForWork(heroHours) : Infinity;
        const hours = Math.max(pathHours, workHours);
        return {
            place: key, name: nameOf(key), ring: rule.ring ?? null, asks, coins: rule.coins || 0,
            levelHours: start, priceHours: price.hours, pathHours, levelHeroHours, heroHours, workHours, hours,
            byWork: Number.isFinite(hours) && workHours > pathHours, complete: complete && Number.isFinite(hours),
            floor: Number.isFinite(hours) ? floor : []
        };
    }

    const stageTiers = [...new Set(settings.stages.map(s => s.tier))].sort((a, b) => a - b);
    const gateMemo = new Map();
    /**
     * The way out of a stage at the curve's player (BALANCE_RULES section 8, owner 2026-11-26:
     * leaving a stage means settling the next place): the soonest of the next stage's places
     * ({@link placeWayOut}), with the stage's heroes, a fully timed one before any floor.
     * `{ tier, next, why, heroes, place, name, ring, asks: [{ skill, level, hours }], coins,
     * levelHours, priceHours, pathHours, levelHeroHours, heroHours, workHours, hours, byWork, complete,
     * floor, needs: [{ key, name, hours }], places }`: `why` is null, `'last'` for the last stage, or
     * `'none'` when no place is of the next stage's tier; `floor` why its time is a floor
     * ({@link WAY_OUT_FLOOR}, none when it is never had); `needs` what else settling the place needs,
     * each at its arrival, as information; `places` how many it was the soonest of.
     */
    function gateOf(tier) {
        if (gateMemo.has(tier)) return gateMemo.get(tier);
        const next = stageTiers.find(t => t > tier) ?? null;
        const base = { tier, next, heroes: heroesAt(settings, tier), place: null, hours: null, needs: [], places: 0, floor: [] };
        let out;
        if (next === null) {
            out = { ...base, why: 'last' };
        } else {
            const keys = placesByTier.get(next) || [];
            // A place whose time is a floor (a fighting style's level) comes after every timed one.
            const timed = keys.map(k => placeWayOut(k, tier))
                .sort((a, b) => b.complete - a.complete || a.hours - b.hours || a.heroHours - b.heroHours || a.place.localeCompare(b.place));
            if (!timed.length) {
                out = { ...base, why: 'none' };
            } else {
                const best = timed[0];
                const needs = reach.get(best.place).rule.needs.map(k => ({ key: k, name: nameOf(k), hours: arrivalOf(k, TARGET).hours }));
                out = { ...base, ...best, why: null, needs, places: timed.length };
            }
        }
        gateMemo.set(tier, out);
        return out;
    }

    const stageMemo = new Map();
    /**
     * A stage at the curve's player ({@link TARGET}): its way out (`gate`, {@link gateOf}), which its
     * budget times, and its full content, information only: when a new game first has everything
     * planned for it, with the reference guild's heroes. Each entry at its arrival
     * ({@link arrivalOf}), and the content no sooner than the guild's heroes can put in all the work of
     * every entry planned for it and the stages before (`heroHours`, each level and step once, at
     * `workHours`); `pathHours` is the slowest entry's path with every skill levelled side by side.
     */
    function stageOf(tier) {
        if (stageMemo.has(tier)) return stageMemo.get(tier);
        const keys = entryKeys.filter(k => counted(k) && effTier(k) === tier);
        const timed = [];
        const untimed = [];
        for (const key of keys) {
            const r = arrivalOf(key, TARGET);
            if (Number.isFinite(r.hours)) timed.push({ key, hours: r.hours, pathHours: r.pathHours, complete: r.complete });
            else untimed.push(key);
        }
        timed.sort((a, b) => b.hours - a.hours);
        const stage = settings.stages.find(s => s.tier === tier) || null;
        const heroHours = keys.length ? heroHoursFor(stageWorkOf(tier), TARGET) : 0;
        const workHours = hoursForWork(heroHours);
        const pathHours = timed.length ? Math.max(...timed.map(t => t.pathHours)) : 0;
        const hours = Math.max(timed.length ? timed[0].hours : 0, keys.length ? workHours : 0);
        // An item and the recipe that makes it share a name: the slowest of a name speaks for both.
        const names = new Set();
        const slowest = timed.filter(t => !names.has(nameOf(t.key)) && names.add(nameOf(t.key))).slice(0, 5);
        const out = {
            tier, profile: TARGET, entries: keys.length, budgetMinutes: stage?.budgetMinutes ?? null,
            hours, pathHours, heroHours, workHours, heroes: heroesAt(settings, tier), byWork: keys.length > 0 && workHours > pathHours,
            slowest, untimed, timed,
            complete: timed.every(t => t.complete),
            gate: gateOf(tier)
        };
        stageMemo.set(tier, out);
        return out;
    }

    // ── findings ───────────────────────────────────────────────────────────────────────────────
    const nameOf = (key) => ledger.world.names.get(key) ?? parseKey(key).id;
    /** A count of heroes in words, to a tenth: "3.2 heroes". */
    const heroCount = (n) => PACE_TEXT.heroes(n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
    /** What a way out asks, in words: "Mining 10 and 420 coins". */
    const wayOutAsks = (g) => {
        const parts = [...g.asks.map(a => `${PACE_TEXT.skill(a.skill)} ${a.level}`), ...(g.coins > 0 ? [PACE_TEXT.coins(g.coins)] : [])];
        return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || 'nothing';
    };
    /** Why a way out is never had, in words. */
    const wayOutNever = (g) => {
        const level = g.asks.find(a => a.hours !== null && !Number.isFinite(a.hours));
        if (level) return `no work of ${PACE_TEXT.skill(level.skill)} reaches ${level.level} by then`;
        return Number.isFinite(g.priceHours) ? 'its time cannot be worked out' : PACE_TEXT.noCoins;
    };
    /** A stage's full content in words: "146 entries, had 7 h in". */
    const contentWords = (s) => `${s.entries} entr${s.entries === 1 ? 'y' : 'ies'}, had ${PACE_TEXT.hours(s.hours)} in`;
    const workName = (work) => {
        if (!work) return '—';
        const t = work.target;
        const water = t.pool && spotOf(rates.token(t.token)) ? spotPoolKey(t.token, t.pool) : tokenKey(t.token);
        const base = t.recipe ? `${nameOf(recipeKey(t.recipe))} at ${nameOf(tokenKey(t.token))}` : nameOf(water);
        return t.pool && t.pool.split('|')[1] ? `${base} (${nameOf(itemKey(t.pool.split('|')[1]))})` : base;
    };

    const wallMemo = new Map();
    /**
     * A skill's walls: each run of levels (one stage) whose every level takes over `wallFactor` times
     * the curve at the curve's player ({@link TARGET}), `{ skill, from, to, tier, hours, curveTotal, worst,
     * startHours, endHours, source, waiting }`: levels `from` to `to + 1`, from `startHours` to
     * `endHours` into a new game, the best source at its start, and the entries that ask a level inside it.
     */
    function wallsOf(skill) {
        if (wallMemo.has(skill)) return wallMemo.get(skill);
        const factor = settings.wallFactor;
        const track = trackOf(skill);
        const runs = [];
        let run = null;
        const close = () => {
            if (!run) return;
            run.waiting = track.asks.filter(a => a.level > run.from && a.level <= run.to + 1).map(a => a.key);
            run.endHours = track.levels[run.to - 1].cumulative[TARGET];
            runs.push(run);
            run = null;
        };
        for (const row of track.levels) {
            const hours = row.hours[TARGET];
            const ratio = hours * 60 / row.curveMinutes;
            if (ratio > factor) {
                if (!run || row.tier !== run.tier) {
                    close();
                    const startHours = row.level > 1 ? track.levels[row.level - 2].cumulative[TARGET] : 0;
                    run = { skill, from: row.level, to: row.level, hours: 0, curveTotal: 0, worst: 0, curve: row.curveMinutes, tier: row.tier, source: row.source[TARGET], startHours };
                }
                run.to = row.level;
                run.hours += hours;
                run.curveTotal += row.curveMinutes;
                if (ratio > run.worst) { run.worst = ratio; run.curve = row.curveMinutes; }
            } else {
                close();
            }
        }
        close();
        wallMemo.set(skill, runs);
        return runs;
    }

    function findings() {
        const out = [];
        const add = (check, key, message, extra = {}) => out.push({ check, key, message, ...extra });

        // Walls: a run of levels far slower at the curve's player than the curve.
        for (const skill of [...askedAt.keys()].sort()) {
            const track = trackOf(skill);
            for (const run of wallsOf(skill)) {
                const waiting = run.waiting;
                const src = run.source.work;
                const why = src
                    ? `the best ${AT_TARGET} source is ${workName(src)} (${Math.round(run.source.xp)} XP an hour${run.source.scale < 1 ? `, short of ${nameOf(itemKey(run.source.short))}` : ''}${run.source.chain < 1 ? `, its chain held to the ${heroCount(run.source.have)} it has there of the ${heroCount(run.source.need)} it needs` : ''})`
                    : 'no work of the skill gives XP there';
                add('wall', `skill:${skill}`, `${PACE_TEXT.skill(skill)} ${run.from} → ${run.to + 1} (${tierLabel(run.tier)}) takes ${PACE_TEXT.hours(run.hours)} at ${AT_TARGET} against the curve's ${formatMinutes(run.curveTotal)} (${PACE_TEXT.times(run.hours * 60 / run.curveTotal)}; a level at worst ${PACE_TEXT.times(run.worst)}): ${why}.${waiting.length ? ` Waiting on it: ${listNames(waiting)}.` : ''}`, {
                    name: PACE_TEXT.skill(skill), related: waiting, severity: run.hours === Infinity ? 'warn' : undefined
                });
            }

            // Against the curve, at the top level each stage asks: Typical and Bare within their bounds
            // slower (Bare must stay playable), Maxed, the curve's player, never so far faster it trivialises it.
            const bounds = settings.profileBounds;
            const tops = new Map();
            for (const a of track.asks) if (Number.isInteger(a.tier) && a.level > 1) tops.set(a.tier, Math.max(tops.get(a.tier) || 1, a.level));
            let lastTop = 1;
            for (const [tier, level] of [...tops].sort((x, y) => x[0] - y[0])) {
                const row = track.levels[level - 2];
                // A later stage asking no higher level adds nothing to say.
                if (!row || level <= lastTop) continue;
                lastTop = level;
                const curve = minutesToReach(settings, level);
                const typical = row.cumulative.typical * 60 / curve;
                const bare = row.cumulative.bare * 60 / curve;
                const maxed = curve / (row.cumulative.maxed * 60);
                const where = `${PACE_TEXT.skill(skill)} ${level} (the top ${tierLabel(tier)} asks)`;
                if (typical > bounds.typical) {
                    add('profile-bounds', `skill:${skill}`, `Typical: ${where} takes ${PACE_TEXT.hours(row.cumulative.typical)} from a new game, ${PACE_TEXT.times(typical)} the curve's ${formatMinutes(curve)} (bound ${bounds.typical}×): a sensible investor falls too far behind the curve's player.`, { name: PACE_TEXT.skill(skill) });
                }
                if (bare > bounds.bare) {
                    add('profile-bounds', `skill:${skill}`, `Bare: ${where} takes ${PACE_TEXT.hours(row.cumulative.bare)} from a new game, ${PACE_TEXT.times(bare)} the curve's ${formatMinutes(curve)} (bound ${bounds.bare}×): too slow to stay playable.`, { name: PACE_TEXT.skill(skill) });
                }
                if (maxed > bounds.maxed) {
                    add('profile-bounds', `skill:${skill}`, `Maxed: ${where} takes ${PACE_TEXT.hours(row.cumulative.maxed)} from a new game, ${PACE_TEXT.times(maxed)} faster than the curve's ${formatMinutes(curve)} (bound ${bounds.maxed}×): the boosts trivialise it.`, { name: PACE_TEXT.skill(skill) });
                }
            }
        }

        // A node whose camp makes much more of it in the dense layout than in the sparse one: the site's layout moves the pace.
        for (const row of layoutRows()) {
            const n = row.nodes;
            const by = (layout) => (row.spawner ? ` (${PACE_TEXT.count(row.spawners[layout], nameOf(tokenKey(row.spawner)))})` : '');
            add('layout', row.work.entry, `${workName(row.work)} at ${AT_TARGET}, worked from ${nameOf(tokenKey(row.camp))}: ${n.sparse} in reach${by('sparse')} make ${PACE_TEXT.rate(row.sparse)} an hour and ${n.dense}${by('dense')} make ${PACE_TEXT.rate(row.dense)} (+${Math.round(row.off * 100)} %, over ±${settings.tolerancePct} %): one hero is not kept busy by ${n.sparse}, so how its site is laid out moves the pace (BALANCE_RULES section 2: a lone hero at one node is busy about a fifth of the time, so a camp keeps one busy on ${Math.round(1 / restRuleBusyShare())}).`, {
                name: workName(row.work)
            });
        }

        // A crafter whose materials need more gatherers than the reference guild gives a maker, at Typical.
        for (const skill of [...askedAt.keys()].sort()) {
            for (const band of gathererBands(skill)) {
                const n = band.gatherers >= 10 ? Math.round(band.gatherers) : Math.round(band.gatherers * 10) / 10;
                add('gatherers', `skill:${skill}`, `${PACE_TEXT.skill(skill)} ${band.from} → ${band.to + 1} at Typical: ${workName(band.work)} needs ${n} gatherers down its chain to run in full, over the reference guild's ${settings.gatherersPerMaker} a maker (±${settings.tolerancePct} %).`, {
                    name: PACE_TEXT.skill(skill), related: [band.work.entry]
                });
            }
        }

        // A price that asks coins nothing the guild has by then earns.
        for (const c of coinGaps()) add('coin-supply', c.key, PACE_TEXT.coinSupply(c.name, c.coins, tierLabel(c.cap)), { name: c.name });

        for (const { key, r, level, expected, ratio } of unlockWalls()) {
            add('unlock-wall', key, `Its own step (${stepWords(r)}) takes ${PACE_TEXT.hours(r.own)} at ${AT_TARGET} once it can start (${PACE_TEXT.hours(r.start)} in), ${PACE_TEXT.times(ratio)} the ${formatMinutes(expected)} the pace allows a wait there (a level at ${level} on the curve, at least a check-in).`);
        }

        // A stage's way out against its budget (owner, 2026-11-26: leaving a stage means settling the next place);
        // its full content beside it, information only.
        for (const stage of settings.stages) {
            const s = stageOf(stage.tier);
            const g = s.gate;
            const label = tierLabel(stage.tier);
            const content = s.entries ? ` Its full content (${contentWords(s)}) is information` : '';
            if (!g.place) {
                if (g.why === 'none' && s.entries) {
                    add('stage-budget', `stage:${stage.tier}`, `${label} has no place of ${tierLabel(g.next)} to settle, so its way out is not timed against its budget of ${formatMinutes(stage.budgetMinutes)}.${content}.`, {
                        name: label, severity: 'info'
                    });
                }
                continue;
            }
            const off = g.hours * 60 / stage.budgetMinutes - 1;
            if (Math.abs(off) * 100 <= settings.tolerancePct) continue;
            const settling = `${label}'s way out, settling ${g.name} (${wayOutAsks(g)})`;
            const when = Number.isFinite(g.hours)
                ? `is had ${PACE_TEXT.hours(g.hours)} into a new game at ${AT_TARGET}, ${off > 0 ? `${Math.round(off * 100)} % over` : `${Math.round(-off * 100)} % under`} its budget of ${formatMinutes(stage.budgetMinutes)} (±${settings.tolerancePct} %)`
                : `is never had at ${AT_TARGET}: ${wayOutNever(g)}`;
            const heroes = g.byWork ? ` Its ${PACE_TEXT.heroes(g.heroes)} set it: ${PACE_TEXT.hours(g.heroHours)} of the guild's work, where the levels side by side and the price take ${PACE_TEXT.hours(g.pathHours)}.` : '';
            const floor = g.floor.length ? ` A floor: ${g.floor.map(f => PACE_TEXT.wayOutFloor[f]).join(', and ')}.` : '';
            const later = g.needs.filter(n => n.hours > g.hours);
            const needs = later.length ? ` Settling it also waits for ${later.map(n => `${n.name} (had ${PACE_TEXT.hours(n.hours)} in)`).join(' and ')}.` : '';
            add('stage-budget', `stage:${stage.tier}`, `${settling}, ${when}.${heroes}${floor}${needs}${content ? `${content}, not held to the budget.` : ''}`, {
                name: label, related: [g.place]
            });
        }

        // A ring that can be settled well before the stage it opens after ends.
        for (let ring = 2; ring <= STRICT_RINGS; ring++) {
            const budget = ringBudgetHours(ring);
            const opens = ringOpensAt(ring, TARGET);
            // A floor (an untimed gate) says nothing about how early the ring opens.
            if (budget === null || !opens.complete || !Number.isFinite(opens.hours)) continue;
            const early = 1 - opens.hours / budget;
            if (early * 100 <= settings.tolerancePct) continue;
            const stars = ledger.world.ringStars?.get(ring) || [];
            const star = stars.length
                ? `its Guild Hall star (${stars.map(hallName).join(' or ')}) is lit ${PACE_TEXT.hours(readyOf(starKey(stars[0]), TARGET).hours)} in`
                : 'no Guild Hall star opens it';
            add('ring-open', `ring:${ring}`, `Ring ${ring} can first be settled ${PACE_TEXT.hours(opens.hours)} into a new game at ${AT_TARGET} (${nameOf(opens.key)}), ${Math.round(early * 100)} % before ${tierLabel(budgetTierOf(ring))} ends at ${formatMinutes(budget * 60)} (±${settings.tolerancePct} %): ${star}.`, {
                name: `Ring ${ring}`
            });
        }

        // Guild Hall ranks: one that adds no rate is named; one whose price its stage cannot gather is a price fault.
        for (const row of hallPaybacks()) {
            if (row.rate === false && row.rank === 1 && !row.ring) add('unmodelled', `hall:${row.id}`, `${row.name}: what it gives (${row.what}) is not a rate, so its payback is not worked out.`, { name: row.name });
            if (Number.isFinite(row.priceHours)) continue;
            const missing = row.price.filter(p => !Number.isFinite(hallUnitHours(p.itemId, row.cap))).map(p => nameOf(itemKey(p.itemId)));
            const coins = row.coins > 0 && !Number.isFinite(rankCoinHours(row)) ? [PACE_TEXT.coins(row.coins)] : [];
            const what = [...missing, ...coins].join(' and ');
            add('hall-price-unreachable', `hall:${row.id}`, `${row.name} rank ${row.rank} (${stageWords(row)}) costs ${row.priceText}, which cannot be gathered by ${tierLabel(row.cap)} at Typical${what ? ` (${what} is not had by then)` : ''}: no one can buy it there, so its payback is not worked out. Price it in what its stage gathers, or set it at the stage its price is first had.`, {
                severity: 'warn', name: row.name
            });
        }

        // A Guild Hall rank over all the work it boosts, on the payback curve: slow is a warning, far quicker information.
        const tol = settings.tolerancePct / 100;
        for (const h of hallGuildPaybacks()) {
            // A free rank (a new guild's) has no price to pay back; one no one can pay is a price fault, above.
            if (h.cost === 0 || !Number.isFinite(h.row.priceHours) || !(Math.abs(h.off) > tol + 1e-9)) continue;
            const slow = h.off > 0;
            const over = !Number.isFinite(h.payback) ? 'never within' : h.off >= 1 ? `${PACE_TEXT.times(h.off + 1)}` : `${Math.round(Math.abs(h.off) * 100)} % ${slow ? 'over' : 'under'}`;
            const across = h.id === ROSTER_STAR ? 'as another hero' : `over all the work it boosts (${PACE_TEXT.pieces(h.works)}, the ${h.counted} best for the guild's ${PACE_TEXT.heroes(h.heroes)})`;
            const remedy = slow ? 'Lower its price or raise what it gives' : 'It is cheap for what it gives: raise its price, or let it be if it is a first step';
            add('hall-guild-payback', `hall:${h.id}`, `${h.name} rank ${h.rank} (${stageWords(h.row)}) ${Number.isFinite(h.cost) ? `costs ${PACE_TEXT.short(h.cost)} at Typical` : 'is behind stars Typical cannot light by then'} and saves ${PACE_TEXT.saves(h.gain)} ${across}: it pays back in ${PACE_TEXT.hours(h.payback)}, ${over} the payback curve's ${PACE_TEXT.hours(h.curve)} at level ${h.level} (±${settings.tolerancePct} %; BALANCE_RULES section 5: payback is 1 hour × 24^(L / 80) and counts all the work a star boosts). ${remedy}.`, {
                name: h.name, severity: slow ? 'warn' : 'info'
            });
        }

        // A drink or work potion whose batch saves less than the rules' factor of its making.
        for (const b of batchPaybackRows()) {
            if (!(b.ratio < settings.batchPayback - 1e-9)) continue;
            add('batch-payback', itemKey(b.item), `${b.name}: a dose lasts ${PACE_TEXT.figure(b.doseCycles)} cycles of ${workName(b.work)} and saves ${PACE_TEXT.saves(b.gain)} of it at Typical, where its doses take ${PACE_TEXT.saves(b.spends)} of hero time to make, ingredients included: it pays back ${PACE_TEXT.times(b.ratio)} its making, under the ${settings.batchPayback}× a batch must pay back (BALANCE_RULES section 5: a batch saves at least four times the time it took to make). Make it stronger, make more of it a craft, or ask less of its recipe.`, {
                severity: 'warn', name: b.name, related: [b.work.entry]
            });
        }

        // A chain paying more or less XP an hour of its gathering than its tier's others: far off is a warning.
        const warnAt = settings.chainXpWarnFactor;
        for (const c of chainXpRows()) {
            if (c.off === null || !(Math.abs(c.off) > tol + 1e-9)) continue;
            const ratio = c.off + 1;
            const far = ratio > warnAt + 1e-9 || ratio < 1 / warnAt - 1e-9;
            add('chain-xp', itemKey(c.item), `${c.name} (${tierLabel(c.tier)}, a chain of ${c.links} links) pays ${PACE_TEXT.figure(c.xpPerHour)} XP an hour of the gathering behind it (${PACE_TEXT.figure(c.xp)} XP over ${PACE_TEXT.short(c.rawHours)} of gathering ${PACE_TEXT.figure(c.raw)} raw), ${Math.round(Math.abs(c.off) * 100)} % ${c.off > 0 ? 'over' : 'under'} its tier's median of ${PACE_TEXT.figure(c.median)} XP an hour (±${settings.tolerancePct} %, a warning beyond ${warnAt}× either way; BALANCE_RULES section 1: each link of a chain pays its own XP, so a tier's chains pay about alike for the time they take from the ground). ${far ? "Move a link's XP, or its ingredient counts, toward the median." : 'Information: within the warning factor.'}`, {
                severity: far ? 'warn' : 'info', name: c.name
            });
        }

        for (const g of boostGroups()) {
            const lifted = g.works;
            const shown = lifted.slice(0, 4).map(w => `${workName(w.work)} +${Math.round(w.gain * 100)} %`).join(', ');
            const more = lifted.length > 4 ? ` and ${lifted.length - 4} more` : '';
            const low = Math.min(...lifted.map(w => w.target));
            add('boost-target', g.factorKeys[0], `${g.names.join(' with ')} (${BOOST_KIND_TEXT[g.kind].toLowerCase()}) make${g.names.length === 1 ? 's' : ''} ${lifted.length === 1 ? 'one piece' : `${lifted.length} pieces`} of work better at Maxed than the ${low} % target: ${shown}${more}.`, {
                severity: 'warn', name: g.names.join(' with '), related: [...g.factorKeys.slice(1), ...new Set(lifted.map(w => w.entry))]
            });
        }

        for (const f of budgetFindings()) {
            add('boost-budget', f.key, f.message, { severity: 'warn', name: f.name, related: [...new Set(f.rows.map(r => r.entry))] });
        }

        // What the calculator cannot read, per entry.
        const seen = new Map();
        for (const work of works) {
            if (work.tier === null || !counted(work.entry)) continue;
            const r = workAt(work, PROFILE.TYPICAL, work.tier).rate;
            const notes = [...(r.unmodelled || [])];
            if (!notes.length) continue;
            if (!seen.has(work.entry)) seen.set(work.entry, new Set());
            for (const u of notes) seen.get(work.entry).add(`${u.what}: ${u.why}${u.source && u.source !== work.target.token ? ` (${nameOf(tokenKey(u.source)) || u.source})` : ''}`);
        }
        for (const [key, set] of seen) add('unmodelled', key, `The calculator cannot read: ${[...set].join('; ')}.`);
        return out;
    }

    let layoutMemo = null;
    /** The nodes a camp hands one hero at a work in a layout, and the spawners they stand for (a Forest's trees by its Forests). */
    const layoutNodesOf = (work, layout) => profiles.campNodesOf(work.target, { nodes: settings.layouts[layout], spawners: settings.layoutSpawners[layout] });

    /**
     * The nodes whose camp makes them past the tolerance faster in the dense layout than in the sparse
     * one at the curve's player ({@link TARGET}), each at its own stage with the rest of its setup as
     * chosen: `[{ work, camp, sparse, dense, off, nodes, spawners, spawner }]`, `sparse` and `dense`
     * what it makes an hour, `nodes` and `spawners` each layout's, `spawner` the one they stand for.
     */
    function layoutRows() {
        if (layoutMemo) return layoutMemo;
        const out = [];
        const made = (r) => (r?.ok ? Object.values(r.items || {}).reduce((a, b) => a + b, 0) : 0);
        for (const work of works) {
            if (work.tier === null || !counted(work.entry)) continue;
            const { setup, rate } = profiles.profileOf(work.target, TARGET, work.tier);
            if (!rate.ok || !isObject(setup.camp)) continue;
            const s = layoutNodesOf(work, 'sparse');
            const d = layoutNodesOf(work, 'dense');
            if (d.nodes <= s.nodes) continue;
            const at = (members) => made(rates.numbersOf(work.target, { ...setup, camp: { ...setup.camp, members } }));
            const sparse = at(s.nodes);
            const dense = at(d.nodes);
            if (!(sparse > 0)) continue;
            const off = dense / sparse - 1;
            if (off * 100 > settings.tolerancePct) {
                out.push({
                    work, camp: setup.camp.id, sparse, dense, off, nodes: { sparse: s.nodes, dense: d.nodes },
                    spawners: { sparse: s.spawners, dense: d.spawners }, spawner: s.spawners ? profiles.contextOf(work.target).family : null
                });
            }
        }
        layoutMemo = out;
        return out;
    }

    let otherPace = null;
    /**
     * The same content timed at the other layout (`settings.layouts`, the dense one when the pace times
     * the sparse), its rate book shared: built when first asked, as it is a second pace.
     */
    function otherLayoutPace() {
        if (!otherPace) {
            const other = settings.layout === 'sparse' ? 'dense' : 'sparse';
            otherPace = buildPace(content, ledger, { ...settings, layout: other }, { book: rates, records: plans });
        }
        return otherPace;
    }

    /** Each skill's days to 99 at each profile in this pace's layout: `{ layout, skills: { [skill]: { maxed, typical, bare } } }`, plain data. */
    function layoutDays() {
        const skills = {};
        for (const skill of [...new Set([...askedAt.keys(), ...skillsOfWork.keys()])].sort()) {
            skills[skill] = Object.fromEntries(PROFILES.map(profile => [profile, hoursToLevel(skill, MAX_SKILL_LEVEL, profile) / 24]));
        }
        return { layout: settings.layout, skills };
    }

    /**
     * Each skill's days to 99 in both layouts at each profile, and how far apart they are:
     * `{ timed, other, nodes, skills: [{ skill, days: { [layout]: { maxed, typical, bare } }, off, warn }] }`,
     * `off` the largest difference over the profiles, as a fraction of the sparse layout's. The other
     * layout's days (`layoutDays` of a pace timed there, worked out elsewhere: the CMS's Worker) when
     * handed, else its pace built here.
     */
    function layoutSpread(otherDays = null) {
        const mine = layoutDays();
        const theirs = otherDays || otherLayoutPace().layoutDays();
        const out = { timed: settings.layout, other: theirs.layout, nodes: { ...settings.layouts }, skills: [] };
        for (const skill of Object.keys(mine.skills)) {
            const days = { [mine.layout]: mine.skills[skill], [theirs.layout]: theirs.skills[skill] || Object.fromEntries(PROFILES.map(p => [p, Infinity])) };
            let off = 0;
            for (const profile of PROFILES) {
                const a = days.sparse?.[profile];
                const b = days.dense?.[profile];
                if (Number.isFinite(a) && Number.isFinite(b) && a > 0) off = Math.max(off, Math.abs(a - b) / a);
            }
            out.skills.push({ skill, days, off, warn: off * 100 > settings.tolerancePct });
        }
        return out;
    }

    /**
     * A skill's levels whose best Typical work needs more gatherers down its chain than the reference
     * guild gives a maker (`settings.gatherersPerMaker`, past the tolerance), one run per work:
     * `[{ work, from, to, gatherers }]`, levels `from` to `to + 1`, `gatherers` the most in the run.
     */
    function gathererBands(skill) {
        const limit = settings.gatherersPerMaker * (1 + settings.tolerancePct / 100);
        const out = [];
        let band = null;
        for (const row of trackOf(skill).levels) {
            const src = row.source[PROFILE.TYPICAL];
            const n = src?.work ? heroesOf(src.work, src.profile ?? PROFILE.TYPICAL, row.tier, src.at ?? null) - 1 : 0;
            if (!(n > limit)) { band = null; continue; }
            if (band && band.work === src.work) {
                band.to = row.level;
                band.gatherers = Math.max(band.gatherers, n);
                continue;
            }
            band = { work: src.work, from: row.level, to: row.level, gatherers: n };
            out.push(band);
        }
        return out;
    }

    /**
     * A long wait for one unlock: an entry whose own step (gathering, a build, luck) takes far over
     * what the curve gives a level where the player is by then, never under a check-in, at the
     * curve's player ({@link TARGET}). `[{ key, r, level, expected, ratio }]`: `r` its path, `expected`
     * the minutes the pace allows.
     */
    function unlockWalls() {
        const out = [];
        for (const key of entryKeys) {
            if (!counted(key)) continue;
            const at = reach.get(key);
            if (!at || !Number.isInteger(at.tier)) continue;
            const r = readyOf(key, TARGET);
            if (!Number.isFinite(r.own) || !(r.own > 0) || !Number.isFinite(r.start)) continue;
            const level = levelAtMinutes(settings, r.start * 60);
            const expected = Math.max(settings.player.checkInMinMinutes, minutesPerLevelAt(settings, level));
            const ratio = r.own * 60 / expected;
            if (ratio > settings.wallFactor) out.push({ key, r, level, expected, ratio });
        }
        return out;
    }

    /**
     * Every price asking coins that nothing the guild has by its stage earns, at Typical: a Shop Token
     * or a Guild Hall star by its own key, settling once per ring (`ring:<n>`), with the coins asked
     * and the stage they are earned at (`cap`). A ring star's ring, which its star's rule also gives,
     * is the star's.
     */
    function coinGaps() {
        const out = [];
        const seen = new Set();
        for (const [key, at] of reach) {
            const rule = at?.rule;
            if (!rule || !(rule.coins > 0) || !Number.isInteger(at.tier) || key.startsWith('ring:')) continue;
            if (isEntry(key) && !counted(key)) continue;
            const settle = rule.how === HOW.SETTLE;
            const ring = rule.ring ?? rule.floor;
            const id = settle ? `ring:${ring}` : key;
            if (seen.has(id)) continue;
            seen.add(id);
            const cap = settle ? Math.min(at.tier, budgetTierOf(ring)) : at.tier;
            if (coinSourcesOf(PROFILE.TYPICAL, cap).length) continue;
            out.push({ key: id, name: settle ? `Ring ${ring}` : nameOf(key), coins: rule.coins, cap });
        }
        return out;
    }

    let asksMemo = null;
    /** Whether any price asks coins: a Shop Token, a Guild Hall rank or a ring of the world tables. */
    function asksCoins() {
        if (asksMemo !== null) return asksMemo;
        const shop = Object.values(ledger.world.tokens).some(def => isObject(def.shop) && shopCoinsOf(def) > 0);
        const hall = profiles.hallTracks.some(t => Array.from({ length: t.maxRank }, (_, i) => t.coins(i + 1)).some(c => c > 0));
        const prices = ledger.world.worldTables?.prices || {};
        const ring = Array.from({ length: STRICT_RINGS }, (_, i) => Number(prices[i + 1]?.coins) || 0).some(c => c > 0);
        asksMemo = shop || hall || ring;
        return asksMemo;
    }

    let coinPriceMemo = null;
    /**
     * A coin cost for every price that may ask coins, proposed from its coin curve (BALANCE_RULES
     * section 7): the coins one hero earns an hour selling when it is paid ({@link sellingSupplyOf}:
     * the best sold work whose level the pace curve has reached by then; kills and thefts still time
     * the price on the path, {@link coinHoursFrom}) times its curve's minutes at its stage
     * (`settings.coinMinutesAt`), rounded down to two figures. Further out costs more twice over:
     * later on a hero earns more an hour, and the curve asks more minutes.
     * - A Shop Token (a Foundation is one), on the everyday curve: at its stage (the owner's tier,
     *   else when first reached), paid when its step may start at Typical (as its stage begins when no
     *   path times it).
     * - A Guild Hall rank, on no curve: a rank is a small step priced by what it saves, so its coins are
     *   left to the payback check ({@link hallPaybacks}), which sums them with its items. Its row is
     *   listed at its tier (else its price's) with no proposal.
     * - Settling a ring-n cell, on the big curve: at stage n, earned with what the stage before gives
     *   (`ringBudgetTier`), when its first cell's step may start.
     * A stage past the last the pace knows is earned at the last.
     *
     * @returns {{ kind: 'shop'|'hall'|'ring', id, name, rank?, ring?, coins, curve: 'everyday'|'big'|null, tier, cap, at,
     *   minutes, perHour, source, proposed: number|null, why: string|null }[]} `coins` what it asks now;
     *   `at` the hours from a new game it is paid at; `proposed` null with `why` when its curve has no
     *   point there or nothing earns coins by then
     */
    function coinPrices() {
        if (coinPriceMemo) return coinPriceMemo;
        const rows = [];
        const propose = (base, curve, profile, tier, earnAt, paidAt) => {
            if (tier === null) return { ...base, curve, tier: null, cap: null, at: null, minutes: null, perHour: 0, source: null, proposed: null, why: PACE_TEXT.notReached };
            const cap = Math.min(maxTier, earnAt);
            const at = Number.isFinite(paidAt) ? paidAt : stageStartHours(earnAt);
            const minutes = coinMinutesAt(settings, tier, curve);
            const s = sellingSupplyOf(profile, cap, at);
            const out = { ...base, curve, tier, cap, at, minutes, perHour: s.perHour, source: coinSourceName(s) };
            if (minutes === null) return { ...out, proposed: null, why: PACE_TEXT.noCurve(curve, tierLabel(tier)) };
            if (!(s.perHour > 0)) return { ...out, proposed: null, why: PACE_TEXT.noIncome(tierLabel(cap)) };
            return { ...out, proposed: Math.max(1, roundDown(s.perHour * minutes / 60)), why: null };
        };
        for (const [id, def] of Object.entries(ledger.world.tokens)) {
            if (!isObject(def.shop) || !counted(tokenKey(id))) continue;
            const tier = effTier(tokenKey(id));
            const start = readyOf(tokenKey(id), PROFILE.TYPICAL).start;
            rows.push(propose({ kind: 'shop', id, name: nameOf(tokenKey(id)), coins: shopCoinsOf(def) }, COIN_CURVE.EVERYDAY, PROFILE.TYPICAL, tier, tier, start));
        }
        for (const track of profiles.hallTracks) {
            for (let rank = 1; rank <= track.maxRank; rank++) {
                const tier = track.tier(rank) ?? priceTierOf(track.price(rank));
                const cap = tier === null ? null : Math.min(maxTier, tier);
                rows.push({ kind: 'hall', id: track.id, name: track.name, rank, coins: track.coins(rank), curve: null, tier, cap, at: null, minutes: null, perHour: 0, source: null, proposed: null, why: PACE_TEXT.hallByPayback });
            }
        }
        const tables = ledger.world.worldTables;
        if (tables) {
            for (let ring = 1; ring <= STRICT_RINGS; ring++) {
                const first = ringOpensAt(ring).key;
                const start = first ? readyOf(first, PROFILE.TYPICAL).start : null;
                const tier = budgetTierOf(ring) + 1;
                rows.push(propose({ kind: 'ring', id: `ring:${ring}`, name: `Ring ${ring}`, ring, coins: Number(tables.prices?.[ring]?.coins) || 0 }, COIN_CURVE.BIG, PROFILE.TYPICAL, tier, budgetTierOf(ring), start));
            }
        }
        coinPriceMemo = rows;
        return rows;
    }

    let coinDropMemo = null;
    /**
     * A worker's selling at Typical where a fighter or a thief first earns at a stage: once both the
     * level `level` and the stage are had ({@link sellingSupplyOf}).
     */
    const sellingWhen = (cap, level) => sellingSupplyOf(PROFILE.TYPICAL, cap, Math.max(curveHoursTo(level), stageStartHours(cap))).perHour;
    const perEach = (perHour, n) => (n > 0 && perHour > 0 ? Math.round(perHour / 2 / n) : null);

    /**
     * Every Live enemy's Coin drop beside what one kill's drops sell for at their coin worth (Bare,
     * average luck, its rare table counted), and that as its proposed Coin drop: a kill drops coins
     * like a sale of its loot. With the kills an hour one hero makes at Typical at its stage, fed as
     * the coin supply feeds it, the coins they drop an hour (Coin Find counted), and a worker's selling
     * there ({@link sellingWhen}) with half of it a kill (BALANCE_RULES section 7: a fighter earns about
     * half a worker's coins). `[{ id, name, level, tier, coinDrop, proposed, killsPerHour,
     * coinsPerHour, sellingPerHour, halfSellingPerKill }]`, weakest first.
     */
    function coinDrops() {
        if (coinDropMemo) return coinDropMemo;
        const rows = [];
        for (const work of works) {
            const def = rates.token(work.target.token);
            if (!isObject(def?.enemy) || work.target.recipe || !counted(work.entry)) continue;
            const cap = work.tier ?? maxTier;
            const { rate } = profiles.profileOf(work.target, PROFILE.BARE, cap);
            let sells = 0;
            for (const [item, n] of Object.entries(rate.perCycle || {})) sells += n * worthOf(item);
            const f = workAt(work, PROFILE.TYPICAL, cap);
            const killsPerHour = f.rate?.ok ? (Number(f.rate.cyclesPerHour) || 0) * f.scale : 0;
            const level = Math.max(1, Number(def.enemy.level) || 1);
            const sellingPerHour = sellingWhen(cap, level);
            rows.push({
                id: def.id, name: nameOf(tokenKey(def.id)), level: Number(def.enemy.level) || null, tier: work.tier, coinDrop: enemyCoinDropOf(def), proposed: Math.round(sells),
                killsPerHour, coinsPerHour: Math.max(0, f.coins || 0), sellingPerHour, halfSellingPerKill: perEach(sellingPerHour, killsPerHour)
            });
        }
        rows.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name));
        coinDropMemo = rows;
        return rows;
    }

    let coinTheftMemo = null;
    /**
     * Every hoarding camp each Hideout robs of coins ({@link theftsAt}, everything had by the last
     * stage): the thefts an hour it makes, less those caught, the coins a theft and an hour, at the
     * stage its camp, enemy and Hideout are all had (`tier`), and a worker's selling there
     * ({@link sellingWhen}, at the Hideout's level) with half of it a theft (BALANCE_RULES section 7).
     * `[{ camp, campName, enemy, enemyName, hideout, hideoutName, tier, level, thefts, coins, perHour,
     * sellingPerHour, halfSellingPerTheft }]`, by stage then camp.
     */
    function coinThefts() {
        if (coinTheftMemo) return coinTheftMemo;
        const rows = theftsAt(maxTier).map(t => {
            const tier = Math.max(...[t.camp, t.enemy, t.hideout].map(id => tierOfKey(tokenKey(id)) ?? 0));
            const sellingPerHour = sellingWhen(tier, t.level);
            return {
                camp: t.camp, campName: nameOf(tokenKey(t.camp)), enemy: t.enemy, enemyName: nameOf(tokenKey(t.enemy)), hideout: t.hideout, hideoutName: nameOf(tokenKey(t.hideout)),
                tier, level: t.level, thefts: t.thefts, coins: t.coins, perHour: t.perHour, sellingPerHour, halfSellingPerTheft: perEach(sellingPerHour, t.thefts)
            };
        });
        rows.sort((a, b) => a.tier - b.tier || a.campName.localeCompare(b.campName) || a.hideoutName.localeCompare(b.hideoutName));
        coinTheftMemo = rows;
        return rows;
    }

    /** Where a coin supply comes from, in words: the work, or the thefts. */
    function coinSourceName(s) {
        if (s.work) return workName(s.work);
        if (s.theft) return PACE_TEXT.theft(nameOf(tokenKey(s.theft.enemy)), nameOf(tokenKey(s.theft.hideout)));
        return null;
    }

    /**
     * Boosts over their target strength at Maxed, beyond the tolerance: one group per kind and set of
     * boosts, `{ kind, factors, factorKeys, names, target, works }`, its works most lifted first.
     */
    function boostGroups() {
        const groups = new Map();
        for (const b of boostRows()) {
            if (b.target === null || !(b.gain > (b.target / 100) * (1 + settings.tolerancePct / 100) + 1e-9)) continue;
            const id = `${b.kind}|${b.factors.join(',')}`;
            if (!groups.has(id)) groups.set(id, { ...b, works: [] });
            groups.get(id).works.push(b);
        }
        for (const g of groups.values()) g.works.sort((x, y) => y.gain - x.gain);
        return [...groups.values()];
    }

    const stepWords = (r) => {
        if (r.step?.gather?.item === COINS) return PACE_TEXT.earning(r.step.gather.coins);
        if (r.step?.gather?.item) return `gathering ${nameOf(r.step.gather.item)}`;
        const how = LEDGER_ENGINE_TEXT.how[r.how] || r.how;
        return r.via ? `${how} ${nameOf(r.via)}` : how;
    };
    const listNames = (keys, max = 4) => {
        const names = [...new Set(keys.map(nameOf))];
        return names.length > max ? `${names.slice(0, max).join(', ')} and ${names.length - max} more` : names.join(', ');
    };

    // ── the Guild Hall ─────────────────────────────────────────────────────────────────────────
    const priceWords = (price, coins = 0) => {
        const parts = price.map(p => `${p.quantity} ${nameOf(itemKey(p.itemId))}`);
        if (coins > 0) parts.push(PACE_TEXT.coins(coins));
        return parts.length ? parts.join(', ') : 'nothing';
    };
    const stageWords = (row) => (row.tier !== null && row.tier > row.cap
        ? `${tierLabel(row.tier)}, measured at ${tierLabel(row.cap)}, the last stage the pace knows`
        : tierLabel(row.tier ?? row.cap));
    /** The stars lit to open a star, in words: "lighting Gold Leaf and Lore". */
    const openingWords = (opening) => `lighting ${opening.path.map(id => hallName(id)).join(' and ')}`;

    /** The Hall's works: each piece of work a track's ranks may move (its context lists the track). */
    const hallWorksMemo = new Map();
    function hallWorksOf(trackId) {
        if (!hallWorksMemo.has(trackId)) {
            hallWorksMemo.set(trackId, works.filter(w => w.tier !== null && profiles.contextOf(w.target).hall.some(t => t.id === trackId)));
        }
        return hallWorksMemo.get(trackId);
    }

    /**
     * One rank at Typical, at the tier it belongs to (its own, else its price's): the hours it saves
     * an hour on the work it saves most on, `{ gain, work }`; `gain` Infinity when it is the only
     * source of what it pays (an enabler).
     */
    function hallRankGain(track, rank, cap, priceHours = 0) {
        // A Bunk Beds rank is another hero: an hour of work an hour.
        if (track.id === ROSTER_STAR) return { gain: 1, work: null, opening: OPEN };
        let best = { gain: 0, work: null, opening: OPEN };
        let bestPayback = Infinity;
        for (const work of hallWorksOf(track.id)) {
            if (work.tier > cap) continue;
            const m = profiles.hallRankOn(work.target, cap, track.id, rank);
            if (!m || !(m.saves > 0)) continue;
            const opening = m.opening || OPEN;
            // Where it pays back soonest: its price and the stars lit to open it there, over what it saves there.
            const payback = m.saves === Infinity ? 0 : (priceHours + opening.cost) / m.saves;
            if (!best.work || payback < bestPayback || (payback === bestPayback && m.saves > best.gain)) {
                best = { gain: m.saves, work, opening };
                bestPayback = payback;
            }
        }
        return best;
    }

    /** Hours a Hall rank's coins take to earn at Typical before the Hall, at the stage it is measured at. */
    const rankCoinHours = (row) => (row.coins > 0 ? coinCostHours(row.coins, BEFORE_HALL, row.cap) : 0);
    /** The tier a Hall price is first had at: its latest item's, the last stage when one is never had. */
    const priceTierOf = (price) => {
        const tiers = price.map(p => tierOfKey(itemKey(p.itemId)));
        return tiers.every(Number.isInteger) ? Math.max(0, ...tiers) : maxTier;
    };

    let hallMemo = null;
    /**
     * Every Guild Hall rank: its tier, price, the hours that price takes to
     * gather at Typical (before the Hall), the hours it saves an hour on the work it pays back soonest
     * on and its payback there (`gain`, `work`, `payback`: information), its payback over all the work
     * it boosts on the payback curve ({@link guildPaybackOf}: `guildGain`, `guildPayback`, `curve`),
     * whether that is within the curve and the tolerance (`pays`, what the hall-guild-payback check
     * asks), and the price the ledger proposes for an authored rank (`proposed`). `rate: false` for a rank that adds no rate (Bank tabs, a wound's
     * length, a loadout slot, a camp's reach). `cap` is the stage it is measured at: its tier, but
     * never past the last stage the pace knows (no later content exists to work or buy there, and
     * every stage costs a Typical profile of every piece of work).
     */
    function hallPaybacks() {
        if (hallMemo) return hallMemo;
        const rows = [];
        for (const track of profiles.hallTracks) {
            for (let rank = 1; rank <= track.maxRank; rank++) {
                const price = track.price(rank);
                const coins = track.coins(rank);
                const tier = track.tier(rank);
                const cap = Math.min(maxTier, tier ?? priceTierOf(price));
                const base = {
                    id: track.id, name: track.name, rank, tier, cap, price, ...(coins > 0 ? { coins } : {}),
                    priceText: priceWords(price, coins), priceHours: profiles.hallPriceHours(price, cap, coins)
                };
                const ring = rank === 1 ? ringOfStar(track.star) : null;
                if (ring !== null) {
                    rows.push({ ...base, rate: false, what: PACE_TEXT.opensRing(ring), ...ringRowOf(track, ring) });
                    continue;
                }
                const addsRate = track.id === ROSTER_STAR || starAddsRate(track.star);
                if (!addsRate) {
                    rows.push({ ...base, rate: false, what: track.description || 'not a rate' });
                    continue;
                }
                const { gain, work, opening } = hallRankGain(track, rank, cap, base.priceHours);
                const enabler = gain === Infinity;
                const cost = base.priceHours + opening.cost;
                const payback = cost === 0 ? 0 : enabler ? 0 : gain > 0 ? cost / gain : Infinity;
                const row = { ...base, rate: true, enabler, gain, work, opening, payback };
                if (!enabler) Object.assign(row, guildPaybackOf(row));
                row.pays = enabler || cost === 0 || withinCurve(row.guildPayback, row.curve);
                row.proposed = proposePrice(track, rank, row);
                rows.push(row);
            }
            neverCheaper(rows.filter(r => r.id === track.id));
        }
        hallMemo = rows;
        return rows;
    }

    /**
     * A rank's payback over all the work it boosts (BALANCE_RULES section 5: for a star that boosts
     * the whole guild, payback counts all the work it boosts, not one hero's), on the payback curve
     * ({@link paybackHoursAt}, at the level its tier opens at). What it saves is the hours an hour each
     * boosted work open by its stage saves at Typical, the most-saving ones added, one per hero the
     * reference guild has there: no more work runs at once than the guild has heroes. Its cost is the
     * price at Typical before the Hall and the stars lit to open it. A Bunk Beds rank is another hero,
     * an hour of work an hour. `{ guildGain, guildPayback, curve, curveLevel, guildWorks: { heroes, works, counted } }`.
     */
    function guildPaybackOf(row) {
        const heroes = heroesAt(settings, row.cap);
        const saves = row.id === ROSTER_STAR ? [1] : hallWorksOf(row.id)
            .filter(w => w.tier <= row.cap)
            .map(w => profiles.hallRankOn(w.target, row.cap, row.id, row.rank)?.saves || 0)
            .filter(x => x > 0 && Number.isFinite(x))
            .sort((a, b) => b - a);
        const counted = Math.min(heroes, saves.length);
        const guildGain = sum(saves.slice(0, counted));
        const cost = row.priceHours + row.opening.cost;
        const guildPayback = cost === 0 ? 0 : guildGain > 0 ? cost / guildGain : Infinity;
        const curveLevel = tierLevelAt(settings.tierLevels, row.tier ?? row.cap);
        return { guildGain, guildPayback, curve: paybackHoursAt(curveLevel), curveLevel, guildWorks: { heroes, works: saves.length, counted } };
    }

    /** Whether a payback is within the curve and the tolerance, as the hall-guild-payback check holds it. */
    const withinCurve = (payback, curve) => payback / curve - 1 <= settings.tolerancePct / 100 + 1e-9;

    /**
     * A star's proposed prices never fall from one rank to the next (the director, 2026-10-30): a
     * rank's proposal is raised to the one before it, in hours to gather and, in the same material,
     * in quantity, rounded up. A raised proposal says so (`raised`) and may then pay back slower
     * than the payback curve allows (`pays: false`).
     */
    function neverCheaper(rows) {
        let before = null;
        for (const row of rows) {
            const p = row.proposed;
            if (!p?.itemId) continue;
            if (before) {
                const perHour = p.quantity / p.priceHours;
                let quantity = p.quantity;
                if (p.priceHours < before.priceHours) quantity = Math.max(quantity, roundUp(before.priceHours * perHour));
                if (p.itemId === before.itemId) quantity = Math.max(quantity, before.quantity);
                if (quantity > p.quantity) {
                    const priceHours = quantity / perHour;
                    const payback = (priceHours + rankCoinHours(row) + row.opening.cost) / row.guildGain;
                    row.proposed = {
                        ...p, quantity, priceHours, payback, raised: true,
                        pays: withinCurve(payback, row.curve),
                        priceText: priceWords([{ itemId: p.itemId, quantity }])
                    };
                }
            }
            before = row.proposed;
        }
    }

    /**
     * The skill a star belongs to: its constellation's, else a rule narrowed to a skill the content
     * works, else the skill of the work that best makes what its lines pay (the Well's Copper Ore is
     * Mining's).
     */
    function starSkill(star, cap) {
        const constellation = rates.hall.constellations.find(c => c.id === star.constellation);
        if (constellation?.skill) return constellation.skill;
        for (const rank of star.ranks) for (const s of rank.rules) if (skillsOfWork.has(s?.payload?.category)) return s.payload.category;
        for (const rank of star.ranks) {
            for (const line of rank.lines) {
                const source = supplyOf(line.itemId, BEFORE_HALL, cap).work;
                const skill = source ? profiles.contextOf(source.target).skill : null;
                if (skill) return skill;
            }
        }
        return null;
    }

    const GATHERING = [WORK.GATHER, WORK.WATER, WORK.FIELD];

    const mainMemo = new Map();
    /**
     * What a skill's work spends, down to the gathered items it is made from, by how much an hour at
     * Typical before the Hall (each fed as the guild can): `Map<itemId, perHour>`, among the work
     * reachable by a stage. A smith's main input is the ore its ingots are smelted from.
     */
    function mainInputsOf(skill, cap) {
        const key = `${skill}|${cap}`;
        if (mainMemo.has(key)) return mainMemo.get(key);
        const out = new Map();
        for (const work of skillsOfWork.get(skill) || []) {
            if (work.tier === null || work.tier > cap) continue;
            for (const [itemId, perHour] of Object.entries(workAt(work, BEFORE_HALL, cap).inputs || {})) {
                if (!(perHour > 0) || !rates.items[itemId]) continue;
                const walk = (node, times) => {
                    if (node.cycle) return;
                    if (node.origin) {
                        out.set(node.id, (out.get(node.id) || 0) + node.quantity * times);
                        return;
                    }
                    for (const child of node.children) walk(child, times);
                };
                walk(ledger.treeOf(itemId).tree, perHour);
            }
        }
        mainMemo.set(key, out);
        return out;
    }

    const materialMemo = new Map();
    /**
     * The material a rank of a tier is priced in: an item first had at that tier (the owner's tier
     * for it, else when it is first reached), gathered rather than made at a station, the most of it
     * an hour at Typical before the Hall, of the star's own skill where one is; else the tier before.
     * A skill that is the best gatherer of nothing by then (Smithing, Cooking, Crafting) is
     * priced in its main input instead: the gathered item its work spends most of, at that
     * tier or the nearest before it. Never what the star itself pays.
     */
    function materialFor(star, tier, cap) {
        const skill = starSkill(star, cap);
        const own = new Set(star.ranks.flatMap(r => r.lines.map(l => l.itemId)));
        const key = `${skill}|${tier}|${cap}|${[...own].join(',')}`;
        if (materialMemo.has(key)) return materialMemo.get(key);
        indexMakers();
        const gathered = (itemId) => (madeBy.get(itemId) || []).some(w => GATHERING.includes(rates.workKindOf(w.target).kind));
        // Each tier's gathered items, at their best source then.
        const foundAt = [];
        for (let t = tier; t >= 0; t--) {
            const found = [];
            for (const itemId of Object.keys(rates.items)) {
                if (own.has(itemId) || effTier(itemKey(itemId)) !== t || !gathered(itemId)) continue;
                const s = supplyOf(itemId, BEFORE_HALL, cap);
                if (!(s.perHour > 0) || !Number.isFinite(s.perHour) || !s.work) continue;
                if (!GATHERING.includes(rates.workKindOf(s.work.target).kind)) continue;
                found.push({ itemId, perHour: s.perHour, work: s.work, mine: !!skill && profiles.contextOf(s.work.target).skill === skill });
            }
            foundAt.push(found);
        }
        let pick = null;
        if (skill && !foundAt.some(found => found.some(f => f.mine))) {
            const main = mainInputsOf(skill, cap);
            for (const found of foundAt) {
                const best = found.filter(f => main.get(f.itemId) > 0)
                    .sort((a, b) => main.get(b.itemId) - main.get(a.itemId) || b.perHour - a.perHour || a.itemId.localeCompare(b.itemId))[0];
                if (best) { pick = { ...best, main: true }; break; }
            }
        }
        for (const found of foundAt) {
            if (pick) break;
            const mine = found.filter(f => f.mine);
            pick = (mine.length ? mine : found).sort((a, b) => b.perHour - a.perHour || a.itemId.localeCompare(b.itemId))[0] || null;
        }
        materialMemo.set(key, pick);
        return pick;
    }

    /**
     * The price the ledger proposes for an authored rank: the most of its tier's material it can
     * cost and still pay back on the payback curve over all the work it boosts at Typical
     * ({@link guildPaybackOf}), rounded down to two figures, then never below the rank before
     * ({@link neverCheaper}).
     * `{ itemId, quantity, priceHours, payback, pays, work }`, or `{ why }` when it cannot propose one.
     */
    function proposePrice(track, rank, row) {
        if (track.tier(rank) === null) return { why: 'no tier set' };
        if (row.enabler) return { why: 'the only source of what it pays, so any price pays back' };
        if (!(row.guildGain > 0)) return { why: 'it saves no time at its tier' };
        const material = materialFor(track.star, row.tier, row.cap);
        if (!material) return { why: 'no gathered material at its tier' };
        // What is left of the curve's hours of guild-wide saving once the stars on the way are lit and the rank's coins earned.
        const coinHours = rankCoinHours(row);
        const left = row.curve * row.guildGain - row.opening.cost - coinHours;
        if (!(left > 0)) return { why: row.coins > 0 ? `opening it and earning its ${PACE_TEXT.coins(row.coins)} take longer than it can pay back` : `opening it (${openingWords(row.opening)}) takes longer than it can pay back` };
        const quantity = Math.max(1, roundDown(left * material.perHour));
        const priceHours = quantity / material.perHour;
        const payback = (priceHours + coinHours + row.opening.cost) / row.guildGain;
        return { itemId: material.itemId, quantity, priceText: priceWords([{ itemId: material.itemId, quantity }]), priceHours, payback, pays: withinCurve(payback, row.curve), work: material.work };
    }

    /** The stars a track opens from (a link counts from both ends), the Hall as `HALL_NODE`. */
    const waysOf = (track) => new Set([...track.links, ...profiles.hallTracks.filter(t => t.links.includes(track.id)).map(t => t.id)]);

    /**
     * A ring star's first rank: when it is lit and its ring first settled at the curve's player
     * (`litAt`, `opensAt`, hours from a new game), the stage end it is priced to (`budgetHours`) and
     * the price the ledger proposes ({@link proposeRingPrice}).
     */
    function ringRowOf(track, ring) {
        const opens = ringOpensAt(ring, TARGET);
        const budgetHours = ringBudgetHours(ring);
        return {
            ring, litAt: readyOf(starKey(track.id), TARGET).hours, opensAt: opens.hours, opensKey: opens.key,
            budgetHours, proposed: proposeRingPrice(track, ring)
        };
    }

    /** The material a ring star is priced in and when its gathering can start: `{ material, start, at }` or `{ why }`. */
    function ringMaterial(track, ring) {
        const tier = track.tier(1) ?? budgetTierOf(ring);
        const cap = Math.min(maxTier, tier);
        const material = materialFor(track.star, tier, cap);
        if (!material) return { why: 'no gathered material at its tier' };
        let openAt = Infinity;
        let openTier = Infinity;
        for (const way of waysOf(track)) {
            if (way === HALL_NODE) { openAt = 0; openTier = 0; break; }
            const r = readyOf(starKey(way), TARGET);
            if (r.hours < openAt) { openAt = r.hours; openTier = tierOfKey(starKey(way)) ?? openTier; }
        }
        if (!Number.isFinite(openAt)) return { why: 'no star it is linked to can be lit' };
        const start = Math.max(readyOf(itemKey(material.itemId), TARGET).hours, openAt);
        // Gathered as its lighting gathers it: at the star's own stage once priced.
        const at = Math.min(maxTier, Math.max(tierOfKey(itemKey(material.itemId)) ?? cap, Number.isFinite(openTier) ? openTier : 0));
        return { material, start, at };
    }

    const ringProposals = new Map();
    /**
     * The price the ledger proposes for a ring star: its tier's material (as a Hall rank's,
     * {@link materialFor}), as much as one hero gathers at the curve's player (Maxed) between when it can start (the
     * material had and a star it is linked to lit) and the end of the stage its ring opens after,
     * rounded down to two figures, so the ring opens when that stage ends. A wild ring, whose stage
     * has no budget, takes the tables' wild price growth (`wild.priceGrowth`, as its cells' prices do)
     * times the hours of the ring before's star. `{ itemId, quantity, priceText, priceHours, start,
     * litAt, budgetHours, grown }`, or `{ why }` when it cannot propose one.
     */
    function proposeRingPrice(track, ring) {
        const memoKey = `${track.id}|${ring}`;
        if (ringProposals.has(memoKey)) return ringProposals.get(memoKey);
        ringProposals.set(memoKey, { why: 'a loop of ring stars' });
        const out = ringProposal(track, ring);
        ringProposals.set(memoKey, out);
        return out;
    }

    function ringProposal(track, ring) {
        const budgetHours = ringBudgetHours(ring);
        let hours = null;
        let grown = null;
        if (budgetHours === null) {
            const before = (ledger.world.ringStars?.get(ring - 1) || []).map(id => profiles.hallTrack(id)).find(Boolean);
            const growth = Number(ledger.world.worldTables?.wild?.priceGrowth) || 0;
            if (ring <= STRICT_RINGS || !before || !(growth > 0)) {
                return { why: `no budget is set for ${tierLabel(budgetTierOf(ring))}, the stage its ring opens after` };
            }
            const prev = proposeRingPrice(before, ring - 1);
            if (!prev.itemId) return { why: `the star of the ring before has no proposal (${prev.why})` };
            hours = prev.priceHours * growth;
            grown = { from: before.id, growth };
        }
        const m = ringMaterial(track, ring);
        if (m.why) return m;
        const { material, start, at } = m;
        const name = nameOf(itemKey(material.itemId));
        if (hours === null) {
            hours = budgetHours - start;
            if (!(hours > 0)) return { why: `${name}, its material, is first had ${PACE_TEXT.hours(start)} in, after ${tierLabel(budgetTierOf(ring))} ends` };
        }
        const perHour = pacedSupply(material.itemId, TARGET, at);
        if (!(perHour > 0)) return { why: `${name} is not gathered at ${AT_TARGET} by then` };
        const quantity = Math.max(1, roundDown(hours * perHour));
        const priceHours = quantity / perHour;
        return {
            itemId: material.itemId, quantity, priceText: priceWords([{ itemId: material.itemId, quantity }]),
            priceHours, start, litAt: start + priceHours, budgetHours, grown, work: material.work
        };
    }

    // ── boosts by kind ─────────────────────────────────────────────────────────────────────────
    const kindGain = (work, profile, cap, kind, level = null) => {
        const { chosen, context, rate } = profiles.profileOf(work.target, profile, cap, level);
        const bare = profiles.bareSetup(context, cap, level);
        const picks = chosen.filter(c => pickKindOf(c, rate) === kind);
        if (!picks.length) return null;
        const offers = profiles.offers(context, cap);
        let s = bare;
        for (const c of picks) {
            if (c.kind === BOOST_KIND.HALL) {
                const ranks = { ...(s.hallRanks || {}) };
                for (const [id, r] of Object.entries(c.hallRanks || {})) ranks[id] = Math.max(r, ranks[id] || 0);
                s = { ...s, hallRanks: ranks };
                continue;
            }
            const o = offers.find(x => x.id === c.id && x.kind === c.kind);
            if (o) s = o.apply(s);
        }
        const r0 = rates.rateOf(work.target, bare);
        const r1 = rates.rateOf(work.target, s);
        const shown = kind === BOOST_KIND.HALL ? hallPicks(picks) : picks;
        // A building in several places is named once, with its copies.
        const copies = new Map();
        for (const c of shown) copies.set(pickName(c), (copies.get(pickName(c)) || 0) + 1);
        return {
            gain: RARE_FIND_KINDS.has(kind) ? findsGainOf(r0, r1) : gainOf(r0, r1, (item) => unitHours(item, cap)),
            names: [...copies].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)),
            factors: [...new Set(shown.map(c => c.factor))], factorKeys: [...new Set(shown.map(factorKeyOf))]
        };
    };
    const factorKeyOf = (c) => (c.kind === BOOST_KIND.HALL ? `hall:${c.upgrade}` : c.kind === BOOST_KIND.SUPPORT || c.kind === BOOST_KIND.CAMP ? tokenKey(c.id) : itemKey(c.id));
    /** A Hall track's name by id. */
    const hallName = (id) => profiles.hallTrack(id)?.name ?? id;
    const pickName = (c) => (c.kind === BOOST_KIND.HALL ? `${hallName(c.upgrade)} ${c.rank}` : nameOf(factorKeyOf(c)));
    /** Hall picks as one per star, at the highest rank taken (the stars lit to open one, at their rank 1). */
    const hallPicks = (picks) => {
        const top = new Map();
        for (const c of picks) {
            for (const [id, rank] of Object.entries(c.hallRanks || { [c.upgrade]: c.rank })) {
                if (!top.has(id) || rank > top.get(id).rank) top.set(id, { kind: BOOST_KIND.HALL, upgrade: id, rank, factor: `hall:${id}` });
            }
        }
        return [...top.values()];
    };

    let boostMemo = null;
    function boostRows() {
        if (boostMemo) return boostMemo;
        const rows = [];
        for (const work of works) {
            if (work.tier === null || !counted(work.entry)) continue;
            // A camp changes how many Tokens one hero works, and Passive Production is no hero's work: neither has a strength target.
            for (const kind of BOOSTED.filter(k => k !== BOOST_KIND.CAMP && !(k === BOOST_KIND.HALL && work.target.token && profiles.contextOf(work.target).kind === WORK.PASSIVE))) {
                const g = kindGain(work, PROFILE.MAXED, work.tier, kind);
                if (!g) continue;
                rows.push({ work, entry: work.entry, kind, tier: work.tier, ...g, target: boostTargetAt(settings, kind, work.tier) });
            }
        }
        boostMemo = rows;
        return rows;
    }

    // ── three checks the balance rules promise (sections 1 and 5) ─────────────────────────────
    const isStation = (work) => rates.workKindOf(work.target).kind === WORK.STATION;
    /** A work's rate at its authored numbers: Bare, its milestone perks left out. */
    const authoredRate = (work, cap) => rates.numbersOf(work.target, { ...profiles.bareSetup(profiles.contextOf(work.target), cap), perks: false });

    let chainMemo = null;
    /**
     * Every chain's total XP per hour of the gathering behind it (BALANCE_RULES section 1: each link
     * pays its own XP, so ore to ingot to dagger pays three times). A chain ends at an item a station
     * makes that no live station recipe spends; its XP is every link's for one of it, each link at its
     * authored XP (one action at Bare, no perks), over the hours its raw inputs take to gather: what
     * gathering, a water, a field or anything but a station gives, each at its own Bare source's rate
     * (a rare drop at its find rate; one in stock is free). Each item comes from its best source at
     * Bare at the end's stage; a raw input with no source by then leaves the chain out. Beside each,
     * the median of its tier's chains (by the end's tier) and how far off it is, null where a tier has
     * fewer than {@link CHAIN_MEDIAN_MIN} chains. A chain through a loop is left out.
     * `[{ item, name, tier, cap, xp, raw, rawHours, xpPerHour, links, median, off }]`, `raw` its raw
     * units, by tier then name.
     */
    function chainXpRows() {
        if (chainMemo) return chainMemo;
        indexMakers();
        const spent = new Set();
        for (const work of works) {
            if (work.tier === null || !counted(work.entry) || !isStation(work)) continue;
            for (const input of list(rates.recipes[work.target.recipe]?.inputs)) if (input?.itemId) spent.add(input.itemId);
        }
        const memo = new Map();
        const chainOf = (itemId, cap, stack) => {
            const key = `${itemId}|${cap}`;
            if (memo.has(key)) return memo.get(key);
            if (stack.has(itemId)) return null;
            const source = supplyOf(itemId, PROFILE.BARE, cap);
            const work = source.work;
            let out = null;
            if (!work || !isStation(work)) {
                const hours = source.perHour === Infinity ? 0 : source.perHour > 0 ? 1 / source.perHour : null;
                const r = work ? authoredRate(work, cap) : null;
                const made = r?.ok ? sum(Object.values(r.items || {})) : 0;
                if (hours !== null) out = { xp: made > 0 ? sum(Object.values(r.xp || {})) / made : 0, raw: 1, hours, links: work ? 1 : 0 };
            } else {
                const r = authoredRate(work, cap);
                const made = r?.ok ? r.items?.[itemId] || 0 : 0;
                if (made > 0) {
                    stack.add(itemId);
                    let xp = sum(Object.values(r.xp || {})) / made;
                    let raw = 0;
                    let hours = 0;
                    let links = 0;
                    let whole = true;
                    for (const [input, n] of Object.entries(r.inputs || {})) {
                        const c = chainOf(input, cap, stack);
                        if (!c) { whole = false; break; }
                        xp += (n / made) * c.xp;
                        raw += (n / made) * c.raw;
                        hours += (n / made) * c.hours;
                        links = Math.max(links, c.links);
                    }
                    stack.delete(itemId);
                    if (whole && hours > 0) out = { xp, raw, hours, links: links + 1 };
                }
            }
            memo.set(key, out);
            return out;
        };
        const rows = [];
        const ends = new Set();
        for (const work of works) {
            if (work.tier === null || !counted(work.entry) || !isStation(work)) continue;
            for (const o of list(rates.recipes[work.target.recipe]?.outputs)) if (o?.itemId && !spent.has(o.itemId)) ends.add(o.itemId);
        }
        for (const itemId of ends) {
            const key = itemKey(itemId);
            const cap = tierOfKey(key);
            const tier = effTier(key);
            if (cap === null || tier === null || !counted(key)) continue;
            const c = chainOf(itemId, cap, new Set());
            if (!c || c.links < 2) continue;
            rows.push({ item: itemId, name: nameOf(key), tier, cap, xp: c.xp, raw: c.raw, rawHours: c.hours, xpPerHour: c.xp / c.hours, links: c.links, median: null, off: null });
        }
        const byTier = new Map();
        for (const row of rows) {
            if (!byTier.has(row.tier)) byTier.set(row.tier, []);
            byTier.get(row.tier).push(row);
        }
        for (const group of byTier.values()) {
            if (group.length < CHAIN_MEDIAN_MIN) continue;
            const median = medianOf(group.map(r => r.xpPerHour));
            for (const row of group) {
                row.median = median;
                row.off = median > 0 ? row.xpPerHour / median - 1 : null;
            }
        }
        rows.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
        chainMemo = rows;
        return rows;
    }

    let batchMemo = null;
    /**
     * Every drink and work potion's batch payback (BALANCE_RULES section 5: a batch saves at least
     * `settings.batchPayback` times the hero time it took to make, ingredients included), as Typical's
     * own gate judged it (`batchPaybackOf` in `profiles.js`, kept on each profile as `batches`): on each work it is
     * offered at, at that work's Typical setup at the stage both are had, against the setup Typical holds
     * there once its choices are made (a dose holding its place judged without itself, one kept out by
     * another judged in that one's place). Each row is the work it pays back best on, so a row short of the
     * factor is a dose Typical takes on no work. `gain` is the work it saves an hour (as a boost's
     * strength is read: the larger of its items' worth and its XP), `doses` what it spends of it an hour
     * at the game's dose length (the rate calculator reads it from `consumableRule.js`), `doseCycles`
     * the cycles one lasts, `unitHours` the hero-hours one takes to make with its ingredients, `spends`
     * the hours an hour its doses take to make, and `ratio` the one over the other. A craft's batch is
     * so many doses for so many times one's making, so the ratio is the batch's.
     * `[{ item, name, tier, cap, work, gain, doses, doseCycles, unitHours, spends, ratio }]`, by name.
     */
    function batchPaybackRows() {
        if (batchMemo) return batchMemo;
        const best = new Map();
        for (const work of works) {
            if (work.tier === null || !counted(work.entry)) continue;
            const ctx = profiles.contextOf(work.target);
            // A build is done once and Passive Production is no hero's: a batch is drunk over repeatable work.
            if (!ctx.consumables.length || !repeatedByHero(ctx.kind)) continue;
            for (const id of ctx.consumables) {
                const key = itemKey(id);
                const tier = tierOfKey(key);
                if (tier === null || !counted(key)) continue;
                const cap = Math.max(work.tier, tier);
                const typical = profiles.profileOf(work.target, PROFILE.TYPICAL, cap);
                const b = typical.batches.get(id);
                if (!b) continue;
                const prev = best.get(id);
                if (!prev || b.ratio > prev.ratio) {
                    best.set(id, { item: id, name: nameOf(key), tier: effTier(key) ?? tier, cap, work, ...b });
                }
            }
        }
        batchMemo = [...best.values()].sort((a, b) => a.name.localeCompare(b.name));
        return batchMemo;
    }

    let hallGuildMemo = null;
    /**
     * Every Guild Hall rank's payback over all the work it boosts, on the payback curve, as
     * `hallPaybacks` works it out for each rank ({@link guildPaybackOf}). Ranks that add no rate and
     * enablers are left out.
     * `[{ id, name, rank, tier, cap, level, heroes, works, counted, gain, oneWork, cost, payback, curve, off, row }]`.
     */
    function hallGuildPaybacks() {
        if (hallGuildMemo) return hallGuildMemo;
        hallGuildMemo = hallPaybacks().filter(row => row.rate !== false && !row.enabler).map(row => ({
            id: row.id, name: row.name, rank: row.rank, tier: row.tier, cap: row.cap, level: row.curveLevel, ...row.guildWorks,
            gain: row.guildGain, oneWork: row.gain, cost: row.priceHours + row.opening.cost, payback: row.guildPayback, curve: row.curve,
            off: row.guildPayback / row.curve - 1, row
        }));
        return hallGuildMemo;
    }

    // ── the boost budget ───────────────────────────────────────────────────────────────────────
    /** A level held within a tier's span on the ladder: from the level the tier opens at to before the next tier's. */
    const levelInTier = (tier, level) => {
        const from = tierLevelAt(settings.tierLevels, tier);
        const next = settings.tierLevels.find(p => p.tier > tier && p.level > from);
        return Math.max(from, next ? Math.min(level, next.level - 1) : level);
    };
    /**
     * Boosts the budget does not size (the balancer, 2026-11-26): a world event's Token and a factor that
     * moves only bonus drops. A profile's rate is read again with them switched off, unless Bare holds
     * them too (the work's own). Mastery tracks are not rated at all (`rates.js` reads none).
     */
    const eventTokens = new Set(Object.values(content?.events || {}).map(e => e?.typeId).filter(Boolean));
    const unbudgeted = (factor) => {
        if (!factor?.on) return false;
        const axes = list(factor.axes);
        if (axes.length && axes.every(a => a === EFFECT_TYPES.BONUS_DROP)) return true;
        const id = factor.kind === FACTOR.SUPPORT ? String(factor.id).slice(FACTOR.SUPPORT.length + 1) : null;
        return !!id && (eventTokens.has(id) || list(rates.token(id)?.tags).includes('Event'));
    };
    function budgetedRate(target, chosen, bare) {
        const own = new Set(list(bare.factors).filter(f => f.on).map(f => f.id));
        const off = list(chosen.rate?.factors).filter(f => unbudgeted(f) && !own.has(f.id)).map(f => f.id);
        return off.length ? rates.rateOf(target, { ...chosen.setup, off: [...list(chosen.setup?.off), ...off] }) : chosen.rate;
    }
    let budgetMemo = null;
    /**
     * Every boost the profiles hold, counted against the boost budget (BALANCE_RULES section 5): for
     * each piece of work at its own stage, what Typical's and Maxed's boosts together add by kind
     * against Bare ({@link boostTotals}), beside the budget's cell of the tier where the boost is held:
     * the work's own tier (a recipe at a tier-3 station is tier 3), or its entry's planned tier where
     * that is later, climbing within that tier by the work's level (`settings.boostBudgetAt`). `[{ work, entry, tier, entryTier, level, profile, kind,
     * pct, budget }]`, kinds that add nothing left out. Fights are combat's, and Passive Production is
     * no hero's work.
     */
    function budgetRows() {
        if (budgetMemo) return budgetMemo;
        const rows = [];
        for (const work of works) {
            if (work.tier === null || !counted(work.entry)) continue;
            const ctx = profiles.contextOf(work.target);
            if (!ctx.skill || ctx.kind === WORK.PASSIVE || ctx.kind === WORK.FIGHT) continue;
            const bare = profiles.profileOf(work.target, PROFILE.BARE, work.tier).rate;
            if (!bare.ok) continue;
            const level = ctx.gate ?? 1;
            // Held where the work is had: its own tier (the station's, the water's), or its entry's planned tier where later.
            const entryTier = Math.max(work.tier, effTier(work.entry) ?? work.tier);
            const cell = boostBudgetAt(settings, levelInTier(entryTier, level));
            for (const profile of [PROFILE.TYPICAL, PROFILE.MAXED]) {
                const totals = boostTotals(bare, budgetedRate(work.target, profiles.profileOf(work.target, profile, work.tier), bare));
                for (const { id: kind } of BOOST_BUDGET_KINDS) {
                    const pct = totals[kind];
                    if (pct === null || !(pct > 0.05)) continue;
                    rows.push({ work, entry: work.entry, tier: work.tier, entryTier, level, profile, kind, pct, budget: cell[kind][profile] });
                }
            }
        }
        budgetMemo = rows;
        return rows;
    }

    /**
     * The boost budget's findings: per kind and profile, the work whose boosts add more than its cell
     * (by over half a point, past rounding), and Maxed's speed cut past the cap, the most over first.
     */
    function budgetFindings() {
        const out = [];
        const label = Object.fromEntries(BOOST_BUDGET_KINDS.map(k => [k.id, k.label]));
        const groups = new Map();
        const push = (id, row) => {
            if (!groups.has(id)) groups.set(id, []);
            groups.get(id).push(row);
        };
        for (const r of budgetRows()) {
            if (r.pct > r.budget + 0.5) push(`${r.kind}|${r.profile}`, r);
            if (r.kind === 'speed' && r.profile === PROFILE.MAXED && r.pct > settings.speedCapPct + 0.5) push('cap', r);
        }
        const amount = (r) => `${r.kind === 'speed' ? '−' : '+'}${Math.round(r.pct)} %`;
        for (const [id, rows] of groups) {
            rows.sort((a, b) => (b.pct - b.budget) - (a.pct - a.budget) || workName(a.work).localeCompare(workName(b.work)));
            const more = rows.length > 4 ? ` and ${rows.length - 4} more` : '';
            const pieces = rows.length === 1 ? 'one piece of work' : `${rows.length} pieces of work`;
            if (id === 'cap') {
                const shown = rows.slice(0, 4).map(r => `${workName(r.work)} ${amount(r)}`).join(', ');
                out.push({ key: 'budget:speed-cap', name: `Speed at ${PROFILE_TEXT.maxed}`, rows, message: `Speed at ${PROFILE_TEXT.maxed} past the ${settings.speedCapPct} % cap: ${pieces}, ${shown}${more}. One more Faster Work building should always still help.` });
                continue;
            }
            const [kind, profile] = id.split('|');
            const shown = rows.slice(0, 4).map(r => `${workName(r.work)} ${amount(r)} against ${Math.round(r.budget)} %`).join(', ');
            out.push({ key: `budget:${kind}:${profile}`, name: `${label[kind]} at ${PROFILE_TEXT[profile]}`, rows, message: `${label[kind]} at ${PROFILE_TEXT[profile]}: ${pieces} over the boost budget, ${shown}${more}.` });
        }
        return out;
    }

    // ── the per-skill breakdown ────────────────────────────────────────────────────────────────
    /**
     * For each skill and each stage it is levelled in: the best XP source at Typical and at Maxed,
     * its Bare XP an hour, and how much each kind of boost adds to it.
     */
    function breakdown() {
        const out = [];
        for (const skill of [...new Set([...askedAt.keys(), ...skillsOfWork.keys()])].sort()) {
            const track = trackOf(skill);
            const stages = new Map();
            for (const row of track.levels) stages.set(row.tier, row.level);
            if (!stages.size) {
                // A skill no entry asks a level of: read it where its first work is reached.
                const first = Math.min(...(skillsOfWork.get(skill) || []).map(w => w.tier).filter(Number.isInteger));
                stages.set(Number.isFinite(first) ? first : maxTier, 1);
            }
            for (const [tier, level] of [...stages].sort((a, b) => a[0] - b[0])) {
                const row = { skill, tier, level, profiles: {} };
                for (const profile of [PROFILE.TYPICAL, PROFILE.MAXED]) {
                    const best = bestXp(skill, level, profile, tier);
                    if (!best.work) { row.profiles[profile] = null; continue; }
                    const bareRate = paced(best.work, PROFILE.BARE, tier, best.at);
                    // What the hero levels with: its own profile's boosts, or a profile's with less where that levels faster.
                    const kinds = {};
                    for (const kind of BOOSTED) {
                        const g = kindGain(best.work, best.profile, tier, kind, best.at);
                        if (g) kinds[kind] = g;
                    }
                    const perks = (best.work && workAt(best.work, best.profile, tier, best.at).rate.factors || []).filter(f => boostKindOf(f) === BOOST_KIND.PERK && f.axes.length);
                    if (perks.length) kinds[BOOST_KIND.PERK] = { gain: null, names: perks.map(f => f.name) };
                    row.profiles[profile] = {
                        work: best.work, name: workName(best.work), xp: best.xp, bareXp: bareRate.xp[skill] || 0,
                        fed: best.scale * (best.chain ?? 1), short: best.short ? nameOf(itemKey(best.short)) : null, kinds,
                        gatherers: heroesOf(best.work, best.profile, tier, best.at) - 1
                    };
                }
                out.push(row);
            }
        }
        return out;
    }

    const api = {
        settings, book: rates, profiles, works, maxTier, target: TARGET,
        workOf: (target) => byKey.get(targetKey(target)) || null,
        workName,
        /** A work's rate at a profile and stage (its own tier by default), fed by the guild. */
        rateAt: (target, profile, cap = null) => {
            const work = byKey.get(targetKey(target));
            if (!work) return null;
            const c = cap ?? work.tier ?? maxTier;
            return { ...workAt(work, profile, c), ...profiles.profileOf(work.target, profile, c), cap: c };
        },
        supplyOf: (itemId, profile, cap = maxTier) => supplyOf(itemId, profile, cap),
        /** Hero-hours one of an item takes at a profile and stage, the gatherers down its chain counted: what a boost's price and a drink's cost are weighed in. */
        heroHoursOf: (itemId, profile, cap = maxTier) => heroHoursOf(itemId, profile, cap),
        /** The share of its full pace a work runs at in the reference chain, at a profile and stage (its own tier by default). */
        chainOf: (target, profile, cap = null, level = null) => {
            const work = byKey.get(targetKey(target));
            if (!work) return null;
            return chainScale(work, profile, cap ?? work.tier ?? maxTier, level);
        },
        /** How a work's chain is staffed at a profile and stage (its own tier by default): `{ need, gatherers, brewers, have, scale }`. */
        staffingOf: (target, profile, cap = null, level = null) => {
            const work = byKey.get(targetKey(target));
            if (!work) return null;
            return staffingOf(work, profile, cap ?? work.tier ?? maxTier, level);
        },
        /** When an entry is first had at a profile with the reference guild's heroes: `{ hours, pathHours, heroHours, workHours, byWork }`. */
        arrivalOf,
        /** The reference guild's heroes by stage, each over its span on the curve, in hours. */
        heroSpans: () => heroSpans.map(s => ({ ...s })),
        /** What a skill's levels make from a new game to a level at a profile, at their best sources: `{ itemId: count }`. */
        levelMade: (skill, level, profile = TARGET) => Object.fromEntries(levelMade(skill, level, profile)),
        /**
         * Everything planned for a stage and the ones before at the curve's player, each once: the level
         * each skill must reach and the steps on the way, with their hero-hours.
         */
        workOfStage: (tier) => {
            const w = stageWorkOf(tier);
            const done = workFor(w, TARGET);
            return {
                levels: { ...w.levels }, steps: [...w.steps], levelHeroHours: done.levelHeroHours, stepHeroHours: done.stepHeroHours, heroHours: done.heroHours,
                costliest: done.steps.sort((a, b) => b.heroHours - a.heroHours).slice(0, 5)
            };
        },
        /** The guild's heroes an hour of a work takes at a profile and stage (its own tier by default): its hero and the gatherers down its chain. */
        heroesOf: (target, profile, cap = null, level = null) => {
            const work = byKey.get(targetKey(target));
            if (!work) return null;
            return heroesOf(work, profile, cap ?? work.tier ?? maxTier, level);
        },
        trackOf,
        /** Each work of a skill open at a level, at a profile and stage, as the level track rates it: `[{ work, xp, gate, profile, … }]`, XP an hour. */
        xpSourcesAt: (skill, level, profile = TARGET, cap = maxTier) => rankedXp(skill, level, profile, cap).filter(r => r.gate <= level),
        hoursToLevel,
        levelAtHours,
        walls: (skill) => wallsOf(skill),
        unlockWalls,
        boostGroups,
        /** What one kind of boost adds to a work at a profile and stage (its own tier by default): a fraction, null when the profile takes none. */
        boostGain: (target, kind, profile = PROFILE.MAXED, cap = null) => {
            const work = byKey.get(targetKey(target));
            if (!work || work.tier === null) return null;
            return kindGain(work, profile, cap ?? work.tier, kind)?.gain ?? null;
        },
        skills: () => [...new Set([...askedAt.keys(), ...skillsOfWork.keys()])].sort(),
        pathOf: (key, profile) => ({ ...readyOf(key, profile), steps: criticalPath(key, profile) }),
        stageOf,
        /** The way out of a stage: the soonest of the next stage's places, its levels and its price, with the stage's heroes (what its budget times). */
        gateOf,
        /**
         * A stage's way out re-timed as if its place asked other levels (`{ skill: level }`) or coins:
         * what moving its settle level or its ring's coins would give. Null when the stage has no way out.
         */
        wayOutWith: (tier, { levels = null, coins = null } = {}) => {
            const g = gateOf(tier);
            return g.place ? placeWayOut(g.place, tier, { levels, coins }) : null;
        },
        ringOpensAt,
        hallPaybacks,
        hallGuildPaybacks,
        chainXpRows,
        batchPaybackRows,
        hallName,
        effTier,
        boostRows,
        budgetRows,
        breakdown,
        /** The guild's coins an hour at a profile and stage, `hours` into a new game (any level when left out): `{ perHour, work, theft, readyHours }`. */
        coinSupplyOf: (profile, cap = maxTier, hours = Infinity) => coinSupplyOf(profile, cap, hours),
        /** A worker's selling at a profile and stage, `hours` into a new game: what a coin price is set on. */
        sellingSupplyOf: (profile, cap = maxTier, hours = Infinity) => sellingSupplyOf(profile, cap, hours),
        /** Every way one hero earns coins at a profile and stage, the most an hour first, with when its level is had. */
        coinSourcesOf: (profile, cap = maxTier) => coinSourcesOf(profile, cap),
        /** One copy's coin worth, as Recalculate writes it. */
        coinWorthOf: worthOf,
        coinPrices,
        asksCoins,
        coinDrops,
        coinThefts,
        findings,
        /** The nodes whose site's layout moves what they make past the tolerance (the `layout` check). */
        layoutRows,
        /** The same content timed at the other layout, built when first asked. */
        otherLayoutPace,
        /** Each skill's days to 99 at each profile in this pace's layout, plain data for the CMS's Worker to hand back. */
        layoutDays,
        /** Each skill's days to 99 in both layouts, and how far apart they are (the other layout's days when handed). */
        layoutSpread,
        /** The buildings a profile stands round a work at a stage (its own tier by default), in its site's places. */
        siteOf: (target, profile, cap = null) => {
            const work = byKey.get(targetKey(target));
            if (!work || work.tier === null) return null;
            return profiles.siteOf(work.target, profiles.profileOf(work.target, profile, cap ?? work.tier).setup);
        }
    };
    return api;
}

/** Records by entry key from content shaped as the ledger takes it, for their plan blocks. */
function recordsOf(content) {
    const out = new Map();
    const each = (collection, keyOf) => {
        if (Array.isArray(collection)) collection.forEach(d => { if (isObject(d) && d.id) out.set(keyOf(d.id), d); });
        else if (isObject(collection)) for (const [id, d] of Object.entries(collection)) if (isObject(d)) out.set(keyOf(d.id ?? id), d);
    };
    each(content.items, itemKey);
    each(content.tokens, tokenKey);
    if (Array.isArray(content.recipes) || isObject(content.recipes)) each(content.recipes, recipeKey);
    else for (const pool of Object.values(isObject(content.recipePools) ? content.recipePools : {})) each(pool, recipeKey);
    return out;
}

/** The step two significant figures leave: 1 below 100, 10 below 1000, and so on. */
function figureStep(n) {
    const digits = Math.floor(Math.log10(n));
    return digits >= 2 ? 10 ** (digits - 1) : 1;
}

/** Down to two significant figures, so a proposed price reads plainly and never pays back slower than asked. */
export function roundDown(n) {
    if (!(n >= 1)) return 0;
    const step = figureStep(n);
    return Math.floor(n / step) * step;
}

/** Up to two significant figures, so a price raised to the rank before never lands under it. */
export function roundUp(n) {
    if (!(n > 0)) return 0;
    if (n < 1) return 1;
    const step = figureStep(n);
    return Math.ceil(n / step - 1e-9) * step;
}

/**
 * What one rate's boosts add to another's, by the boost budget's kinds, in percent (null where a
 * kind can be read on nothing): speed the cut in work time, or in a node's growth or rest where that
 * is cut more (Farming's growth counts as speed); XP a cycle's XP; yield a cycle's main output (what
 * it makes most of, among what it makes at least once in {@link LUCK_BELOW} cycles); rare finds the
 * largest rise of what it makes rarer than that.
 */
export function boostTotals(r0, r1) {
    const out = { speed: null, xp: null, yield: null, rare: null };
    if (!r0?.ok || !r1?.ok) return out;
    const cut = (a, b) => (a > 0 && b > 0 ? (1 - b / a) * 100 : null);
    const speeds = [cut(r0.cycleMs, r1.cycleMs), cut(r0.lifecycle?.restMs, r1.lifecycle?.restMs)].filter(v => v !== null);
    if (speeds.length) out.speed = Math.max(...speeds);
    if (r0.xpPerCycle > 0) out.xp = (r1.xpPerCycle / r0.xpPerCycle - 1) * 100;
    let main = null;
    for (const [item, n] of Object.entries(r0.perCycle || {})) {
        if (!(n > 0)) continue;
        if (n >= LUCK_BELOW) {
            if (!main || n > r0.perCycle[main]) main = item;
            continue;
        }
        const rise = ((r1.perCycle?.[item] ?? 0) / n - 1) * 100;
        out.rare = out.rare === null ? rise : Math.max(out.rare, rise);
    }
    if (main) out.yield = ((r1.perCycle?.[main] ?? 0) / r0.perCycle[main] - 1) * 100;
    return out;
}

/**
 * How much more of its finds a rate brings than another: the largest rise of any one item it made
 * already, as a fraction (1 is twice as many). A rare-find boost's strength, read on the finds it
 * raises rather than diluted by the work's whole worth.
 */
export function findsGainOf(r0, r1) {
    if (!r0?.ok || !r1?.ok) return 0;
    let top = 0;
    for (const [item, n0] of Object.entries(r0.items || {})) {
        const n1 = r1.items?.[item] ?? 0;
        if (n0 > 0) top = Math.max(top, n1 / n0 - 1);
    }
    return top;
}

export { PROFILE, PROFILES, PROFILE_TEXT, gainOf };
