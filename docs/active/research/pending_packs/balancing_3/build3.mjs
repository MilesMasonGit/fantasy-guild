// The third balancing pack: the XP a cycle numbers the first pack had to hold back (T-291), now pinned.
// Usage (from the worktree root): node docs/active/research/pending_packs/balancing_3/build3.mjs <scratch dir>
//  1. today's workspace from data/ + plan (mkws.mjs);
//  2. the preview, run again on its own result until it proposes nothing more (a cut source hands its
//     levels to another, which the next round then proposes), each round's pack from `balance --out`,
//     so each carries the pins `balancePack` sets;
//  3. the pack = every number taken, each record whole, fingerprinted against today's workspace.
// stamp, check, gate and world follow by hand (STATUS.md here).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/n4';
const HERE = path.join(WT, 'docs/active/research/pending_packs/balancing_3');
const OUT = process.argv[2];
const ID = '2026-11-03-balancing-3';
const { setValue, proposedValue, currentValue, fingerprint } = await import('file:///' + WT + '/cms/src/engine/changePacks.js');
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const run = (args) => execFileSync('node', args, { cwd: WT, encoding: 'utf8', maxBuffer: 1 << 26 });

const ws0File = path.join(OUT, 'ws0.json');
run(['docs/active/research/pending_packs/fish/mkws.mjs', ws0File]);
const ws0 = rd(ws0File);

const taken = new Map();
let wsRun = ws0;
const firstStages = [];
for (let round = 1; round <= 5; round++) {
    const wsFile = path.join(OUT, `wsRound${round}.json`);
    fs.writeFileSync(wsFile, JSON.stringify(wsRun));
    const previewFile = path.join(OUT, `preview${round}.json`);
    const jsonFile = path.join(OUT, `preview${round}_all.json`);
    const log = run(['cms/changePackTool.mjs', 'balance', '--from', wsFile, '--out', previewFile, '--json', jsonFile]);
    fs.writeFileSync(path.join(OUT, `preview${round}.txt`), log);
    const fresh = rd(previewFile).entries;
    if (round === 1) firstStages.push(...(rd(previewFile).intent?.stages || []));
    console.log(`round ${round}: ${fresh.length} numbers to take`);
    if (!fresh.length) break;
    for (const e of fresh) {
        if (!/^XP a cycle/.test(e.note)) throw new Error(`Not an XP number, this pack carries only those: ${e.id}: ${e.note}`);
        const was = taken.get(`${e.kind}:${e.id}`);
        taken.set(`${e.kind}:${e.id}`, was ? { ...e, note: `${was.note} Then: ${e.note}` } : e);
        wsRun = { ...wsRun, ...setValue(wsRun, e.kind, e.id, proposedValue(e)) };
    }
}
const entries = [...taken.values()].map((e) => ({ ...e, fingerprint: fingerprint(currentValue(ws0, e.kind, e.id)) }));
const pack = {
    format: 'fantasy-guild-change-pack', version: 1, id: ID, createdAt: new Date().toISOString(),
    asked: 'The XP numbers the first balancing pack had to hold back, because Sync would have put them back: they clear the Alchemy and Forestry walls and bring Plane 1 near its 55 minutes. Each is now pinned on its entry, so Recalculate and Sync keep it (T-291).',
    ...(firstStages.length ? { intent: { stages: firstStages } } : {}),
    entries,
};
fs.writeFileSync(path.join(HERE, ID + '.json'), JSON.stringify(pack, null, 2) + '\n');
console.log(`${entries.length} entries, ${entries.filter((e) => e.value.sim?.xpPinned).length} pinned.`);
for (const e of entries) console.log(`- ${e.value.name}: ${e.kind === 'recipe' ? e.value.xp : e.value.config.xp}`);
