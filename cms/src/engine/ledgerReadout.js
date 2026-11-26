import { workspaceReport } from './ledgerReport.js';
import { ledgerRows } from './ledgerRows.js';
import { PROFILE } from './ledger/pace.js';
import { minutesPerLevelAt, boostBudgetAt, chainHeroesAt } from './ledger/settings.js';
import { COMBAT, parseKey } from '../../../src/systems/progression/ledger/engine.js';
import { PLAN_STATUS, tierLabel } from '../../../src/systems/progression/ledger/plan.js';
import { MAX_SKILL_LEVEL } from '../../../src/utils/XPCurve.js';

/**
 * The ledger's read-out for an agent (`npm run cms -- ledger`): the pace of each skill at three
 * profiles, each entry's numbers and arrival at two, the boost budget and the ledger's checks, as
 * plain JSON. Built only from the ledger's own report (`workspaceReport`); nothing here times
 * anything itself: the guild time is the hero-hours the pace counts for a level (`track.work`: its
 * chain's heroes at work all the while), the stages are timed with the reference guild's heroes
 * (`pace.stageOf`), and the other layout is the pace's own second timing (`pace.layoutSpread`).
 *
 * Keys and units follow the balancer's solver (`.claude/skills/balancer/balance_solver.cjs`): `opt`,
 * `typ` and `bare` for the players, minutes per level and to arrive, days to 99, seconds an action.
 * ⚠️ The ledger's optimized player is its Maxed profile (every boost the stage offers), the curve's
 * player; `typ` is its Typical, `bare` its Bare (no boosts: what the balance rules divide XP an
 * action by). Where the two cannot match, `NOTES` says so, and the read-out carries them.
 *
 * Pure: reads only the workspace it is handed.
 */

export const READOUT_FORMAT = 'fantasy-guild-ledger-readout';
export const READOUT_VERSION = 3;

/** The solver's players and the ledger profiles they are read at. */
export const READOUT_PROFILES = Object.freeze({ opt: PROFILE.MAXED, typ: PROFILE.TYPICAL, bare: PROFILE.BARE });

/** The players an entry's arrival is read at. */
const ARRIVAL_PROFILES = Object.freeze({ opt: PROFILE.MAXED, typ: PROFILE.TYPICAL });

/** Each player's guild time key, as the solver and L1 named them. */
const GUILD_KEY = Object.freeze({ opt: 'guild', typ: 'guildTyp', bare: 'guildBare' });

export const NOTES = Object.freeze([
    'opt is the ledger\'s Maxed profile (every boost the stage offers), the curve\'s player; typ its Typical (boosts that pay back); bare its Bare (no boosts). The balance rules\' optimized boost factor at a level is bare / opt there.',
    'Times are hero-work hours turned to minutes: heroes work around the clock. A skill\'s levels are one hero\'s climb on its chain; a stage and an arrival also wait for the guild\'s heroes to do all the work on the way (heroes, stages).',
    'heroes lists the reference guild\'s heroes by stage (BALANCE_RULES section 8: about one a tier, a Ledger setting), each arriving as the curve reaches its tier, and the heroes one chain has there (chainHeroes: the guild\'s, at most one maker and gatherersPerMaker gatherers).',
    'gatherers and brewers (per level and profile) are the heroes a level\'s work needs besides its maker to run in full: the gatherers down its chain and the brewers of the drinks and potions its boosts spend (each with their own gatherers), at the same profile\'s setup. chain is the share of its full pace the level runs at: the chain\'s heroes over the heroes it needs, each doing its share of everything in turn, at most 1. guild is the hero-hours the level takes: its hours times the chain\'s heroes at work, the lesser of what it needs and what it has.',
    'A stage\'s minutes are the later of its slowest entry\'s arrival and the time the guild\'s heroes take to put in all the work planned for it and the stages before (workMinutes, from heroMinutes of hero time: each level and each price once); pathMinutes is the slowest entry\'s path with every skill levelled side by side, and byWork says the heroes set it. An entry\'s arrival is likewise the later of its path and its own path\'s work.',
    'layouts times each skill\'s days to 99 at both layouts (a camp working the sparse or the dense layout\'s nodes, a Ledger setting; the pace and everything else here is the timed one) and warns where they differ past the tolerance; nodes lists the nodes the dense layout makes past the tolerance more of (the layout check).',
    'site (per entry with a work, at opt and typ) is the buildings its profile stands round the work in its site\'s places (BALANCE_RULES section 5: room for sitePlaces.buildings, at most sitePlaces.perKind boosting one kind), each with its copies and the kinds it boosts, and the camp it works from with the nodes that hands it.',
    'Levels above the highest level any entry asks (pastTop) are worked at the best work open by the last stage; their best work is not named, and their guild time and gatherers keep the last named level\'s.',
    'An entry\'s numbers (xp, seconds, inputs, makes) are its work\'s own at Bare: one action, before boosts. Items have no work of their own: see via for the work that first gives them.',
    'Arrivals (arriveOpt, arriveTyp) are minutes from a new game along the ledger\'s path; null when never reached, and for Planned entries (the ledger times nothing Planned).',
    'The solver\'s curve is its own dials; curve here is the CMS pace rule (Ledger settings) at that level, and the stages\' budgets follow from it.',
    'boostBudget lists the budget\'s cells by tier and, under over, every total a profile holds over its cell (the boost-budget check).',
]);

