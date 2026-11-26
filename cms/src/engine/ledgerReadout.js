import { workspaceReport } from './ledgerReport.js';
import { ledgerRows } from './ledgerRows.js';
import { PROFILE } from './ledger/pace.js';
import { minutesPerLevelAt } from './ledger/settings.js';
import { COMBAT, parseKey } from '../../../src/systems/progression/ledger/engine.js';
import { PLAN_STATUS, tierLabel } from '../../../src/systems/progression/ledger/plan.js';
import { MAX_SKILL_LEVEL } from '../../../src/utils/XPCurve.js';

/**
 * The ledger's read-out for an agent (`npm run cms -- ledger`): the pace of each skill and each
 * entry's numbers and arrival at two profiles, and the ledger's checks, as plain JSON. Built only
 * from the ledger's own report (`workspaceReport`); nothing here times anything itself except the
 * guild time, which adds up the ledger's rates and supply.
 *
 * Keys and units follow the balancer's solver (`.claude/skills/balancer/balance_solver.cjs`): `opt`
 * and `typ` for the two players, minutes per level and to arrive, days to 99, seconds an action.
 * ⚠️ The ledger has no "optimized" profile: `opt` is its Maxed player (every boost the stage offers);
 * `typ` is its Typical. Where the two cannot match, `NOTES` says so, and the read-out carries them.
 *
 * Pure: reads only the workspace it is handed.
 */

export const READOUT_FORMAT = 'fantasy-guild-ledger-readout';
export const READOUT_VERSION = 1;

/** The solver's two players and the ledger profiles they are read at. */
export const READOUT_PROFILES = Object.freeze({ opt: PROFILE.MAXED, typ: PROFILE.TYPICAL });

export const NOTES = Object.freeze([
    'opt is the ledger\'s Maxed profile (every boost the stage offers), typ its Typical (boosts that pay back): the ledger has no "optimized" profile of its own.',
    'Times are hero-work hours turned to minutes: heroes work around the clock, one hero per skill, all levelling side by side.',
    'A level\'s time is fed by the guild (one hero on the best source of each input); guild adds the hours of those feeding heroes, down the chain, at the ledger\'s supply rates (an estimate: the ledger itself counts one feeder per input). Each feeder works at the same profile\'s setup, so opt\'s guild time includes brewing the drinks and potions Maxed spends, which the solver\'s guild time has no rule for.',
    'Levels above the highest level any entry asks (pastTop) are worked at the best work open by the last stage; their best work is not named, and their guild time keeps the last named level\'s ratio.',
    'An entry\'s numbers (xp, seconds, inputs, makes) are its work\'s own at Bare: one action, before boosts. Items have no work of their own: see via for the work that first gives them.',
    'Arrivals (arriveOpt, arriveTyp) are minutes from a new game along the ledger\'s path; null when never reached, and for Planned entries (the ledger times nothing Planned).',
    'The solver\'s curve is its own dials; curve here is the CMS pace curve (Ledger settings) at that level.',
]);

const finite = (n) => (Number.isFinite(n) ? n : null);
const minutes = (hours) => (Number.isFinite(hours) ? round(hours * 60, 3) : null);
const round = (n, places = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** places) / 10 ** places : null);

/**
 * The guild's hero-hours an hour of a work takes: the work's own hero, and for each input it spends
 * the share of the hero feeding it, down the chain. 1 for work that spends nothing.
 */
function guildRatioOf(pace, work, profile, cap, seen = new Set(), depth = 0) {
    if (!work || depth > 12 || seen.has(work.key)) return 1;
    const rate = pace.rateAt(work.target, profile, cap);
    if (!rate?.rate?.ok) return 1;
    seen.add(work.key);
    let ratio = 1;
    for (const [item, need] of Object.entries(rate.inputs || {})) {
        const left = need - (rate.items?.[item] || 0);
        if (!(left > 0)) continue;
        const s = pace.supplyOf(item, profile, cap);
        if (!(s.perHour > 0) || !Number.isFinite(s.perHour) || !s.work) continue;
        ratio += Math.min(1, left / s.perHour) * guildRatioOf(pace, s.work, profile, cap, seen, depth + 1);
    }
    seen.delete(work.key);
    return ratio;
}

