// the progression ledger's balancing preview: numbers proposed so the curve's player (Maxed) follows the pace

import { buildLedger, HOW, COMBAT, FIND, LEDGER_ENGINE_TEXT, findsPerDay, parseKey, itemKey, tokenKey, recipeKey } from '../../../../src/systems/progression/ledger/engine.js';
import { buildPace, PACE_TEXT, TARGET, roundUp, roundDown } from './pace.js';
import { PROFILE, PROFILE_TEXT, BOOST_KIND, BOOST_KIND_TEXT } from './profiles.js';
import { LIFECYCLE } from './rates.js';
import { settingsOf, formatMinutes } from './settings.js';
import { tierLabel } from '../../../../src/systems/progression/ledger/plan.js';
import { EFFECT_TYPES } from '../../../../src/systems/effects/constants.js';
import { SKILLS, SKILL_LAYERS } from '../../../../src/config/registries/skillRegistry.js';

/**
 * Automatic balancing as a preview: the numbers the content would need for the
 * curve's player ({@link TARGET}, Maxed: brief 880 L3) to follow the pace curve and boosts their strength
 * targets, worked out with the ledger's own pace (`pace.js`) and never applied. Four levers, each
 * pass re-reading the pace the one before left:
 *
 * - **Boost strengths**: a building's, drink's, tool's or gear's effect over its kind's target at
 *   Maxed is weakened (its library effect's value, or the bearer's own statement), never a Guild
 *   Hall star's: the Hall waits for its own balance pass.
 * - **XP a cycle**: for each skill, the levels where one source is the best at Maxed are worked at
 *   that source's XP; its XP is scaled so those levels take the curve's time. Where the curve and
 *   the XP a level needs part by more than the wall factor inside one source's levels, only the
 *   first stretch is followed and the rest is reported: one number cannot follow both. A raise
 *   stops short of out-paying, at any level, the best other work where another work carries the
 *   levels (BALANCE_RULES section 1); the levels it then leaves slow are reported as `gaps`.
 * - **Costs and times**: a one-off step far longer than the pace allows (a Shop price, a build's
 *   inputs or time, a growth) is cut to the wait the pace allows there.
 * - **Coins** (brief 870 C3): a price that asks coins (a Shop Token's `shop.coins`, a ring's
 *   `prices[ring].coins`) beyond the tolerance from the coin curve's number (`pace.coinPrices`) is
 *   set to it. Which prices ask coins is the author's: one asking none is never given a coin cost.
 *   A Guild Hall rank's coins are never set here: the payback check judges them with its items.
 *
 * **A stage is its way out** (`pace.gateOf`, owner 2026-11-26): its budget times settling the next
 * place, never its full content, so no lever fits a stage's content into its budget. A way out off
 * its budget is the world tables' to move, and is reported as a suggestion
 * ({@link wayOutSuggestion}): the place's settle level, or its ring's coins, that would bring it to
 * its budget. The owner and the balancer decide; nothing here writes either.
 *
 * What none of them can fix is reported with its cause (`CANT_FIX`): a skill with no source where
 * the curve needs one, a source that wears out, luck, the world tables (a way out off its budget),
 * the XP floor, the Hall, a step the calculator cannot time, a chain of first finds, a proposal at its cap.
 *
 * Pure: reads only the content and settings it is handed and changes neither.
 * ⚠️ The Economy simulator's Recalculate derives XP a cycle of tagged entries from its XPH pins, so
 * an XP proposal reaches the game only with `sim.xpPinned` beside it, which the CMS's change pack
 * (`ledgerBalance.balancePack`) adds. A gate moved on a tagged entry with no pin also changes what
 * Recalculate derives for it, which the pace read here does not foresee. Time proposals touch only
 * building recipes and growths, which Recalculate does not time.
 */

export const LEVER = Object.freeze({ XP: 'xp', COST: 'cost', TIME: 'time', BOOST: 'boost', COINS: 'coins' });

export const CANT_FIX = Object.freeze({
    CONTENT: 'content',
    ONE_OFF: 'one-off',
    LUCK: 'luck',
    RARE: 'rare',
    WORLD: 'world',
    FLOOR: 'floor',
    HALL: 'hall',
    UNTIMED: 'untimed',
    CHAIN: 'chain',
    LIMIT: 'limit',
    OTHER: 'other'
});

/** Author-facing words, kept together for translation. */
export const BALANCE_TEXT = Object.freeze({
    lever: Object.freeze({ xp: 'XP a cycle', cost: 'Cost', time: 'Time', boost: 'Boost strength', coins: 'Coins' }),
    cause: Object.freeze({
        content: 'Needs content', 'one-off': 'A source that wears out', luck: 'Luck', rare: 'A rare find', world: 'World tables',
        floor: 'The XP floor', hall: 'Guild Hall pass', untimed: 'Not timed', chain: 'A chain of first finds',
        limit: 'At its cap', other: 'Other'
    }),
    worldTables: 'World tables',
    coins: (row) => `${row.name} asks ${row.coins} coins; the coin curve asks the coins one hero earns selling at ${tierLabel(row.cap)} (${Math.round(row.perHour)} an hour${row.source ? `, ${row.source}` : ''}) in ${row.minutes} min (its ${row.curve} curve).`,
    field: Object.freeze({
        'config.xp': 'XP a cycle', xp: 'XP a cycle', 'config.skillRequired': 'Level needed', levelRequirement: 'Level needed',
        durationMs: 'Time (ms)', 'config.cycleTimeMs': 'Cycle (ms)', 'grows.afterMs': 'Grow time (ms)', 'shop.coins': 'Shop coins'
    })
});

/** A settle level suggested for a way out goes no higher than this. */
const MAX_SETTLE_LEVEL = 99;
/** A ring's coins suggested for a way out rise at most this many times. */
const MAX_COIN_FACTOR = 100;
/** An XP proposal moves a source at most this many times either way from its authored number. */
export const MAX_XP_FACTOR = 20;
/** A time is never cut below a second. */
const MIN_TIME_MS = 1000;
/** Rounds of the passes: each re-reads the pace the last left. */
const DEFAULT_ROUNDS = 4;

