// the progression ledger's pace: supply, level times and path time at each profile, and checks D

import { buildRateBook, LIFECYCLE, WORK } from './rates.js';
import { buildProfiles, targetKey, PROFILE, PROFILES, PROFILE_TEXT, BOOST_KIND, BOOST_KIND_TEXT, boostKindOf, BEFORE_HALL } from './profiles.js';
import { starAddsRate } from './hall.js';
import { settingsOf, minutesPerLevelAt, minutesToReach, formatMinutes, levelAtMinutes } from './settings.js';
import { HOW, COMBAT, parseKey, itemKey, tokenKey, recipeKey, LEDGER_ENGINE_TEXT } from './engine.js';
import { planOf, PLAN_STATUS, tierLabel } from './plan.js';
import { xpForLevel, MAX_SKILL_LEVEL } from '../../../utils/XPCurve.js';
import { turnTiming } from '../../../config/registries/tokenConstants.js';
import { SKILLS, SKILL_LAYERS } from '../../../config/registries/skillRegistry.js';

/**
 * How the game is paced for the target player, worked out statically from the content at the three
 * profiles (`profiles.js`), every step shown (owner, 2026-10-29: "pathing and a rate calculator",
 * no pretend player):
 *
 * - **Supply**: how fast the guild gets each item at a stage: the best source reachable by then,
 *   fed by one hero on the best source of each of its inputs (a smith fed by one miner). A loop
 *   (seeds that make seeds) takes its own input as in stock.
 * - **Level tracks**: for each skill, the hours each level takes: the XP it needs over the best
 *   XP an hour any work of the skill gives at that level (with the milestone perks held by then),
 *   fed the same way, among the work reachable by the stage that first asks for that level.
 * - **Path time**: for each entry, when it is first had from a new game: along the path the reach
 *   engine shows, a step starts once everything it needs is had and its level gates are reached
 *   (skills level side by side, each by its own hero: one job per hero), then takes its own time
 *   (gathering what it spends, a build, a cycle, a chance at average luck).
 * - **Checks D**: walls (a level far slower than the pace curve), a long wait for one unlock, a
 *   stage's time against its budget, Bare and Maxed out of their bounds, a Guild Hall rank slow to
 *   pay back, a boost off its target strength, and what the calculator cannot read.
 * - **The Guild Hall**: every rank's payback at Typical (the hours to gather its price against the
 *   hours it saves an hour on the work it pays best on, at the tier the owner gave it), and a
 *   proposed price for it (a preview: brief 290's rule, until the calculator is seen to agree with
 *   real play).
 *
 * Average luck only. Hours are hero-work hours: heroes keep working through the player's check-ins
 * and the night, so a level grind runs around the clock; a step that waits on the player is not
 * delayed (an attentive player).
 *
 * Pure: reads only the content, the ledger and the settings it is handed.
 */

const HOUR_MS = 3_600_000;

/** A fighting style (melee, magic…): levelled by fights, never by work. */
const isCombatStyle = (skill) => SKILLS[skill]?.layer === SKILL_LAYERS.COMBAT;

/** The kinds of boost a profile chooses per piece of work (perks come with levels). */
const BOOSTED = [BOOST_KIND.SUPPORT, BOOST_KIND.CAMP, BOOST_KIND.CONSUMABLE, BOOST_KIND.TOOL, BOOST_KIND.GEAR, BOOST_KIND.HALL];

