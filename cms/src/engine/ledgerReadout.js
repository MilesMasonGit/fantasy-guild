import { workspaceReport } from './ledgerReport.js';
import { ledgerRows } from './ledgerRows.js';
import { liftPlanned } from './ledgerWithPlanned.js';
import { PROFILE, PACE_TEXT } from './ledger/pace.js';
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
export const READOUT_VERSION = 6;

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
    'A stage\'s minutes are its way out (owner, 2026-11-26: leaving a stage means settling the next place), what its budget times (offPct): gate is the soonest of the next stage\'s places, its level in the one or two skills it asks (asks, each by its own hero: levelMinutes) then its settle price (coins, earned from then: priceMinutes), along pathMinutes, and no sooner than the stage\'s heroes can put in that work (heroMinutes at workMinutes; byWork says they set it). needs lists what else settling it needs (the place before, the ring\'s star) at their arrivals, as information. A place\'s goods are the world seed\'s, which the ledger does not hold: the price is its coins, so every way out is a floor while its goods are not counted (floor, with its reasons in floorWhy; a level trained by fights, which are not timed, is another). gateWhy says why a stage has no way out (the last stage; no place of the next tier).',
    'A stage\'s content is its full content, information only and held to no budget: the later of its slowest entry\'s arrival and the time the guild\'s heroes take to put in all the work planned for it and the stages before (workMinutes, from heroMinutes of hero time: each level and each price once); pathMinutes is the slowest entry\'s path with every skill levelled side by side, and byWork says the heroes set it. An entry\'s arrival is likewise the later of its path and its own path\'s work.',
    'layouts times each skill\'s days to 99 at both layouts (a camp working the sparse or the dense layout\'s nodes; a site worked from a spawner, a Forest, an Orchard or a Quarry, the whole allowance of each of the layout\'s layoutSpawners: Ledger settings; the pace and everything else here is the timed one) and warns where they differ past the tolerance; nodesOff lists the nodes the dense layout makes past the tolerance more of (the layout check), with each layout\'s nodes.',
    'site (per entry with a work, at opt and typ) is the buildings its profile stands round the work in its site\'s places (BALANCE_RULES section 5: sitePlaces.places round the node, of which its camp, spawners and nodes, the one worked among them, take taken; room is what they leave, at most sitePlaces.buildings, at most sitePlaces.perKind boosting one kind), each with its copies and the kinds it boosts, and the camp it works from with the nodes that hands it and the spawners they stand for.',
    'Levels above the highest level any entry asks (pastTop) are worked at the best work open by the last stage; their best work is not named, and their guild time and gatherers keep the last named level\'s.',
    'An entry\'s numbers (xp, seconds, inputs, makes) are its work\'s own at Bare: one action, before boosts. Items have no work of their own: see via for the work that first gives them.',
    'Arrivals (arriveOpt, arriveTyp) are minutes from a new game along the ledger\'s path; null when never reached, and for Planned entries (the ledger times nothing Planned).',
    'The solver\'s curve is its own dials; curve here is the CMS pace rule (Ledger settings) at that level, and the stages\' budgets follow from it.',
    'boostBudget lists the budget\'s cells by tier and, under over, every total a profile holds over its cell (the boost-budget check).',
    'ruleChecks holds the three checks the balance rules promise, with the rows behind their findings: chainXp, each chain\'s total XP an hour of the gathering behind it (every link at its authored XP, Bare and no perks, over rawMinutes, the minutes its raw inputs take to gather, each at its Bare source\'s rate, a rare drop at its find rate; a chain ends at an item no station spends) against its tier\'s median (null with fewer than three chains), off past the tolerance and warn beyond chainXpWarnFactor times or under it (the chain-xp check, BALANCE_RULES section 1); batches, each drink and work potion\'s batch payback on the repeatable work it pays back best on at Typical (the work it saves an hour over the hours an hour its doses take to make, ingredients included, at the game\'s dose length: doseCycles), short under factor (the batch-payback check, section 5); finishedRatio is the same dose against the finished Typical setup on that work, information only; hallGuild, each Guild Hall rank\'s payback counting every boosted work the reference guild\'s heroes can work at once, against the payback curve (1 hour x 24^(L / 80) at the level its tier opens at), off past the tolerance either way (the hall-guild-payback check, section 5); unreachable where its price cannot be gathered by its stage (the hall-price-unreachable check), never off.',
    'coins holds the two coin curves (BALANCE_RULES section 7, Ledger settings, minutes of one hero\'s selling from a stage on: everyday for a Shop Token or a Foundation, one level\'s time; big for settling a place or a Guild Hall star, half the payback curve) and every price that asks coins with its curve, its minutes there, the income it is earned at (perHour) and the coins the curve proposes; off marks one beyond the tolerance from it.',
]);