/** The axes a boost's strength is read on (`rates.js`): their values are what a boost proposal weakens. */
const RATE_AXES = new Set([
    EFFECT_TYPES.WORK_TIME, EFFECT_TYPES.YIELD, EFFECT_TYPES.XP_BONUS, EFFECT_TYPES.LOOT_MULT, EFFECT_TYPES.DOUBLE_DROP,
    EFFECT_TYPES.INPUT_COST, EFFECT_TYPES.GROW_TIME, EFFECT_TYPES.CROP_LOAD, EFFECT_TYPES.CATCH_WEIGHT, EFFECT_TYPES.LUCKY
]);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const AT_TARGET = PROFILE_TEXT[TARGET];
const isCombatStyle = (skill) => skill === COMBAT || SKILLS[skill]?.layer === SKILL_LAYERS.COMBAT;
const HOUR_MS = 3_600_000;

// ── content access ──────────────────────────────────────────────────────────────────────────────

function findIn(collection, id) {
    if (Array.isArray(collection)) return collection.find(d => isObject(d) && d.id === id) || null;
    if (isObject(collection)) return isObject(collection[id]) ? collection[id] : Object.values(collection).find(d => isObject(d) && d.id === id) || null;
    return null;
}

/** The record of an entity in content shaped as the ledger takes it (recipes as `recipes` or in `recipePools`). */
export function recordOf(content, kind, id) {
    if (kind === 'item') return findIn(content.items, id);
    if (kind === 'hallStar') return findIn(content.hallSky?.stars, id);
    // The world tables as the ledger reads them (normalised); a change pack carries the workspace's own record.
    if (kind === 'world') return isObject(content.worldTables) ? content.worldTables : null;
    if (kind === 'token') return findIn(content.tokens, id);
    if (kind === 'effect') return findIn(content.effects, id);
    if (kind === 'recipe') {
        if (content.recipes) return findIn(content.recipes, id);
        for (const pool of Object.values(isObject(content.recipePools) ? content.recipePools : {})) {
            const found = findIn(pool, id);
            if (found) return found;
        }
    }
    return null;
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
function setPath(obj, path, value) {
    const parts = path.split('.');
    let at = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        at = at?.[parts[i]];
        if (at === null || at === undefined) return false;
    }
    at[parts[parts.length - 1]] = value;
    return true;
}

const entryKeyOf = (kind, id) => (kind === 'item' ? itemKey(id) : kind === 'token' ? tokenKey(id) : kind === 'recipe' ? recipeKey(id) : `${kind}:${id}`);

/**
 * The content with proposals applied: a copy, the content handed in untouched. Each proposal names
 * its entity (`kind`, `id`), a field path (`config.xp`, `shop.price.0.quantity`) and its new value.
 */
export function applyProposals(content, proposals) {
    const out = structuredClone(content);
    for (const p of proposals || []) {
        const record = recordOf(out, p.kind, p.id);
        if (record) setPath(record, p.field, p.to);
    }
    return out;
}

// ── the pace and its summary ─────────────────────────────────────────────────────────────────────

function evaluate(content, settings) {
    const ledger = buildLedger(content, { steadyPerDay: settings.steadyFindsPerDay, tierLevels: settings.tierLevels });
    return { content, ledger, pace: buildPace(content, ledger, settings) };
}

/**
 * The parts of a pace the preview reports before and after: each stage's way out against its
 * budget (`hours`, null when it has none: `why` says why) with its full content beside it as
 * information (`content`), the walls at Maxed, the long waits for one unlock, and the boosts over
 * their targets. Plain data.
 */
export function balanceSummary({ pace, ledger }) {
    const settings = pace.settings;
    const name = (key) => ledger.world.names.get(key) ?? parseKey(key).id;
    const tol = settings.tolerancePct;
    const stages = settings.stages.map((s) => {
        const st = pace.stageOf(s.tier);
        const g = st.gate;
        const off = g.place && Number.isFinite(g.hours) ? (g.hours * 60) / s.budgetMinutes - 1 : null;
        return {
            tier: s.tier, label: tierLabel(s.tier), budgetMinutes: s.budgetMinutes, next: g.next, why: g.why,
            hours: g.place ? g.hours : null, offPct: off === null ? null : Math.round(off * 1000) / 10,
            // A way out never had is off its budget; a stage with none has nothing to time.
            within: g.place ? off !== null && Math.abs(off) * 100 <= tol + 1e-9 : true,
            place: g.place, name: g.place ? g.name : null, ring: g.ring ?? null, coins: g.coins ?? 0,
            asks: (g.asks || []).map(a => ({ ...a })), levelHours: g.place ? g.levelHours : null, priceHours: g.place ? g.priceHours : null,
            heroes: g.heroes, byWork: !!g.byWork, complete: g.place ? g.complete : true, floor: [...g.floor],
            content: {
                entries: st.entries, hours: st.entries ? st.hours : null, complete: st.complete, untimed: st.untimed.length,
                slowest: st.slowest.slice(0, 3).map(x => ({ key: x.key, name: name(x.key), hours: x.hours }))
            }
        };
    });
    const walls = [];
    for (const skill of pace.skills()) {
        for (const w of pace.walls(skill)) {
            walls.push({
                skill, from: w.from, to: w.to + 1, tier: w.tier, hours: w.hours, curveHours: w.curveTotal / 60, worst: w.worst,
                source: w.source?.work ? pace.workName(w.source.work) : null, sourceEntry: w.source?.work?.entry ?? null
            });
        }
    }
    const unlockWalls = pace.unlockWalls().map(u => ({
        key: u.key, name: name(u.key), own: u.r.own, start: u.r.start, allowedMinutes: u.expected, ratio: u.ratio, how: u.r.how, via: u.r.via ?? null
    }));
    const boosts = pace.boostGroups().map(g => ({
        kind: g.kind, names: g.names, factorKeys: g.factorKeys, target: Math.min(...g.works.map(w => w.target)),
        gain: g.works[0].gain, works: g.works.length, top: pace.workName(g.works[0].work)
    }));
    return { stages, walls, unlockWalls, boosts };
}