/** One skill's pace, levels 1 to 98 (the time to the next level), with the solver's keys. */
function skillPace(pace, skill) {
    const track = pace.trackOf(skill);
    const levels = [];
    const reach = { opt: 0, typ: 0, guild: 0, guildTyp: 0 };
    const lastRatio = { opt: 1, typ: 1 };
    const ratios = new Map();
    const ratioOf = (src, as, cap) => {
        if (!src?.work) return null;
        const key = `${src.work.key}|${src.profile ?? as}|${cap}`;
        if (!ratios.has(key)) ratios.set(key, guildRatioOf(pace, src.work, src.profile ?? as, cap));
        return ratios.get(key);
    };
    const before = { opt: 0, typ: 0 };
    for (let L = 1; L < MAX_SKILL_LEVEL; L++) {
        const row = track.levels[L - 1] || null;
        const out = { L, curve: round(minutesPerLevelAt(pace.settings, L), 3) };
        const best = {};
        for (const [who, profile] of Object.entries(READOUT_PROFILES)) {
            let hours;
            if (row) {
                hours = row.hours[profile];
                const src = row.source[profile];
                best[who] = src?.work ? pace.workName(src.work) : null;
                const r = ratioOf(src, profile, row.tier);
                if (r !== null) lastRatio[who] = r;
            } else {
                const to = pace.hoursToLevel(skill, L + 1, profile);
                hours = to - before[who];
                best[who] = null;
            }
            before[who] += Number.isFinite(hours) ? hours : Infinity;
            out[who] = minutes(hours);
            const guildKey = who === 'opt' ? 'guild' : 'guildTyp';
            out[guildKey] = minutes(hours * lastRatio[who]);
            reach[who] += Number.isFinite(hours) ? hours : Infinity;
            reach[guildKey] += Number.isFinite(hours) ? hours * lastRatio[who] : Infinity;
        }
        out.best = best;
        out.reach = Object.fromEntries(Object.entries(reach).map(([k, v]) => [k, minutes(v)]));
        if (!row) out.pastTop = true;
        levels.push(out);
    }
    const curveTotal = levels.reduce((s, x) => s + (x.curve || 0), 0);
    const days = (h) => (Number.isFinite(h) ? round(h / 24, 2) : null);
    return {
        top: track.top,
        asks: track.asks.length,
        levels,
        days: { opt: days(reach.opt), typ: days(reach.typ), guild: days(reach.guild), guildTyp: days(reach.guildTyp), curve: round(curveTotal / 1440, 2) },
    };
}

/** The highest level its reach asks of a skill other than Combat, as `{ skill, level }`. */
function gateOf(at) {
    let out = { skill: null, level: null };
    for (const g of at?.rule?.gates || []) {
        if (g.skill === COMBAT || !(g.level > (out.level ?? 0))) continue;
        out = { skill: g.skill, level: g.level };
    }
    return out;
}

/** A work's numbers for one action at Bare: XP, seconds, what it spends and makes. */
function workNumbers(pace, report, work) {
    const f = pace.rateAt(work.target, PROFILE.BARE, work.tier);
    const rate = f?.rate;
    if (!rate) return null;
    const name = (id) => report.ledger.world.names.get(`item:${id}`) ?? id;
    const per = rate.cyclesPerHour > 0 ? (m) => Object.entries(m || {}).map(([id, n]) => ({ id, name: name(id), count: round(n / rate.cyclesPerHour, 3) })) : () => [];
    return {
        work: pace.workName(work),
        skill: rate.skill || null,
        level: rate.gates?.needed ?? null,
        xp: round(rate.xpPerCycle, 3),
        seconds: round(rate.baseCycleMs / 1000, 2),
        inputs: per(rate.inputs),
        makes: Object.entries(rate.perCycle || {}).map(([id, n]) => ({ id, name: name(id), count: round(n, 3) })),
        ok: rate.ok !== false,
        ...(rate.ok === false && rate.reason ? { why: rate.reason } : {}),
    };
}

/**
 * The read-out of a workspace (the collections, as the CMS's store holds them).
 * @param {object} state
 * @param {{ report?: object }} options  a `workspaceReport` already worked out, to reuse
 */