/** The note `--with-planned` adds, in place of none: the plain read-out's notes are left as they are. */
const WITH_PLANNED_NOTE = 'withPlanned: Planned work is timed as if it were live (ledger --with-planned), in this read-out only. Each Planned row keeps planned: true and its Planned status and has its arrival; the pace, the stages, the boost budget and the checks read the Planned entries as live, so a Planned work may set the pace of a level. counts.plannedTimed is how many Planned entries were reached; the rest read never reached.';

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
function layoutsOf(pace, both = true) {
    const nodes = pace.layoutRows().map((r) => ({
        entry: r.work.entry, work: pace.workName(r.work), camp: r.camp, sparse: round(r.sparse, 2), dense: round(r.dense, 2), offPct: round(r.off * 100, 1),
        nodes: { ...r.nodes }, ...(r.spawner ? { spawner: r.spawner, spawners: { ...r.spawners } } : {}),
    }));
    const other = pace.settings.layout === 'sparse' ? 'dense' : 'sparse';
    const base = { timed: pace.settings.layout, other, nodes: { ...pace.settings.layouts }, tolerancePct: pace.settings.tolerancePct, nodesOff: nodes };
    if (!both) return { ...base, skills: null, warnings: null, skipped: true };
    const spread = pace.layoutSpread();
    const days = (d) => Object.fromEntries(Object.entries(READOUT_PROFILES).map(([who, profile]) => [who, Number.isFinite(d[profile]) ? round(d[profile], 2) : null]));
    const skills = {};
    for (const s of spread.skills) {
        if (s.skill === COMBAT) continue;
        skills[s.skill] = { sparse: days(s.days.sparse), dense: days(s.days.dense), offPct: round(s.off * 100, 1), warn: s.warn };
    }
    return { ...base, skills, warnings: Object.keys(skills).filter((k) => skills[k].warn) };
}

/** The buildings a profile stands round a work in its site's places, named. */
function siteText(pace, report, target, profile) {
    const site = pace.siteOf(target, profile);
    if (!site) return null;
    const name = (id) => report.ledger.world.names.get(`token:${id}`) ?? id;
    return {
        places: site.places, room: site.room, taken: site.taken, byKind: site.byKind,
        buildings: site.buildings.map((b) => ({ id: b.id, name: name(b.id), count: b.count, kinds: b.kinds })),
        camp: site.camp ? { ...site.camp, name: name(site.camp.id) } : null,
    };
}