// ── the proposer ─────────────────────────────────────────────────────────────────────────────────

/**
 * The balancing preview of some content.
 *
 * @param {object} content  as the ledger takes it (`{ items, tokens, recipes | recipePools, effects, … }`); never changed
 * @param {object} [rawSettings]  the Ledger settings (`settings.js`)
 * @param {{ rounds?: number }} [options]
 * @returns {{ before, after, proposals, cantFix, rounds }} `before`/`after` from {@link balanceSummary};
 *   `proposals` `[{ key, kind, id, name, field, label, lever, from, to, why }]`, each field once;
 *   `cantFix` `[{ kind: 'wall'|'stage'|'unlock'|'boost', key, skill?, name, cause, message }]`
 *   `gaps` `[{ skill, fromLevel, toLevel, key, name, xp, wanted, why }]`: levels an XP raise would follow only by
 *   out-paying a later work, held at `xp` (`toLevel` the first level past them): they need new content
 */
export function proposeBalance(content, rawSettings = null, { rounds = DEFAULT_ROUNDS } = {}) {
    const settings = settingsOf(rawSettings);
    const original = content;
    const first = evaluate(content, settings);
    const before = balanceSummary(first);
    // The passes change only the copy; until the first change, the authored content's pace stands for it.
    const state = {
        settings, original, first, content: structuredClone(content), eval: first, proposals: new Map(), capped: new Map(), gaps: new Map()
    };

    let used = 0;
    for (let round = 0; round < rounds; round++) {
        used = round + 1;
        let any = false;
        for (const pass of [coinPass, boostPass, xpPass, costPass]) {
            if (pass(state)) {
                any = true;
                state.eval = evaluate(state.content, settings);
            }
        }
        if (!any) break;
    }
    tidyXp(state);

    const kept = [...state.proposals.values()].filter(p => p.to !== p.from);
    const after = kept.length ? balanceSummary(state.eval) : before;
    state.final = { bands: null };
    const proposals = kept.map(({ problem, result, ...p }) => ({ ...p, why: [problem, result ? result(state, p) : null].filter(Boolean).join(' ') }));
    const live = new Set(finalBands(state).map(b => `${b.kind}:${b.id}|${b.field}`));
    const gaps = [...state.gaps].filter(([fieldId]) => live.has(fieldId)).map(([, gap]) => gap)
        .sort((a, b) => a.skill.localeCompare(b.skill) || a.fromLevel - b.fromLevel);
    return {
        before, after, proposals,
        cantFix: explain(state, after),
        gaps,
        rounds: used
    };
}

/**
 * An XP proposal made for levels another source took over in a later round sets no level in the
 * end: it is put back to its authored number, unless that makes its source the best again.
 */
function tidyXp(state) {
    const fieldId = (p) => `${p.kind}:${p.id}|${p.field}`;
    const setting = () => new Set(xpBands(state).map(b => `${b.kind}:${b.id}|${b.field}`));
    const live = setting();
    const moot = [...state.proposals.values()].filter(p => p.lever === LEVER.XP && p.to !== p.from && !live.has(fieldId(p)));
    if (!moot.length) return;
    for (const p of moot) setPath(recordOf(state.content, p.kind, p.id), p.field, p.from);
    state.eval = evaluate(state.content, state.settings);
    const back = setting();
    const keep = moot.filter(p => back.has(fieldId(p)));
    for (const p of moot) {
        if (keep.includes(p)) continue;
        state.proposals.delete(`${p.key}|${p.field}`);
        state.capped.delete(fieldId(p));
    }
    if (!keep.length) return;
    for (const p of keep) setPath(recordOf(state.content, p.kind, p.id), p.field, p.to);
    state.eval = evaluate(state.content, state.settings);
}

/**
 * Record a proposal and set it in the working content. `from` is always the authored number;
 * `problem` (words on what was off) is kept from the first time the field is proposed, `result`
 * (words on where it lands, read from the final pace) from the last.
 */
function propose(state, { kind, id, field, to, lever, problem, result = null }) {
    const record = recordOf(state.content, kind, id);
    if (!record) return false;
    const now = getPath(record, field);
    if (now === to) return false;
    const key = entryKeyOf(kind, id);
    const id_ = `${key}|${field}`;
    const was = state.proposals.get(id_);
    const from = was?.from ?? getPath(recordOf(state.original, kind, id), field);
    setPath(record, field, to);
    const name = kind === 'effect' || kind === 'hallStar' ? (record.name || id) : kind === 'world' ? BALANCE_TEXT.worldTables : (state.eval.ledger.world.names.get(key) ?? id);
    state.proposals.set(id_, {
        key, kind, id, name, field, label: BALANCE_TEXT.field[field] || fieldLabel(field, lever), lever, from, to,
        problem: was?.problem ?? problem, result
    });
    return true;
}

/** The XP bands of the final pace, worked out once. */
const finalBands = (state) => (state.final.bands ??= xpBands(state));

function fieldLabel(field, lever) {
    if (lever === LEVER.COST) return 'Quantity';
    if (lever === LEVER.BOOST) return 'Value';
    if (lever === LEVER.COINS) return 'Coins';
    return BALANCE_TEXT.lever[lever] || field;
}

// ── coins ───────────────────────────────────────────────────────────────────────────────────────

/** The field a coin price row is written in: its record's kind, id and path. */
function coinField(row) {
    if (row.kind === 'shop') return { kind: 'token', id: row.id, field: 'shop.coins' };
    if (row.kind === 'ring') return { kind: 'world', id: 'world', field: `prices.${row.ring}.coins` };
    return null;
}