export function ledgerReadout(state = {}, { report = null } = {}) {
    const started = Date.now();
    const r = report || workspaceReport(state);
    const { pace, ledger, findings } = r;
    const worksByEntry = new Map();
    for (const w of pace.works) {
        if (!worksByEntry.has(w.entry)) worksByEntry.set(w.entry, []);
        worksByEntry.get(w.entry).push(w);
    }

    const skills = {};
    for (const skill of pace.skills()) if (skill !== COMBAT) skills[skill] = skillPace(pace, skill);

    const rows = [];
    for (const entry of ledgerRows(state)) {
        const key = entry.ledgerKey;
        const at = ledger.reach.get(key) || null;
        const planned = entry.status === PLAN_STATUS.PLANNED;
        const works = (worksByEntry.get(key) || []).filter((w) => w.tier !== null).sort((a, b) => a.tier - b.tier);
        const numbers = works.length ? workNumbers(pace, r, works[0]) : null;
        const gate = gateOf(at);
        const arrive = {};
        for (const [who, profile] of Object.entries(READOUT_PROFILES)) {
            arrive[who] = planned ? null : minutes(pace.pathOf(key, profile).hours);
        }
        rows.push({
            key, id: entry.id, name: entry.name, kind: entry.kind, status: entry.status, planned,
            tier: entry.tier ?? (Number.isInteger(at?.tier) ? at.tier : null),
            reachTier: Number.isInteger(at?.tier) ? at.tier : null,
            skill: numbers?.skill ?? gate.skill, level: numbers?.level ?? gate.level,
            work: numbers?.work ?? null, xp: numbers?.xp ?? null, seconds: numbers?.seconds ?? null,
            inputs: numbers?.inputs ?? [], makes: numbers?.makes ?? [],
            ...(numbers && !numbers.ok ? { workWhy: numbers.why ?? 'its work cannot run' } : {}),
            via: at?.via ?? at?.rule?.via ?? null, how: at?.how ?? at?.rule?.how ?? null,
            arriveOpt: arrive.opt, arriveTyp: arrive.typ,
            ...(planned ? { why: 'planned' } : arrive.typ === null ? { why: at ? 'never reached' : 'not in the ledger' } : {}),
        });
    }

    const stages = pace.settings.stages.map((s) => {
        const stage = pace.stageOf(s.tier);
        return { tier: s.tier, label: tierLabel(s.tier), entries: stage.entries, minutes: stage.entries ? minutes(finite(stage.hours) ?? Infinity) : null, untimed: stage.untimed.length, budgetMinutes: s.budgetMinutes };
    });
    const nameOf = (key) => (key ? ledger.world.names.get(key) ?? parseKey(key).id : null);
    const checks = findings.map((f) => ({ check: f.check, key: f.key ?? null, name: f.name ?? nameOf(f.key), severity: f.severity, message: f.message }));

    return {
        format: READOUT_FORMAT, version: READOUT_VERSION,
        profiles: { ...READOUT_PROFILES },
        units: { levelTimes: 'minutes', days: 'days (24 hero-hours)', arrive: 'minutes', seconds: 'seconds an action', xp: 'XP an action' },
        notes: [...NOTES],
        pace: skills,
        rows,
        stages,
        checks,
        counts: {
            skills: Object.keys(skills).length, rows: rows.length, planned: rows.filter((x) => x.planned).length,
            checks: checks.length, bySeverity: checks.reduce((m, c) => ({ ...m, [c.severity]: (m[c.severity] || 0) + 1 }), {}),
        },
        ms: Date.now() - started,
    };
}

const fmtMin = (m) => (m === null ? 'never' : m < 60 ? `${round(m, 1)} min` : m < 1440 ? `${round(m / 60, 1)} h` : `${round(m / 1440, 1)} d`);

/** A short summary in words: days to 99 per skill, the stages, the checks by severity. */
export function readoutText(out) {
    const lines = [];
    lines.push(`Skill | days to 99 opt (Maxed) | typ (Typical) | guild opt | curve | highest level asked`);
    for (const [skill, p] of Object.entries(out.pace).sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`${skill} ${p.days.opt ?? 'never'} ${p.days.typ ?? 'never'} ${p.days.guild ?? 'never'} ${p.days.curve} ${p.top}`);
    }
    lines.push('', 'Stage | Typical time | budget | entries (untimed)');
    for (const s of out.stages) lines.push(`${s.label} ${fmtMin(s.minutes)} ${fmtMin(s.budgetMinutes)} ${s.entries} (${s.untimed})`);
    const sev = Object.entries(out.counts.bySeverity).map(([k, n]) => `${n} ${k}`).join(', ') || 'none';
    lines.push('', `${out.counts.rows} entries (${out.counts.planned} Planned, marked), ${out.counts.checks} checks: ${sev}.`);
    return lines;
}
