// the progression ledger's balancing preview: numbers proposed so the Typical profile follows the pace

import { buildLedger, HOW, COMBAT, parseKey, itemKey, tokenKey, recipeKey } from './engine.js';
import { buildPace, PACE_TEXT } from './pace.js';
import { PROFILE, BOOST_KIND, BOOST_KIND_TEXT } from './profiles.js';
import { LIFECYCLE } from './rates.js';
import { settingsOf, formatMinutes } from './settings.js';
import { tierLabel } from './plan.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { SKILLS, SKILL_LAYERS } from '../../../config/registries/skillRegistry.js';

/**
 * Automatic balancing as a preview (brief 290 L9): the numbers the content would need for the
 * Typical profile to follow the pace curve, each stage to meet its budget and boosts their strength
 * targets, worked out with the ledger's own pace (`pace.js`) and never applied. Four levers, each
 * pass re-reading the pace the one before left:
 *
 * - **Boost strengths**: a building's, drink's, tool's or gear's effect over its kind's target at
 *   Maxed is weakened (its library effect's value, or the bearer's own statement), never a Guild
 *   Hall star's (owner, 2026-11-02: the Hall waits for its own pass).
 * - **XP a cycle**: for each skill, the levels where one source is the best at Typical are worked at
 *   that source's XP; its XP is scaled so those levels take the curve's time. Where the curve and
 *   the XP a level needs part by more than the wall factor inside one source's levels, only the
 *   first stretch is followed and the rest is reported: one number cannot follow both.
 * - **Level gates**: a stage off its budget has its level gates moved along each skill's Typical
 *   track: a slow stage's late unlocks are pulled in to land by its budget, a fast stage's unlocks
 *   spread over it from the stage before's end, in the same order. Gates the world tables set are
 *   not moved here.
 * - **Costs and times**: a one-off step far longer than the pace allows (a Shop price, a build's
 *   inputs or time, a growth) is cut to the wait the pace allows there.
 *
 * What none of them can fix is reported with its cause (`CANT_FIX`): a skill with no source where
 * the curve needs one, a source that wears out, luck, the world tables, the XP floor, the Hall, a
 * step the calculator cannot time, a chain of first finds, a proposal at its cap.
 *
 * Pure: reads only the content and settings it is handed and changes neither.
 * ⚠️ The Economy simulator's Recalculate derives XP a cycle and cycle times of tagged entries from
 * its XPH pins and Tempo bands, so an applied XP or time proposal would be undone by the next
 * Recalculate unless this pass runs after it: applying is a later phase.
 */

export const LEVER = Object.freeze({ XP: 'xp', GATE: 'gate', COST: 'cost', TIME: 'time', BOOST: 'boost' });

export const CANT_FIX = Object.freeze({
    CONTENT: 'content',
    ONE_OFF: 'one-off',
    LUCK: 'luck',
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
    lever: Object.freeze({ xp: 'XP a cycle', gate: 'Level gate', cost: 'Cost', time: 'Time', boost: 'Boost strength' }),
    cause: Object.freeze({
        content: 'Needs content', 'one-off': 'A source that wears out', luck: 'Luck', world: 'World tables',
        floor: 'The XP floor', hall: 'Guild Hall pass', untimed: 'Not timed', chain: 'A chain of first finds',
        limit: 'At its cap', other: 'Other'
    }),
    field: Object.freeze({
        'config.xp': 'XP a cycle', xp: 'XP a cycle', 'config.skillRequired': 'Level needed', levelRequirement: 'Level needed',
        durationMs: 'Time (ms)', 'config.cycleTimeMs': 'Cycle (ms)', 'grows.afterMs': 'Grow time (ms)'
    })
});

/** An XP proposal moves a source at most this many times either way from its authored number. */
export const MAX_XP_FACTOR = 20;
/** A time is never cut below a second. */
const MIN_TIME_MS = 1000;
/** Rounds of the passes: each re-reads the pace the last left. */
const DEFAULT_ROUNDS = 3;

