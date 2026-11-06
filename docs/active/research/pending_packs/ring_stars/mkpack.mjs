// Writes the ring stars' change pack from spec.mjs and the ledger's prices (prices.json).
import fs from 'fs';
import { skyWith, RINGS, CONSTELLATION } from './spec.mjs';

const prices = JSON.parse(fs.readFileSync('prices.json', 'utf8'));
for (const r of RINGS) if (!prices[r.id]) throw new Error(`no price for ${r.id}`);
const sky = skyWith(prices);
const id = '2026-11-06-ring-stars';

const PRICE_NOTE = {
    star_ring_2: 'Priced by the Ledger (Guild Hall page, proposed): Cherry, the most-gathered material first had in plane 1, as much as one hero picks at Typical from when Cherry is first had (14 min in) to the end of plane 1 (55 min), so the star is lit 54 min in. Ring 2 stays first settled at 1 h 22 min: its Farming 15 gate is later than the star.',
    star_ring_3: 'Priced by the Ledger: Trout, the most-gathered material first had in plane 2, as much as one hero catches at Typical from 1 h 43 min in to the end of plane 2 (a day), so ring 3 opens about 22 h 52 min in, not 7 h 27 min as before.',
    star_ring_4: 'A wild ring: plane 3 has no budget yet (T-294 sets the ladder\'s), so the Ledger takes the world tables\' wild price growth (1.5, as wild cells\' prices grow) times the hours of the star before, in plane 3\'s most-gathered material (Watermelon). A placeholder until the ladder\'s budgets come.',
    star_ring_5: 'A wild ring: the star before\'s hours times the wild price growth (1.5), in plane 3\'s most-gathered material. A placeholder until the ladder\'s budgets come.',
    star_ring_6: 'The last wild ring: the star before\'s hours times the wild price growth (1.5), in plane 3\'s most-gathered material. A placeholder until the ladder\'s budgets come.',
};

const entries = [
    {
        op: 'create', kind: 'hallConstellation', id: CONSTELLATION.id,
        value: { id: CONSTELLATION.id, name: CONSTELLATION.name, label: CONSTELLATION.label },
        note: 'The ring stars\' constellation: the Compass, the name the owner once gave the sky\'s reach constellation (retired 2026-10-29 with Scouting Flags); world-map reach comes back to the Hall with the ring stars (brief 380 M4). It sits left of the Hall, past the Vault, between Crafting and Construction; its name under the third star.',
    },
    ...RINGS.map((r, i) => ({
        op: 'create', kind: 'hallStar', id: r.id,
        value: sky.stars[r.id],
        note: `Opens ring ${r.ring} of the world map (opensRing ${r.ring})${i === 0 ? ', linked to the Hall so it is buyable from the start' : `, linked to ${RINGS[i - 1].name} so the rings open in order`}. Tier ${r.tier} (${i < 2 ? 'the plane before its ring' : 'the last plane the strict rings hold'}). ${PRICE_NOTE[r.id]} No ring number in its name or words (owner: no ring numbers for the player); the sky draws a map outline over it.`,
    })),
];

const pack = {
    format: 'fantasy-guild-change-pack',
    version: 1,
    id,
    createdAt: new Date().toISOString(),
    asked: 'A Guild Hall star per ring: ring 1 open from the start; a star allows settling ring 2, another ring 3, then one per wild ring; prices follow the ledger\'s algorithm (owner, 2026-11-03; brief 380 M4).',
    entries,
};
fs.writeFileSync(`${id}.json`, JSON.stringify(pack, null, 2) + '\n');
console.log(`wrote ${id}.json with ${entries.length} entries`);
for (const r of RINGS) console.log(r.id, JSON.stringify(sky.stars[r.id].ranks[0].price));
