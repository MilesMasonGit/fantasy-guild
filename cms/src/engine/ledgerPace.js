import { PROFILES, PROFILE_TEXT, PACE_TEXT } from '../../../src/systems/progression/ledger/pace.js';
import { BOOST_KIND, BOOST_KIND_TEXT, factorId } from '../../../src/systems/progression/ledger/profiles.js';
import { parseKey, itemKey, tokenKey, recipeKey, LEDGER_ENGINE_TEXT, COMBAT } from '../../../src/systems/progression/ledger/engine.js';
import { minutesToReach, minutesPerLevelAt, formatMinutes } from '../../../src/systems/progression/ledger/settings.js';

/**
 * What the Ledger's pace views show, worked out from a pace (`pace.js`): an entry's path time at
 * each profile with the steps that set it, the rates of the work that belongs to an entry with
 * every factor, and the per-skill breakdown of where XP comes from. Pure: the components draw it.
 */

export { PROFILES, PROFILE_TEXT, PACE_TEXT, BOOST_KIND_TEXT };

export const hoursText = (h) => PACE_TEXT.hours(h);
const perHourText = (n) => (n >= 100 ? Math.round(n).toString() : n >= 10 ? n.toFixed(1) : n.toFixed(2));
export const rateText = (n) => (Number.isFinite(n) ? perHourText(n) : '—');

/** The name of any key the ledger knows. */
export function keyName(pace, ledger, key) {
  return ledger.world.names.get(key) ?? parseKey(key).id;
}

/**
 * An entry's path time at each profile: `{ profile, hours, complete, curveMinutes, ratio, steps }`.
 * `curveMinutes` is what the pace curve gives to reach the highest level the path asks (null when it
 * asks none); `steps` the chain that sets the time, latest first, each `{ key, name, how, start,
 * own, ready, waits }` where `waits` says what the step waited for.
 */
export function pathRows(pace, ledger, key) {
  const at = ledger.reachOf(key);
  if (!at || at.planned || !Number.isInteger(at.tier)) return [];
  const levels = Object.entries(at.levels || {}).filter(([s]) => s !== COMBAT);
  const top = levels.length ? Math.max(...levels.map(([, l]) => l)) : null;
  const curveMinutes = top && top > 1 ? minutesToReach(pace.settings, top) : null;
  return PROFILES.map((profile) => {
    const path = pace.pathOf(key, profile);
    const steps = path.steps.map((r) => ({
      key: r.key,
      name: keyName(pace, ledger, r.key),
      how: LEDGER_ENGINE_TEXT.how[r.how] || r.how || '',
      via: r.via ? keyName(pace, ledger, r.via) : null,
      start: r.start,
      own: r.own,
      ready: r.hours,
      why: r.why || null,
      waits: r.waitsOn?.skill
        ? `${PACE_TEXT.skill(r.waitsOn.skill)} ${r.waitsOn.level}`
        : r.waitsOn?.need ? keyName(pace, ledger, r.waitsOn.need) : null,
      gates: (r.gates || []).filter((g) => g.skill !== COMBAT).map((g) => ({ ...g, text: `${PACE_TEXT.skill(g.skill)} ${g.level}` })),
    }));
    return {
      profile, hours: path.hours, complete: path.complete, curveMinutes,
      ratio: curveMinutes ? (path.hours * 60) / curveMinutes : null, steps,
    };
  });
}

/** The work that belongs to an entry: a Token's own work (each pool of a water), a recipe at each station or Foundation. */
export function worksOf(pace, key) {
  const { kind, id } = parseKey(key);
  if (kind === 'token') return pace.works.filter((w) => w.target.token === id && !w.target.recipe);
  if (kind === 'recipe') return pace.works.filter((w) => w.target.recipe === id);
  return [];
}

/** A rate as one row: the work, cycle, cycles an hour, what limits it, items, XP and inputs an hour. */
export function rateRow(rate, scale = 1) {
  if (!rate?.ok) return { ok: false, reason: rate?.reason || 'not rated' };
  const times = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, v * scale]));
  return {
    ok: true,
    cycleMs: rate.cycleMs,
    cyclesPerHour: rate.cyclesPerHour * scale,
    limitedBy: scale < 1 ? 'inputs' : rate.limitedBy,
    items: times(rate.items),
    xp: times(rate.xp),
    inputs: times(rate.inputs),
  };
}

