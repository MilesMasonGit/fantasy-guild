import { HOW, COMBAT, parseKey, itemKey } from '../../../src/systems/progression/ledger/engine.js';
import { PROFILE, PACE_TEXT } from '../../../src/systems/progression/ledger/pace.js';
import { minutesToReach, minutesPerLevelAt, formatMinutes } from '../../../src/systems/progression/ledger/settings.js';
import { tierLabel } from '../../../src/systems/progression/ledger/plan.js';

/**
 * What the Ledger's timeline draws, read from a pace (`pace.js`): a lane per skill with the level
 * the Typical player has over time and the pace curve beside it, every item and Token at its first
 * reach, the walls with their blocker, the crowded and empty stretches, and the stages. Pure; the
 * component draws it.
 *
 * Times are hours from a new game at Typical, as the pace gives them.
 */

/** A crowded spot: this many first reaches in one lane within one check-in (or one curve level, if longer). */
export const CROWD_MIN = 5;
/** An empty stretch: nothing new in a lane for as long as the curve gives this many levels (and over a check-in). */
export const EMPTY_LEVELS = 10;

/** The lane for entries no skill level gates: the Starter Camp's bank, the Shop, fights, the Guild Hall. */
export const OTHER_LANE = 'other';

/** The skill level an entry's own step asks: its rule's gate, or for a recipe's output the recipe's. */
function gateOf(ledger, at) {
    const own = (at.rule?.gates || []).filter((g) => g.skill !== COMBAT);
    const recipe = at.rule?.how === HOW.CRAFT && at.rule.via ? ledger.reach.get(at.rule.via) : null;
    const gates = own.length ? own : (recipe?.rule?.gates || []).filter((g) => g.skill !== COMBAT);
    if (!gates.length) return null;
    return gates.reduce((a, b) => (b.level > a.level ? b : a));
}

/** The curve's level after `minutes` of play, with the fraction of the next level done. */
export function curveLevelAt(settings, minutes) {
    let level = 1;
    let total = 0;
    for (; level < 99; level++) {
        const step = minutesPerLevelAt(settings, level) ?? Infinity;
        if (total + step > minutes) return level + (minutes - total) / step;
        total += step;
    }
    return 99;
}

/**
 * Crowded spots in one lane's first reaches (hours, sorted): runs of at least `CROWD_MIN` within a
 * window of a check-in or one curve level, whichever is longer. What a new game has from the start
 * is not an arrival and is left out.
 */
export function crowdedOf(times, settings) {
    const t = times.filter((h) => h > 0);
    const out = [];
    for (let i = 0; i < t.length;) {
        const minutes = Math.max(settings.player.checkInMinMinutes, minutesPerLevelAt(settings, Math.floor(curveLevelAt(settings, t[i] * 60))) ?? 0);
        let j = i;
        while (j + 1 < t.length && (t[j + 1] - t[i]) * 60 <= minutes) j++;
        if (j - i + 1 >= CROWD_MIN) {
            out.push({ startHours: t[i], endHours: t[j], count: j - i + 1 });
            i = j + 1;
        } else {
            i++;
        }
    }
    return out;
}

/** Empty stretches between one lane's first reaches (hours, sorted): a gap of `EMPTY_LEVELS` curve levels and over a check-in. */
export function emptyOf(times, settings) {
    const t = times.filter((h) => h > 0);
    const out = [];
    for (let i = 1; i < t.length; i++) {
        const gapMinutes = (t[i] - t[i - 1]) * 60;
        if (gapMinutes <= settings.player.checkInMaxMinutes) continue;
        const levels = curveLevelAt(settings, t[i] * 60) - curveLevelAt(settings, t[i - 1] * 60);
        if (levels >= EMPTY_LEVELS) out.push({ startHours: t[i - 1], endHours: t[i], curveLevels: levels });
    }
    return out;
}

/**
 * The timeline of the whole content.
 *
 * @param {object} pace     `buildPace(...)`
 * @param {object} ledger   the ledger the pace was built from
 * @param {{ tierOf?: (key: string) => number|null, findings?: object[] }} [options]  the tier a dot is
 *   coloured by (the owner's when set); the checks' findings, for the long waits for one unlock
 * @returns {{ lanes, stages, unreached, maxHours }}
 *   lanes: `[{ id, name, top, track, curve, dots, walls, crowded, empty }]`, one per skill with a
 *   level track and one for what no level gates; `track` and `curve` are `[{ level, hours }]` (the
 *   hours a new game first has that level, at Typical and on the curve); `dots` `[{ key, name, kind,
 *   hours, level, tier, wait }]`, `wait` the message of a long wait for that one unlock.
 */
