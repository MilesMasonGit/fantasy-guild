// the progression ledger's pace: supply, level times and path time at each profile, and checks D

import { buildRateBook, LIFECYCLE } from './rates.js';
import { buildProfiles, targetKey, PROFILE, PROFILES, PROFILE_TEXT, BOOST_KIND, BOOST_KIND_TEXT, boostKindOf } from './profiles.js';
import { settingsOf, minutesPerLevelAt, minutesToReach, formatMinutes, levelAtMinutes } from './settings.js';
import { HOW, COMBAT, parseKey, itemKey, tokenKey, recipeKey, LEDGER_ENGINE_TEXT } from './engine.js';
import { planOf, PLAN_STATUS, tierLabel } from './plan.js';
import { xpForLevel, MAX_SKILL_LEVEL } from '../../../utils/XPCurve.js';
import { turnTiming } from '../../../config/registries/tokenConstants.js';
import { GUILD_UPGRADES, getUpgradePrice, wishingWellWater, WISHING_WELL_ITEM } from '../../../config/guildUpgrades.js';

/**
 * How the game is paced for the target player, worked out statically from the content at the three
 * profiles (`profiles.js`), every step shown (owner, 2026-10-29: "pathing and a rate calculator",
 * no pretend player):
 *
 * - **Supply**: how fast the guild gets each item at a stage: the best source reachable by then,
 *   fed by one hero on the best source of each of its inputs (a smith fed by one miner). A loop
 *   (seeds that make seeds) takes its own input as in stock.
 * - **Level tracks**: for each skill, the hours each level takes: the XP it needs over the best
 *   XP an hour any work of the skill gives at that level, fed the same way, among the work reachable
 *   by the stage that first asks for that level.
 * - **Path time**: for each entry, when it is first had from a new game: along the path the reach
 *   engine shows, a step starts once everything it needs is had and its level gates are reached
 *   (skills level side by side, each by its own hero: one job per hero), then takes its own time
 *   (gathering what it spends, a build, a cycle, a chance at average luck).
 * - **Checks D**: walls (a level far slower than the pace curve), a long wait for one unlock, a
 *   stage's time against its budget, Bare and Maxed out of their bounds, a Guild Hall rank slow to
 *   pay back, a boost off its target strength, and what the calculator cannot read.
 *
 * Average luck only. Hours are hero-work hours: heroes keep working through the player's check-ins
 * and the night, so a level grind runs around the clock; a step that waits on the player is not
 * delayed (an attentive player).
 *
 * Pure: reads only the content, the ledger and the settings it is handed.
 */

const HOUR_MS = 3_600_000;

/** The kinds of boost a profile chooses per piece of work (perks come with levels). */
const BOOSTED = [BOOST_KIND.SUPPORT, BOOST_KIND.CAMP, BOOST_KIND.CONSUMABLE, BOOST_KIND.TOOL, BOOST_KIND.GEAR, BOOST_KIND.HALL];