/** Every Shop Token and ring price that asks coins, beyond the tolerance from the coin curve's number, set to it. */
function coinPass(state) {
    // Nothing asks coins: nothing to price, and no coin income worked out for it.
    if (!state.eval.pace.asksCoins()) return false;
    const tol = state.settings.tolerancePct / 100;
    let changed = false;
    for (const row of state.eval.pace.coinPrices()) {
        const field = coinField(row);
        if (!field || !(row.coins > 0) || !(row.proposed > 0)) continue;
        if (Math.abs(row.coins / row.proposed - 1) <= tol + 1e-9) continue;
        changed = propose(state, { ...field, to: row.proposed, lever: LEVER.COINS, problem: BALANCE_TEXT.coins(row) }) || changed;
    }
    return changed;
}

// ── boost strengths ─────────────────────────────────────────────────────────────────────────────

/**
 * The numbers a boost's strength is made of: every rate-axis value on the bearer's own statements
 * and in the library effects it carries (and those its statements apply), each once.
 */
function boostValues(content, factorKeys) {
    const out = new Map();
    const fromStatements = (kind, id, statements, depth) => {
        list(statements).forEach((s, i) => {
            const payload = s?.payload;
            if (!isObject(payload)) return;
            if (typeof payload.effectId === 'string' && depth < 3) fromEffect(payload.effectId, depth + 1);
            const value = Number(payload.value);
            if (!RATE_AXES.has(payload.type) || !Number.isFinite(value) || value === 0) return;
            const path = `statements.${i}.payload.value`;
            out.set(`${kind}:${id}|${path}`, { kind, id, path, value, whole: Number.isInteger(value) && payload.bucket !== 'percentage' });
        });
    };
    const fromEffect = (effectId, depth) => {
        const effect = recordOf(content, 'effect', effectId);
        if (effect) fromStatements('effect', effectId, effect.statements, depth);
    };
    for (const key of factorKeys) {
        const { kind, id } = parseKey(key);
        if (kind !== 'token' && kind !== 'item') continue;
        const record = recordOf(content, kind, id);
        if (!record) continue;
        fromStatements(kind, id, record.statements, 0);
        for (const ref of list(record.effects)) {
            const effectId = typeof ref === 'string' ? ref : ref?.effectId;
            if (typeof effectId === 'string') fromEffect(effectId, 1);
        }
    }
    return [...out.values()];
}

/** A boost value weakened by `f`, rounded as it is written, never to nothing and never past zero. */
function weakened(v, f) {
    const raw = v.value * f;
    if (v.whole) {
        const n = Math.round(raw);
        return n === 0 ? Math.sign(v.value) : n;
    }
    const n = Math.round(raw * 100) / 100;
    return n === 0 ? Math.sign(v.value) * 0.01 : n;
}

function boostPass(state) {
    const { pace } = state.eval;
    const tol = state.settings.tolerancePct / 100;
    let changed = false;
    // A value two groups share is weakened for the first; the other is read again next round.
    const touched = new Set();
    for (const g of pace.boostGroups()) {
        if (g.kind === BOOST_KIND.HALL || g.kind === BOOST_KIND.CAMP) continue;
        const target = Math.min(...g.works.map(w => w.target)) / 100;
        const values = boostValues(state.content, g.factorKeys);
        if (!values.length || !(target > 0)) continue;
        if (values.some(v => touched.has(`${v.kind}:${v.id}|${v.path}`))) continue;
        let f = 1;
        let gain = g.works[0].gain;
        let best = null;
        let last = values.map(v => v.value).join(',');
        for (let i = 0; i < 6 && gain > target * (1 + 1e-6); i++) {
            f *= Math.min(0.95, Math.max(0.05, target / gain));
            const next = values.map(v => ({ ...v, to: weakened(v, f) }));
            const signature = next.map(v => v.to).join(',');
            // Rounding holds the values where they are: weakening further changes nothing.
            if (signature === last) break;
            last = signature;
            const trial = structuredClone(state.content);
            for (const v of next) setPath(recordOf(trial, v.kind, v.id), v.path, v.to);
            const p = buildPace(trial, buildLedger(trial, { steadyPerDay: state.settings.steadyFindsPerDay, tierLevels: state.settings.tierLevels }), state.settings);
            gain = Math.max(0, ...g.works.map(w => p.boostGain(w.work.target, g.kind, PROFILE.MAXED, w.tier) ?? 0));
            if (!best || gain < best.gain) best = { gain, next };
        }
        if (!best || best.gain > target * (1 + tol)) continue;
        const top = g.works[0];
        const problem = `${g.names.join(' with ')} (${BOOST_KIND_TEXT[g.kind].toLowerCase()}) make ${pace.workName(top.work)} +${Math.round(top.gain * 100)} % at Maxed against the ${Math.round(target * 100)} % target.`;
        const result = (s) => {
            const gain = s.eval.pace.boostGain(top.work.target, g.kind, PROFILE.MAXED, top.tier);
            return Number.isFinite(gain) ? `Weakened: +${Math.round(gain * 100)} % there.` : null;
        };
        for (const v of best.next) {
            touched.add(`${v.kind}:${v.id}|${v.path}`);
            changed = propose(state, { kind: v.kind, id: v.id, field: v.path, to: v.to, lever: LEVER.BOOST, problem, result }) || changed;
        }
    }
    return changed;
}

// ── XP a cycle ──────────────────────────────────────────────────────────────────────────────────

/** Where a work's XP a cycle is written: a recipe's `xp`, else its Token's `config.xp`. */
function xpFieldOf(content, work) {
    const t = work.target;
    if (t.recipe) {
        const rec = recordOf(content, 'recipe', t.recipe);
        const value = Number(rec?.xp);
        return value > 0 ? { kind: 'recipe', id: t.recipe, field: 'xp', value } : null;
    }
    const tok = recordOf(content, 'token', t.token);
    const value = Number(tok?.config?.xp);
    return value > 0 ? { kind: 'token', id: t.token, field: 'config.xp', value } : null;
}