const finite = (n) => (Number.isFinite(n) ? n : null);
const minutes = (hours) => (Number.isFinite(hours) ? round(hours * 60, 3) : null);
const round = (n, places = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** places) / 10 ** places : null);

/** One skill's pace, levels 1 to 98 (the time to the next level), with the solver's keys. */
function skillPace(pace, skill) {
    const track = pace.trackOf(skill);
    const levels = [];
    const reach = { opt: 0, typ: 0, bare: 0, guild: 0, guildTyp: 0, guildBare: 0 };
    // The last named level's staffing, which the levels past the top keep.
    const last = Object.fromEntries(Object.keys(READOUT_PROFILES).map((who) => [who, { gatherers: 0, brewers: 0, chain: 1, atWork: 1 }]));
    const staff = new Map();
    const staffingOf = (src, as, cap) => {
        if (!src?.work) return null;
        const profile = src.profile ?? as;
        const key = `${src.work.key}|${profile}|${cap}|${src.at ?? ''}`;
        if (!staff.has(key)) staff.set(key, pace.staffingOf(src.work.target, profile, cap, src.at ?? null));
        return staff.get(key);
    };
    const before = { opt: 0, typ: 0, bare: 0 };
    for (let L = 1; L < MAX_SKILL_LEVEL; L++) {
        const row = track.levels[L - 1] || null;
        const out = { L, curve: round(minutesPerLevelAt(pace.settings, L), 3) };
        const best = {};
        const gatherers = {};
        const brewers = {};
        const chain = {};
        for (const [who, profile] of Object.entries(READOUT_PROFILES)) {
            let hours;
            if (row) {
                hours = row.hours[profile];
                const src = row.source[profile];
                best[who] = src?.work ? pace.workName(src.work) : null;
                const s = staffingOf(src, profile, row.tier);
                if (s) last[who] = { gatherers: s.gatherers, brewers: s.brewers, chain: s.scale, atWork: Math.min(s.need, s.have) };
            } else {
                const to = pace.hoursToLevel(skill, L + 1, profile);
                hours = to - before[who];
                best[who] = null;
            }
            before[who] += Number.isFinite(hours) ? hours : Infinity;
            // The level's hero-hours: its chain's heroes at work all the while, as the pace counts them.
            const work = row ? row.work[profile] : hours * last[who].atWork;
            out[who] = minutes(hours);
            out[GUILD_KEY[who]] = minutes(work);
            gatherers[who] = round(last[who].gatherers, 3);
            brewers[who] = round(last[who].brewers, 3);
            chain[who] = round(last[who].chain, 4);
            reach[who] += Number.isFinite(hours) ? hours : Infinity;
            reach[GUILD_KEY[who]] += Number.isFinite(work) ? work : Infinity;
        }
        out.best = best;
        out.gatherers = gatherers;
        out.brewers = brewers;
        out.chain = chain;
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
        days: { ...Object.fromEntries(Object.entries(reach).map(([k, v]) => [k, days(v)])), curve: round(curveTotal / 1440, 2) },
    };
}

/**
 * The boost budget as the ledger holds it: the cells at each tier's opening (`settings.boostBudget`,
 * with the level each opens at), the speed cap, and every total a profile holds over its cell
 * (`pace.budgetRows`), the most over first.
 */