/** Author-facing words, kept together for translation. */
export const PACE_TEXT = Object.freeze({
    hours: (h) => (Number.isFinite(h) ? formatMinutes(h * 60) : 'never'),
    /** As `hours`, with a time under a minute in seconds: a Hall price can take seconds to gather. */
    short: (h) => (Number.isFinite(h) && h > 0 && h * 60 < 0.5 ? `${Math.max(1, Math.round(h * 3600))} s` : PACE_TEXT.hours(h)),
    /** Hours saved an hour, in words: "12 min an hour", "40 s an hour". */
    saves: (h) => (!(h > 0) ? 'nothing' : h * 60 >= 1 ? `${formatMinutes(h * 60)} an hour` : `${Math.max(1, Math.round(h * 3600))} s an hour`),
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
    // Only the content's own entries: a world cell, a tool need or a Token the world tables name but
    // the content lacks sets no stage and asks no level.
    const isEntry = (key) => plans.has(key) && !ledger.world.retired?.has(key);
    const tiers = new Set([...reach.values()].filter(a => isEntry(a.key)).map(a => a.tier).filter(Number.isInteger));
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

    /**
     * A work's rate fed by the guild: one hero on the best source of each input, its scale the scarcest.
     * `level`: the working hero's level (its milestone perks), the work's own gate when null.
     */
    function fed(work, profile, cap, stack, level = null) {
        const key = `${work.key}|${profile}|${cap}|${level ?? ''}`;
        if (fedMemo.has(key)) return fedMemo.get(key);
        const { rate } = profiles.profileOf(work.target, profile, cap, level);
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
    const hallUnitHours = (itemId, cap) => {
        const s = supplyOf(itemId, BEFORE_HALL, cap).perHour;
        return s > 0 ? 1 / s : Infinity;
    };
    /** Bare hero-hours to have one of a Token: free where the camp or a Region places it, else its price and its build. */
    const costHours = (key, cap) => {
        const at = reach.get(key);
        if (!at?.rule) return Infinity;
        const rule = at.rule;
        if ([HOW.STARTER_CAMP, HOW.MAP, HOW.MODIFIER, HOW.WORLD, HOW.HALL, HOW.SPAWN, HOW.GROW, HOW.TURN, HOW.REGROW].includes(rule.how)) return 0;
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
        tierOf: tierOfKey, unitHours, costHours, hallUnitHours, horizonHours: () => settings.paybackHours, hallHorizonHours: () => settings.hallPaybackHours,
        campMembers: settings.campMembers,
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
    const workAt = (work, profile, cap, level = null) => fed(work, profile, cap, new Set(), level);

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
    /**
     * The best XP an hour any work of a skill gives a hero at a level, at a profile and stage: each
     * work rated with the milestone perks the hero holds by then (`at`: the level it was rated at,
     * null for its own gate), so the ranking is kept per level band.
     */
    function bestXp(skill, level, profile, cap) {
        const band = bandOf(skill, level);
        const key = `${skill}|${profile}|${cap}|${band}`;
        let ranked = bestMemo.get(key);
        if (!ranked) {
            ranked = (skillsOfWork.get(skill) || [])
                .filter(w => w.tier !== null && w.tier <= cap)
                .map(w => {
                    const at = bandLevel(w, skill, band);
                    const f = workAt(w, profile, cap, at);
                    return { work: w, at, gate: f.rate.gates?.needed ?? 1, xp: f.xp[skill] || 0, scale: f.scale, short: f.short };
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
        if (ledger.world.retired?.has(key)) return false;
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
        // An item and the recipe that makes it share a name: the slowest of a name speaks for both.
        const names = new Set();
        const slowest = timed.filter(t => !names.has(nameOf(t.key)) && names.add(nameOf(t.key))).slice(0, 5);
        return {
            tier, entries: keys.length, budgetMinutes: stage?.budgetMinutes ?? null,
            hours: timed.length ? timed[0].hours : 0, slowest, untimed,
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

    const wallMemo = new Map();
    /**
     * A skill's walls: each run of levels (one stage) whose every level takes over `wallFactor` times
     * the curve at Typical, `{ skill, from, to, tier, hours, curveTotal, worst, startHours, endHours,
     * source, waiting }`: levels `from` to `to + 1`, from `startHours` to `endHours` into a new game,
     * the best Typical source at its start, and the entries that ask a level inside it.
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
            run.endHours = track.levels[run.to - 1].cumulative.typical;
            runs.push(run);
            run = null;
        };
        for (const row of track.levels) {
            const hours = row.hours.typical;
            const ratio = hours * 60 / row.curveMinutes;
            if (ratio > factor) {
                if (!run || row.tier !== run.tier) {
                    close();
                    const startHours = row.level > 1 ? track.levels[row.level - 2].cumulative.typical : 0;
                    run = { skill, from: row.level, to: row.level, hours: 0, curveTotal: 0, worst: 0, curve: row.curveMinutes, tier: row.tier, source: row.source.typical, startHours };
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
        const factor = settings.wallFactor;

        // Walls: a run of levels far slower at Typical than the curve.
        for (const skill of [...askedAt.keys()].sort()) {
            const track = trackOf(skill);
            for (const run of wallsOf(skill)) {
                const waiting = run.waiting;
                const src = run.source.work;
                const why = src
                    ? `the best Typical source is ${workName(src)} (${Math.round(run.source.xp)} XP an hour${run.source.scale < 1 ? `, short of ${nameOf(itemKey(run.source.short))}` : ''})`
                    : 'no work of the skill gives XP there';
                add('wall', `skill:${skill}`, `${PACE_TEXT.skill(skill)} ${run.from} → ${run.to + 1} (${tierLabel(run.tier)}) takes ${PACE_TEXT.hours(run.hours)} at Typical against the curve's ${formatMinutes(run.curveTotal)} (${PACE_TEXT.times(run.hours * 60 / run.curveTotal)}; a level at worst ${PACE_TEXT.times(run.worst)}): ${why}.${waiting.length ? ` Waiting on it: ${listNames(waiting)}.` : ''}`, {
                    name: PACE_TEXT.skill(skill), related: waiting, severity: run.hours === Infinity ? 'warn' : undefined
                });
            }

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

        // Guild Hall ranks: each must pay for itself, at Typical.
        for (const row of hallPaybacks()) {
            if (row.rate === false) {
                if (row.rank === 1) add('unmodelled', `hall:${row.id}`, `${row.name}: what it gives (${row.what}) is not a rate, so its payback is not worked out.`, { name: row.name });
                continue;
            }
            if (row.enabler || row.pays) continue;
            add('hall-payback', `hall:${row.id}`, `${row.name} rank ${row.rank} (${stageWords(row)}) costs ${row.priceText} (${PACE_TEXT.short(row.priceHours)} to gather at Typical) ${savesWords(row)}: it pays back in ${PACE_TEXT.hours(row.payback)}, over the ${PACE_TEXT.hours(settings.hallPaybackHours)} a Guild Hall rank has to pay for itself.`, { name: row.name });
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
    const priceWords = (price) => (price.length ? price.map(p => `${p.quantity} ${nameOf(itemKey(p.itemId))}`).join(', ') : 'nothing');
    const stageWords = (row) => (row.tier !== null && row.tier > row.cap
        ? `${tierLabel(row.tier)}, measured at ${tierLabel(row.cap)}, the last stage the pace knows`
        : tierLabel(row.tier ?? row.cap));
    const savesWords = (row) => {
        if (!(row.gain > 0)) return 'and saves no time at its tier (no work it reaches is open by then)';
        const on = row.work ? ` on ${workName(row.work)}` : '';
        return `and saves ${PACE_TEXT.saves(row.gain)}${on}`;
    };

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
    function hallRankGain(track, rank, cap) {
        if (track.id === 'roster_size') return { gain: 1, work: null };
        let best = { gain: 0, work: null };
        for (const work of hallWorksOf(track.id)) {
            if (work.tier > cap) continue;
            const m = profiles.hallRankOn(work.target, cap, track.id, rank);
            if (m && m.saves > best.gain) best = { gain: m.saves, work };
        }
        return best;
    }

    let hallMemo = null;
    /**
     * Every Guild Hall rank, built-in and authored: its tier, price, the hours that price takes to
     * gather at Typical (before the Hall), the hours it saves an hour and on which work, its payback
     * and whether that is within the payback time (`pays`), and the price the ledger proposes for an
     * authored rank (`proposed`). `rate: false` for a rank that adds no rate (Bank tabs, a wound's
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
                const tier = track.tier(rank);
                const priceTiers = price.map(p => tierOfKey(itemKey(p.itemId)));
                const priceTier = priceTiers.every(Number.isInteger) ? Math.max(0, ...priceTiers) : maxTier;
                const cap = Math.min(maxTier, tier ?? priceTier);
                const base = {
                    id: track.id, name: track.name, rank, builtIn: track.builtIn, tier, cap, price,
                    priceText: priceWords(price), priceHours: profiles.hallPriceHours(price, cap)
                };
                const addsRate = track.builtIn ? track.id !== 'bank_tabs' : starAddsRate(track.star);
                if (!addsRate) {
                    rows.push({ ...base, rate: false, what: track.description || 'not a rate' });
                    continue;
                }
                const { gain, work } = hallRankGain(track, rank, cap);
                const enabler = gain === Infinity;
                const payback = base.priceHours === 0 ? 0 : enabler ? 0 : gain > 0 ? base.priceHours / gain : Infinity;
                const row = { ...base, rate: true, enabler, gain, work, payback, pays: enabler || payback <= settings.hallPaybackHours };
                if (!track.builtIn) row.proposed = proposePrice(track, rank, row);
                rows.push(row);
            }
            if (!track.builtIn) neverCheaper(rows.filter(r => r.id === track.id));
        }
        hallMemo = rows;
        return rows;
    }

    /**
     * A star's proposed prices never fall from one rank to the next (the director, 2026-10-30): a
     * rank's proposal is raised to the one before it, in hours to gather and, in the same material,
     * in quantity, rounded up. A raised proposal says so (`raised`) and may then pay back slower
     * than the Hall's payback time (`pays: false`).
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
                    row.proposed = {
                        ...p, quantity, priceHours, payback: priceHours / row.gain, raised: true,
                        pays: priceHours / row.gain <= settings.hallPaybackHours,
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

    const materialMemo = new Map();
    /**
     * The material a rank of a tier is priced in: an item first had at that tier (the owner's tier
     * for it, else when it is first reached), gathered rather than made at a station, the most of it
     * an hour at Typical before the Hall, of the star's own skill where one is; else the tier before.
     * Never what the star itself pays.
     */
    function materialFor(star, tier, cap) {
        const skill = starSkill(star, cap);
        const own = new Set(star.ranks.flatMap(r => r.lines.map(l => l.itemId)));
        const key = `${skill}|${tier}|${cap}|${[...own].join(',')}`;
        if (materialMemo.has(key)) return materialMemo.get(key);
        indexMakers();
        const gathered = (itemId) => (madeBy.get(itemId) || []).some(w => [WORK.GATHER, WORK.WATER, WORK.FIELD].includes(rates.workKindOf(w.target).kind));
        let pick = null;
        for (let t = tier; t >= 0 && !pick; t--) {
            const found = [];
            for (const itemId of Object.keys(rates.items)) {
                if (own.has(itemId) || effTier(itemKey(itemId)) !== t || !gathered(itemId)) continue;
                const s = supplyOf(itemId, BEFORE_HALL, cap);
                if (!(s.perHour > 0) || !Number.isFinite(s.perHour) || !s.work) continue;
                const kind = rates.workKindOf(s.work.target).kind;
                if (kind !== WORK.GATHER && kind !== WORK.WATER && kind !== WORK.FIELD) continue;
                found.push({ itemId, perHour: s.perHour, work: s.work, mine: !!skill && profiles.contextOf(s.work.target).skill === skill });
            }
            const mine = found.filter(f => f.mine);
            pick = (mine.length ? mine : found).sort((a, b) => b.perHour - a.perHour || a.itemId.localeCompare(b.itemId))[0] || null;
        }
        materialMemo.set(key, pick);
        return pick;
    }

    /**
     * The price the ledger proposes for an authored rank: the most of its tier's material it can
     * cost and still pay back within the Hall's payback time at Typical, rounded down to two
     * figures, then never below the rank before ({@link neverCheaper}).
     * `{ itemId, quantity, priceHours, payback, pays, work }`, or `{ why }` when it cannot propose one.
     */
    function proposePrice(track, rank, row) {
        if (track.tier(rank) === null) return { why: 'no tier set' };
        if (row.enabler) return { why: 'the only source of what it pays, so any price pays back' };
        if (!(row.gain > 0)) return { why: 'it saves no time at its tier' };
        const material = materialFor(track.star, row.tier, row.cap);
        if (!material) return { why: 'no gathered material at its tier' };
        const quantity = Math.max(1, roundDown(settings.hallPaybackHours * row.gain * material.perHour));
        const priceHours = quantity / material.perHour;
        const payback = priceHours / row.gain;
        return { itemId: material.itemId, quantity, priceText: priceWords([{ itemId: material.itemId, quantity }]), priceHours, payback, pays: payback <= settings.hallPaybackHours, work: material.work };
    }

    // ── boosts by kind ─────────────────────────────────────────────────────────────────────────
    const kindGain = (work, profile, cap, kind, level = null) => {
        const { chosen, context } = profiles.profileOf(work.target, profile, cap, level);
        const bare = profiles.bareSetup(context, cap, level);
        const picks = chosen.filter(c => c.kind === kind);
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
        return {
            gain: gainOf(r0, r1, (item) => unitHours(item, cap)), names: shown.map(pickName),
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
                    const bareRate = workAt(best.work, PROFILE.BARE, tier, best.at);
                    const kinds = {};
                    for (const kind of BOOSTED) {
                        const g = kindGain(best.work, profile, tier, kind, best.at);
                        if (g) kinds[kind] = g;
                    }
                    const perks = (best.work && workAt(best.work, profile, tier, best.at).rate.factors || []).filter(f => boostKindOf(f) === BOOST_KIND.PERK && f.axes.length);
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
        walls: (skill) => wallsOf(skill),
        skills: () => [...new Set([...askedAt.keys(), ...skillsOfWork.keys()])].sort(),
        pathOf: (key, profile) => ({ ...readyOf(key, profile), steps: criticalPath(key, profile) }),
        stageOf,
        hallPaybacks,
        hallName,
        effTier,
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
