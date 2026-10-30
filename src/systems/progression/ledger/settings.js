// the progression ledger's settings: stage budgets, the tolerance, the target player, the pace curve

import { PLAN_TIERS, tierBudgetMs, tierOrNull } from './plan.js';

/**
 * What the owner sets once for the whole ledger, kept with the plan in `cms/plan/plan.json`:
 *
 *     {
 *       stages: [{ tier, budgetMinutes }],          // time from a new game to the end of each stage
 *       tolerancePct: 25,                            // a stage is red beyond this, either way
 *       player: { checkInMinMinutes, checkInMaxMinutes, overnightHours },
 *       paceCurve: [{ level, minutesPerLevel }],     // the target time one level takes, at a few levels
 *       wallFactor: 2,                               // a wall is a wait over this many times the curve
 *       profileBounds: 3,                            // Bare and Maxed stay within this many times the curve
 *       boostTargets: { support: [{ tier, pct }], … }, // how strong each kind of boost should be, by tier
 *       campMembers: 3,                              // copies of a vein or Field a camp hands one hero
 *       paybackHours: 2,                             // a sensible investor's boost pays for itself within this
 *       rulesVersion: 'classless-one-job'            // which roster rules the pace follows
 *     }
 *
 * Times are in minutes so the file reads plainly; later phases convert with the helpers below.
 * The ledger's pace (`pace.js`) reads these; nothing in the game does.
 *
 * ⚠️ The CMS, its server and its Node tools import this file, so it stays free of game state.
 */

const MINUTE = 60 * 1000;

/** The roster rules the pretend player can follow. */
export const RULES_VERSIONS = Object.freeze([
    Object.freeze({ id: 'classless-one-job', label: 'Classless heroes, one job each (briefs 260 and 270)' }),
    Object.freeze({ id: 'today', label: 'The game as it is today' }),
]);

/** The owner's starting stages: the budgets in `plan.js`, as minutes. */
const DEFAULT_STAGES = PLAN_TIERS
    .filter((tier) => tierBudgetMs(tier) !== null)
    .map((tier) => ({ tier, budgetMinutes: tierBudgetMs(tier) / MINUTE }));

/** The owner's points (2026-10-30): a few minutes a level at first, a day at 60, three days at 99. */
const DEFAULT_PACE_CURVE = [
    { level: 1, minutesPerLevel: 3 },
    { level: 10, minutesPerLevel: 8 },
    { level: 20, minutesPerLevel: 30 },
    { level: 40, minutesPerLevel: 3 * 60 },
    { level: 60, minutesPerLevel: 24 * 60 },
    { level: 99, minutesPerLevel: 3 * 24 * 60 },
];

/** The kinds of boost a target can be set for, with their words. */
export const BOOST_TARGET_KINDS = Object.freeze([
    Object.freeze({ id: 'support', label: 'Buildings' }),
    Object.freeze({ id: 'consumable', label: 'Consumables' }),
    Object.freeze({ id: 'tool', label: 'Tools' }),
    Object.freeze({ id: 'gear', label: 'Gear' }),
    Object.freeze({ id: 'hall', label: 'Guild Hall' }),
]);

/**
 * The owner's examples (2026-10-29): buildings up to +30 %, consumables +20 %, the Hall up to +100 %
 * late. The Hall's climb by plane is a placeholder; tools and gear have no target until set.
 */
const DEFAULT_BOOST_TARGETS = {
    support: [{ tier: 0, pct: 30 }],
    consumable: [{ tier: 0, pct: 20 }],
    hall: [{ tier: 1, pct: 10 }, { tier: 2, pct: 25 }, { tier: 3, pct: 50 }, { tier: 4, pct: 100 }],
};

export const DEFAULT_LEDGER_SETTINGS = Object.freeze({
    stages: DEFAULT_STAGES,
    tolerancePct: 25,
    player: { checkInMinMinutes: 30, checkInMaxMinutes: 60, overnightHours: 8 },
    paceCurve: DEFAULT_PACE_CURVE,
    wallFactor: 2,
    profileBounds: 3,
    boostTargets: DEFAULT_BOOST_TARGETS,
    campMembers: 3,
    paybackHours: 2,
    rulesVersion: RULES_VERSIONS[0].id,
});

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const positive = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Settings with every field present and sane: anything missing or unreadable falls back to its
 * default, stages are one per tier in tier order, curve points one per level in level order.
 * Fields this file does not know are kept, for later phases.
 */
