// the progression ledger's settings: the pace rule and the stage budgets it sets, the tolerance, the target player, the boost budget

import { PLAN_TIER_LEVELS, tierOrNull, tierLevelsOf, tierLevelAt } from '../../../../src/systems/progression/ledger/plan.js';

/**
 * What the owner sets once for the whole ledger, kept with the plan in `cms/plan/plan.json`:
 *
 *     {
 *       paceRule: { startMinutes, stepPct, minPct, maxPct }, // level 1's minutes, each level stepPct longer, within the range
 *       tierLevels: [{ tier, level }],               // the level each tier opens at (the ladder)
 *       tolerancePct: 25,                            // a stage is red beyond this, either way
 *       player: { checkInMinMinutes, checkInMaxMinutes, overnightHours },
 *       wallFactor: 2,                               // a wall is a wait over this many times the curve
 *       profileBounds: { typical, bare, maxed },     // Typical and Bare at most this many times slower than the curve, Maxed faster
 *       boostTargets: { support: [{ tier, pct }], … }, // how strong each kind of boost should be, by tier
 *       boostBudget: [{ tier, speed, xp, yield, rare }], // what Typical and Maxed hold at each tier's opening, in percent
 *       speedCapPct: 65,                             // no speed cut past this at Maxed
 *       heroesByTier: [{ tier, heroes }],            // the reference guild's heroes from a stage on: one at copper to eight
 *       gatherersPerMaker: 2.2,                      // a full chain is one maker and this many gatherers: a chain's heroes at most
 *       layouts: { sparse: 2, dense: 4 },            // the nodes a camp works in each layout the pace can time
 *       layout: 'sparse',                            // the layout the pace times (the other is reported beside it)
 *       sitePlaces: { buildings: 8, perKind: 4 },    // building places round a work, and at most this many boosting one kind
 *       paybackHours: 2,                             // a sensible investor's boost pays for itself within this
 *       hallPaybackHours: 24,                        // and a Guild Hall rank within this
 *       steadyFindsPerDay: 1,                        // a rare find on repeatable work this often a day is a steady source
 *       coinCurve: [{ tier, minutes }],              // a coin cost asks one hero's coins earned in this long, from a stage on
 *       rulesVersion: 'classless-one-job'            // which roster rules the pace follows
 *     }
 *
 * Times are in minutes so the file reads plainly; later phases convert with the helpers below.
 * The ledger's pace (`pace.js`) reads these; nothing in the game does. **The stages** (`stages:
 * [{ tier, budgetMinutes, endsAt }]`) are not set by hand: each stage's budget is the pace rule's time
 * from a new game to the level the next tier opens at, the last tier's to 99 (brief 880 L3).
 *
 * ⚠️ The CMS, its server and its Node tools import this file, so it stays free of game state.
 */

const MINUTE = 60 * 1000;

/** The roster rules the pretend player can follow. */
export const RULES_VERSIONS = Object.freeze([
    Object.freeze({ id: 'classless-one-job', label: 'Classless heroes, one job each (briefs 260 and 270)' }),
    Object.freeze({ id: 'today', label: 'The game as it is today' }),
]);

/** The level a stage of the last tier runs to. */
const TOP_LEVEL = 99;

/**
 * The owner's pace rule (BALANCE_RULES section 1, 2026-11-25): 3 minutes at level 1, each level
 * 6.25 % longer, the step kept within the owner's range of 6 to 6.5 %.
 */
const DEFAULT_PACE_RULE = Object.freeze({ startMinutes: 3, stepPct: 6.25, minPct: 6, maxPct: 6.5 });

/**
 * The curve's player is Maxed (owner, 2026-11-07): a typical player lands about 1.45x slower
 * than the curve and one with no boosts at most 3x; Maxed no more than 3x faster.
 */
const DEFAULT_PROFILE_BOUNDS = Object.freeze({ typical: 1.45, bare: 3, maxed: 3 });

/** The kinds of boost the budget counts, with their words. */
export const BOOST_BUDGET_KINDS = Object.freeze([
    Object.freeze({ id: 'speed', label: 'Speed' }),
    Object.freeze({ id: 'xp', label: 'XP' }),
    Object.freeze({ id: 'yield', label: 'Yield' }),
    Object.freeze({ id: 'rare', label: 'Rare finds' }),
]);
const BUDGET_KINDS = BOOST_BUDGET_KINDS.map((k) => k.id);

