// The QA fixture's ring stars equal the pack's.
import fs from 'fs';
import { pathToFileURL } from 'url';
const WT = 'C:/Users/16048/Projects/fantasy_guild_v2/.claude/worktrees/m4';
const { qaRingStarSky } = await import(pathToFileURL(`${WT}/src/ui/dev/qaRingStars.js`).href);
const pack = JSON.parse(fs.readFileSync('2026-11-06-ring-stars.json', 'utf8'));
const qa = qaRingStarSky();
let bad = 0;
for (const e of pack.entries) {
    const mine = e.kind === 'hallStar' ? qa.stars[e.id] : qa.constellations[e.id];
    const same = JSON.stringify(mine) === JSON.stringify(e.value);
    if (!same) { bad++; console.log('DIFF', e.id, JSON.stringify(mine), JSON.stringify(e.value)); }
}
console.log(bad ? `${bad} differ` : `all ${pack.entries.length} entries equal the QA fixture`);