/**
 * Each skill's levels grouped by the XP field of their best source at the curve's player, in level order, with
 * each level's time against the curve (`ratio`), and the first stretch whose ratios stay within the
 * wall factor of one another (`head`): the levels one number can follow.
 */
function xpBands(state) {
    const { pace } = state.eval;
    const wf = state.settings.wallFactor;
    const groups = new Map();
    for (const skill of pace.skills()) {
        if (isCombatStyle(skill)) continue;
        for (const row of pace.trackOf(skill).levels) {
            const src = row.source[TARGET];
            if (!src?.work || !(src.xp > 0)) continue;
            const field = xpFieldOf(state.content, src.work);
            if (!field) continue;
            const id = `${field.kind}:${field.id}|${field.field}`;
            if (!groups.has(id)) groups.set(id, { ...field, skill, rows: [], work: src.work });
            groups.get(id).rows.push({ level: row.level, hours: row.hours[TARGET], curveMinutes: row.curveMinutes, ratio: row.hours[TARGET] * 60 / row.curveMinutes });
        }
    }
    for (const g of groups.values()) {
        g.rows.sort((a, b) => a.level - b.level);
        let lo = Infinity;
        let hi = 0;
        let n = 0;
        for (const r of g.rows) {
            const nlo = Math.min(lo, r.ratio);
            const nhi = Math.max(hi, r.ratio);
            if (n > 0 && nhi / nlo > wf) break;
            lo = nlo;
            hi = nhi;
            n++;
        }
        g.head = g.rows.slice(0, n);
        g.tail = g.rows.slice(n);
        g.ratio = sum(g.head.map(r => r.hours * 60)) / sum(g.head.map(r => r.curveMinutes));
    }
    return [...groups.values()];
}

/**
 * The most XP a cycle a band's field can take without its work out-paying, at the curve's player,
 * the best other work at a level another work's XP field carries, in the authored content or now:
 * `{ to, over: { name, level } }`, the highest whole number strictly under that rate (read as
 * proportional to XP a cycle), null when there is no such level.
 * ⚠️ Strictly under: on a tie the lower gate is the best source, so an equal rate takes the levels.
 */
function xpCeiling(state, g, fieldId) {
    const { pace } = state.eval;
    const idOf = (w) => {
        const f = xpFieldOf(state.content, w);
        return f ? `${f.kind}:${f.id}|${f.field}` : null;
    };
    const others = new Set();
    for (const p of [state.first.pace, pace]) {
        for (const row of p.trackOf(g.skill).levels) {
            const src = row.source[TARGET];
            if (src?.work && src.xp > 0 && idOf(src.work) !== fieldId) others.add(row.level);
        }
    }
    let best = null;
    for (const row of pace.trackOf(g.skill).levels) {
        if (!others.has(row.level)) continue;
        let own = 0;
        let other = null;
        for (const r of pace.xpSourcesAt(g.skill, row.level, TARGET, row.tier)) {
            if (idOf(r.work) === fieldId) own = Math.max(own, r.xp);
            else if (!other || r.xp > other.xp) other = r;
        }
        if (!(own > 0) || !other) continue;
        const f = other.xp / own;
        if (!best || f < best.f) best = { f, level: row.level, work: other.work };
    }
    if (!best) return null;
    return { to: Math.max(1, Math.ceil(g.value * best.f) - 1), over: { name: pace.workName(best.work), level: best.level } };
}

function xpPass(state) {
    const tol = state.settings.tolerancePct / 100;
    let changed = false;
    for (const g of xpBands(state)) {
        const R = g.ratio;
        if (!(R > 0) || !Number.isFinite(R)) continue;
        const authored = Number(getPath(recordOf(state.original, g.kind, g.id), g.field)) || g.value;
        const fieldId = `${g.kind}:${g.id}|${g.field}`;
        const ceiling = xpCeiling(state, g, fieldId);
        // The ceiling only stops a raise; it never takes a work below its authored number.
        const roof = ceiling ? Math.max(authored, ceiling.to) : Infinity;
        const onPace = R >= 1 / (1 + tol) && R <= 1 + tol;
        // ⚠️ Checked on pace too: a work raised in an earlier round can out-pay one lowered since.
        if (onPace && g.value <= roof) {
            state.gaps.delete(fieldId);
            continue;
        }
        const lo = Math.max(1, Math.ceil(authored / MAX_XP_FACTOR));
        const hi = Math.floor(authored * MAX_XP_FACTOR);
        const wanted = onPace ? g.value : Math.round(g.value * R);
        const limited = Math.min(hi, Math.max(lo, wanted));
        const first = g.head[0].level;
        const last = g.head[g.head.length - 1].level + 1;
        const name = state.eval.pace.workName(g.work);
        const to = Math.min(limited, roof);
        const slow = to < limited ? g.head.filter(r => r.ratio * g.value / to > 1 + tol) : [];
        if (slow.length) {
            const from = slow[0].level;
            const upTo = slow[slow.length - 1].level + 1;
            const over = ceiling.over;
            state.gaps.set(fieldId, {
                skill: g.skill, fromLevel: from, toLevel: upTo, key: entryKeyOf(g.kind, g.id), name, xp: to, wanted: limited,
                why: `${PACE_TEXT.skill(g.skill)} ${from} → ${upTo}: ${name} would need ${limited} XP a cycle to follow the curve there, but above ${to} it would out-pay ${over.name}, the best ${AT_TARGET} work at ${PACE_TEXT.skill(g.skill)} ${over.level}, and take its levels. These levels need a work of their own.`
            });
        } else {
            state.gaps.delete(fieldId);
        }
        if (to === limited && (wanted > hi || wanted < lo)) {
            state.capped.set(fieldId, {
                kind: 'xp', key: entryKeyOf(g.kind, g.id), name, cause: CANT_FIX.LIMIT,
                message: `${name}: ${PACE_TEXT.skill(g.skill)} ${first} → ${last} takes ${PACE_TEXT.times(R)} the curve's time on it; its XP a cycle would need to be ${wanted}, and the proposal stops at ${to} (${MAX_XP_FACTOR}× its authored ${authored} either way). The source itself is too ${R > 1 ? 'slow' : 'fast'} for a number to fix.`
            });
        } else {
            state.capped.delete(fieldId);
        }
        if (to === g.value) continue;
        const problem = `${PACE_TEXT.skill(g.skill)} ${first} → ${last}: its best ${AT_TARGET} source, ${name}, takes ${PACE_TEXT.times(R)} the curve's time.`;
        const result = (s) => {
            const band = finalBands(s).find(b => `${b.kind}:${b.id}|${b.field}` === fieldId);
            if (!band) return 'Another source now carries those levels; at its authored number it would take them back.';
            const a = band.head[0].level;
            const b = band.head[band.head.length - 1].level + 1;
            return `Now ${PACE_TEXT.times(band.ratio)} the curve over ${PACE_TEXT.skill(band.skill)} ${a} → ${b}.`;
        };
        changed = propose(state, { kind: g.kind, id: g.id, field: g.field, to, lever: LEVER.XP, problem, result }) || changed;
    }
    return changed;
}