/**
 * The boost budget (BALANCE_RULES section 5, owner 2026-11-07): what Typical and Maxed hold at the
 * opening of each tier, in percent, by kind: speed (the cut in work or growth time), XP, yield (more
 * of the work's main output a cycle) and rare finds. Copper's row serves tiers 0 and 1.
 */
const DEFAULT_BOOST_BUDGET = Object.freeze([
    [0, [15, 20], [7.5, 10], [2, 27], [0, 100]],
    [2, [22.5, 30], [7.5, 10], [41, 77], [0, 100]],
    [3, [26.25, 35], [11.25, 15], [68, 110], [0, 100]],
    [4, [30, 40], [11.25, 15], [100, 150], [50, 150]],
    [5, [33.75, 45], [15, 20], [138, 197], [50, 150]],
    [6, [37.5, 50], [15, 20], [183, 254], [50, 250]],
    [7, [45, 60], [15, 20], [300, 400], [50, 250]],
].map(([tier, ...cells]) => Object.freeze({
    tier, ...Object.fromEntries(BUDGET_KINDS.map((kind, i) => [kind, Object.freeze({ typical: cells[i][0], maxed: cells[i][1] })])),
})));

/** The kinds of boost a target can be set for, with their words. */
export const BOOST_TARGET_KINDS = Object.freeze([
    Object.freeze({ id: 'support', label: 'Buildings' }),
    Object.freeze({ id: 'consumable', label: 'Consumables' }),
    Object.freeze({ id: 'tool', label: 'Tools' }),
    Object.freeze({ id: 'gear', label: 'Gear' }),
    Object.freeze({ id: 'hall', label: 'Guild Hall' }),
    Object.freeze({ id: 'rareConsumable', label: 'Rare-find potions' }),
    Object.freeze({ id: 'rareSupport', label: 'Rare Finds buildings' }),
]);

/**
 * The owner's examples (2026-10-29): buildings up to +30 %, consumables +20 %, the Hall up to +100 %
 * late. The Hall's climb by plane is a placeholder; tools and gear have no target until set.
 * Rare-find boosts are measured on the finds alone (`pace.js`), by the owner's rule (2026-11-07): a
 * rare-find potion doubles finds, rising to x3 for late potions, and a Rare Finds building adds x1.5.
 * Late is plan tier 6, adamantine, where BALANCE_RULES puts the x3.
 */
const DEFAULT_BOOST_TARGETS = {
    support: [{ tier: 0, pct: 30 }],
    consumable: [{ tier: 0, pct: 20 }],
    hall: [{ tier: 1, pct: 10 }, { tier: 2, pct: 25 }, { tier: 3, pct: 50 }, { tier: 4, pct: 100 }],
    rareConsumable: [{ tier: 0, pct: 100 }, { tier: 6, pct: 200 }],
    rareSupport: [{ tier: 0, pct: 50 }],
};

/**
 * The coin curve (brief 870 C3): from each stage on, the minutes of one hero's coin income a coin
 * cost asks (`pace.coinPrices`). The same minutes everywhere still rise with rank and distance,
 * since a later stage earns more an hour; more minutes further out make them rise faster.
 */
const DEFAULT_COIN_CURVE = [{ tier: 0, minutes: 10 }];

/**
 * The reference guild's heroes (BALANCE_RULES section 8): about one a tier, one
 * at copper (the Starter Camp and Plane 1), two at iron, on to eight at darkmetal, where the two
 * tiers of adamantine's twenty levels bring two.
 */
const DEFAULT_HEROES_BY_TIER = Object.freeze([[0, 1], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 8]]
    .map(([tier, heroes]) => Object.freeze({ tier, heroes })));

/**
 * The layouts a work site is timed at (BALANCE_RULES sections 2 and 8): how many nodes a camp works.
 * Sparse is the rule's own, a camp with two (the rest rule keeps one hero fully busy on two); dense
 * gives the site's four places that are not buildings (its camp, a second node or two, a spawner) to
 * nodes, four with the worked one. Bare has no camp: one node.
 */
export const LAYOUTS = Object.freeze(['sparse', 'dense']);
const DEFAULT_LAYOUTS = Object.freeze({ sparse: 2, dense: 4 });

/**
 * A work site's building places (BALANCE_RULES section 5: Tokens 128 u apart within the
 * 240 u reach, twelve places round a node): about eight for buildings once the camp, the nodes and
 * a spawner stand, and about four of them max one kind of boost, so a site leans one or two ways.
 */
const DEFAULT_SITE_PLACES = Object.freeze({ buildings: 8, perKind: 4 });

