// The pack through the CMS's Sync shape and back into the game's sky: every ring star keeps opensRing and its price.
import fs from 'fs';
import { engine } from './lib.mjs';
const { server, load } = await engine();
try {
    const ws = JSON.parse(fs.readFileSync('workspace_after.json', 'utf8'));
    const { hallSkyFile } = await load('/src/engine/hallSky.js');
    const { normaliseHallSky } = await load('/../src/config/hallStars.js');
    const file = JSON.parse(JSON.stringify(hallSkyFile(ws)));
    const sky = normaliseHallSky(file);
    const rings = sky.stars.filter(s => s.opensRing);
    console.log('stars in file', Object.keys(file.stars).length, 'constellations', Object.keys(file.constellations).length);
    for (const s of rings) console.log(s.id, s.name, 'opensRing', s.opensRing, 'links', s.links.join(','), 'price', JSON.stringify(s.ranks[0].price), 'tier', s.ranks[0].tier, 'node', JSON.stringify(s.node));
    console.log('compass', JSON.stringify(sky.constellations.find(c => c.id === 'compass')));
} finally { await server.close(); }