// ── costs and times ─────────────────────────────────────────────────────────────────────────────

/**
 * Cut a one-off step to `targetHours` of its own time: a Shop price's or a build's quantities (each
 * input to what its supply gathers in the time), a build's time, a growth's time. False when the
 * step is none of these.
 */
function shrinkStep(state, key, targetHours, problem) {
    const { pace, ledger } = state.eval;
    const at = ledger.reach.get(key);
    const rule = at?.rule;
    if (!rule || !(targetHours > 0)) return false;
    let changed = false;
    const cap = Number.isInteger(at.tier) ? at.tier : pace.maxTier;
    const result = (st) => {
        const own = st.eval.pace.pathOf(key, TARGET).own;
        return Number.isFinite(own) ? `Its own step now takes ${PACE_TEXT.hours(own)}.` : null;
    };
    const shrinkInputs = (kind, id, base, hours) => {
        const record = recordOf(state.content, kind, id);
        list(getPath(record, base)).forEach((input, i) => {
            const q = Number(input?.quantity);
            if (!(q > 1) || typeof input.itemId !== 'string') return;
            const s = pace.supplyOf(input.itemId, TARGET, cap).perHour;
            if (!(s > 0) || !Number.isFinite(s) || q / s <= hours) return;
            const to = Math.max(1, Math.floor(hours * s));
            if (to < q) changed = propose(state, { kind, id, field: `${base}.${i}.quantity`, to, lever: LEVER.COST, problem, result }) || changed;
        });
    };
    if (rule.how === HOW.SHOP) {
        shrinkInputs('token', parseKey(key).id, 'shop.price', targetHours);
    } else if (rule.how === HOW.CRAFT) {
        const recipeId = parseKey(rule.via).id;
        const recipe = recordOf(state.content, 'recipe', recipeId);
        if (!recipe || !list(recipe.foundationKinds).length) return false;
        const buildHours = (Number(recipe.durationMs) || 0) / HOUR_MS;
        if (buildHours > targetHours / 2) {
            const to = Math.max(MIN_TIME_MS, Math.round(targetHours / 2 * HOUR_MS / 1000) * 1000);
            if (to < recipe.durationMs) changed = propose(state, { kind: 'recipe', id: recipeId, field: 'durationMs', to, lever: LEVER.TIME, problem, result }) || changed;
        }
        shrinkInputs('recipe', recipeId, 'inputs', targetHours - Math.min(buildHours, targetHours / 2));
    } else if (rule.how === HOW.GROW && rule.via) {
        const id = parseKey(rule.via).id;
        const def = recordOf(state.content, 'token', id);
        const ms = Number(def?.grows?.afterMs);
        const to = Math.max(MIN_TIME_MS, Math.round(targetHours * HOUR_MS / 1000) * 1000);
        if (ms > to) changed = propose(state, { kind: 'token', id, field: 'grows.afterMs', to, lever: LEVER.TIME, problem, result }) || changed;
    } else {
        return false;
    }
    return changed;
}

function costPass(state) {
    const { pace } = state.eval;
    let changed = false;
    // A long wait for one unlock: its own step cut to the wait the pace allows there.
    for (const u of pace.unlockWalls()) {
        const problem = `${state.eval.ledger.world.names.get(u.key) ?? u.key}: its own step takes ${PACE_TEXT.hours(u.r.own)} at ${AT_TARGET} once it can start, ${PACE_TEXT.times(u.ratio)} the ${formatMinutes(u.expected)} the pace allows a wait there.`;
        changed = shrinkStep(state, u.key, u.expected / 60, problem) || changed;
    }
    return changed;
}

// ── what numbers cannot fix ─────────────────────────────────────────────────────────────────────