export const DEFAULT_LEDGER_SETTINGS = Object.freeze({
    paceRule: DEFAULT_PACE_RULE,
    tierLevels: PLAN_TIER_LEVELS,
    tolerancePct: 25,
    player: { checkInMinMinutes: 30, checkInMaxMinutes: 60, overnightHours: 8 },
    wallFactor: 2,
    profileBounds: DEFAULT_PROFILE_BOUNDS,
    boostTargets: DEFAULT_BOOST_TARGETS,
    boostBudget: DEFAULT_BOOST_BUDGET,
    // The owner (2026-11-07): at most a 65 % cut at Maxed, inside the game's 80 % cap.
    speedCapPct: 65,
    heroesByTier: DEFAULT_HEROES_BY_TIER,
    // The reference guild (BALANCE_RULES section 8, owner 2026-11-25): a chain is one maker and about 2 gatherers at every tier, 2.2 at Typical.
    gatherersPerMaker: 2.2,
    layouts: DEFAULT_LAYOUTS,
    layout: LAYOUTS[0],
    sitePlaces: DEFAULT_SITE_PLACES,
    paybackHours: 2,
    // The owner (2026-10-30): a Guild Hall rank may take about a day to pay for itself.
    hallPaybackHours: 24,
    // The owner (2026-11-07): a low rate on repeatable work is still steady. ⚠️ Matches the engine's STEADY_FINDS_PER_DAY (pinned by a test).
    steadyFindsPerDay: 1,
    // A starting point for the content agent to tune: costs rise with the stage because what a hero earns does.
    coinCurve: DEFAULT_COIN_CURVE,
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
 * default, and the stages follow from the pace rule and the tier levels ({@link stagesOf}). Fields
 * this file does not know are kept, for later phases; the hand budgets and curve points of before
 * (`stages`, `paceCurve`) are dropped, as the rule now sets them, and so is the camp's copies of
 * before (`campMembers`), which the layouts replace.
 */
export function settingsOf(raw) {
    const src = { ...(isObject(raw) ? raw : {}) };
    delete src.stages;
    delete src.paceCurve;
    delete src.campMembers;
    const d = DEFAULT_LEDGER_SETTINGS;

    const player = isObject(src.player) ? src.player : {};
    const checkInMin = positive(player.checkInMinMinutes, d.player.checkInMinMinutes);
    const checkInMax = Math.max(checkInMin, positive(player.checkInMaxMinutes, d.player.checkInMaxMinutes));
    const overnight = Number(player.overnightHours);
    const paceRule = paceRuleOf(src.paceRule);
    const tierLevels = tierLevelsOf(src.tierLevels);

    return {
        ...src,
        paceRule,
        tierLevels,
        stages: stagesOf(paceRule, tierLevels),
        tolerancePct: Number.isFinite(Number(src.tolerancePct)) && Number(src.tolerancePct) >= 0 ? Number(src.tolerancePct) : d.tolerancePct,
        player: {
            ...player,
            checkInMinMinutes: checkInMin,
            checkInMaxMinutes: checkInMax,
            overnightHours: Number.isFinite(overnight) && overnight >= 0 ? overnight : d.player.overnightHours,
        },
        wallFactor: positive(src.wallFactor, d.wallFactor),
        profileBounds: profileBoundsOf(src.profileBounds),
        boostTargets: boostTargetsOf(src.boostTargets),
        boostBudget: boostBudgetOf(src.boostBudget),
        speedCapPct: Math.min(100, positive(src.speedCapPct, d.speedCapPct)),
        heroesByTier: heroesByTierOf(src.heroesByTier),
        gatherersPerMaker: positive(src.gatherersPerMaker, d.gatherersPerMaker),
        layouts: layoutsOf(src.layouts),
        layout: LAYOUTS.includes(src.layout) ? src.layout : d.layout,
        sitePlaces: sitePlacesOf(src.sitePlaces),
        paybackHours: positive(src.paybackHours, d.paybackHours),
        hallPaybackHours: positive(src.hallPaybackHours, d.hallPaybackHours),
        steadyFindsPerDay: positive(src.steadyFindsPerDay, d.steadyFindsPerDay),
        coinCurve: Array.isArray(src.coinCurve) ? coinCurveOf(src.coinCurve) : clone(d.coinCurve),
        rulesVersion: RULES_VERSIONS.some((r) => r.id === src.rulesVersion) ? src.rulesVersion : d.rulesVersion,
    };
}

/** The pace rule with each number sane: the step within its range, the range never upside down. */
function paceRuleOf(raw) {
    const d = DEFAULT_PACE_RULE;
    const src = isObject(raw) ? raw : {};
    const low = Number(src.minPct);
    const minPct = Number.isFinite(low) && low >= 0 ? low : d.minPct;
    const maxPct = Math.max(minPct, positive(src.maxPct, d.maxPct));
    const step = Number(src.stepPct);
    return {
        startMinutes: positive(src.startMinutes, d.startMinutes),
        stepPct: Math.min(maxPct, Math.max(minPct, Number.isFinite(step) ? step : d.stepPct)),
        minPct, maxPct,
    };
}

/** Minutes the rule gives one level (`level` to the next). */
const ruleMinutes = (rule, level) => rule.startMinutes * (1 + rule.stepPct / 100) ** (Math.max(1, level) - 1);
/** Minutes the rule gives from level 1 to `level`: the sum of each step's, a geometric series. */
const ruleReach = (rule, level) => {
    if (!(level > 1)) return 0;
    const g = rule.stepPct / 100;
    return g > 0 ? rule.startMinutes * ((1 + g) ** (level - 1) - 1) / g : rule.startMinutes * (level - 1);
};

/**
 * The stages the rule and the ladder set: one per tier the tier levels name, each done when the curve
 * reaches the level the next higher tier opens at (`endsAt`, 99 for the last), its budget the curve's
 * minutes from a new game to there.
 */
function stagesOf(rule, tierLevels) {
    return tierLevels.map((p, i) => {
        const next = tierLevels.slice(i + 1).find((q) => q.level > p.level);
        const endsAt = next ? next.level : TOP_LEVEL;
        return { tier: p.tier, budgetMinutes: ruleReach(rule, endsAt), endsAt };
    });
}

/** The profile bounds; a single number, as saved before, bounds Bare and Maxed and leaves Typical its default. */
function profileBoundsOf(raw) {
    const d = DEFAULT_PROFILE_BOUNDS;
    if (!isObject(raw)) {
        const n = Number(raw);
        return Number.isFinite(n) && n >= 1 ? { typical: d.typical, bare: n, maxed: n } : { ...d };
    }
    const at = (k) => Math.max(1, positive(raw[k], d[k]));
    return { typical: at('typical'), bare: at('bare'), maxed: at('maxed') };
}

/**
 * The boost budget: rows one per tier in tier order, each cell `{ typical, maxed }` percents from 0
 * (Maxed never under Typical); the owner's table when none is readable.
 */
function boostBudgetOf(raw) {
    const byTier = new Map();
    for (const row of Array.isArray(raw) ? raw : []) {
        const tier = tierOrNull(row?.tier);
        if (tier === null) continue;
        const out = { tier };
        let ok = true;
        for (const kind of BUDGET_KINDS) {
            const typical = Number(row?.[kind]?.typical);
            const maxed = Number(row?.[kind]?.maxed);
            if (!(Number.isFinite(typical) && typical >= 0 && Number.isFinite(maxed) && maxed >= 0)) { ok = false; break; }
            out[kind] = { typical, maxed: Math.max(typical, maxed) };
        }
        if (ok) byTier.set(tier, out);
    }
    return byTier.size ? [...byTier.values()].sort((a, b) => a.tier - b.tier) : clone(DEFAULT_BOOST_BUDGET);
}

/**
 * The boost budget's cell for work at `level`: the row of the tier the level falls in (the tier
 * levels'), speed and XP climbing level by level to the next row's at its tier's opening level, yield
 * and rare finds stepping (owner, 2026-11-25). `{ speed, xp, yield, rare }`, each `{ typical, maxed }`.
 */
export function boostBudgetAt(settings, level) {
    const s = settings?.boostBudget && settings?.tierLevels ? settings : settingsOf(settings);
    const rows = s.boostBudget;
    const levelOf = (tier) => tierLevelAt(s.tierLevels, tier);
    let at = 0;
    for (let i = 0; i < rows.length; i++) if (levelOf(rows[i].tier) <= level) at = i;
    const row = rows[at];
    const next = rows[at + 1];
    const from = levelOf(row.tier);
    const to = next ? levelOf(next.tier) : null;
    const f = next && to > from ? Math.min(1, Math.max(0, (level - from) / (to - from))) : 0;
    const out = {};
    for (const kind of BUDGET_KINDS) {
        const climbs = kind === 'speed' || kind === 'xp';
        out[kind] = {
            typical: row[kind].typical + (climbs && next ? (next[kind].typical - row[kind].typical) * f : 0),
            maxed: row[kind].maxed + (climbs && next ? (next[kind].maxed - row[kind].maxed) * f : 0),
        };
    }
    return out;
}

/**
 * Boost targets: per kind, points one per tier in tier order, each a whole tier and a percent from 0.
 * A kind the saved settings never mention (one added since they were saved) takes its default.
 */
function boostTargetsOf(raw) {
    if (!isObject(raw)) return clone(DEFAULT_BOOST_TARGETS);
    const out = {};
    for (const { id } of BOOST_TARGET_KINDS) {
        if (!(id in raw)) {
            if (DEFAULT_BOOST_TARGETS[id]) out[id] = clone(DEFAULT_BOOST_TARGETS[id]);
            continue;
        }
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

/** The heroes by tier: one point per tier in tier order, each a whole number of heroes from 1; the reference guild's when none is readable. */
function heroesByTierOf(raw) {
    const byTier = new Map();
    for (const p of Array.isArray(raw) ? raw : []) {
        const tier = tierOrNull(p?.tier);
        const heroes = Math.floor(Number(p?.heroes));
        if (tier !== null && heroes >= 1) byTier.set(tier, { tier, heroes });
    }
    return byTier.size ? [...byTier.values()].sort((a, b) => a.tier - b.tier) : clone(DEFAULT_HEROES_BY_TIER);
}

/** The layouts' nodes a camp works, each whole from 1, dense never under sparse. */
function layoutsOf(raw) {
    const src = isObject(raw) ? raw : {};
    const sparse = Math.max(1, Math.floor(positive(src.sparse, DEFAULT_LAYOUTS.sparse)));
    return { sparse, dense: Math.max(sparse, Math.floor(positive(src.dense, DEFAULT_LAYOUTS.dense))) };
}

/** A site's building places and the most of one kind, each whole from 1, the kind's never past the places. */
function sitePlacesOf(raw) {
    const src = isObject(raw) ? raw : {};
    const buildings = Math.max(1, Math.floor(positive(src.buildings, DEFAULT_SITE_PLACES.buildings)));
    return { buildings, perKind: Math.min(buildings, Math.max(1, Math.floor(positive(src.perKind, DEFAULT_SITE_PLACES.perKind)))) };
}

/** The reference guild's heroes at a stage: the last point at or before it, else the first point's. */
export function heroesAt(settings, tier) {
    const points = settings?.heroesByTier && Array.isArray(settings.heroesByTier) ? settings.heroesByTier : settingsOf(settings).heroesByTier;
    let out = points[0]?.heroes ?? 1;
    for (const p of points) if (p.tier <= tier) out = p.heroes;
    return out;
}

/**
 * The heroes one chain has at a stage (BALANCE_RULES section 8): a full chain is one maker and
 * `gatherersPerMaker` gatherers, and a guild with fewer heroes than that runs one chain with them
 * all, each doing everything in turn. Eight heroes so run two or three chains.
 */
export function chainHeroesAt(settings, tier) {
    const s = settings?.heroesByTier && Number.isFinite(settings?.gatherersPerMaker) ? settings : settingsOf(settings);
    return Math.min(heroesAt(s, tier), 1 + s.gatherersPerMaker);
}

/** The coin curve's points, one per tier in tier order, each a whole tier and minutes above 0. */
function coinCurveOf(raw) {
    const byTier = new Map();
    for (const p of raw) {
        const tier = tierOrNull(p?.tier);
        const minutes = Number(p?.minutes);
        if (tier !== null && Number.isFinite(minutes) && minutes > 0) byTier.set(tier, { tier, minutes });
    }
    return [...byTier.values()].sort((a, b) => a.tier - b.tier);
}

/** The coin curve's minutes at a tier: the last point at or before it, else null (no coin cost is proposed there). */
export function coinMinutesAt(settings, tier) {
    let out = null;
    for (const p of settingsOf(settings).coinCurve) if (p.tier <= tier) out = p.minutes;
    return out;
}

/** A stage's budget in milliseconds from the settings, or null when it has none. */
export function stageBudgetMs(settings, tier) {
    const t = tierOrNull(tier);
    const stage = settingsOf(settings).stages.find((s) => s.tier === t);
    return stage ? stage.budgetMinutes * MINUTE : null;
}

/**
 * The curve's target minutes for one level at `level` (the time from it to the next): the pace
 * rule, level 1's minutes grown by the step each level after (BALANCE_RULES section 1).
 */
export function minutesPerLevelAt(settings, level) {
    return ruleMinutes(paceRuleOf(settings?.paceRule), level);
}

/** The curve's target minutes from level 1 to `level`: the sum of each step's time. */
export function minutesToReach(settings, level) {
    return ruleReach(paceRuleOf(settings?.paceRule), level);
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