function budgetOf(pace) {
    const s = pace.settings;
    const tiers = s.boostBudget.map((row) => {
        const level = s.tierLevels.find((p) => p.tier === row.tier)?.level ?? null;
        return { tier: row.tier, label: tierLabel(row.tier), level, ...boostBudgetAt(s, level ?? 1) };
    });
    const over = pace.budgetRows()
        .filter((r) => r.pct > r.budget + 0.5)
        .sort((a, b) => (b.pct - b.budget) - (a.pct - a.budget))
        .map((r) => ({ entry: r.entry, work: pace.workName(r.work), tier: r.tier, entryTier: r.entryTier, level: r.level, profile: r.profile, kind: r.kind, pct: round(r.pct, 1), budget: round(r.budget, 1) }));
    return { tiers, speedCapPct: s.speedCapPct, over };
}

/** The reference guild's heroes by stage, each with when it arrives and leaves on the curve, and the heroes one chain has there. */
function heroesOf(pace) {
    return pace.heroSpans().map((s) => ({
        tier: s.tier, label: tierLabel(s.tier), heroes: s.heroes, chainHeroes: round(chainHeroesAt(pace.settings, s.tier), 3),
        fromMinutes: minutes(s.from), toMinutes: minutes(s.to),
    }));
}

/** Both layouts' days to 99 per skill, with the warnings, and the nodes the dense layout makes past the tolerance more of. */
function layoutsOf(pace) {
    const spread = pace.layoutSpread();
    const days = (d) => Object.fromEntries(Object.entries(READOUT_PROFILES).map(([who, profile]) => [who, Number.isFinite(d[profile]) ? round(d[profile], 2) : null]));
    const skills = {};
    for (const s of spread.skills) {
        if (s.skill === COMBAT) continue;
        skills[s.skill] = { sparse: days(s.days.sparse), dense: days(s.days.dense), offPct: round(s.off * 100, 1), warn: s.warn };
    }
    const nodes = pace.layoutRows().map((r) => ({
        entry: r.work.entry, work: pace.workName(r.work), camp: r.camp, sparse: round(r.sparse, 2), dense: round(r.dense, 2), offPct: round(r.off * 100, 1),
    }));
    return { timed: spread.timed, other: spread.other, nodes: spread.nodes, tolerancePct: pace.settings.tolerancePct, skills, warnings: Object.keys(skills).filter((k) => skills[k].warn), nodesOff: nodes };
}