function explain(state, after) {
    const { pace } = state.eval;
    const out = [...state.capped.values()];
    const bands = xpBands(state);

    for (const w of after.walls) {
        const skill = PACE_TEXT.skill(w.skill);
        const range = `${skill} ${w.from} → ${w.to}`;
        const base = { kind: 'wall', key: `skill:${w.skill}`, skill: w.skill, name: range };
        if (!w.source) {
            out.push({ ...base, cause: CANT_FIX.CONTENT, message: `${range}: no work of the skill gives XP there at ${AT_TARGET}; it needs a source.` });
            continue;
        }
        const band = bands.find(b => b.skill === w.skill && b.rows.some(r => r.level === w.from));
        const fieldId = band ? `${band.kind}:${band.id}|${band.field}` : null;
        if (fieldId && state.capped.has(fieldId)) {
            out.push({ ...base, cause: CANT_FIX.LIMIT, message: `${range}: ${w.source} would need its XP a cycle raised over ${MAX_XP_FACTOR}× its authored number to follow the curve; the proposal stops there.` });
            continue;
        }
        // A source of the skill that opens inside the wall but cannot carry it.
        const opening = pace.works.filter(x => x.tier !== null && x.tier <= w.tier && pace.profiles.contextOf(x.target).skill === w.skill)
            .map(x => ({ x, gate: pace.profiles.contextOf(x.target).gate ?? 1 }))
            .filter(o => o.gate > w.from - 1 && o.gate < w.to);
        const worn = opening.filter(o => {
            const r = pace.rateAt(o.x.target, TARGET)?.rate;
            return !r?.ok || r.lifecycle?.kind === LIFECYCLE.ONE_OFF || !(r.cyclesPerHour > 0);
        });
        const first = band?.rows[0]?.level ?? 1;
        if (worn.length) {
            const names = [...new Set(worn.map(o => `${pace.workName(o.x)} (${skill} ${o.gate})`))].slice(0, 4).join(', ');
            out.push({ ...base, cause: CANT_FIX.ONE_OFF, message: `${range}: ${w.source} is the best source from level ${first}; ${names} open${worn.length === 1 ? 's' : ''} inside it but ${worn.length === 1 ? 'is' : 'are'} not worked over and over (it wears out for good or is not rated), so it cannot carry these levels.` });
        } else {
            out.push({ ...base, cause: CANT_FIX.CONTENT, message: `${range}: ${w.source} is the best source from level ${first}, and nothing of the skill opens between ${w.from} and ${w.to}. One XP number cannot follow the curve both before and after level ${w.from}: ${skill} needs a new source that opens around level ${w.from}.` });
        }
    }

    for (const s of after.stages) {
        if (s.within || !s.place) continue;
        out.push(wayOutReport(state, s));
    }

    for (const u of after.unlockWalls) {
        const cause = stepCause(state, u.key);
        out.push({ kind: 'unlock', key: u.key, name: u.name, cause: cause.cause, message: `${u.name}: its own step takes ${PACE_TEXT.hours(u.own)} at ${AT_TARGET}, ${PACE_TEXT.times(u.ratio)} the ${formatMinutes(u.allowedMinutes)} the pace allows; ${cause.words}.` });
    }

    for (const b of after.boosts) {
        const names = b.names.join(' with ');
        const base = { kind: 'boost', key: b.factorKeys[0], name: names };
        if (b.kind === BOOST_KIND.HALL) {
            out.push({ ...base, cause: CANT_FIX.HALL, message: `${names} (Guild Hall) make ${b.top} +${Math.round(b.gain * 100)} % at Maxed against the ${b.target} % target: left for the Guild Hall balance pass.` });
        } else if (floorBound(state, b)) {
            out.push({ ...base, cause: CANT_FIX.FLOOR, message: `${names} make ${b.top} +${Math.round(b.gain * 100)} % at Maxed against the ${b.target} % target: an XP bonus on a cycle worth 1 XP always adds a whole XP (the XP floor), so no strength brings it to target; the work's XP a cycle would have to rise.` });
        } else {
            out.push({ ...base, cause: CANT_FIX.OTHER, message: `${names} make ${b.top} +${Math.round(b.gain * 100)} % at Maxed against the ${b.target} % target, and weakening its values does not bring it there.` });
        }
    }
    return out;
}

/** A way out time in words, with how far it is off its budget: "1 h 20 min (+167 %)". */
function wayOutTime(hours, budgetMinutes) {
    if (!Number.isFinite(hours)) return 'never';
    const off = Math.round((hours * 60 / budgetMinutes - 1) * 100);
    return `${PACE_TEXT.hours(hours)} (${off >= 0 ? '+' : ''}${off} %)`;
}

/**
 * What would bring a stage's way out to its budget (within the tolerance), as the world tables
 * would have to move it: `{ level, coins }`, each null when it cannot. `level`
 * (`{ skill, from, to, hours }`) is the level its slowest timed ask would need, the other asks as
 * they are; `coins` (`{ ring, from, to, hours }`) the coins its ring would need (the ring's price,
 * which a further place asks grown by its order), to two figures, for a place that asks coins (one
 * asking none is never given a coin cost). `hours` is the way out then.
 * Never written: the owner and the balancer decide.
 */
export function wayOutSuggestion(pace, tier, budgetMinutes) {
    const g = pace.gateOf(tier);
    const B = budgetMinutes / 60;
    const tol = pace.settings.tolerancePct / 100;
    const out = { level: null, coins: null };
    if (!g.place || !(B > 0)) return out;
    const within = (hours) => Number.isFinite(hours) && Math.abs(hours / B - 1) <= tol + 1e-9;
    const slow = !Number.isFinite(g.hours) || g.hours > B;

    const ask = g.asks.filter(a => a.hours !== null).sort((a, b) => b.hours - a.hours)[0] || null;
    if (ask) {
        let best = null;
        // Levels climbed in order: once past the budget, each further one is further from it.
        for (let level = slow ? 1 : ask.level + 1; level <= (slow ? ask.level - 1 : MAX_SETTLE_LEVEL); level++) {
            const hours = pace.wayOutWith(tier, { levels: { [ask.skill]: level } }).hours;
            const d = Number.isFinite(hours) && hours > 0 ? Math.abs(Math.log(hours / B)) : Infinity;
            if (!best || d < best.d) best = { d, level, hours };
            if (!(hours <= B)) break;
        }
        if (best && within(best.hours)) out.level = { skill: ask.skill, from: ask.level, to: best.level, hours: best.hours };
    }

    // The ring's price, which the place asks grown by its order in the ring: what the world tables hold.
    const ringCoins = g.ringCoins ?? g.coins;
    if (ringCoins > 0) {
        // More coins only lengthen the price: bisect on the coins asked.
        const at = (coins) => pace.wayOutWith(tier, { coins }).hours;
        let lo = slow ? 0 : ringCoins;
        let hi = slow ? ringCoins : ringCoins * MAX_COIN_FACTOR;
        for (let i = 0; i < 40 && hi - lo > 0.5; i++) {
            const mid = (lo + hi) / 2;
            if (at(mid) > B) hi = mid; else lo = mid;
        }
        const coins = slow ? Math.max(1, roundDown(lo)) : roundUp(hi);
        const hours = at(coins);
        if (coins !== ringCoins && within(hours)) out.coins = { ring: g.ring, from: ringCoins, to: coins, hours };
    }
    return out;
}

