// The game's boot audit rule for the sky, run on the pack's sky against data/, plus a few own checks.
import fs from 'fs';
import { engine, WT } from './lib.mjs';
const { server, load } = await engine();
try {
    const { hallStarFindings } = await load('/../src/systems/core/hallStarRule.js');
    const { normaliseHallSky, hallStarsFile } = await load('/../src/config/hallStars.js');
    const pack = JSON.parse(fs.readFileSync('pack/2026-10-30-hall-first-stars.json', 'utf8'));
    const constellations = {}, stars = {};
    for (const e of pack.entries) (e.kind === 'hallStar' ? stars : constellations)[e.id] = { ...e.value, id: e.id };
    const sky = normaliseHallSky({ constellations, stars });
    const items = Object.fromEntries((x => Array.isArray(x) ? x.map(i => [i.id, i]) : Object.entries(x))(JSON.parse(fs.readFileSync(WT + '/data/items.json', 'utf8'))));
    const tokens = Object.fromEntries((x => Array.isArray(x) ? x.map(i => [i.id, i]) : Object.entries(x))(JSON.parse(fs.readFileSync(WT + '/data/tokens.json', 'utf8'))));
    console.log('normalised', sky.constellations.length, 'constellations', sky.stars.length, 'stars', sky.stars.reduce((a, s) => a + s.ranks.length, 0), 'ranks');
    console.log('audit findings', JSON.stringify(hallStarFindings({ sky, items, tokens }), null, 1));
    const ids = new Set(); let dup = 0;
    for (const s of sky.stars) for (const r of s.ranks) for (const st of r.rules) { if (ids.has(st.id)) dup++; ids.add(st.id); }
    console.log('statement ids', ids.size, 'duplicates', dup);
    const tags = new Set(Object.values(tokens).flatMap(t => t.tags || []));
    for (const s of sky.stars) for (const r of s.ranks) for (const st of r.rules) if (st.to?.mode === 'tag' && !tags.has(st.to.value)) console.log('unknown tag', st.to.value);
    const ws = JSON.parse(fs.readFileSync('ws_planned.json', 'utf8'));
    for (const s of sky.stars) for (const r of s.ranks) for (const p of [...r.price, ...r.lines]) if (!ws.items[p.itemId]) console.log('item missing in planned ws', p.itemId);
} finally { await server.close(); }