/** Author-facing words, kept together for translation. */
export const PACE_TEXT = Object.freeze({
    hours: (h) => (Number.isFinite(h) ? formatMinutes(h * 60) : 'never'),
    times: (r) => `${r >= 10 ? Math.round(r) : Math.round(r * 10) / 10}×`,
    skill: (s) => (s === COMBAT ? 'Combat' : s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'),
    waits: Object.freeze({ need: 'waits for', level: 'levels', own: 'its own time' })
});

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

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
        }
        const tier = parts.some(t => t === null) ? null : Math.max(...parts);
        const work = { target, key: targetKey(target), entry, tier };
        works.push(work);
        byKey.set(work.key, work);
    }
    const tiers = new Set([...reach.values()].map(a => a.tier).filter(Number.isInteger));
    for (const s of settings.stages) tiers.add(s.tier);
    const maxTier = tiers.size ? Math.max(...tiers) : 0;

    // ── supply: Bare first (it prices every boost), then the profiles that buy them ─────────────
    const supplyMemo = new Map();
    const fedMemo = new Map();
    const madeBy = new Map();
    let profiles = null;
    let indexed = false;
    const indexMakers = () => {
        if (indexed) return;
        indexed = true;
        // What each work can make with or without every boost, read without pricing anything (pricing reads this index).
        for (const work of works) {
            if (work.tier === null) continue;
            const r = profiles.everythingOf(work.target, maxTier);
            const b = profiles.profileOf(work.target, PROFILE.BARE, maxTier).rate;
            for (const item of new Set([...Object.keys(r.items || {}), ...Object.keys(b.items || {})])) {
                if (!madeBy.has(item)) madeBy.set(item, []);
                madeBy.get(item).push(work);
            }
        }
    };

    /** A work's rate fed by the guild: one hero on the best source of each input, its scale the scarcest. */
    function fed(work, profile, cap, stack) {
        const key = `${work.key}|${profile}|${cap}`;
        if (fedMemo.has(key)) return fedMemo.get(key);
        const { rate } = profiles.profileOf(work.target, profile, cap);
        let out;
        if (!rate.ok) {
            out = { rate, scale: 0, items: {}, xp: {}, tokens: {}, inputs: {}, short: null };
        } else {
            let scale = 1;
            let short = null;
            for (const [item, need] of Object.entries(rate.inputs || {})) {
                // What the work makes of its own input (a felled tree's seedlings for its regrowth) comes first.
                const own = rate.items?.[item] || 0;
                if (!(need > own)) continue;
                const s = supplyOf(item, profile, cap, stack).perHour + own;
                if (s / need < scale) {
                    scale = s / need;
                    short = item;
                }
            }
            scale = Math.max(0, Math.min(1, scale));
            const times = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, v * scale]));
            out = { rate, scale, items: times(rate.items), xp: times(rate.xp), tokens: times(rate.tokens), inputs: times(rate.inputs), short };
        }
        if (!stack.size) fedMemo.set(key, out);
        return out;
    }

    /** How fast the guild gets an item at a stage: `{ perHour, work }`, the best source then. */
    function supplyOf(itemId, profile, cap, stack = new Set()) {
        const key = `${itemId}|${profile}|${cap}`;
        if (supplyMemo.has(key)) return supplyMemo.get(key);
        // An item asked for inside its own making (seeds for the tree that drops them) is in stock.
        if (stack.has(itemId)) return { perHour: Infinity, work: null, loop: true };
        indexMakers();
        stack.add(itemId);
        let best = { perHour: 0, work: null };
        for (const work of madeBy.get(itemId) || []) {
            if (work.tier === null || work.tier > cap) continue;
            const f = fed(work, profile, cap, stack);
            const n = f.items[itemId] || 0;
            if (n > best.perHour) best = { perHour: n, work };
        }
        stack.delete(itemId);
        if (!stack.size) supplyMemo.set(key, best);
        return best;
    }

    const unitHours = (itemId, cap) => {
        const s = supplyOf(itemId, PROFILE.BARE, cap).perHour;
        return s > 0 ? 1 / s : Infinity;
    };
    /** Bare hero-hours to have one of a Token: free where the camp or a Region places it, else its price and its build. */
    const costHours = (key, cap) => {
        const at = reach.get(key);
        if (!at?.rule) return Infinity;
        const rule = at.rule;
        if ([HOW.STARTER_CAMP, HOW.MAP, HOW.MODIFIER, HOW.HALL, HOW.SPAWN, HOW.GROW, HOW.TURN, HOW.REGROW].includes(rule.how)) return 0;
        if (rule.how === HOW.SHOP) return sum(rule.inputs.map(i => i.quantity * unitHours(parseKey(i.key).id, cap)));
        if (rule.how === HOW.CRAFT) {
            const recipe = rates.recipes[parseKey(rule.via).id];
            const build = reach.get(rule.via)?.rule;
            const foundation = build?.how === HOW.BUILD ? reach.get(build.via)?.rule : null;
            const price = foundation?.how === HOW.SHOP ? foundation.inputs : [];
            return sum([...rule.inputs, ...price].map(i => i.quantity * unitHours(parseKey(i.key).id, cap))) + (Number(recipe?.durationMs) || 0) / HOUR_MS;
        }
        return Infinity;
    };
    profiles = buildProfiles(rates, {
        tierOf: tierOfKey, unitHours, costHours, horizonHours: () => settings.paybackHours, campMembers: settings.campMembers,
        inputScale: (rate, cap, profile) => {
            let scale = 1;
            for (const [item, need] of Object.entries(rate.inputs || {})) {
                const own = rate.items?.[item] || 0;
                if (need > own) scale = Math.min(scale, (supplyOf(item, profile, cap).perHour + own) / need);
            }
            return Math.max(0, scale);
        }
    });

    /** A work's profile rate at a stage, fed. */
    const workAt = (work, profile, cap) => fed(work, profile, cap, new Set());

    // ── level tracks ───────────────────────────────────────────────────────────────────────────
    const askedAt = new Map();
    for (const [key, at] of reach) {
        if (!Number.isInteger(at.tier) || at.planned || !/^(item|token|recipe):/.test(key)) continue;
        // A Parked entry's levels still count: a live path may run through it.
        const tier = effTier(key);
        for (const [skill, level] of Object.entries(at.levels || {})) {
            if (skill === COMBAT) continue;
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
        for (let level = 1; level < top; level++) {
            const needing = asks.filter(a => a.level > level);
            const tier = needing.length ? Math.min(...needing.map(a => a.tier).filter(Number.isInteger)) : maxTier;
            const cap = Number.isFinite(tier) ? tier : maxTier;
            const xp = xpForLevel(level + 1) - xpForLevel(level);
            const row = { level, tier: cap, xp, curveMinutes: minutesPerLevelAt(settings, level), hours: {}, cumulative: {}, source: {} };
            for (const profile of PROFILES) {
                const best = bestXp(skill, level, profile, cap);
                const hours = best.xp > 0 ? xp / best.xp : Infinity;
                total[profile] += hours;
                row.hours[profile] = hours;
                row.cumulative[profile] = total[profile];
                row.source[profile] = best;
            }
            levels.push(row);
        }
        const out = { skill, top, levels, asks };
        trackMemo.set(skill, out);
        return out;
    }

    const bestMemo = new Map();
    function bestXp(skill, level, profile, cap) {
        const key = `${skill}|${profile}|${cap}`;
        let ranked = bestMemo.get(key);
        if (!ranked) {
            ranked = (skillsOfWork.get(skill) || [])
                .filter(w => w.tier !== null && w.tier <= cap)
                .map(w => {
                    const f = workAt(w, profile, cap);
                    return { work: w, gate: f.rate.gates?.needed ?? 1, xp: f.xp[skill] || 0, scale: f.scale, short: f.short };
                })
                .filter(x => x.xp > 0)
                .sort((a, b) => a.gate - b.gate);
            bestMemo.set(key, ranked);
        }
        let best = { xp: 0, work: null };
        for (const r of ranked) if (r.gate <= level && r.xp > best.xp) best = r;
        return best;
    }

    /** Hours from a new game to a skill level at a profile: the track's cumulative hours. */
    function levelHours(skill, level, profile) {
        if (level <= 1) return 0;
        const track = trackOf(skill);
        const row = track.levels[Math.min(level, track.top) - 2];
        if (!row) return 0;
        return level > track.top ? Infinity : row.cumulative[profile];
    }

    // ── path time ──────────────────────────────────────────────────────────────────────────────
    const gatherHours = (inputs, profile, cap) => {
        // One hero on each item: the slowest item sets the time.
        let worst = 0;
        let item = null;
        for (const { key, quantity } of inputs) {
            if (!(quantity > 0)) continue;
            const s = supplyOf(parseKey(key).id, profile, cap).perHour;
            const h = s > 0 ? quantity / s : Infinity;
            if (h > worst) { worst = h; item = key; }
        }
        return { hours: worst, item };
    };

    /** The own time of the step that gives `give` by `rule` at a profile: `{ hours, complete, why }`. */
    function stepOf(rule, give, profile, cap) {
        const done = (hours, why = null, extra = {}) => ({ hours, complete: Number.isFinite(hours), why, ...extra });
        const ratedBy = (target) => {
            const work = byKey.get(targetKey(target));
            return work ? workAt(work, profile, Math.max(cap, work.tier ?? cap)) : null;
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
            // A first-kill drop comes with the first win: one fight.
            if (give.firstKill && f?.rate?.ok) return done(f.rate.cycleMs / HOUR_MS, null, { firstKill: true });
            return firstOf(f, give.key);
        }
        case HOW.CATCH: {
            const id = parseKey(rule.via).id;
            const pools = works.filter(w => w.target.token === id && w.target.pool);
            let best = done(Infinity, 'no pool catches it');
            for (const w of pools) {
                const r = firstOf(workAt(w, profile, Math.max(cap, w.tier ?? cap)), give.key);
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
        case HOW.SHOP: {
            const g = gatherHours(rule.inputs, profile, cap);
            return done(g.hours, Number.isFinite(g.hours) ? null : 'its price is never made', { gather: g });
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
        case HOW.TURN: {
            const def = rates.token(parseKey(rule.via).id);
            const { everyMs, chance } = turnTiming(def?.turns);
            return chance > 0 && give.chance > 0 ? done(everyMs / (chance / 100) / give.chance / HOUR_MS) : done(Infinity, 'never turns');
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
        case HOW.BONUS: {
            const target = rule.needs.find(n => n !== rule.via && n.startsWith('token:'));
            const f = target ? ratedBy({ token: parseKey(target).id }) : null;
            const cph = f?.rate?.ok ? f.rate.cyclesPerHour * f.scale : 0;
            return cph > 0 && give.chance > 0 ? done(1 / (cph * give.chance)) : done(Infinity, 'a bonus on work not timed');
        }
        case HOW.BOUNTY:
            return done(0, 'bounties are not timed', { complete: false });
        case HOW.UPCYCLE:
            return done(0, 'trading maps up is not timed', { complete: false });
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
            const h = levelHours(g.skill, g.level, profile);
            gates.push({ ...g, hours: h });
            if (h > start) { start = h; waitsOn = { skill: g.skill, level: g.level }; }
        }
        const give = rule.gives.find(g => g.key === key) || { key, chance: at.chance ?? 1 };
        const own = stepOf(rule, give, profile, at.tier);
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

    // ── stages ─────────────────────────────────────────────────────────────────────────────────
    const entryKeys = [...plans.keys()].filter(k => /^(item|token|recipe):/.test(k));
    const counted = (key) => {
        const status = statusOf(key);
        return status !== PLAN_STATUS.PLANNED && status !== PLAN_STATUS.PARKED;
    };
    function stageOf(tier) {
        const keys = entryKeys.filter(k => counted(k) && effTier(k) === tier);
        const timed = [];
        const untimed = [];
        for (const key of keys) {
            const r = readyOf(key, PROFILE.TYPICAL);
            if (Number.isFinite(r.hours)) timed.push({ key, hours: r.hours, complete: r.complete });
            else untimed.push(key);
        }
        timed.sort((a, b) => b.hours - a.hours);
        const stage = settings.stages.find(s => s.tier === tier) || null;
        return {
            tier, entries: keys.length, budgetMinutes: stage?.budgetMinutes ?? null,
            hours: timed.length ? timed[0].hours : 0, slowest: timed.slice(0, 5), untimed,
            complete: timed.every(t => t.complete)
        };
    }

    // ── findings ───────────────────────────────────────────────────────────────────────────────
    const nameOf = (key) => ledger.world.names.get(key) ?? parseKey(key).id;
    const workName = (work) => {
        if (!work) return '—';
        const t = work.target;
        const base = t.recipe ? `${nameOf(recipeKey(t.recipe))} at ${nameOf(tokenKey(t.token))}` : nameOf(tokenKey(t.token));
        return t.pool && t.pool.split('|')[1] ? `${base} (${nameOf(itemKey(t.pool.split('|')[1]))})` : base;
    };

    function findings() {
        const out = [];
        const add = (check, key, message, extra = {}) => out.push({ check, key, message, ...extra });
        const factor = settings.wallFactor;

        // Walls: a run of levels far slower at Typical than the curve.
        for (const skill of [...askedAt.keys()].sort()) {
            const track = trackOf(skill);
            let run = null;
            const close = () => {
                if (!run) return;
                const waiting = track.asks.filter(a => a.level > run.from && a.level <= run.to + 1).map(a => a.key);
                const src = run.source.work;
                const why = src
                    ? `the best Typical source is ${workName(src)} (${Math.round(run.source.xp)} XP an hour${run.source.scale < 1 ? `, short of ${nameOf(itemKey(run.source.short))}` : ''})`
                    : 'no work of the skill gives XP there';
                add('wall', `skill:${skill}`, `${PACE_TEXT.skill(skill)} ${run.from} → ${run.to + 1} (${tierLabel(run.tier)}) takes ${PACE_TEXT.hours(run.hours)} at Typical against the curve's ${formatMinutes(run.curveTotal)} (${PACE_TEXT.times(run.hours * 60 / run.curveTotal)}; a level at worst ${PACE_TEXT.times(run.worst)}): ${why}.${waiting.length ? ` Waiting on it: ${listNames(waiting)}.` : ''}`, {
                    name: PACE_TEXT.skill(skill), related: waiting, severity: run.hours === Infinity ? 'warn' : undefined
                });
                run = null;
            };
            for (const row of track.levels) {
                const hours = row.hours.typical;
                const ratio = hours * 60 / row.curveMinutes;
                if (ratio > factor) {
                    if (!run || row.tier !== run.tier) {
                        close();
                        run = { from: row.level, to: row.level, hours: 0, curveTotal: 0, worst: 0, curve: row.curveMinutes, tier: row.tier, source: row.source.typical };
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

            // Bare must stay playable, Maxed must not trivialise it: at the top level each stage asks.
            const bound = settings.profileBounds;
            const tops = new Map();
            for (const a of track.asks) if (Number.isInteger(a.tier) && a.level > 1) tops.set(a.tier, Math.max(tops.get(a.tier) || 1, a.level));
            let lastTop = 1;
            for (const [tier, level] of [...tops].sort((x, y) => x[0] - y[0])) {
                const row = track.levels[level - 2];
                // A later stage asking no higher level adds nothing to say.
                if (!row || level <= lastTop) continue;
                lastTop = level;
                const curve = minutesToReach(settings, level);
                const bare = row.cumulative.bare * 60 / curve;
                const maxed = curve / (row.cumulative.maxed * 60);
                const where = `${PACE_TEXT.skill(skill)} ${level} (the top ${tierLabel(tier)} asks)`;
                if (bare > bound) {
                    add('profile-bounds', `skill:${skill}`, `Bare: ${where} takes ${PACE_TEXT.hours(row.cumulative.bare)} from a new game, ${PACE_TEXT.times(bare)} the curve's ${formatMinutes(curve)} (bound ${bound}×): too slow to stay playable.`, { name: PACE_TEXT.skill(skill) });
                }
                if (maxed > bound) {
                    add('profile-bounds', `skill:${skill}`, `Maxed: ${where} takes ${PACE_TEXT.hours(row.cumulative.maxed)} from a new game, ${PACE_TEXT.times(maxed)} faster than the curve's ${formatMinutes(curve)} (bound ${bound}×): the boosts trivialise it.`, { name: PACE_TEXT.skill(skill) });
                }
            }
        }

        // A long wait for one unlock: a step's own time (gathering, a build, luck) far over what the
        // curve gives a level where the player is by then, and never under a check-in.
        for (const key of entryKeys) {
            if (!counted(key)) continue;
            const at = reach.get(key);
            if (!at || !Number.isInteger(at.tier)) continue;
            const r = readyOf(key, PROFILE.TYPICAL);
            if (!Number.isFinite(r.own) || !(r.own > 0) || !Number.isFinite(r.start)) continue;
            const level = levelAtMinutes(settings, r.start * 60);
            const expected = Math.max(settings.player.checkInMinMinutes, minutesPerLevelAt(settings, level));
            const ratio = r.own * 60 / expected;
            if (ratio > factor) {
                add('unlock-wall', key, `Its own step (${stepWords(r)}) takes ${PACE_TEXT.hours(r.own)} at Typical once it can start (${PACE_TEXT.hours(r.start)} in), ${PACE_TEXT.times(ratio)} the ${formatMinutes(expected)} the pace allows a wait there (a level at ${level} on the curve, at least a check-in).`);
            }
        }

        // Stage time against its budget.
        for (const stage of settings.stages) {
            const s = stageOf(stage.tier);
            if (!s.entries) continue;
            const minutes = s.hours * 60;
            const off = minutes / stage.budgetMinutes - 1;
            if (Math.abs(off) * 100 <= settings.tolerancePct) continue;
            const slow = s.slowest.slice(0, 3).map(x => `${nameOf(x.key)} (${PACE_TEXT.hours(x.hours)})`).join(', ');
            const floor = s.complete && !s.untimed.length ? '' : ` A floor: ${s.untimed.length} entr${s.untimed.length === 1 ? 'y has' : 'ies have'} no time and some steps are not timed.`;
            add('stage-budget', `stage:${stage.tier}`, `${tierLabel(stage.tier)} is done ${PACE_TEXT.hours(s.hours)} into a new game at Typical, ${off > 0 ? `${Math.round(off * 100)} % over` : `${Math.round(-off * 100)} % under`} its budget of ${formatMinutes(stage.budgetMinutes)} (±${settings.tolerancePct} %).${slow ? ` Slowest: ${slow}.` : ''}${floor}`, {
                name: tierLabel(stage.tier), related: s.slowest.map(x => x.key)
            });
        }

        // Guild Hall ranks: each must pay for itself.
        for (const row of hallPaybacks()) {
            if (row.rate === false) {
                if (row.rank === 1) add('unmodelled', `hall:${row.id}`, `${row.name}: what it gives (${row.what}) is not a rate, so its payback is not worked out.`, { name: row.name });
                continue;
            }
            if (row.enabler) continue;
            if (!(row.payback <= settings.paybackHours)) {
                add('hall-payback', `hall:${row.id}`, `${row.name} rank ${row.rank} costs ${row.priceText} (${PACE_TEXT.hours(row.priceHours)} of work at Bare) and pays back in ${PACE_TEXT.hours(row.payback)}, over the ${PACE_TEXT.hours(settings.paybackHours)} a boost has to pay for itself.`, { name: row.name });
            }
        }

        // Boosts over their target strength, by kind, at Maxed: one finding per set of boosts, with every work it lifts.
        const groups = new Map();
        for (const b of boostRows()) {
            if (b.target === null || !(b.gain > (b.target / 100) * (1 + settings.tolerancePct / 100) + 1e-9)) continue;
            const id = `${b.kind}|${b.factors.join(',')}`;
            if (!groups.has(id)) groups.set(id, { ...b, works: [] });
            groups.get(id).works.push(b);
        }
        for (const g of groups.values()) {
            const lifted = g.works.sort((x, y) => y.gain - x.gain);
            const shown = lifted.slice(0, 4).map(w => `${workName(w.work)} +${Math.round(w.gain * 100)} %`).join(', ');
            const more = lifted.length > 4 ? ` and ${lifted.length - 4} more` : '';
            const low = Math.min(...lifted.map(w => w.target));
            add('boost-target', g.factorKeys[0], `${g.names.join(' with ')} (${BOOST_KIND_TEXT[g.kind].toLowerCase()}) make${g.names.length === 1 ? 's' : ''} ${lifted.length === 1 ? 'one piece' : `${lifted.length} pieces`} of work better at Maxed than the ${low} % target: ${shown}${more}.`, {
                severity: 'warn', name: g.names.join(' with '), related: [...g.factorKeys.slice(1), ...new Set(lifted.map(w => w.entry))]
            });
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

    const stepWords = (r) => {
        if (r.step?.gather?.item) return `gathering ${nameOf(r.step.gather.item)}`;
        const how = LEDGER_ENGINE_TEXT.how[r.how] || r.how;
        return r.via ? `${how} ${nameOf(r.via)}` : how;
    };
    const listNames = (keys, max = 4) => {
        const names = [...new Set(keys.map(nameOf))];
        return names.length > max ? `${names.slice(0, max).join(', ')} and ${names.length - max} more` : names.join(', ');
    };

    // ── the Guild Hall ─────────────────────────────────────────────────────────────────────────
    let hallMemo = null;
    /** Each Guild Hall rank's price, what it adds an hour (in Bare hours) and its payback; `rate: false` for a rank that adds no rate. */
    function hallPaybacks() {
        if (hallMemo) return hallMemo;
        const rows = [];
        for (const def of GUILD_UPGRADES) {
            for (let rank = 1; rank <= def.maxRank; rank++) {
                const price = getUpgradePrice(def, rank - 1) || [];
                const tier = Math.max(0, ...price.map(p => tierOfKey(itemKey(p.itemId))).filter(Number.isInteger));
                const priceHours = sum(price.map(p => p.quantity * unitHours(p.itemId, tier)));
                const priceText = price.length ? price.map(p => `${p.quantity} ${nameOf(itemKey(p.itemId))}`).join(', ') : 'nothing';
                let gain = null;
                let what = null;
                if (def.id === 'roster_size') gain = 1;
                else if (def.id === 'wishing_well') gain = (wishingWellWater(rank) - wishingWellWater(rank - 1)) * (HOUR_MS / 300000) * unitHours(WISHING_WELL_ITEM, tier);
                else what = def.description;
                if (gain === null) {
                    rows.push({ id: def.id, name: def.name, rank, rate: false, what, priceText, priceHours, tier });
                    continue;
                }
                // The only way to have what it gives (no other Water at that stage): an enabler, not a speed-up.
                const enabler = !Number.isFinite(gain);
                const payback = priceHours === 0 ? 0 : gain > 0 && !enabler ? priceHours / gain : Infinity;
                rows.push({ id: def.id, name: def.name, rank, rate: true, enabler, gain, priceText, priceHours, payback, tier });
            }
        }
        hallMemo = rows;
        return rows;
    }

    // ── boosts by kind ─────────────────────────────────────────────────────────────────────────
    const kindGain = (work, profile, cap, kind) => {
        const { setup, chosen, context } = profiles.profileOf(work.target, profile, cap);
        void setup;
        const bare = profiles.bareSetup(context, cap);
        const picks = chosen.filter(c => c.kind === kind);
        if (!picks.length) return null;
        const offers = profiles.offers(context, cap);
        let s = bare;
        for (const c of picks) {
            const o = offers.find(x => x.factor === c.factor);
            if (o) s = o.apply(s);
        }
        const r0 = rates.rateOf(work.target, bare);
        const r1 = rates.rateOf(work.target, s);
        return {
            gain: gainOf(r0, r1, (item) => unitHours(item, cap)), names: picks.map(c => nameOf(factorKeyOf(c))),
            factors: picks.map(c => c.factor), factorKeys: picks.map(factorKeyOf)
        };
    };
    const factorKeyOf = (c) => (c.kind === BOOST_KIND.SUPPORT || c.kind === BOOST_KIND.CAMP ? tokenKey(c.id) : itemKey(c.id));

    let boostMemo = null;
    function boostRows() {
        if (boostMemo) return boostMemo;
        const rows = [];
        for (const work of works) {
            if (work.tier === null || !counted(work.entry)) continue;
            for (const kind of BOOSTED) {
                const g = kindGain(work, PROFILE.MAXED, work.tier, kind);
                if (!g) continue;
                rows.push({ work, entry: work.entry, kind, tier: work.tier, ...g, target: boostTargetAt(settings, kind, work.tier) });
            }
        }
        boostMemo = rows;
        return rows;
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
                    const bareRate = workAt(best.work, PROFILE.BARE, tier);
                    const kinds = {};
                    for (const kind of BOOSTED) {
                        const g = kindGain(best.work, profile, tier, kind);
                        if (g) kinds[kind] = g;
                    }
                    const perks = (best.work && workAt(best.work, profile, tier).rate.factors || []).filter(f => boostKindOf(f) === BOOST_KIND.PERK && f.axes.length);
                    if (perks.length) kinds[BOOST_KIND.PERK] = { gain: null, names: perks.map(f => f.name) };
                    row.profiles[profile] = {
                        work: best.work, name: workName(best.work), xp: best.xp, bareXp: bareRate.xp[skill] || 0,
                        fed: best.scale, short: best.short ? nameOf(itemKey(best.short)) : null, kinds
                    };
                }
                out.push(row);
            }
        }
        return out;
    }

    return {
        settings, book: rates, profiles, works, maxTier,
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
        trackOf,
        skills: () => [...new Set([...askedAt.keys(), ...skillsOfWork.keys()])].sort(),
        pathOf: (key, profile) => ({ ...readyOf(key, profile), steps: criticalPath(key, profile) }),
        stageOf,
        hallPaybacks,
        boostRows,
        breakdown,
        findings
    };
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

export { PROFILE, PROFILES, PROFILE_TEXT };
