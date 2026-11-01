// Writes the H3 change pack from the priced sky and the ledger's rows.
import fs from 'fs';
const sky = JSON.parse(fs.readFileSync('sky_planned.json', 'utf8'));
const rows = JSON.parse(fs.readFileSync('rows_planned.json', 'utf8'));
const intent = fs.existsSync('intent.json') ? JSON.parse(fs.readFileSync('intent.json', 'utf8')) : null;
const ID = '2026-10-30-hall-first-stars';
const h = (x) => (x < 1 ? `${Math.round(x * 60)} min` : `${x.toFixed(1)} h`);
const tierName = (t) => (t === 0 ? 'Starter Camp' : `plane ${t}`);
const entries = [];
for (const [id, c] of Object.entries(sky.constellations)) {
    entries.push({ op: 'create', kind: 'hallConstellation', id, value: c, note: `${c.name}'s constellation: its XP, yield and work-speed stars and its Token upgrades, linked to the Hall.` });
}
for (const [id, s] of Object.entries(sky.stars)) {
    const parts = s.ranks.map((rank, i) => {
        const r = rows.find((x) => x.id === id && x.rank === i + 1);
        const price = rank.price.map((p) => `${p.quantity} ${p.itemId.replace('item_', '').replace(/_/g, ' ')}`).join(', ') || 'free';
        const pay = r?.rate ? (r.pays ? `pays back in ${h(r.payback)}` : `pays back in ${h(r.payback)}, over the day (raised to the rank before)`) : 'no rate to pay back (priced like its neighbours)';
        return `rank ${i + 1} ${tierName(rank.tier)}: ${price}, ${pay}`;
    });
    const how = /_camp_reach$/.test(id) ? ' Camp reach is no rate the ledger reads: each rank is priced like the same skill\'s work-speed rank of its tier.'
        : s.constellation === 'hearth' ? ' No rate the ledger reads: each rank is priced like the middle skill-star proposal of its tier, never below the rank before.'
        : ' Prices: the ledger\'s proposal at the Guild Hall\'s 24 h payback, at Typical (a preview until the calculator is seen to agree with play).';
    entries.push({ op: 'create', kind: 'hallStar', id, value: s, note: `${s.name}. ${parts.join('; ')}.${how}` });
}
const pack = {
    format: 'fantasy-guild-change-pack', version: 1, id: ID, createdAt: new Date().toISOString(),
    asked: 'Brief 320, phase H3: the first Guild Hall star list. For every skill with content, XP, yield and speed boosts at one rank per tier; Token upgrades for its Tokens (vein rest, regrowth, camp reach where camps exist); the Well\'s basic outputs; the Hearth\'s Infirmary and loadout slots; each rank\'s tier set and its price proposed by the ledger (a preview).',
    ...(intent ? { intent } : {}),
    entries
};
fs.mkdirSync('pack', { recursive: true });
fs.writeFileSync(`pack/${ID}.json`, JSON.stringify(pack, null, 2) + '\n');
console.log('entries', entries.length, Object.entries(entries.reduce((a, e) => ((a[e.kind] = (a[e.kind] || 0) + 1), a), {})));
