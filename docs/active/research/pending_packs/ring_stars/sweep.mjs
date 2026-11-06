// Checks F over 100 worlds (and 1000 with --many), before (today's data) and after the pack.
import fs from 'fs';
import { engine, dataWorkspace } from './lib.mjs';

const many = process.argv.includes('--many');
const { server, load } = await engine();
try {
    const base = await dataWorkspace(load);
    const { applyPackInMemory } = await load('/src/engine/packGate.js');
    const pack = JSON.parse(fs.readFileSync('2026-11-06-ring-stars.json', 'utf8'));
    const applied = applyPackInMemory(base, pack);
    const after = { ...base, ...applied.workspace };
    console.log('conflicts', applied.conflicts?.length ?? 0);
    fs.writeFileSync('workspace_after.json', JSON.stringify(after));
    const world = await load('/src/engine/ledgerWorld.js');
    for (const [label, ws] of [['before (today)', base], ['after (with the pack)', after]]) {
        const t0 = Date.now();
        const ctx = world.workspaceWorldContext(ws);
        const n = many && label.startsWith('after') ? 1000 : 100;
        const text = world.sweepText(world.sweepWorkspace(ctx, n));
        console.log(`\n===== ${label}: ${n} worlds in ${Date.now() - t0} ms`);
        fs.writeFileSync(`sweep_${label.split(' ')[0]}_${n}.txt`, text + '\n');
        console.log(text.split('\n').slice(0, 40).join('\n'));
    }
} finally { await server.close(); }