/** A stage's way out (`pace.gateOf`) in the read-out's units, or null when it has none. */
function gateText(g) {
    if (!g.place) return null;
    return {
        place: g.place, name: g.name, ring: g.ring, places: g.places,
        asks: g.asks.map((a) => ({ skill: a.skill, level: a.level, minutes: a.hours === null ? null : minutes(a.hours) })), coins: g.coins,
        minutes: minutes(g.hours), levelMinutes: minutes(g.levelHours), priceMinutes: minutes(g.priceHours), pathMinutes: minutes(g.pathHours),
        workMinutes: minutes(g.workHours), heroMinutes: minutes(g.heroHours), byWork: g.byWork, complete: g.complete,
        floor: g.floor.length > 0, floorWhy: g.floor.map((f) => PACE_TEXT.wayOutFloor[f]),
        needs: g.needs.map((n) => ({ key: n.key, name: n.name, minutes: minutes(n.hours) })),
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
 * The two coin curves (BALANCE_RULES section 7) and every price that asks coins on its curve, with
 * what the curve proposes and whether it is beyond the tolerance from it (as the balancing preview
 * reads it). No price asking coins: no coin income is worked out.
 */
function coinsOf(pace) {
    const curves = { everyday: pace.settings.coinCurve.map((p) => ({ ...p })), big: pace.settings.bigCoinCurve.map((p) => ({ ...p })) };
    if (!pace.asksCoins()) return { curves, prices: [] };
    const tol = pace.settings.tolerancePct / 100;
    const prices = pace.coinPrices().filter((p) => p.coins > 0).map((p) => ({
        kind: p.kind, id: p.id, name: p.name, ...(p.rank ? { rank: p.rank } : {}), ...(p.ring ? { ring: p.ring } : {}),
        tier: p.tier, curve: p.curve, minutes: p.minutes, perHour: round(p.perHour, 1), coins: p.coins, proposed: p.proposed,
        off: p.proposed > 0 && Math.abs(p.coins / p.proposed - 1) > tol + 1e-9,
        ...(p.why ? { why: p.why } : {}),
    }));
    return { curves, prices };
}

/** The rows behind the three rule checks (BALANCE_RULES sections 1 and 5), in the read-out's units. */
function ruleChecksOf(pace) {
    const tolPct = pace.settings.tolerancePct;
    const past = (off) => off !== null && Number.isFinite(off) && Math.abs(off) * 100 > tolPct + 1e-9;
    const pct = (off) => (off === null ? null : Number.isFinite(off) ? round(off * 100, 1) : null);
    const factor = pace.settings.batchPayback;
    const warnAt = pace.settings.chainXpWarnFactor;
    return {
        tolerancePct: tolPct,
        chainXpWarnFactor: warnAt,
        chainXp: pace.chainXpRows().map((c) => ({
            item: c.item, name: c.name, tier: c.tier, links: c.links, xp: round(c.xp, 2), raw: round(c.raw, 3), rawMinutes: round(c.rawHours * 60, 3), xpPerHour: round(c.xpPerHour, 1),
            median: c.median === null ? null : round(c.median, 1), offPct: pct(c.off), off: past(c.off),
            warn: past(c.off) && (c.off + 1 > warnAt + 1e-9 || c.off + 1 < 1 / warnAt - 1e-9),
        })),
        batches: {
            factor,
            rows: pace.batchPaybackRows().map((b) => ({
                item: b.item, name: b.name, tier: b.tier, work: pace.workName(b.work), doseCycles: round(b.doseCycles, 2), gain: round(b.gain, 4),
                dosesPerHour: round(b.doses, 3), unitMinutes: minutes(b.unitHours), ratio: Number.isFinite(b.ratio) ? round(b.ratio, 2) : null, finishedRatio: Number.isFinite(b.finishedRatio) ? round(b.finishedRatio, 2) : null, short: b.ratio < factor - 1e-9,
            })),
        },
        hallGuild: pace.hallGuildPaybacks().map((h) => ({
            id: h.id, name: h.name, rank: h.rank, tier: h.tier, level: h.level, heroes: h.heroes, works: h.works, counted: h.counted,
            gain: round(h.gain, 4), oneWork: round(h.oneWork, 4), costMinutes: minutes(h.cost), paybackMinutes: minutes(h.payback), curveMinutes: minutes(h.curve),
            offPct: pct(h.off), unreachable: !Number.isFinite(h.row.priceHours),
            off: h.cost > 0 && Number.isFinite(h.row.priceHours) && (!Number.isFinite(h.off) || past(h.off)),
        })),
    };
}

/**
 * The read-out of a workspace (the collections, as the CMS's store holds them).
 * @param {object} state
 * @param {{ report?: object, layouts?: boolean, withPlanned?: boolean }} options  a `workspaceReport` already worked out, to reuse;
 *   `layouts: false` leaves out the other layout's days to 99 (a second pace, most of the time), keeping its node check;
 *   `withPlanned` times Planned work as if it were live, each Planned row still marked (a handed `report` must be of the lifted workspace)
 */
export function ledgerReadout(state = {}, { report = null, layouts = true, withPlanned = false } = {}) {
    const started = Date.now();
    const lifted = withPlanned ? liftPlanned(state) : null;
    if (lifted) state = lifted.state;
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
        const planned = lifted ? lifted.keys.has(key) : entry.status === PLAN_STATUS.PLANNED;
        const untimed = planned && !lifted;
        const works = (worksByEntry.get(key) || []).filter((w) => w.tier !== null).sort((a, b) => a.tier - b.tier);
        const numbers = works.length ? workNumbers(pace, r, works[0]) : null;
        const gate = gateOf(at);
        const arrive = {};
        const path = {};
        for (const [who, profile] of Object.entries(ARRIVAL_PROFILES)) {
            const a = untimed ? null : pace.arrivalOf(key, profile);
            arrive[who] = a ? minutes(a.hours) : null;
            path[who] = a ? minutes(a.pathHours) : null;
        }
        const site = works.length ? { opt: siteText(pace, r, works[0].target, PROFILE.MAXED), typ: siteText(pace, r, works[0].target, PROFILE.TYPICAL) } : null;
        rows.push({
            key, id: entry.id, name: entry.name, kind: entry.kind, status: planned ? PLAN_STATUS.PLANNED : entry.status, planned,
            tier: entry.tier ?? (Number.isInteger(at?.tier) ? at.tier : null),
            reachTier: Number.isInteger(at?.tier) ? at.tier : null,
            skill: numbers?.skill ?? gate.skill, level: numbers?.level ?? gate.level,
            work: numbers?.work ?? null, xp: numbers?.xp ?? null, seconds: numbers?.seconds ?? null,
            inputs: numbers?.inputs ?? [], makes: numbers?.makes ?? [],
            ...(numbers && !numbers.ok ? { workWhy: numbers.why ?? 'its work cannot run' } : {}),
            via: at?.via ?? at?.rule?.via ?? null, how: at?.how ?? at?.rule?.how ?? null,
            arriveOpt: arrive.opt, arriveTyp: arrive.typ, pathOpt: path.opt, pathTyp: path.typ,
            ...(site ? { site } : {}),
            ...(untimed ? { why: 'planned' } : arrive.typ === null ? { why: at ? 'never reached' : 'not in the ledger' } : {}),
        });
    }

    const stages = pace.settings.stages.map((s) => {
        const stage = pace.stageOf(s.tier);
        const work = stage.entries ? pace.workOfStage(s.tier) : null;
        const g = stage.gate;
        return {
            tier: s.tier, label: tierLabel(s.tier), profile: stage.profile, budgetMinutes: round(s.budgetMinutes, 3), endsAt: s.endsAt, heroes: stage.heroes,
            // What the budget times: the way out.
            minutes: g.place ? minutes(g.hours) : null,
            offPct: g.place && Number.isFinite(g.hours) ? round((g.hours * 60 / s.budgetMinutes - 1) * 100, 1) : null,
            gate: gateText(g),
            ...(g.place ? {} : { gateWhy: g.why === 'last' ? 'the last stage: no place after it' : `no place of ${tierLabel(g.next)} to settle` }),
            content: {
                entries: stage.entries, untimed: stage.untimed.length, minutes: stage.entries ? minutes(stage.hours) : null,
                ...(work ? {
                    pathMinutes: minutes(stage.pathHours), workMinutes: minutes(stage.workHours), heroMinutes: minutes(stage.heroHours), byWork: stage.byWork,
                    levels: work.levels, levelHeroMinutes: minutes(work.levelHeroHours), stepHeroMinutes: minutes(work.stepHeroHours),
                } : {}),
            },
        };
    });
    const nameOf = (key) => (key ? ledger.world.names.get(key) ?? parseKey(key).id : null);
    const checks = findings.map((f) => ({ check: f.check, key: f.key ?? null, name: f.name ?? nameOf(f.key), severity: f.severity, message: f.message }));

    return {
        format: READOUT_FORMAT, version: READOUT_VERSION,
        ...(lifted ? { withPlanned: true } : {}),
        profiles: { ...READOUT_PROFILES },
        units: { levelTimes: 'minutes', days: 'days (24 hero-hours)', arrive: 'minutes', seconds: 'seconds an action', xp: 'XP an action', heroMinutes: 'minutes of one hero\'s work' },
        notes: [...NOTES, ...(lifted ? [WITH_PLANNED_NOTE] : [])],
        guild: {
            heroes: heroesOf(pace), gatherersPerMaker: pace.settings.gatherersPerMaker, layout: pace.settings.layout, layoutNodes: { ...pace.settings.layouts },
            layoutSpawners: { ...pace.settings.layoutSpawners }, sitePlaces: { ...pace.settings.sitePlaces },
        },
        pace: skills,
        rows,
        stages,
        layouts: layoutsOf(pace, layouts),
        boostBudget: budgetOf(pace),
        coins: coinsOf(pace),
        ruleChecks: ruleChecksOf(pace),
        checks,
        counts: {
            skills: Object.keys(skills).length, rows: rows.length, planned: rows.filter((x) => x.planned).length,
            ...(lifted ? { plannedTimed: rows.filter((x) => x.planned && x.arriveTyp !== null).length } : {}),
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
    lines.push('', 'Stage | the way out at Maxed (what the budget times) | budget | heroes | full content, information: Maxed time, entries (untimed), the heroes\' work');
    for (const s of out.stages) {
        const g = s.gate;
        const asks = g ? [...g.asks.map((a) => `${a.skill} ${a.level}`), ...(g.coins > 0 ? [`${g.coins} coins`] : [])].join(' + ') : '';
        const way = g ? `${fmtMin(g.minutes)}${s.offPct === null ? '' : ` (${s.offPct > 0 ? '+' : ''}${s.offPct} %)`}: ${g.name}, ${asks}${g.byWork ? ', its heroes set it' : ''}${g.floor ? `, a floor (${g.floorWhy.join('; ')})` : ''}` : s.gateWhy;
        const c = s.content;
        const content = c.entries ? `${fmtMin(c.minutes)}, ${c.entries} (${c.untimed})${c.workMinutes !== undefined ? `, ${fmtMin(c.workMinutes)}${c.byWork ? ' (sets it)' : ''}` : ''}` : 'nothing planned';
        lines.push(`${s.label} | ${way} | ${fmtMin(s.budgetMinutes)} | ${s.heroes} | ${content}`);
    }
    const l = out.layouts;
    if (l?.skipped) {
        lines.push('', `Layouts: timed ${l.timed} only (the ${l.other} layout left out); ${l.nodesOff.length} node${l.nodesOff.length === 1 ? '' : 's'} make past the tolerance more in the dense layout (the layout check).`);
    } else if (l) {
        lines.push('', `Layouts: a camp works ${l.nodes.sparse} nodes (sparse) or ${l.nodes.dense} (dense); timed ${l.timed}. Days to 99 opt sparse | dense:`);
        for (const [skill, x] of Object.entries(l.skills).sort(([a], [b]) => a.localeCompare(b))) {
            lines.push(`${skill} ${x.sparse.opt ?? 'never'} | ${x.dense.opt ?? 'never'}${x.warn ? `  differ ${x.offPct} % (past ±${l.tolerancePct} %)` : ''}`);
        }
        if (l.nodesOff.length) lines.push(`${l.nodesOff.length} node${l.nodesOff.length === 1 ? '' : 's'} make past the tolerance more in the dense layout (the layout check).`);
    }
    const over = out.boostBudget?.over || [];
    if (over.length) lines.push('', `Boost budget: ${over.length} total${over.length === 1 ? '' : 's'} over a cell (${[...new Set(over.map((o) => `${o.kind} at ${o.profile}`))].join(', ')}).`);
    if (out.coins) {
        const curve = (points) => points.map((p) => `${tierLabel(p.tier)} ${p.minutes}`).join(', ') || 'no points';
        lines.push('', `Coin curves, minutes of one hero's selling from a stage on: everyday ${curve(out.coins.curves.everyday)}; big ${curve(out.coins.curves.big)}.`);
        const asking = out.coins.prices;
        if (!asking.length) {
            lines.push('Coin prices: none ask coins.');
        } else {
            const kinds = ['shop', 'hall', 'ring'].map((k) => [k, asking.filter((p) => p.kind === k).length]).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', ');
            const off = asking.filter((p) => p.off).length;
            lines.push(`Coin prices: ${asking.length} ask${asking.length === 1 ? 's' : ''} coins (${kinds}); ${off} beyond the tolerance from ${off === 1 ? 'its' : 'their'} curve's proposal.`);
        }
    }
    const rc = out.ruleChecks;
    if (rc) {
        const chainsOff = rc.chainXp.filter((c) => c.off).length;
        const chainsWarn = rc.chainXp.filter((c) => c.warn).length;
        const short = rc.batches.rows.filter((b) => b.short).length;
        const slow = rc.hallGuild.filter((h) => h.off && !(h.offPct < 0)).length;
        const quick = rc.hallGuild.filter((h) => h.off && h.offPct < 0).length;
        lines.push('', `Rule checks (±${rc.tolerancePct} %): ${rc.chainXp.length} chains, ${chainsOff} off their tier's median XP an hour of gathering (${chainsWarn} beyond ${rc.chainXpWarnFactor}x); ${rc.batches.rows.length} drink and potion batches, ${short} under ${rc.batches.factor}x their making; ${rc.hallGuild.length} Guild Hall ranks over all their work, ${slow} slower and ${quick} quicker than the payback curve.`);
    }
    const sev = Object.entries(out.counts.bySeverity).map(([k, n]) => `${n} ${k}`).join(', ') || 'none';
    lines.push('', `${out.counts.rows} entries (${out.counts.planned} Planned, marked), ${out.counts.checks} checks: ${sev}.`);
    if (out.withPlanned) lines.push(`Planned work timed as if live: ${out.counts.plannedTimed} of ${out.counts.planned} Planned entries timed (the rest never reached); the pace, stages and checks read them as live.`);
    return lines;
}