export function timelineOf(pace, ledger, { tierOf = (key) => ledger.reach.get(key)?.tier ?? null, findings = [] } = {}) {
    const { settings } = pace;
    const waits = new Map();
    for (const f of findings) if (f.check === 'unlock-wall') waits.set(f.key, f.message);
    const name = (key) => ledger.world.names.get(key) ?? parseKey(key).id;

    const lanes = new Map();
    const laneOf = (id) => {
        if (!lanes.has(id)) lanes.set(id, { id, name: id === OTHER_LANE ? 'No skill level' : PACE_TEXT.skill(id), dots: [] });
        return lanes.get(id);
    };
    for (const skill of pace.skills()) if (pace.trackOf(skill).top > 1) laneOf(skill);

    let unreached = 0;
    for (const [key, at] of ledger.reach) {
        const { kind } = parseKey(key);
        if (kind !== 'item' && kind !== 'token') continue;
        if (at.planned || !Number.isInteger(at.tier) || !at.rule) { unreached++; continue; }
        const path = pace.pathOf(key, PROFILE.TYPICAL);
        if (!Number.isFinite(path.hours)) { unreached++; continue; }
        const gate = gateOf(ledger, at);
        const lane = laneOf(gate ? gate.skill : OTHER_LANE);
        lane.dots.push({
            key, name: name(key), kind, hours: path.hours, level: gate && lane.id !== OTHER_LANE ? gate.level : null,
            tier: tierOf(key), complete: path.complete, wait: waits.get(key) ?? null,
        });
    }

    const out = [];
    for (const lane of lanes.values()) {
        lane.dots.sort((a, b) => a.hours - b.hours || a.name.localeCompare(b.name));
        const times = lane.dots.map((d) => d.hours);
        if (lane.id === OTHER_LANE) {
            out.push({ ...lane, top: 1, track: [], curve: [], walls: [], crowded: crowdedOf(times, settings), empty: [] });
            continue;
        }
        const track = pace.trackOf(lane.id);
        const points = [{ level: 1, hours: 0 }, ...track.levels.map((r) => ({ level: r.level + 1, hours: r.cumulative.typical }))];
        const curve = points.map((p) => ({ level: p.level, hours: minutesToReach(settings, p.level) / 60 }));
        const walls = pace.walls(lane.id).map((w) => wallOf(pace, w, name));
        out.push({ ...lane, top: track.top, track: points, curve, walls, crowded: crowdedOf(times, settings), empty: emptyOf(times, settings) });
    }
    out.sort((a, b) => (a.id === OTHER_LANE) - (b.id === OTHER_LANE) || a.name.localeCompare(b.name));

    const stages = [];
    for (const s of settings.stages) {
        const stage = pace.stageOf(s.tier);
        if (!stage.entries) continue;
        stages.push({ tier: s.tier, label: tierLabel(s.tier), hours: stage.hours, budgetHours: s.budgetMinutes / 60, complete: stage.complete && !stage.untimed.length });
    }

    const finite = (h) => (Number.isFinite(h) ? h : 0);
    const maxHours = Math.max(
        1 / 60,
        ...out.flatMap((l) => [...l.dots.map((d) => d.hours), ...l.track.map((p) => finite(p.hours)), ...l.curve.map((p) => p.hours)]),
        ...stages.flatMap((s) => [finite(s.hours), s.budgetHours]),
    );
    return { lanes: out, stages, unreached, maxHours };
}

/** A wall as the timeline labels it: the levels, its length against the curve, and what holds it up. */
function wallOf(pace, w, name) {
    const src = w.source?.work;
    const blocker = src
        ? `${pace.workName(src)}, ${Math.round(w.source.xp)} XP/h${w.source.scale < 1 && w.source.short ? `, short of ${name(itemKey(w.source.short))}` : ''}`
        : 'no work gives XP';
    return {
        from: w.from, to: w.to + 1, tier: w.tier, startHours: w.startHours, endHours: w.endHours,
        hours: w.hours, curveMinutes: w.curveTotal, ratio: (w.hours * 60) / w.curveTotal,
        blocker, sourceKey: src ? src.entry : null, waiting: w.waiting,
        label: `Wall ${w.from} → ${w.to + 1}: ${PACE_TEXT.hours(w.hours)} against ${formatMinutes(w.curveTotal)} (${PACE_TEXT.times((w.hours * 60) / w.curveTotal)})`,
    };
}

/** Ticks for a time axis in hours, on a log scale from `lo` to `hi`: `[{ hours, text }]`. */
export function timeTicks(lo, hi) {
    const marks = [1 / 60, 5 / 60, 15 / 60, 0.5, 1, 2, 4, 8, 16, 24, 48, 96, 168, 336, 720, 1440, 2160, 4320];
    return marks.filter((h) => h >= lo * 0.999 && h <= hi * 1.001).map((h) => ({ hours: h, text: formatMinutes(h * 60) }));
}
