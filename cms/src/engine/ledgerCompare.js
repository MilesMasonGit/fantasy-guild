import { PACE_TEXT } from '../../../src/systems/progression/ledger/pace.js';
import { tierLabel } from '../../../src/systems/progression/ledger/plan.js';
import { timelineOf } from './ledgerTimeline.js';

/**
 * Before and after: what a change does to the ledger. A **snapshot** is the part of a report the
 * comparison needs (every entry's first reach on the timeline, each stage's time, the findings),
 * plain data so it crosses to and from a Web Worker and into a pack's `gate` record. Two snapshots
 * compare into the entries that moved, the stages that moved, and the checks turned red or green.
 * Pure.
 */

/** An entry has moved when its first reach shifts by at least this many hours (half a minute)… */
export const MOVE_MIN_HOURS = 0.5 / 60;
/** …and by at least this fraction of its time. */
export const MOVE_MIN_RATIO = 0.02;
/** The time floor the distance is measured from, so an entry at the very start still has a distance. */
const FLOOR_HOURS = 1 / 60;

const finiteOrNull = (h) => (Number.isFinite(h) ? h : null);

/**
 * The comparable part of a `workspaceReport`.
 * @returns {{ at: number, tolerancePct: number, stages: object[], dots: object, findings: object[] }}
 *   `dots` by entry key: `{ name, kind, lane, hours, level }`; `stages` `[{ tier, label, entries,
 *   hours, untimed, budgetHours }]`, `hours` null when not timed.
 */
export function snapshotOf(report, { at = Date.now() } = {}) {
    const { pace, ledger, findings = [] } = report;
    const dots = {};
    let stages = [];
    let tolerancePct = 25;
    if (pace) {
        const timeline = timelineOf(pace, ledger, { findings });
        for (const lane of timeline.lanes) {
            for (const d of lane.dots) dots[d.key] = { name: d.name, kind: d.kind, lane: lane.id, hours: d.hours, level: d.level };
        }
        tolerancePct = pace.settings.tolerancePct;
        stages = pace.settings.stages.map((s) => {
            const stage = pace.stageOf(s.tier);
            return {
                tier: s.tier, label: tierLabel(s.tier), entries: stage.entries,
                hours: stage.entries ? finiteOrNull(stage.hours) : null, untimed: stage.untimed.length,
                budgetHours: s.budgetMinutes / 60,
            };
        });
    }
    const nameOf = (key) => ledger?.world?.names?.get(key) ?? null;
    return {
        at, tolerancePct, stages, dots,
        findings: findings.map((f) => ({ check: f.check, key: f.key, severity: f.severity, message: f.message, name: f.name ?? nameOf(f.key) })),
    };
}

/** How far apart two times are, as the log of their ratio (from a one-minute floor). */
export function distanceOf(fromHours, toHours) {
    return Math.abs(Math.log((toHours + FLOOR_HOURS) / (fromHours + FLOOR_HOURS)));
}

const findingId = (f) => `${f.check}|${f.key}|${f.severity}`;

/** The findings in `b` beyond those in `a`, counted by check, entry and severity (messages carry numbers that move with every edit). */
function findingsBeyond(a, b) {
    const counts = new Map();
    for (const f of a) counts.set(findingId(f), (counts.get(findingId(f)) || 0) + 1);
    const out = [];
    for (const f of b) {
        const n = counts.get(findingId(f)) || 0;
        if (n > 0) counts.set(findingId(f), n - 1);
        else out.push(f);
    }
    return out;
}

/**
 * A stage's move: `beyond` when it moved by more than the tolerance either way. ⚠️ A stage time is
 * its slowest timed entry, so when entries lose their time (`lost`) and the time drops, the drop is
 * those entries falling out, not the stage getting faster: it reads as slower.
 */
function stageMove(before, after, tolerancePct) {
    const b = before.hours;
    const a = after.hours;
    const lost = after.untimed > before.untimed;
    let pct = null;
    if (b !== null && a !== null) pct = (a - b) / Math.max(b, FLOOR_HOURS);
    else if (b === null && a !== null) pct = -Infinity;
    else if (b !== null && a === null) pct = Infinity;
    if (Number.isFinite(pct) && Math.abs(pct) < 0.005) pct = 0;
    const beyond = pct !== null && Math.abs(pct) * 100 > tolerancePct;
    const direction = pct > 0 || (lost && pct < 0) ? 'slower' : pct < 0 ? 'faster' : null;
    return { pct, beyond, direction, lost };
}