/** The buildings a profile stands round a work in its site's places, named. */
function siteText(pace, report, target, profile) {
    const site = pace.siteOf(target, profile);
    if (!site) return null;
    const name = (id) => report.ledger.world.names.get(`token:${id}`) ?? id;
    return {
        places: site.places, room: site.room, byKind: site.byKind,
        buildings: site.buildings.map((b) => ({ id: b.id, name: name(b.id), count: b.count, kinds: b.kinds })),
        camp: site.camp ? { ...site.camp, name: name(site.camp.id) } : null,
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
        const path = {};
        for (const [who, profile] of Object.entries(ARRIVAL_PROFILES)) {
            const a = planned ? null : pace.arrivalOf(key, profile);
            arrive[who] = a ? minutes(a.hours) : null;
            path[who] = a ? minutes(a.pathHours) : null;
        }
        const site = works.length ? { opt: siteText(pace, r, works[0].target, PROFILE.MAXED), typ: siteText(pace, r, works[0].target, PROFILE.TYPICAL) } : null;
        rows.push({
            key, id: entry.id, name: entry.name, kind: entry.kind, status: entry.status, planned,
            tier: entry.tier ?? (Number.isInteger(at?.tier) ? at.tier : null),
            reachTier: Number.isInteger(at?.tier) ? at.tier : null,
            skill: numbers?.skill ?? gate.skill, level: numbers?.level ?? gate.level,
            work: numbers?.work ?? null, xp: numbers?.xp ?? null, seconds: numbers?.seconds ?? null,
            inputs: numbers?.inputs ?? [], makes: numbers?.makes ?? [],
            ...(numbers && !numbers.ok ? { workWhy: numbers.why ?? 'its work cannot run' } : {}),
            via: at?.via ?? at?.rule?.via ?? null, how: at?.how ?? at?.rule?.how ?? null,
            arriveOpt: arrive.opt, arriveTyp: arrive.typ, pathOpt: path.opt, pathTyp: path.typ,
            ...(site ? { site } : {}),
            ...(planned ? { why: 'planned' } : arrive.typ === null ? { why: at ? 'never reached' : 'not in the ledger' } : {}),
        });
    }

    const stages = pace.settings.stages.map((s) => {
        const stage = pace.stageOf(s.tier);
        const work = stage.entries ? pace.workOfStage(s.tier) : null;
        return {
            tier: s.tier, label: tierLabel(s.tier), profile: stage.profile, entries: stage.entries,
            minutes: stage.entries ? minutes(finite(stage.hours) ?? Infinity) : null, untimed: stage.untimed.length, budgetMinutes: round(s.budgetMinutes, 3), endsAt: s.endsAt,
            heroes: stage.heroes,
            ...(work ? {
                pathMinutes: minutes(stage.pathHours), workMinutes: minutes(stage.workHours), heroMinutes: minutes(stage.heroHours), byWork: stage.byWork,
                levels: work.levels, levelHeroMinutes: minutes(work.levelHeroHours), stepHeroMinutes: minutes(work.stepHeroHours),
            } : {}),
        };
    });
    const nameOf = (key) => (key ? ledger.world.names.get(key) ?? parseKey(key).id : null);
    const checks = findings.map((f) => ({ check: f.check, key: f.key ?? null, name: f.name ?? nameOf(f.key), severity: f.severity, message: f.message }));

    return {
        format: READOUT_FORMAT, version: READOUT_VERSION,
        profiles: { ...READOUT_PROFILES },
        units: { levelTimes: 'minutes', days: 'days (24 hero-hours)', arrive: 'minutes', seconds: 'seconds an action', xp: 'XP an action', heroMinutes: 'minutes of one hero\'s work' },
        notes: [...NOTES],
        guild: {
            heroes: heroesOf(pace), gatherersPerMaker: pace.settings.gatherersPerMaker, layout: pace.settings.layout, layoutNodes: { ...pace.settings.layouts },
            sitePlaces: { ...pace.settings.sitePlaces },
        },
        pace: skills,
        rows,
        stages,
        layouts: layoutsOf(pace),
        boostBudget: budgetOf(pace),
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
    lines.push(`Skill | days to 99 opt (Maxed) | typ (Typical) | bare (Bare) | guild opt | curve | highest level asked`);
    for (const [skill, p] of Object.entries(out.pace).sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`${skill} ${p.days.opt ?? 'never'} ${p.days.typ ?? 'never'} ${p.days.bare ?? 'never'} ${p.days.guild ?? 'never'} ${p.days.curve} ${p.top}`);
    }
    lines.push('', 'Stage | Maxed time | budget | entries (untimed) | heroes | path side by side | the heroes\' work');
    for (const s of out.stages) {
        const heroes = s.workMinutes !== undefined ? ` | ${s.heroes} | ${fmtMin(s.pathMinutes)} | ${fmtMin(s.workMinutes)}${s.byWork ? ' (sets it)' : ''}` : ` | ${s.heroes}`;
        lines.push(`${s.label} ${fmtMin(s.minutes)} ${fmtMin(s.budgetMinutes)} ${s.entries} (${s.untimed})${heroes}`);
    }
    const l = out.layouts;
    if (l) {
        lines.push('', `Layouts: a camp works ${l.nodes.sparse} nodes (sparse) or ${l.nodes.dense} (dense); timed ${l.timed}. Days to 99 opt sparse | dense:`);
        for (const [skill, x] of Object.entries(l.skills).sort(([a], [b]) => a.localeCompare(b))) {
            lines.push(`${skill} ${x.sparse.opt ?? 'never'} | ${x.dense.opt ?? 'never'}${x.warn ? `  differ ${x.offPct} % (past ±${l.tolerancePct} %)` : ''}`);
        }
        if (l.nodesOff.length) lines.push(`${l.nodesOff.length} node${l.nodesOff.length === 1 ? '' : 's'} make past the tolerance more in the dense layout (the layout check).`);
    }
    const over = out.boostBudget?.over || [];
    if (over.length) lines.push('', `Boost budget: ${over.length} total${over.length === 1 ? '' : 's'} over a cell (${[...new Set(over.map((o) => `${o.kind} at ${o.profile}`))].join(', ')}).`);
    const sev = Object.entries(out.counts.bySeverity).map(([k, n]) => `${n} ${k}`).join(', ') || 'none';
    lines.push('', `${out.counts.rows} entries (${out.counts.planned} Planned, marked), ${out.counts.checks} checks: ${sev}.`);
    return lines;
}