export function settingsOf(raw) {
    const src = isObject(raw) ? raw : {};
    const d = DEFAULT_LEDGER_SETTINGS;

    const stageByTier = new Map();
    for (const s of Array.isArray(src.stages) ? src.stages : []) {
        const tier = tierOrNull(s?.tier);
        const budget = Number(s?.budgetMinutes);
        if (tier !== null && Number.isFinite(budget) && budget > 0) stageByTier.set(tier, { ...s, tier, budgetMinutes: budget });
    }
    const stages = Array.isArray(src.stages)
        ? [...stageByTier.values()].sort((a, b) => a.tier - b.tier)
        : clone(d.stages);

    const pointByLevel = new Map();
    for (const p of Array.isArray(src.paceCurve) ? src.paceCurve : []) {
        const level = Number(p?.level);
        const minutes = Number(p?.minutesPerLevel);
        if (Number.isInteger(level) && level >= 1 && Number.isFinite(minutes) && minutes > 0) pointByLevel.set(level, { ...p, level, minutesPerLevel: minutes });
    }
    const paceCurve = Array.isArray(src.paceCurve)
        ? [...pointByLevel.values()].sort((a, b) => a.level - b.level)
        : clone(d.paceCurve);

    const player = isObject(src.player) ? src.player : {};
    const checkInMin = positive(player.checkInMinMinutes, d.player.checkInMinMinutes);
    const checkInMax = Math.max(checkInMin, positive(player.checkInMaxMinutes, d.player.checkInMaxMinutes));
    const overnight = Number(player.overnightHours);

    return {
        ...src,
        stages,
        tolerancePct: Number.isFinite(Number(src.tolerancePct)) && Number(src.tolerancePct) >= 0 ? Number(src.tolerancePct) : d.tolerancePct,
        player: {
            ...player,
            checkInMinMinutes: checkInMin,
            checkInMaxMinutes: checkInMax,
            overnightHours: Number.isFinite(overnight) && overnight >= 0 ? overnight : d.player.overnightHours,
        },
        paceCurve,
        wallFactor: positive(src.wallFactor, d.wallFactor),
        profileBounds: Math.max(1, positive(src.profileBounds, d.profileBounds)),
        boostTargets: boostTargetsOf(src.boostTargets),
        campMembers: Math.max(1, Math.floor(positive(src.campMembers, d.campMembers))),
        paybackHours: positive(src.paybackHours, d.paybackHours),
        rulesVersion: RULES_VERSIONS.some((r) => r.id === src.rulesVersion) ? src.rulesVersion : d.rulesVersion,
    };
}

/** Boost targets: per kind, points one per tier in tier order, each a whole tier and a percent from 0. */
function boostTargetsOf(raw) {
    if (!isObject(raw)) return clone(DEFAULT_BOOST_TARGETS);
    const out = {};
    for (const { id } of BOOST_TARGET_KINDS) {
        const byTier = new Map();
        for (const p of Array.isArray(raw[id]) ? raw[id] : []) {
            const tier = tierOrNull(p?.tier);
            const pct = Number(p?.pct);
            if (tier !== null && Number.isFinite(pct) && pct >= 0) byTier.set(tier, { tier, pct });
        }
        if (byTier.size) out[id] = [...byTier.values()].sort((a, b) => a.tier - b.tier);
    }
    return out;
}

/** A stage's budget in milliseconds from the settings, or null when it has none. */
export function stageBudgetMs(settings, tier) {
    const t = tierOrNull(tier);
    const stage = settingsOf(settings).stages.find((s) => s.tier === t);
    return stage ? stage.budgetMinutes * MINUTE : null;
}

/**
 * The curve's target minutes for one level at `level`, between two points by a constant ratio
 * (time per level grows by a steady factor, as an XP curve does); flat beyond the ends. Null with
 * no points.
 */
export function minutesPerLevelAt(settings, level) {
    const points = settingsOf(settings).paceCurve;
    if (!points.length) return null;
    if (level <= points[0].level) return points[0].minutesPerLevel;
    const last = points[points.length - 1];
    if (level >= last.level) return last.minutesPerLevel;
    const at = points.findIndex((p) => p.level >= level);
    const a = points[at - 1];
    const b = points[at];
    const f = (level - a.level) / (b.level - a.level);
    return a.minutesPerLevel * (b.minutesPerLevel / a.minutesPerLevel) ** f;
}

/** The curve's target minutes from level 1 to `level`: the sum of each step's time. */
export function minutesToReach(settings, level) {
    let total = 0;
    for (let l = 1; l < level; l++) total += minutesPerLevelAt(settings, l) ?? 0;
    return total;
}

/** The level the curve has a player at after `minutes` of play: the highest it reaches by then. */
export function levelAtMinutes(settings, minutes) {
    let level = 1;
    let total = 0;
    for (; level < 99; level++) {
        const next = total + (minutesPerLevelAt(settings, level) ?? Infinity);
        if (next > minutes) break;
        total = next;
    }
    return level;
}

/** A length of minutes in words: "45 min", "1 h 30 min", "2 d 4 h". */
export function formatMinutes(minutes) {
    if (!Number.isFinite(minutes)) return '—';
    const m = Math.round(minutes);
    if (m < 60) return `${m} min`;
    const d = Math.floor(m / 1440);
    const h = Math.floor((m % 1440) / 60);
    const rest = m % 60;
    if (d > 0) return h ? `${d} d ${h} h` : `${d} d`;
    return rest ? `${h} h ${rest} min` : `${h} h`;
}
