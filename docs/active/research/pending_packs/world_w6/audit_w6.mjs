// Audits the W6 pack's world over many seeds: each mat's busy heroes (4 to 6), each listed origin's
// and guaranteed camp's ring against its plan tier, and how many worlds hold each camp per ring.
//   node audit_w6.mjs <worktree> <workspace_applied.json> [seeds]
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const [root, wsFile, n = '100'] = process.argv.slice(2);
const mod = async (rel) => import(pathToFileURL(path.join(root, rel)).href);
const { normaliseWorldTables, STRICT_RINGS } = await mod('src/config/worldTablesShape.js');
const { generateWorld } = await mod('src/systems/world/generate.js');
const { cellMat, busyHeroes } = await mod('src/systems/world/cellMat.js');
const { materialsFromTokens, hallOriginsOf } = await mod('src/systems/world/materials.js');
const ws = JSON.parse(fs.readFileSync(wsFile, 'utf8'));
const tables = normaliseWorldTables(ws.world);
if (tables.issues.length) console.log('Issues:', tables.issues);
const typeOf = (id) => ws.tokens[id];
const materialsOf = materialsFromTokens(typeOf);
const skillOf = (id) => typeOf(id)?.config?.skill || null;
const hallOrigins = hallOriginsOf(ws.starterCamp?.tokens, materialsOf);
const tierOf = (id) => ws.tokens[id]?.plan?.tier;

console.log('Ring against plan tier (listed earlier than its tier, or later):');
for (const line of tables.lines) {
    for (let r = 1; r <= STRICT_RINGS; r++) {
        for (const o of line.origins[r]) {
            const t = tierOf(o.id);
            const first = Math.min(...tables.lines.flatMap(l => [1, 2, 3].filter(x => l.origins[x].some(p => p.id === o.id))));
            if (r === first && t !== r && !(t === 0 && r === 1)) console.log(`  ${line.id} r${r} ${o.id}: plan tier ${t}`);
            if (!ws.tokens[o.id]) console.log(`  MISSING token ${o.id}`);
        }
    }
    for (let r = 1; r <= STRICT_RINGS; r++) for (const c of tables.camps[r]) if (tierOf(c.id) !== r) console.log(`  camp r${r} ${c.id}: plan tier ${tierOf(c.id)}`);
}
for (const k of tables.kits) for (const c of [...k.camps, ...k.bossCamps]) if (!ws.tokens[c]) console.log('MISSING camp', c);

let low = Infinity, high = 0, over = 0, under = 0, cells = 0;
const overList = [];
const seeds = Array.from({ length: Number(n) }, (_, i) => i + 1);
for (const seed of seeds) {
    const world = generateWorld({ seed, tables, materialsOf, hallOrigins });
    for (const cell of world.cells.filter(c => c.ring >= 1 && c.ring <= STRICT_RINGS)) {
        const busy = busyHeroes(cellMat(cell, tables, { skillOf, hallOrigins }), tables);
        cells++;
        low = Math.min(low, busy); high = Math.max(high, busy);
        if (busy > 6 + 1e-9) { over++; if (overList.length < 5) overList.push(`${seed} ${cell.id} ${busy.toFixed(2)} camps ${cell.camps.join(',')}`); }
        if (busy < 4 - 1e-9) under++;
    }
}
console.log(`Busy heroes over ${cells} strict cells: ${low.toFixed(2)} to ${high.toFixed(2)}; ${over} over 6, ${under} under 4`);
for (const l of overList) console.log('  over:', l);
