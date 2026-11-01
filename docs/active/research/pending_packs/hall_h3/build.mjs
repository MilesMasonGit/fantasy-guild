// Builds the H3 sky (constellations and stars, prices empty) from spec.mjs.
import { SKILLS, WELL, HEARTH, STEP, provides } from './spec.mjs';
const T = { XP: 'XP_BONUS', YIELD: 'YIELD', WORK: 'WORK_TIME', GROW: 'GROW_TIME', REACH: 'CAMP_REACH', WOUND: 'WOUND_TIME', SLOTS: 'LOADOUT_SLOTS' };
const pct = (v) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} %`;
const rnd = (n) => Math.round(n * 100) / 100;
// Each rank's step a tenth bigger than the one before, so a later rank saves at least as much as the last.
const GROW = 1.1;
const grownYield = (r) => Array.from({ length: r }, (_, k) => 1 + STEP.yield * GROW ** k).reduce((a, b) => a * b, 1) - 1;
const grownSpeed = (r) => Array.from({ length: r }, (_, k) => STEP.speed * GROW ** k).reduce((a, b) => a + b, 0);
const grownLine = (step, r) => Array.from({ length: r }, (_, k) => Math.ceil(step * GROW ** k - 1e-9)).reduce((a, b) => a + b, 0);

export function buildSky(wellStep) {
    const constellations = {};
    const stars = {};
    const tagFor = (x, y) => (x > 0.15 ? 'right' : x < -0.15 ? 'left' : y < 0 ? 'above' : 'below');
    for (const s of SKILLS) {
        const a = (s.angle * Math.PI) / 180;
        const u = { x: Math.cos(a), y: Math.sin(a) };
        const v = { x: -u.y, y: u.x };
        const R0 = Math.abs(Math.sin(a)) > 0.75 ? 1.5 : 1.12, D = 0.45, W = 0.24;
        const at = (d, w) => ({ x: rnd(R0 * u.x + d * u.x + w * v.x), y: rnd(R0 * u.y + d * u.y + w * v.y) });
        const ranksOf = (fn, tiers = s.tiers) => tiers.map((tier, i) => ({ tier, price: [], rules: fn(i + 1), lines: [] }));
        const sideTag = (w) => { const d = { x: (w < 0 ? -1 : 1) * v.x, y: (w < 0 ? -1 : 1) * v.y }; return Math.abs(d.x) > Math.abs(d.y) ? (d.x > 0 ? 'right' : 'left') : (d.y > 0 ? 'below' : 'above'); };
        const add = (id, name, description, node, links, ranks, w = 0) => {
            stars[id] = { constellation: s.id, name, description, node, tag: (w === 0 && Math.abs(Math.sin(a)) > 0.75) ? (u.x > 0 ? 'right' : 'left') : sideTag(w), links, ranks };
        };
        const xpId = `star_${s.id}_xp`;
        const hasYield = !!s.names.yield;
        const yId = `star_${s.id}_yield`;
        const spId = `star_${s.id}_speed`;
        // Work speed opens the constellation: its first rank is the cheapest, so the XP and yield behind it are not gated by a dear first star.
        add(spId, s.names.speed, `${s.name} work goes faster: ${pct(STEP.speed)} ${s.name} work time at the first rank, a little more each rank after.`, at(0, 0), ['hall'],
            ranksOf(r => [provides(spId, r, T.WORK, grownSpeed(r), { category: s.id })]));
        if (hasYield) {
            add(yId, s.names.yield, `${s.name} work brings in more: ${pct(STEP.yield)} ${s.name} yield at the first rank, a little more each rank after.`, at(D, W), [spId],
                ranksOf(r => [provides(yId, r, T.YIELD, grownYield(r), { category: s.id })]), W);
        }
        add(xpId, s.names.xp, `${s.name} teaches more: ${pct(STEP.xp)} ${s.name} XP a rank.`, hasYield ? at(D, -W) : at(D, 0), [spId],
            ranksOf(r => [provides(xpId, r, T.XP, STEP.xp * r, { category: s.id })], s.xpTiers || [s.tiers[0]]), hasYield ? -W : 0);
        if (s.token) {
            const t = s.token;
            add(t.id, t.name, `${t.desc} ${pct(STEP.rest)} a rank.`, at(2 * D, W), [hasYield ? yId : xpId],
                ranksOf(r => t.to.map(to => provides(t.id, r, T.GROW, STEP.rest * r, { to })), t.tiers), W);
        }
        if (s.camp) {
            const c = s.camp;
            add(c.id, c.name, `${c.desc} ${pct(STEP.reach)} reach a rank.`, at(2 * D, -W), [xpId],
                ranksOf(r => [provides(c.id, r, T.REACH, STEP.reach * r, { to: { mode: 'id', value: c.token } })]), -W);
        }
        constellations[s.id] = { name: s.name, label: at(2 * D + 0.4, 0), skill: s.id };
    }
    for (const h of HEARTH) {
        const rules = (r) => h.kind === 'wound' ? [provides(h.id, r, T.WOUND, STEP.wound * r)]
            : [provides(h.id, r, T.SLOTS, r, { bucket: 'flat', category: h.kind })];
        stars[h.id] = { constellation: 'hearth', name: h.name, description: h.kind === 'wound' ? `${h.desc} ${pct(STEP.wound)} wound time a rank.` : h.desc,
            node: h.at, tag: h.tag, links: h.links, ranks: h.tiers.map((tier, i) => ({ tier, price: [], rules: rules(i + 1), lines: [] })) };
    }
    for (const w of WELL) {
        const id = `star_well_${w.item.replace('item_', '')}`;
        const step = wellStep[w.item];
        stars[id] = { constellation: 'well', name: w.title, description: `The Guild Hall draws ${w.name} every lap, from ${step} at the first rank. No hero needed.`,
            node: w.at, tag: w.tag, links: w.links, ranks: w.tiers.map((tier, i) => ({ tier, price: [], rules: [], lines: [{ itemId: w.item, quantity: grownLine(step, i + 1) }] })) };
    }
    return { constellations, stars };
}