/** A way out off its budget, reported for the world tables to move: what it asks, and what would bring it to its budget. */
function wayOutReport(state, s) {
    const { pace } = state.eval;
    const g = pace.gateOf(s.tier);
    const asks = [...g.asks.map(a => `${PACE_TEXT.skill(a.skill)} ${a.level}`), ...(g.coins > 0 ? [PACE_TEXT.coins(g.coins)] : [])].join(' and ') || 'nothing';
    const base = { kind: 'stage', key: `stage:${s.tier}`, name: s.label, related: [g.place], floor: [...g.floor] };
    const settling = `${s.label}'s way out, settling ${g.name} (${asks})`;
    const floor = g.floor.length ? ` A floor: ${g.floor.map(f => PACE_TEXT.wayOutFloor[f]).join(', and ')}, so the real way out is later.` : '';
    const ring = g.ring !== null ? `ring ${g.ring}'s` : 'its';
    if (!Number.isFinite(g.hours)) {
        const level = g.asks.find(a => a.hours !== null && !Number.isFinite(a.hours));
        const why = level ? `no work of ${PACE_TEXT.skill(level.skill)} reaches ${level.level} by then` : PACE_TEXT.noCoins;
        return { ...base, cause: CANT_FIX.CONTENT, suggest: { level: null, coins: null }, message: `${settling}, is never had at ${AT_TARGET}: ${why}.` };
    }
    const suggest = wayOutSuggestion(pace, s.tier, s.budgetMinutes);
    const slow = g.hours * 60 > s.budgetMinutes;
    const heroes = g.byWork ? ` Its ${PACE_TEXT.heroes(g.heroes)} set it, with ${PACE_TEXT.hours(g.heroHours)} of the guild's work.` : '';
    const ways = [];
    if (suggest.level) ways.push(`${ring} settle level ${PACE_TEXT.skill(suggest.level.skill)} ${suggest.level.from} → about ${suggest.level.to} (the way out then ${wayOutTime(suggest.level.hours, s.budgetMinutes)})`);
    if (suggest.coins) {
        const proposed = state.proposals.has(`${entryKeyOf('world', 'world')}|prices.${g.ring}.coins`) ? ", the coin curve's number proposed above" : '';
        ways.push(`${ring} coins ${suggest.coins.from}${proposed} → about ${suggest.coins.to} (then ${wayOutTime(suggest.coins.hours, s.budgetMinutes)})`);
    }
    const offer = ways.length
        ? ` For the world tables to bring it to its budget: ${ways.join(', or ')}. A suggestion only: the preview writes neither.`
        : ` No settle level or coins of the place alone bring it within its budget: ${slow ? 'a longer budget' : 'a shorter budget'}, or another place of ${tierLabel(g.next)}.`;
    return {
        ...base, cause: CANT_FIX.WORLD, suggest,
        message: `${settling}, is had ${wayOutTime(g.hours, s.budgetMinutes)} into a new game at ${AT_TARGET}, against its budget of ${formatMinutes(s.budgetMinutes)}.${heroes}${offer}${floor}`
    };
}

/** Whether a boost group lifts XP only through the XP floor: an XP bonus on a work worth 1 XP a cycle. */
function floorBound(state, boost) {
    const values = boostValues(state.content, boost.factorKeys);
    return values.length > 0 && values.every(v => {
        const s = getPath(recordOf(state.content, v.kind, v.id), v.path.replace(/\.value$/, ''));
        return s?.type === EFFECT_TYPES.XP_BONUS;
    });
}

/** Why an entry's own step is long, in words: `{ cause, words }`. */
function stepCause(state, key) {
    const { pace, ledger } = state.eval;
    const name = (k) => ledger.world.names.get(k) ?? parseKey(k).id;
    const path = pace.pathOf(key, TARGET);
    for (const step of [path]) {
        const rule = ledger.reach.get(step.key)?.rule;
        const give = rule?.gives?.find(g => g.key === step.key);
        if (!rule || !give || step.own <= 0 || ![HOW.DROP, HOW.WORK, HOW.CATCH, HOW.BONUS, HOW.SPAWN].includes(rule.how)) continue;
        const find = ledger.findClass(rule, give);
        const chance = `a ${Math.round(give.chance * 1000) / 10} % chance from ${rule.via ? name(rule.via) : 'its source'}`;
        if (find === FIND.LUCK) {
            return { cause: CANT_FIX.LUCK, words: `comes only by luck: ${chance}; a sure source or a higher chance is a design call` };
        }
        if (find === FIND.RARE) {
            return { cause: CANT_FIX.RARE, words: `is a rare find: ${chance}, ${LEDGER_ENGINE_TEXT.perDay(findsPerDay(rule, give))} for one hero; more heroes on it, a rare-find boost or a higher chance is a design call` };
        }
    }
    if (!path.complete) return { cause: CANT_FIX.UNTIMED, words: 'its path has steps the calculator cannot time (a fight\'s levels, trading maps up), so its time is a floor' };
    const chain = path.steps.filter(x => x.own > 0);
    if (chain.length > 1) {
        return { cause: CANT_FIX.CHAIN, words: `its time is a chain of first finds and crafts (${chain.slice(0, 4).map(x => `${name(x.key)} ${PACE_TEXT.hours(x.own)}`).join(', ')}), no level or price to move; it may belong to a later stage` };
    }
    return { cause: CANT_FIX.OTHER, words: 'no level, price or time the pass can move sets it' };
}
