/* The balance solver: the rules of docs/reference/BALANCE_RULES.md over the content catalogue.
 * One copy, run by the balancing page (as the BalanceSolver global) and by Node for packs:
 *   node .claude/skills/balancer/balance_solver.cjs [dials.json]   prints a summary
 * The owner sets the dials; the solver works out each entry's numbers, may move an unlock a
 * few levels to even out a thin stretch, and flags only the empty stretches it can't smooth
 * (docs/active/concept_balancing_view.md). Numbers are never stored in the catalogue.
 */
(function (root) {
  'use strict';

  const DIALS = {
    paceStartMinutes: 3,      // level 1's length
    paceGrowth: 1.0625,       // each level this much longer; the owner's range is 1.06 to 1.065
    oldTaskPerTier: 2,        // XP an hour doubles every 20 levels, so an old task is this much slower a tier on
    cycleGrowth: 1.15,        // action time grows this much every 20 levels
    baseGather: 6, basePrepare: 8, baseMake: 12,   // seconds at level 0
    countDoublesEvery: 40,    // raw ingredient counts double every this many levels
    typicalShare: 0.75,       // a typical player holds this share of each speed and XP boost (owner, 2026-11-26)
    moveMax: 3,               // the most the solver may move an unlock, in levels
    gapFlag: 6,               // levels with nothing new before a stretch is flagged
    extraPerBar: 0.5,         // a make step takes this much longer for each main ingredient past the first
    boostSmooth: 1,           // 0: the boost budget steps up at each tier's opening level; 1: it climbs level by level between them
  };
  const XP_HOUR_AT_1 = 1660;  // level 1's 83 XP in 3 minutes; keeps today's start
  const TIERS = [['Copper', 1], ['Iron', 20], ['Silver', 30], ['Mythril', 40], ['Gold', 50], ['Adamantine', 60], ['Darkmetal', 80]];
  // The boost budget (BALANCE_RULES section 5): what an optimized hero holds per tier, in percent.
  const OPT_SPEED_CUT = [20, 30, 35, 40, 45, 50, 60];
  const OPT_XP = [10, 10, 15, 15, 20, 20, 20];
  // Fixed counts of a made main ingredient by kind (section 3).
  const FIXED = [[/dagger/i, 1], [/sword|longsword/i, 2], [/woodaxe|pickaxe|harpoon/i, 2], [/gloves|boots|slippers/i, 2],
    [/helmet|hat|hood|cap\b/i, 3], [/shield|buckler/i, 3], [/mace|cleaver|axe\b|hammer/i, 3], [/cape|cloak/i, 3],
    [/chestplate|chest|robe|tunic|vest/i, 5]];
  const PREPARE_TYPES = /^(material|prep)$/i;
  // Fixed counts are gear's: a Voidcap Pie is not a cap, a Harvest Platter not a vest.
  const CONSUMABLE_TYPES = /^(food|drink|prep|elixir|poison|work|ingredient)/i;
  const ALWAYS_ONE = new Set(['water']);  // water is 1 in every recipe (section 3)
  // What one craft makes when it isn't 1 (section 3, owner 2026-11-25). An arrow craft uses a bar's worth of arrowheads.
  const AMMO_A_CRAFT = 40, NAILS_A_BAR = 5, DRINKS_A_CRAFT = 5;  // drinks and work potions alike
  const makesOf = e => /^(drink|work)/i.test(e.type || '') ? DRINKS_A_CRAFT : /arrowheads|kunai|\barrow$/i.test(e.name) ? AMMO_A_CRAFT : /\bnails$/i.test(e.name) ? NAILS_A_BAR : 1;
  const UNTIMED = { building: 'Builds follow the one-off step rule; Construction XP has no rule yet',
    event: 'Events copy the Token they stand in for' };

  const tierIndex = L => { let k = 0; TIERS.forEach(([, lo], i) => { if (L >= lo) k = i; }); return k; };
  const tierStart = L => TIERS[tierIndex(L)][1];
  const nextTierStart = L => (TIERS[tierIndex(L) + 1] || [null, 100])[1];

  function make(d) {
    d = Object.assign({}, DIALS, d || {});
    const minutes = L => d.paceStartMinutes * Math.pow(d.paceGrowth, L - 1);
    const xpHour = L => XP_HOUR_AT_1 * Math.pow(d.oldTaskPerTier, (L - 1) / 20);
    const xpToNext = L => Math.round(xpHour(L) * minutes(L) / 60);
    const cycle = (kind, L) => ({ gather: d.baseGather, prepare: d.basePrepare, make: d.baseMake })[kind] * Math.pow(d.cycleGrowth, L / 20);
    const count = (base, L) => Math.max(1, Math.round(base * Math.pow(2, L / d.countDoublesEvery)));
    const held = (table, L) => {
      const k = tierIndex(L), next = TIERS[k + 1];
      if (!d.boostSmooth || !next) return table[k];
      return table[k] + (table[k + 1] - table[k]) * (L - TIERS[k][1]) / (next[1] - TIERS[k][1]);
    };
    const boost = (L, share) => 1 / (1 - share * held(OPT_SPEED_CUT, L) / 100) * (1 + share * held(OPT_XP, L) / 100);
    const opt = L => boost(L, 1), typ = L => boost(L, d.typicalShare);
    return { d, minutes, xpHour, xpToNext, cycle, count, opt, typ };
  }

  function solve(entries, dials) {
    const R = make(dials);
    const d = R.d;
    const byId = new Map(entries.map(e => [e.id, e]));
    const givenBy = new Map();
    for (const e of entries) for (const g of e.gives || []) { if (!givenBy.has(g)) givenBy.set(g, []); givenBy.get(g).push(e.id); }

    // Which entries are work a hero does, and of what kind.
    const work = e => {
      if (e.work) return e.work;
      if (UNTIMED[e.category]) return null;
      if (e.category === 'token') return 'gather';
      // A catch or find with a level of its own, later than the Token that gives it (Salmon at 40 from
      // the level-1 Fishing Spot), is new work at that level.
      if (e.category === 'item' && e.level != null && !(e.madeWith || []).length && givenBy.has(e.id)) {
        const own = givenBy.get(e.id).map(g => byId.get(g)).filter(g => g.skill === e.skill);
        if (own.length && !own.some(g => g.level === e.level)) return 'gather';
      }
      if ((e.madeWith || []).length) return PREPARE_TYPES.test(e.type || '') ? 'prepare' : 'make';
      if (e.from && !givenBy.has(e.id)) return 'gather';  // a catch or a find worked directly
      return null;
    };
    const out = new Map();
    for (const e of entries) {
      const k = work(e);
      out.set(e.id, { id: e.id, name: e.name, skill: e.skill || '', category: e.category, type: e.type || '',
        planned: e.level, level: e.level, work: k, why: UNTIMED[e.category] || (e.level == null ? 'No level of its own: gathered or found, no rule for it yet' : k ? '' : 'Gathered from a Token') });
    }
    const tasks = [...out.values()].filter(r => r.work && r.level != null);
    const skills = {};
    for (const t of tasks) (skills[t.skill] = skills[t.skill] || []).push(t);

    // Gather and use together: a Token stays on the level of what it gives, and a gathered thing on
    // the level of a recipe that uses it (Swordfish and Swordfish Steak at 63, with the Harpoon).
    const usedAt = new Map();
    for (const e of entries) for (const i of e.madeWith || []) { if (!usedAt.has(i)) usedAt.set(i, new Set()); usedAt.get(i).add(e.level); }
    const pinned = t => (byId.get(t.id).gives || []).some(g => byId.get(g) && byId.get(g).level === t.planned) ||
      (usedAt.has(t.id) && usedAt.get(t.id).has(t.planned));

    // Move unlocks a little to even out thin stretches: only a task beside a gap over the flag,
    // never one on a tier's opening level (that is the tier arriving),
    // only if it shrinks the larger of its two gaps, never across a tier's opening, never onto a
    // taken level, never below the level of an ingredient it needs, in any skill, never off the level of what it gives or feeds.
    for (const list of Object.values(skills)) {
      for (let pass = 0; pass < 4; pass++) {
        list.sort((a, b) => a.level - b.level);
        for (let i = 0; i < list.length; i++) {
          const t = list[i], p = list[i - 1], n = list[i + 1];
          const left = p ? t.level - p.level : t.level - 1, right = n ? n.level - t.level : 99 - t.level;
          if (Math.max(left, right) <= d.gapFlag || !p || !n || TIERS.some(([, lo]) => lo === t.planned) || pinned(t)) continue;
          const taken = new Set(list.map(x => x.level));
          const floor = Math.max(tierStart(t.planned), t.planned - d.moveMax,
            ...(byId.get(t.id).madeWith || []).map(i2 => out.get(i2)).filter(x => x && x.level != null).map(x => x.level));
          const ceil = Math.min(nextTierStart(t.planned) - 1, t.planned + d.moveMax, 99);
          let best = t.level, bestGap = Math.max(left, right);
          for (let L = floor; L <= ceil; L++) {
            if (L !== t.level && taken.has(L)) continue;
            const g = Math.max(L - p.level, n.level - L);
            if (L > p.level && L < n.level && g < bestGap) { best = L; bestGap = g; }
          }
          t.level = best;
        }
      }
      list.sort((a, b) => a.level - b.level);
    }

    // Numbers by the rules: action time, ingredient counts, XP an action at the midpoint level.
    const isRaw = id => { const x = byId.get(id); return !!x && !(x.madeWith || []).length; };
    for (const list of Object.values(skills)) {
      list.forEach((t, i) => {
        const e = byId.get(t.id);
        const next = list[i + 1] ? list[i + 1].level : 100;
        t.xpLevel = next > t.level + 1 ? (t.level + next) / 2 : t.level;
        const ins = e.madeWith || [];
        const made = ins.filter(x => !isRaw(x));
        const fixed = CONSUMABLE_TYPES.test(e.type || '') ? 1 : (FIXED.find(([re]) => re.test(e.name)) || [, 1])[1];
        t.inputs = ins.map(x => {
          let n;
          if (ALWAYS_ONE.has(x)) n = 1;
          else if (/arrowheads/i.test(x)) n = AMMO_A_CRAFT;
          else if (!isRaw(x)) n = x === made[0] ? fixed : 1;
          else if (made.length) n = 1;  // a handle's wood, a weird item
          else n = R.count(t.work === 'prepare' && /ore|wood|wheat/i.test(x) ? 2 : 1, t.level);
          return { id: x, name: byId.get(x) ? byId.get(x).name : x, count: n };
        });
        const bars = made.length ? fixed : 1;
        t.seconds = R.cycle(t.work, t.level) * (t.work === 'make' ? 1 + d.extraPerBar * (bars - 1) : 1);
        // XP is whole, so the action's length is trimmed to pay the rule's XP an hour exactly,
        // within 15 % of the rule's time (section 1: seconds that give whole XP early on).
        const perSecond = R.xpHour(t.xpLevel) / 3600 / R.opt(t.level);
        t.ruleSeconds = t.seconds;
        t.xp = Math.max(1, Math.round(perSecond * t.seconds));
        t.seconds = Math.round(Math.min(t.ruleSeconds * 1.15, Math.max(t.ruleSeconds * 0.85, t.xp / perSecond)) * 10) / 10;
        t.xpHourOpt = t.xp * 3600 / t.seconds * R.opt(t.level);
        t.makes = makesOf(e);
      });
    }

    // Guild time per piece: its own seconds plus the gathering behind every ingredient.
    const guildMemo = new Map();
    const guild = (id, depth) => {
      if (guildMemo.has(id)) return guildMemo.get(id);
      const r = out.get(id); let s = 0, raw = 0;
      if (depth > 12 || !r) return { s: 0, raw: 0 };
      if (r.work && r.seconds) {
        s = r.seconds;
        for (const inp of r.inputs || []) { const g = guild(inp.id, depth + 1), per = inp.count / ((out.get(inp.id) || {}).makes || 1); s += per * g.s; raw += per * (g.raw || 1); }
        if (r.work === 'gather' && !(r.inputs || []).length) raw = 0;
      } else {
        const src = (givenBy.get(id) || []).map(g => out.get(g)).find(x => x && x.seconds);
        s = src ? src.seconds : R.cycle('gather', r.level || 1); raw = 1;
      }
      const v = { s, raw }; guildMemo.set(id, v); return v;
    };
    for (const t of tasks) { const g = guild(t.id, 0); t.guildSeconds = g.s; t.rawGathers = g.raw; }

    // Pace: each level's time with the best work unlocked, for each player.
    const pace = {};
    for (const [skill, list] of Object.entries(skills)) {
      const levels = [];
      let tOpt = 0, tTyp = 0, tGuild = 0;
      for (let L = 1; L < 99; L++) {
        const open = list.filter(t => t.level <= L);
        const curve = R.minutes(L);
        if (!open.length) {
          // Nothing to train yet: counted at the curve's time so arrivals stay finite, and flagged below.
          const typMin = curve * R.opt(L) / R.typ(L);
          tOpt += curve; tTyp += typMin; tGuild += curve;
          levels.push({ L, curve, opt: curve, typ: typMin, guild: curve, best: null, none: true, reach: { opt: tOpt, typ: tTyp, guild: tGuild } });
          continue;
        }
        const best = open.reduce((a, b) => (b.xp / b.seconds > a.xp / a.seconds ? b : a));
        const rate = best.xp * 3600 / best.seconds;  // bare XP an hour
        const optMin = R.xpToNext(L) / (rate * R.opt(L)) * 60;
        const typMin = R.xpToNext(L) / (rate * R.typ(L)) * 60;
        const guildMin = optMin * (best.guildSeconds / best.seconds);
        tOpt += optMin; tTyp += typMin; tGuild += guildMin;
        levels.push({ L, curve, opt: optMin, typ: typMin, guild: guildMin, best: best.name, reach: { opt: tOpt, typ: tTyp, guild: tGuild } });
      }
      // Empty stretches: a gap over the flag between unlocks, with its slowest level against the curve.
      const stretches = [];
      const ls = list.map(t => t.level);
      if (ls[0] > 1) stretches.push({ from: 1, to: ls[0] - 1, length: ls[0] - 1, worst: Infinity, after: null, before: list[0].name, start: true });
      for (let i = 0; i < ls.length; i++) {
        const a = ls[i], b = i + 1 < ls.length ? ls[i + 1] : 99;
        if (b - a > d.gapFlag) {
          const span = levels.filter(x => x.L > a && x.L < b && x.opt);
          const worst = span.reduce((m, x) => Math.max(m, x.opt / x.curve), 0);
          stretches.push({ from: a + 1, to: b - 1, length: b - a - 1, worst, after: list[i].name, before: list[i + 1] ? list[i + 1].name : null });
        }
      }
      const curveTotal = levels.reduce((s, x) => s + x.curve, 0);
      pace[skill] = { levels, stretches, days: { opt: tOpt / 1440, typ: tTyp / 1440, guild: tGuild / 1440, curve: curveTotal / 1440 } };
    }

    // When things arrive: its own skill reaching its level, and every ingredient already arrived
    // (one hero per skill, all climbing together, as the ledger counts).
    const reachAt = (skill, L, who) => {
      const p = pace[skill]; if (!p || L == null) return 0;
      if (L <= 1) return 0;
      const x = p.levels[L - 2]; return x && x.reach ? x.reach[who] : Infinity;
    };
    const arrMemo = new Map();
    const arrive = (id, depth) => {
      if (arrMemo.has(id)) return arrMemo.get(id);
      const r = out.get(id); if (!r || depth > 12) return { opt: 0, typ: 0 };
      let a;
      if (r.work && r.level != null) {
        a = { opt: reachAt(r.skill, r.level, 'opt'), typ: reachAt(r.skill, r.level, 'typ') };
        for (const inp of r.inputs || []) { const b = arrive(inp.id, depth + 1); a.opt = Math.max(a.opt, b.opt); a.typ = Math.max(a.typ, b.typ); }
      } else {
        const srcs = (givenBy.get(id) || []).map(g => arrive(g, depth + 1));
        a = srcs.length ? srcs.reduce((m, b) => (b.opt < m.opt ? b : m)) : { opt: 0, typ: 0 };
      }
      arrMemo.set(id, a); return a;
    };
    for (const r of out.values()) { const a = arrive(r.id, 0); r.arriveOpt = a.opt; r.arriveTyp = a.typ; }

    return { dials: d, rows: [...out.values()], pace, moved: tasks.filter(t => t.level !== t.planned),
      tiers: TIERS.map(([n, L], k) => ({ name: n, level: L, opt: R.opt(L), typ: R.typ(L), speedCut: OPT_SPEED_CUT[k], xp: OPT_XP[k] })),
      rules: R };
  }

  const api = { DIALS, solve, make, TIERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BalanceSolver = api;

  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    const fs = require('fs');
    const cat = JSON.parse(fs.readFileSync('docs/active/content_catalogue.json', 'utf8')).entries;
    const dials = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : {};
    const s = solve(cat, dials);
    const R = s.rules;
    console.log('XP table: level | minutes | XP an hour | XP to next');
    for (const L of [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 98]) console.log(L, R.minutes(L).toFixed(1), Math.round(R.xpHour(L)), R.xpToNext(L));
    console.log('\nSkill | days to 99 optimized | typical | curve | empty stretches');
    for (const [k, p] of Object.entries(s.pace).sort()) console.log(k, p.days.opt.toFixed(1), p.days.typ.toFixed(1), p.days.curve.toFixed(1), p.stretches.map(x => `${x.from}-${x.to}`).join(' '));
    console.log('\nMoved:', s.moved.map(t => `${t.name} ${t.planned}->${t.level}`).join(', ') || 'none');
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