/** Items an hour in words: "1080 Copper Ore, 2.25 Bird Nest". */
export function itemsText(pace, ledger, items) {
  const parts = Object.entries(items || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${rateText(n)} ${keyName(pace, ledger, itemKey(id))}`);
  return parts.length ? parts.join(', ') : '—';
}

/** The words for a factor kind as the rate lists it (`support`, `consumable`, …). */
export const FACTOR_KIND_TEXT = Object.freeze({
  self: 'The work itself', support: 'Building', tool: 'Tool', gear: 'Gear', consumable: 'Consumable',
  perk: 'Perk', region: 'Region', guild: 'Guild-wide', hall: 'Guild Hall',
});

/**
 * The setup a profile chose for a work, with factors switched off by the author: the profile's own
 * setup plus `off`. What the rate panel re-rates on every switch.
 */
export function switchedSetup(choice, off) {
  return { ...choice.setup, off: [...(choice.setup.off || []), ...off] };
}

/** The factor ids a rate lists that can be switched (everything but the work itself). */
export function switchableFactors(rate) {
  return (rate?.factors || []).filter((f) => f.kind !== 'self');
}

/** A profile's choices in words, each with why: "Copper Mine (pays back in 4 min)". */
export function choiceText(pace, ledger, chosen) {
  return chosen.map((c) => {
    const hall = c.kind === BOOST_KIND.HALL;
    const key = c.kind === BOOST_KIND.SUPPORT || c.kind === BOOST_KIND.CAMP ? tokenKey(c.id) : hall ? null : itemKey(c.id);
    const opened = hall && c.path?.length ? `, opened through ${c.path.map((id) => `${pace.hallName(id)} 1`).join(' and ')}` : '';
    const name = hall ? `${pace.hallName(c.upgrade)} rank ${c.rank}` : keyName(pace, ledger, key);
    const why = !Number.isFinite(c.payback) ? ''
      : c.kind === BOOST_KIND.CONSUMABLE ? ' (pays as it is drunk)'
        : c.payback > 0 ? ` (pays back in ${hoursText(c.payback)}${opened})` : ` (free: already there${opened})`;
    return { kind: c.kind, name, why, factor: c.factor };
  });
}

/**
 * The Guild Hall's ranks for the Pace page and the Guild Hall page: every rank that adds a rate,
 * with its tier, price, the hours that price takes to gather at Typical, what opening a closed star
 * costs on the way (`openingText`), what it saves an hour and where, its payback (red when over the
 * payback time) and the proposed price. `byStar` groups them.
 */
export function hallRows(pace) {
  return pace.hallPaybacks().map((r) => ({
    ...r,
    workText: r.work ? pace.workName(r.work) : null,
    savesText: r.rate ? (r.enabler ? 'the only source of what it pays' : r.gain > 0 ? PACE_TEXT.saves(r.gain) : 'nothing at its tier') : null,
    paybackText: r.rate ? (r.enabler ? 'an enabler' : PACE_TEXT.short(r.payback)) : null,
    priceTimeText: PACE_TEXT.short(r.priceHours),
    openingText: r.opening?.path?.length
      ? `${PACE_TEXT.short(r.opening.cost)} to open it, lighting ${r.opening.path.map((id) => pace.hallName(id)).join(' and ')}`
      : null,
    ...(r.ring ? {
      litText: PACE_TEXT.hours(r.litAt),
      opensText: PACE_TEXT.hours(r.opensAt),
      budgetText: r.budgetHours === null ? null : PACE_TEXT.hours(r.budgetHours),
    } : {}),
  }));
}

/** One star's rows by rank, `{ [rank]: row }`. */
export function hallRowsOf(rows, starId) {
  return Object.fromEntries(rows.filter((r) => r.id === starId).map((r) => [r.rank, r]));
}

/**
 * The per-skill breakdown: for each skill and each stage it is levelled in, the best XP source at
 * Typical and at Maxed, its XP an hour against Bare, and what each kind of boost adds, plus the
 * hours to the top level the stage asks at each profile against the curve.
 */
export function breakdownRows(pace) {
  const rows = pace.breakdown();
  return rows.map((row) => {
    const track = pace.trackOf(row.skill);
    const atLevel = track.levels[row.level - 1] || null;
    const reach = atLevel ? atLevel.level + 1 : 1;
    const hours = Object.fromEntries(PROFILES.map((p) => [p, atLevel ? atLevel.cumulative[p] : 0]));
    return {
      ...row,
      reach,
      curveMinutes: reach > 1 ? minutesToReach(pace.settings, reach) : 0,
      hours,
      perLevelCurve: minutesPerLevelAt(pace.settings, row.level),
    };
  });
}

/** A boost's share in words: "+25 %". */
export function gainText(gain) {
  if (gain === null || gain === undefined) return 'on';
  if (!Number.isFinite(gain)) return 'enables it';
  return `+${Math.round(gain * 100)} %`;
}

export { formatMinutes, factorId, tokenKey, recipeKey, itemKey };