/**
 * What changed from `before` to `after`.
 * @returns {{ tolerancePct, stages, moved, added, cleared }}
 *   `stages` `[{ tier, label, before, after, budgetHours, pct, beyond, direction, lost, untimedBefore, untimedAfter }]`
 *   for each stage with entries on either side; `moved` `[{ key, name, kind, change, from, to, distance }]`
 *   (`change` 'earlier' | 'later' | 'lane' | 'new' | 'gone'; `from`/`to` `{ lane, hours, level }` or
 *   null), furthest first, new and gone first of all; `added` and `cleared` the findings turned on
 *   and off.
 */
export function compareSnapshots(before, after) {
    const tolerancePct = after.tolerancePct ?? before.tolerancePct ?? 25;

    const stages = [];
    const beforeStages = new Map(before.stages.map((s) => [s.tier, s]));
    for (const s of after.stages) {
        const was = beforeStages.get(s.tier);
        // A stage gaining its first entries, or losing its last, has no time to move from or to.
        if (!was || !was.entries || !s.entries) continue;
        const move = stageMove(was, s, tolerancePct);
        stages.push({
            tier: s.tier, label: s.label, before: was.hours, after: s.hours, budgetHours: s.budgetHours,
            untimedBefore: was.untimed, untimedAfter: s.untimed, ...move,
        });
    }

    const moved = [];
    const keys = new Set([...Object.keys(before.dots), ...Object.keys(after.dots)]);
    for (const key of keys) {
        const from = before.dots[key] || null;
        const to = after.dots[key] || null;
        const where = (d) => (d ? { lane: d.lane, hours: d.hours, level: d.level } : null);
        const base = { key, name: (to || from).name, kind: (to || from).kind, from: where(from), to: where(to) };
        if (!from) { moved.push({ ...base, change: 'new', distance: Infinity }); continue; }
        if (!to) { moved.push({ ...base, change: 'gone', distance: Infinity }); continue; }
        const shift = to.hours - from.hours;
        const far = Math.abs(shift) >= MOVE_MIN_HOURS && Math.abs(shift) >= MOVE_MIN_RATIO * Math.max(from.hours, to.hours);
        if (far) moved.push({ ...base, change: shift > 0 ? 'later' : 'earlier', distance: distanceOf(from.hours, to.hours) });
        else if (from.lane !== to.lane || from.level !== to.level) moved.push({ ...base, change: 'lane', distance: 0 });
    }
    moved.sort((a, b) => b.distance - a.distance || a.name.localeCompare(b.name));

    return {
        tolerancePct, stages, moved,
        added: findingsBeyond(before.findings, after.findings),
        cleared: findingsBeyond(after.findings, before.findings),
    };
}

/** Whether a comparison found anything at all. */
export function hasChanges(diff) {
    return !!diff && (diff.moved.length > 0 || diff.added.length > 0 || diff.cleared.length > 0 || diff.stages.some((s) => s.pct || s.lost));
}

/** One moved entry in words: "1 h 20 min → 45 min (earlier)". */
export function moveText(m) {
    const h = (d) => PACE_TEXT.hours(d.hours);
    if (m.change === 'new') return `now first had at ${h(m.to)}`;
    if (m.change === 'gone') return `was first had at ${h(m.from)}; now never reached`;
    if (m.change === 'lane') return `same time (${h(m.to)}), now at ${m.to.level ? `level ${m.to.level}` : 'no level'} in ${m.to.lane}`;
    return `${h(m.from)} → ${h(m.to)} (${m.change})`;
}

/** A stage's move in words: "Plane 1: 3 h → 1 h 10 min, 61 % faster". */
export function stageMoveText(s) {
    const h = (x) => (x === null ? 'not timed' : PACE_TEXT.hours(x));
    let how = 'no change';
    if (s.pct === Infinity) how = 'now never done';
    else if (s.pct === -Infinity) how = 'now done';
    else if (s.pct) how = `${Math.round(Math.abs(s.pct) * 100)} % ${s.pct > 0 ? 'slower' : 'faster'}`;
    const lost = s.lost ? `; ${s.untimedAfter - s.untimedBefore} more entr${s.untimedAfter - s.untimedBefore === 1 ? 'y' : 'ies'} with no time` : '';
    return `${s.label}: ${h(s.before)} → ${h(s.after)}, ${how}${lost}`;
}