/** The axes a boost's strength is read on (`rates.js`): their values are what a boost proposal weakens. */
const RATE_AXES = new Set([
    EFFECT_TYPES.WORK_TIME, EFFECT_TYPES.YIELD, EFFECT_TYPES.XP_BONUS, EFFECT_TYPES.LOOT_MULT, EFFECT_TYPES.DOUBLE_DROP,
    EFFECT_TYPES.INPUT_COST, EFFECT_TYPES.GROW_TIME, EFFECT_TYPES.CROP_LOAD, EFFECT_TYPES.CATCH_WEIGHT
]);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
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
    const ledger = buildLedger(content);
    return { content, ledger, pace: buildPace(content, ledger, settings) };
}

/**
 * The parts of a pace the preview reports before and after: each stage against its budget, the
 * walls at Typical, the long waits for one unlock, and the boosts over their targets. Plain data.
 */
export function balanceSummary({ pace, ledger }) {
    const settings = pace.settings;
    const name = (key) => ledger.world.names.get(key) ?? parseKey(key).id;
    const tol = settings.tolerancePct;
    const stages = settings.stages.map((s) => {
        const st = pace.stageOf(s.tier);
        const off = st.entries && Number.isFinite(st.hours) ? (st.hours * 60) / s.budgetMinutes - 1 : null;
        return {
            tier: s.tier, label: tierLabel(s.tier), budgetMinutes: s.budgetMinutes, entries: st.entries,
            hours: st.entries ? st.hours : null, offPct: off === null ? null : Math.round(off * 1000) / 10,
            within: off === null || Math.abs(off) * 100 <= tol + 1e-9, complete: st.complete, untimed: st.untimed.length,
            slowest: st.slowest.slice(0, 3).map(x => ({ key: x.key, name: name(x.key), hours: x.hours }))
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
 * @returns {{ before, after, proposals, cantFix, rounds, ms }} `before`/`after` from {@link balanceSummary};
 *   `proposals` `[{ key, kind, id, name, field, label, lever, from, to, why }]`, each field once;
 *   `cantFix` `[{ kind: 'wall'|'stage'|'unlock'|'boost', key, skill?, name, cause, message }]`
 */
export function proposeBalance(content, rawSettings = null, { rounds = DEFAULT_ROUNDS } = {}) {
    const started = Date.now();
    const settings = settingsOf(rawSettings);
    const original = content;
    const first = evaluate(content, settings);
    const before = balanceSummary(first);
    const state = {
        settings, original, content: structuredClone(content), eval: null, proposals: new Map(), capped: new Map()
    };
    state.eval = evaluate(state.content, settings);

    let used = 0;
    for (let round = 0; round < rounds; round++) {
        used = round + 1;
        let any = false;
        for (const pass of [boostPass, xpPass, gatePass, costPass]) {
            if (pass(state)) {
                any = true;
                state.eval = evaluate(state.content, settings);
            }
        }
        if (!any) break;
    }

    const proposals = [...state.proposals.values()].filter(p => p.to !== p.from);
    const after = proposals.length ? balanceSummary(state.eval) : before;
    return {
        before, after, proposals,
        cantFix: explain(state, after),
        rounds: used, ms: Date.now() - started
    };
}

/** Record a proposal and set it in the working content. `from` is always the authored number. */
function propose(state, { kind, id, field, to, lever, why }) {
    const record = recordOf(state.content, kind, id);
    if (!record) return false;
    const now = getPath(record, field);
    if (now === to) return false;
    const key = entryKeyOf(kind, id);
    const id_ = `${key}|${field}`;
    const from = state.proposals.get(id_)?.from ?? getPath(recordOf(state.original, kind, id), field);
    setPath(record, field, to);
    const name = kind === 'effect' ? (record.name || id) : (state.eval.ledger.world.names.get(key) ?? id);
    state.proposals.set(id_, { key, kind, id, name, field, label: BALANCE_TEXT.field[field] || fieldLabel(field, lever), lever, from, to, why });
    return true;
}

function fieldLabel(field, lever) {
    if (lever === LEVER.COST) return 'Quantity';
    if (lever === LEVER.BOOST) return 'Value';
    return BALANCE_TEXT.lever[lever] || field;
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
    for (const g of pace.boostGroups()) {
        if (g.kind === BOOST_KIND.HALL || g.kind === BOOST_KIND.CAMP) continue;
        const target = Math.min(...g.works.map(w => w.target)) / 100;
        const values = boostValues(state.content, g.factorKeys);
        if (!values.length || !(target > 0)) continue;
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
            const p = buildPace(trial, buildLedger(trial), state.settings);
            gain = Math.max(0, ...g.works.map(w => p.boostGain(w.work.target, g.kind, PROFILE.MAXED, w.tier) ?? 0));
            if (!best || gain < best.gain) best = { gain, next };
        }
        if (!best || best.gain > target * (1 + tol)) continue;
        const why = `${g.names.join(' with ')} (${BOOST_KIND_TEXT[g.kind].toLowerCase()}) make ${pace.workName(g.works[0].work)} +${Math.round(g.works[0].gain * 100)} % at Maxed against the ${Math.round(target * 100)} % target; weakened, +${Math.round(best.gain * 100)} %.`;
        for (const v of best.next) changed = propose(state, { kind: v.kind, id: v.id, field: v.path, to: v.to, lever: LEVER.BOOST, why }) || changed;
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
 * Each skill's levels grouped by the XP field of their best Typical source, in level order, with
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
            const src = row.source.typical;
            if (!src?.work || !(src.xp > 0)) continue;
            const field = xpFieldOf(state.content, src.work);
            if (!field) continue;
            const id = `${field.kind}:${field.id}|${field.field}`;
            if (!groups.has(id)) groups.set(id, { ...field, skill, rows: [], work: src.work });
            groups.get(id).rows.push({ level: row.level, hours: row.hours.typical, curveMinutes: row.curveMinutes, ratio: row.hours.typical * 60 / row.curveMinutes });
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

function xpPass(state) {
    const tol = state.settings.tolerancePct / 100;
    let changed = false;
    for (const g of xpBands(state)) {
        const R = g.ratio;
        if (!(R > 0) || !Number.isFinite(R)) continue;
        if (R >= 1 / (1 + tol) && R <= 1 + tol) continue;
        const authored = Number(getPath(recordOf(state.original, g.kind, g.id), g.field)) || g.value;
        const lo = Math.max(1, Math.ceil(authored / MAX_XP_FACTOR));
        const hi = Math.floor(authored * MAX_XP_FACTOR);
        const wanted = Math.round(g.value * R);
        const to = Math.min(hi, Math.max(lo, wanted));
        const first = g.head[0].level;
        const last = g.head[g.head.length - 1].level + 1;
        const name = state.eval.pace.workName(g.work);
        const fieldId = `${g.kind}:${g.id}|${g.field}`;
        if (wanted > hi || wanted < lo) {
            state.capped.set(fieldId, {
                kind: 'xp', key: entryKeyOf(g.kind, g.id), name, cause: CANT_FIX.LIMIT,
                message: `${name}: ${PACE_TEXT.skill(g.skill)} ${first} → ${last} takes ${PACE_TEXT.times(R)} the curve's time on it; its XP a cycle would need to be ${wanted}, and the proposal stops at ${to} (${MAX_XP_FACTOR}× its authored ${authored} either way). The source itself is too ${R > 1 ? 'slow' : 'fast'} for a number to fix.`
            });
        } else {
            state.capped.delete(fieldId);
        }
        if (to === g.value) continue;
        const why = `${PACE_TEXT.skill(g.skill)} ${first} → ${last}: its best Typical source, ${name}, takes ${PACE_TEXT.times(R)} the curve's time; its XP a cycle ${g.value} → ${to}.`;
        changed = propose(state, { kind: g.kind, id: g.id, field: g.field, to, lever: LEVER.XP, why }) || changed;
    }
    return changed;
}

// ── level gates ─────────────────────────────────────────────────────────────────────────────────

/** The level gate an entry's time waits on at Typical: along its critical path, the first step that waited for a level. */
function bindingGate(pace, key) {
    const path = pace.pathOf(key, PROFILE.TYPICAL);
    for (const step of path.steps) {
        if (step.waitsOn?.skill) return isCombatStyle(step.waitsOn.skill) ? null : { key: step.key, skill: step.waitsOn.skill, level: step.waitsOn.level, hours: step.start };
        if (!step.waitsOn?.need) return null;
    }
    return null;
}

/**
 * The fields a gate on an entry is written in, for one skill: a recipe's `levelRequirement` and its
 * station's (or Foundation's) `config.skillRequired`; a Token's own work's `config.skillRequired`.
 * None for a gate the world tables set (a settle) or a fight.
 */
function gateFields(state, key, skill) {
    const rule = state.eval.ledger.reach.get(key)?.rule;
    if (!rule) return [];
    const out = [];
    const tokenField = (tokenId, own) => {
        const def = recordOf(state.content, 'token', tokenId);
        if (!def || !isObject(def.config)) return;
        const its = def.foundation ? (def.foundation.skill || own) : def.config.skill;
        if (its === skill) out.push({ kind: 'token', id: tokenId, field: 'config.skillRequired', value: Number(def.config.skillRequired) || 1, own: false });
    };
    if (rule.how === HOW.STATION || rule.how === HOW.BUILD) {
        const recipeId = parseKey(rule.gives[0]?.key || key).id;
        const recipe = recordOf(state.content, 'recipe', recipeId);
        if (recipe && recipe.skill === skill) out.push({ kind: 'recipe', id: recipeId, field: 'levelRequirement', value: Number(recipe.levelRequirement) || 1, own: true });
        if (rule.via) tokenField(parseKey(rule.via).id, recipe?.skill);
    } else if ([HOW.WORK, HOW.CATCH, HOW.REGROW].includes(rule.how) && rule.via) {
        tokenField(parseKey(rule.via).id, null);
        for (const f of out) f.own = true;
    }
    return out;
}

function gatePass(state) {
    const { pace } = state.eval;
    const tol = state.settings.tolerancePct / 100;
    const moves = new Map();
    let prevEnd = 0;
    for (const s of [...state.settings.stages].sort((a, b) => a.tier - b.tier)) {
        const B = s.budgetMinutes / 60;
        const S = prevEnd;
        prevEnd = B;
        const st = pace.stageOf(s.tier);
        const T = st.hours;
        if (!st.entries || !st.timed?.length || !(T > 0) || !Number.isFinite(T)) continue;
        const off = T / B - 1;
        if (Math.abs(off) <= tol) continue;

        const gates = new Map();
        for (const e of st.timed) {
            const g = bindingGate(pace, e.key);
            if (!g || pace.effTier(g.key) !== s.tier) continue;
            const id = `${g.key}|${g.skill}`;
            const at = gates.get(id);
            if (!at) gates.set(id, { ...g, entryHours: e.hours });
            else at.entryHours = Math.max(at.entryHours, e.hours);
        }
        const stageWords = `${tierLabel(s.tier)} is done ${PACE_TEXT.hours(T)} into a new game at Typical against its ${formatMinutes(s.budgetMinutes)}`;

        if (off < 0) {
            // Too fast: its unlocks spread over the stage, from the stage before's end, in the same order.
            const base = T > S ? S : 0;
            for (const g of gates.values()) {
                if (!(g.hours > base)) continue;
                const h = base + (g.hours - base) * (B - base) / (T - base);
                const level = Math.max(g.level, pace.levelAtHours(g.skill, h, PROFILE.TYPICAL, s.tier));
                if (level > g.level) addMove(moves, state, g, level, 'up', `${stageWords}: its unlocks spread over the stage; ${PACE_TEXT.skill(g.skill)} ${g.level} is reached ${PACE_TEXT.hours(g.hours)} in, ${PACE_TEXT.skill(g.skill)} ${level} about ${PACE_TEXT.hours(h)} in.`);
            }
        } else {
            // Too slow: the unlocks past its budget pulled in to land by it, in the same order.
            const keep = st.timed.filter(e => e.hours <= B).map(e => e.hours);
            const C = Math.max(S > B ? 0 : S, ...keep, 0);
            const late = [...gates.values()].filter(g => g.entryHours > B && g.hours > C);
            if (!late.length) continue;
            // The latest gate lands its entry by the budget; the others keep their order below it,
            // and none lands its own entry later than the budget.
            const top = late.reduce((a, b) => (b.hours > a.hours ? b : a));
            const landing = top.hours - (top.entryHours - B);
            for (const g of late) {
                const mapped = landing > C ? C + (g.hours - C) * (landing - C) / (top.hours - C) : C;
                const h = Math.max(C, Math.min(mapped, g.hours - (g.entryHours - B)));
                const level = Math.min(g.level, pace.levelAtHours(g.skill, h, PROFILE.TYPICAL, s.tier));
                if (level < g.level) addMove(moves, state, g, Math.max(1, level), 'down', `${stageWords}: ${PACE_TEXT.skill(g.skill)} ${g.level} is reached ${PACE_TEXT.hours(g.hours)} in; ${PACE_TEXT.skill(g.skill)} ${Math.max(1, level)} lands it by the budget.`);
            }
        }
    }
    let changed = false;
    for (const m of moves.values()) changed = propose(state, { kind: m.kind, id: m.id, field: m.field, to: m.to, lever: LEVER.GATE, why: m.why }) || changed;
    return changed;
}

/** One gate move onto its fields: raised on the entry's own field, lowered on every field above it. */
function addMove(moves, state, gate, level, way, why) {
    const fields = gateFields(state, gate.key, gate.skill);
    const chosen = way === 'up'
        ? (fields.filter(f => f.own).slice(0, 1).length ? fields.filter(f => f.own).slice(0, 1) : fields.slice(0, 1))
        : fields.filter(f => f.value > level);
    for (const f of chosen) {
        const to = Math.min(99, Math.max(1, Math.round(level)));
        const id = `${f.kind}:${f.id}|${f.field}`;
        const at = moves.get(id);
        if (!at) moves.set(id, { ...f, to, why });
        else at.to = way === 'up' ? Math.max(at.to, to) : Math.min(at.to, to);
    }
}

// ── costs and times ─────────────────────────────────────────────────────────────────────────────

/**
 * Cut a one-off step to `targetHours` of its own time: a Shop price's or a build's quantities (each
 * input to what its supply gathers in the time), a build's time, a growth's time. False when the
 * step is none of these.
 */
function shrinkStep(state, key, targetHours, why) {
    const { pace, ledger } = state.eval;
    const at = ledger.reach.get(key);
    const rule = at?.rule;
    if (!rule || !(targetHours > 0)) return false;
    let changed = false;
    const cap = Number.isInteger(at.tier) ? at.tier : pace.maxTier;
    const shrinkInputs = (kind, id, base, hours) => {
        const record = recordOf(state.content, kind, id);
        list(getPath(record, base)).forEach((input, i) => {
            const q = Number(input?.quantity);
            if (!(q > 1) || typeof input.itemId !== 'string') return;
            const s = pace.supplyOf(input.itemId, PROFILE.TYPICAL, cap).perHour;
            if (!(s > 0) || !Number.isFinite(s) || q / s <= hours) return;
            const to = Math.max(1, Math.floor(hours * s));
            if (to < q) changed = propose(state, { kind, id, field: `${base}.${i}.quantity`, to, lever: LEVER.COST, why }) || changed;
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
            if (to < recipe.durationMs) changed = propose(state, { kind: 'recipe', id: recipeId, field: 'durationMs', to, lever: LEVER.TIME, why }) || changed;
        }
        shrinkInputs('recipe', recipeId, 'inputs', targetHours - Math.min(buildHours, targetHours / 2));
    } else if (rule.how === HOW.GROW && rule.via) {
        const id = parseKey(rule.via).id;
        const def = recordOf(state.content, 'token', id);
        const ms = Number(def?.grows?.afterMs);
        const to = Math.max(MIN_TIME_MS, Math.round(targetHours * HOUR_MS / 1000) * 1000);
        if (ms > to) changed = propose(state, { kind: 'token', id, field: 'grows.afterMs', to, lever: LEVER.TIME, why }) || changed;
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
        const why = `Its own step takes ${PACE_TEXT.hours(u.r.own)} at Typical once it can start, ${PACE_TEXT.times(u.ratio)} the ${formatMinutes(u.expected)} the pace allows a wait there.`;
        changed = shrinkStep(state, u.key, u.expected / 60, why) || changed;
    }
    // A stage still over its budget for a step no level holds: the step cut by the overrun.
    const tol = state.settings.tolerancePct / 100;
    for (const s of state.settings.stages) {
        const st = pace.stageOf(s.tier);
        const B = s.budgetMinutes / 60;
        if (!st.timed?.length || !(st.hours / B - 1 > tol)) continue;
        for (const e of st.timed.filter(x => x.hours > B)) {
            const steps = pace.pathOf(e.key, PROFILE.TYPICAL).steps;
            const longest = steps.filter(x => Number.isFinite(x.own) && x.own > 0).sort((a, b) => b.own - a.own)[0];
            if (!longest) continue;
            const target = longest.own - (e.hours - B);
            if (!(target > 0)) continue;
            const why = `${tierLabel(s.tier)} is over its ${formatMinutes(s.budgetMinutes)}: ${e.key === longest.key ? 'its' : `${state.eval.ledger.world.names.get(longest.key) ?? longest.key}'s`} own step takes ${PACE_TEXT.hours(longest.own)}.`;
            changed = shrinkStep(state, longest.key, target, why) || changed;
        }
    }
    return changed;
}

// ── what numbers cannot fix ─────────────────────────────────────────────────────────────────────

function explain(state, after) {
    const { pace, ledger } = state.eval;
    const name = (key) => ledger.world.names.get(key) ?? parseKey(key).id;
    const out = [...state.capped.values()];
    const bands = xpBands(state);

    for (const w of after.walls) {
        const skill = PACE_TEXT.skill(w.skill);
        const range = `${skill} ${w.from} → ${w.to}`;
        const base = { kind: 'wall', key: `skill:${w.skill}`, skill: w.skill, name: range };
        if (!w.source) {
            out.push({ ...base, cause: CANT_FIX.CONTENT, message: `${range}: no work of the skill gives XP there at Typical; it needs a source.` });
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
            const r = pace.rateAt(o.x.target, PROFILE.TYPICAL)?.rate;
            return !r?.ok || r.lifecycle?.kind === LIFECYCLE.ONE_OFF || !(r.cyclesPerHour > 0);
        });
        const first = band?.rows[0]?.level ?? 1;
        if (worn.length) {
            const names = [...new Set(worn.map(o => `${pace.workName(o.x)} (${skill} ${o.gate})`))].slice(0, 4).join(', ');
            out.push({ ...base, cause: CANT_FIX.ONE_OFF, message: `${range}: ${w.source} is the best source from level ${first}; ${names} open${worn.length === 1 ? 's' : ''} inside it but ${worn.length === 1 ? 'is' : 'are'} not worked over and over (it wears out for good or is not rated), so it cannot carry these levels.` });
        } else {
            out.push({ ...base, cause: CANT_FIX.CONTENT, message: `${range}: ${w.source} is the best source from level ${first}, and nothing of the skill opens between ${w.from} and ${w.to}; past level ${w.from} one XP number cannot follow the curve and the levels before it too: it needs a new source around level ${w.from}.` });
        }
    }

    for (const s of after.stages) {
        if (s.within || !s.entries) continue;
        const st = pace.stageOf(s.tier);
        const slow = s.offPct > 0;
        const top = st.timed?.[0];
        const base = { kind: 'stage', key: `stage:${s.tier}`, name: s.label };
        const words = `${s.label} is done ${PACE_TEXT.hours(s.hours)} in at Typical, ${Math.abs(Math.round(s.offPct))} % ${slow ? 'over' : 'under'} its ${formatMinutes(s.budgetMinutes)}`;
        if (!slow) {
            const gates = (st.timed || []).map(e => bindingGate(pace, e.key)).filter(Boolean);
            const world = gates.some(g => ledger.reach.get(g.key)?.rule?.how === HOW.SETTLE);
            out.push({ ...base, cause: world ? CANT_FIX.WORLD : CANT_FIX.CONTENT, message: `${words}: no level gate the pass can move holds its unlocks back${world ? ' (some are the world tables\' settle levels)' : ''}; it needs more to do, or a shorter budget.` });
            continue;
        }
        if (!top) continue;
        const cause = stepCause(state, top.key);
        out.push({ ...base, cause: cause.cause, message: `${words}: ${name(top.key)} (${PACE_TEXT.hours(top.hours)}) ${cause.words}.` });
    }

    for (const u of after.unlockWalls) {
        const cause = stepCause(state, u.key, true);
        out.push({ kind: 'unlock', key: u.key, name: u.name, cause: cause.cause, message: `${u.name}: its own step takes ${PACE_TEXT.hours(u.own)} at Typical, ${PACE_TEXT.times(u.ratio)} the ${formatMinutes(u.allowedMinutes)} the pace allows; ${cause.words}.` });
    }

    for (const b of after.boosts) {
        const names = b.names.join(' with ');
        const base = { kind: 'boost', key: b.factorKeys[0], name: names };
        if (b.kind === BOOST_KIND.HALL) {
            out.push({ ...base, cause: CANT_FIX.HALL, message: `${names} (Guild Hall) make ${b.top} +${Math.round(b.gain * 100)} % at Maxed against the ${b.target} % target: left for the Guild Hall pass (owner, 2026-11-02).` });
        } else if (floorBound(state, b)) {
            out.push({ ...base, cause: CANT_FIX.FLOOR, message: `${names} make ${b.top} +${Math.round(b.gain * 100)} % at Maxed against the ${b.target} % target: an XP bonus on a cycle worth 1 XP always adds a whole XP (the XP floor), so no strength brings it to target; the work's XP a cycle would have to rise.` });
        } else {
            out.push({ ...base, cause: CANT_FIX.OTHER, message: `${names} make ${b.top} +${Math.round(b.gain * 100)} % at Maxed against the ${b.target} % target, and weakening its values does not bring it there.` });
        }
    }
    return out;
}

/** Whether a boost group lifts XP only through the XP floor: an XP bonus on a work worth 1 XP a cycle. */
function floorBound(state, boost) {
    const values = boostValues(state.content, boost.factorKeys);
    return values.length > 0 && values.every(v => {
        const s = getPath(recordOf(state.content, v.kind, v.id), v.path.replace(/\.value$/, ''));
        return s?.type === EFFECT_TYPES.XP_BONUS;
    });
}

/** Why an entry's own time or path is long, in words: `{ cause, words }`. */
function stepCause(state, key, own = false) {
    const { pace, ledger } = state.eval;
    const name = (k) => ledger.world.names.get(k) ?? parseKey(k).id;
    const path = pace.pathOf(key, PROFILE.TYPICAL);
    const gate = own ? null : bindingGate(pace, key);
    if (gate) {
        const rule = ledger.reach.get(gate.key)?.rule;
        if (rule?.how === HOW.SETTLE) return { cause: CANT_FIX.WORLD, words: `waits on ${PACE_TEXT.skill(gate.skill)} ${gate.level}, a settle level the world tables set` };
        if (pace.effTier(gate.key) !== pace.effTier(key)) return { cause: CANT_FIX.OTHER, words: `waits on ${PACE_TEXT.skill(gate.skill)} ${gate.level} for ${name(gate.key)}, planned for another stage` };
        return { cause: CANT_FIX.OTHER, words: `waits on ${PACE_TEXT.skill(gate.skill)} ${gate.level} (${name(gate.key)}), which the gate pass could not bring in further` };
    }
    const steps = own ? [path] : path.steps;
    for (const step of steps) {
        const rule = ledger.reach.get(step.key)?.rule;
        const give = rule?.gives?.find(g => g.key === step.key);
        if (rule && [HOW.DROP, HOW.WORK, HOW.CATCH, HOW.BONUS, HOW.SPAWN, HOW.TURN].includes(rule.how) && give && give.chance < 1 && step.own > 0) {
            return { cause: CANT_FIX.LUCK, words: `comes only by luck: a ${Math.round(give.chance * 1000) / 10} % chance from ${rule.via ? name(rule.via) : 'its source'}; a sure source or a higher chance is a design call` };
        }
    }
    if (!path.complete) return { cause: CANT_FIX.UNTIMED, words: 'its path has steps the calculator cannot time (a fight\'s levels, a bounty, trading maps up), so its time is a floor' };
    const chain = path.steps.filter(x => x.own > 0);
    if (chain.length > 1) {
        return { cause: CANT_FIX.CHAIN, words: `its time is a chain of first finds and crafts (${chain.slice(0, 4).map(x => `${name(x.key)} ${PACE_TEXT.hours(x.own)}`).join(', ')}), no level or price to move; it may belong to a later stage` };
    }
    return { cause: CANT_FIX.OTHER, words: 'no level, price or time the pass can move sets it' };
}
