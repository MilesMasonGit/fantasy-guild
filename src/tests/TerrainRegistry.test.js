import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    SUBSTRATES, TERRAIN_TYPES, substrateSprite, getTerrain, isTerrainId, substrateOf,
    DEFAULT_ART_SET, ART_PX_FOR_SET, artSet, setArtSet, substrateArtPx, substrateVariants
} from '../config/registries/terrainRegistry.js';
import { subtileArtPx } from '../systems/board/TerrainLattice.js';
import {
    MAP_TERRAIN, TOKEN_TERRAIN, DEFAULT_TERRAIN, terrainForMap, terrainForToken
} from '../config/registries/terrainAssignments.js';

/**
 * Terrain P0 — the vocabulary and the assignment table.
 *
 * Nothing renders yet, so what is worth pinning here is not behaviour but
 * *coverage*: that every Map and every Token can actually answer "what terrain
 * do I paint", and that the answer names something real. Those are the two ways
 * this table rots — content is added and nobody updates it, or a terrain is
 * renamed and the references dangle.
 *
 * These read `data/*.json` straight off disk rather than going through
 * `tokenRegistry`/`mapRegistry`, deliberately: the registries are mutable at
 * runtime (`registerTokenTypes`) and the test fixtures push made-up Tokens into
 * them, so a coverage claim made against them would be a claim about the
 * fixtures. The files are what ships.
 */

const projectRoot = resolve(__dirname, '../..');
const readData = (name) =>
    JSON.parse(readFileSync(resolve(projectRoot, 'data', name), 'utf-8'));

const TOKENS = readData('tokens.json');
const MAPS = readData('maps.json');

/** Token ids that some Map's pool can produce — so a burst can stamp them. */
const POOLED_TOKEN_IDS = new Set(
    Object.values(MAPS)
        .flatMap(m => m.pool || [])
        .filter(e => e.kind === 'token')
        .map(e => e.refId)
        // ⚠️ `map_guild_hall_map` lists `token_fallen_oak_tree`, which does not
        // exist in tokens.json. That dangling reference is a content bug and
        // not this feature's to fix, but it must not be counted as a Token.
        .filter(id => Object.prototype.hasOwnProperty.call(TOKENS, id))
);

const POOLLESS_TOKEN_IDS = Object.keys(TOKENS).filter(id => !POOLED_TOKEN_IDS.has(id));

describe('Terrain types name real art', () => {
    it('every terrain sits on a substrate that exists', () => {
        for (const [id, terrain] of Object.entries(TERRAIN_TYPES)) {
            expect(terrain.id, `${id} must carry its own id`).toBe(id);
            expect(SUBSTRATES[terrain.substrate], `${id} substrate`).toBeDefined();
        }
    });

    it('every substrate variant is a file on disk, in BOTH art sets', () => {
        // Both sets are checked whichever one is selected, so switching
        // `ART_SET` can never be the thing that discovers a missing sprite.
        for (const substrate of Object.values(SUBSTRATES)) {
            for (const set of Object.keys(ART_PX_FOR_SET)) {
                for (let v = 0; v < substrate.variants[set]; v++) {
                    const rel = substrateSprite(substrate.id, v, set);
                    const abs = resolve(projectRoot, 'public', rel.replace(/^\//, ''));
                    expect(existsSync(abs), `missing ${rel}`).toBe(true);
                }
            }
        }
    });

    it('does not claim a variant that was never drawn', () => {
        // The counts are hand-written, so the cheap mistake is claiming one
        // variant too many and rendering a broken image on some subtiles.
        for (const substrate of Object.values(SUBSTRATES)) {
            for (const set of Object.keys(ART_PX_FOR_SET)) {
                const rel = substrateSprite(substrate.id, substrate.variants[set], set);
                const abs = resolve(projectRoot, 'public', rel.replace(/^\//, ''));
                expect(existsSync(abs), `${substrate.id}/${set} claims too few`).toBe(false);
            }
        }
    });

    it('⚠️ cuts coastlines at the same resolution the ground is drawn at', () => {
        // The one way to switch art sets and get something that looks broken
        // rather than different: an edge stepped at 16 through ground drawn at
        // 8 is finer than anything around it, and reads as a rendering fault.
        // Checked in BOTH sets, because the QA toggle can leave either live.
        const original = artSet();
        try {
            for (const set of Object.keys(ART_PX_FOR_SET)) {
                setArtSet(set);
                expect(subtileArtPx(), set).toBe(substrateArtPx());
                expect(substrateArtPx(), set).toBe(ART_PX_FOR_SET[set]);
            }
        } finally {
            setArtSet(original);
        }
    });

    it('⭐ actually changes what is drawn when the set is switched', () => {
        // The bug this guards is silent: if anything captures the art set at
        // import time — a constant, a cache key — the toggle appears to work
        // and the board keeps drawing the old sprites.
        const original = artSet();
        try {
            setArtSet('a');
            const fine = substrateSprite('grass', 0);
            const fineSize = substrateArtPx();
            setArtSet('b');
            expect(substrateSprite('grass', 0)).not.toBe(fine);
            expect(substrateArtPx()).not.toBe(fineSize);
            expect(subtileArtPx()).toBe(substrateArtPx());
        } finally {
            setArtSet(original);
        }
    });

    it('refuses a set that does not exist, and leaves the live one alone', () => {
        const original = artSet();
        expect(setArtSet('nonsense')).toBe(false);
        expect(artSet()).toBe(original);
        expect(setArtSet(original)).toBe(false);   // already live, nothing to do
    });

    it('ships a default that names a real set', () => {
        expect(ART_PX_FOR_SET[DEFAULT_ART_SET]).toBeDefined();
    });

    it('every sprite in the selected set really is the size that set claims', () => {
        // A PNG's width lives at byte 16 of the IHDR chunk. Cheaper than
        // decoding, and this only has to catch a sprite drawn at the wrong size.
        for (const substrate of Object.values(SUBSTRATES)) {
            for (let v = 0; v < substrateVariants(substrate.id); v++) {
                const rel = substrateSprite(substrate.id, v);
                const abs = resolve(projectRoot, 'public', rel.replace(/^\//, ''));
                const width = readFileSync(abs).readUInt32BE(16);
                expect(width, `${rel} is ${width}px`).toBe(substrateArtPx());
            }
        }
    });

    it('⚠️ has no edge or corner art, which is why slice one cannot blend', () => {
        // If this ever fails, someone has drawn the stencil library and the
        // blending work in roadmap P3 is unblocked. Delete this test then.
        const masks = resolve(projectRoot, 'public/assets/playmat/terrain/masks');
        expect(existsSync(masks)).toBe(false);
    });

    it('resolves terrain and substrate lookups, and refuses unknown ids', () => {
        expect(getTerrain('forest').substrate).toBe('grass');
        expect(substrateOf('shore').id).toBe('sand');
        expect(isTerrainId('forest')).toBe(true);
        expect(isTerrainId('swamp')).toBe(false);
        expect(getTerrain('swamp')).toBeNull();
        expect(substrateOf('swamp')).toBeNull();
    });

    it('two terrain types may share one substrate (D-T8)', () => {
        // The whole point of the flattened model: "desert" and "desert village"
        // are different terrains on the same sand. If this stops being true the
        // registry has drifted back towards the concept doc's overlay split.
        const bySubstrate = {};
        for (const t of Object.values(TERRAIN_TYPES)) {
            (bySubstrate[t.substrate] ||= []).push(t.id);
        }
        const shared = Object.values(bySubstrate).filter(ids => ids.length > 1);
        expect(shared.length).toBeGreaterThan(0);
    });
});

describe('Every Map stamps a real terrain', () => {
    it('covers every authored Map', () => {
        for (const mapId of Object.keys(MAPS)) {
            expect(MAP_TERRAIN[mapId], `${mapId} has no terrain`).toBeDefined();
        }
    });

    it('names no Map that does not exist', () => {
        for (const mapId of Object.keys(MAP_TERRAIN)) {
            expect(MAPS[mapId], `${mapId} is not a real Map`).toBeDefined();
        }
    });

    it('stamps only real terrain', () => {
        for (const [mapId, terrainId] of Object.entries(MAP_TERRAIN)) {
            expect(isTerrainId(terrainId), `${mapId} -> ${terrainId}`).toBe(true);
        }
    });

    it('returns null for a Map it has never heard of', () => {
        expect(terrainForMap('map_atlantis')).toBeNull();
        expect(terrainForMap('map_oak_forest')).toBe('forest');
    });
});

describe('⚠️ Every Token can answer what it paints (D-T4, D-T7)', () => {
    it('every Token that no Map produces has its own terrain', () => {
        // This is the guarantee that makes "every Token paints" true. 50 of the
        // 75 Tokens are crafted or bought and never come out of a Map pool, so
        // there is no stamp to inherit and the override is the only answer.
        const missing = POOLLESS_TOKEN_IDS.filter(id => !TOKEN_TERRAIN[id]);
        expect(missing, 'pool-less Tokens with no terrain').toEqual([]);
    });

    it('⭐ overrides a Token a Map can produce only on purpose', () => {
        // An override beats the Map stamp, so listing a pooled Token in
        // TOKEN_TERRAIN kills map inheritance for it — and the whole reason the
        // stamp exists is Tokens like `token_wishing_well`, farmland out of
        // Golden Farmland and hills out of Test Map. An accidental override
        // picks one and makes the other wrong, silently.
        //
        // So it is allowed, but never by accident: a pooled Token has to be
        // named here as well, with a reason. Adding one to the registry without
        // adding it here fails, which is the point.
        const DELIBERATE = new Map([
            ['token_coast', 'the Coast is the sea, not the beach it stamps'],
            ['token_fishing_net', 'a net is in the water, not on the sand'],
            ['token_rusty_pickaxe', 'every tool paints diggings, wherever it came from'],
            ['token_rusty_woodaxe', 'every tool paints diggings, wherever it came from'],
            ['token_fir_tree', 'a fir lays down fir wood, though Oak Forest produced it']
        ]);

        const overreach = [...POOLED_TOKEN_IDS]
            .filter(id => TOKEN_TERRAIN[id] && !DELIBERATE.has(id))
            .sort();
        expect(overreach, 'pooled Tokens overridden without a stated reason').toEqual([]);

        // And the allowlist may not rot: every entry must still be a pooled
        // Token that is still overridden.
        for (const id of DELIBERATE.keys()) {
            expect(POOLED_TOKEN_IDS.has(id), `${id} is no longer pooled`).toBe(true);
            expect(TOKEN_TERRAIN[id], `${id} is no longer overridden`).toBeDefined();
        }
    });

    it('names no Token that does not exist', () => {
        for (const typeId of Object.keys(TOKEN_TERRAIN)) {
            expect(TOKENS[typeId], `${typeId} is not a real Token`).toBeDefined();
        }
    });

    it('assigns only real terrain', () => {
        for (const [typeId, terrainId] of Object.entries(TOKEN_TERRAIN)) {
            expect(isTerrainId(terrainId), `${typeId} -> ${terrainId}`).toBe(true);
        }
    });

    it('accounts for all 75 Tokens between the two routes', () => {
        const answered = new Set([...POOLED_TOKEN_IDS, ...Object.keys(TOKEN_TERRAIN)]);
        expect(answered.size).toBe(Object.keys(TOKENS).length);
    });
});

describe('Resolving a Token’s terrain (D-T5 precedence)', () => {
    it('prefers an explicit override over the Map that stamped it', () => {
        expect(terrainForToken('token_oak_tree', 'shore')).toBe('shore'); // no override, stamp wins
        expect(terrainForToken('token_iron_ore_vein', 'shore')).toBe('mountain'); // override wins
    });

    it('falls back to the Map stamp when there is no override', () => {
        // `token_wishing_well` is the case the stamp exists for: it is in two
        // pools, so the Map that actually produced it decides.
        expect(terrainForToken('token_wishing_well', 'farmland')).toBe('farmland');
        expect(terrainForToken('token_wishing_well', 'hills')).toBe('hills');
    });

    it('⭐ falls back to the sole Map that lists it, when only one does', () => {
        // Without this a pooled Token created outside a burst — the QA panel's
        // "Fill Tray", a fixture, a future crafting recipe — has neither an
        // override nor a stamp and paints the default. That put grass under
        // Shrimp Coast on any board filled from the QA panel, which reads as
        // the feature being broken rather than as a Token lacking provenance.
        expect(terrainForToken('token_shrimp_coast')).toBe('shore');
        expect(terrainForToken('token_oak_tree')).toBe('forest');
        expect(terrainForToken('token_wheat_field')).toBe('farmland');
    });

    it('⚠️ does NOT guess for a Token that two Maps list', () => {
        // The ambiguity the burst stamp exists to resolve. Picking one of the
        // two would be wrong half the time and impossible to notice.
        expect(terrainForToken('token_coal_vein')).toBe(DEFAULT_TERRAIN);
        expect(terrainForToken('token_wishing_well')).toBe(DEFAULT_TERRAIN);
        // ...but a real stamp still wins over the default.
        expect(terrainForToken('token_coal_vein', 'hills')).toBe('hills');
    });

    it('falls back to the default when there is nothing at all', () => {
        expect(terrainForToken('token_nonexistent')).toBe(DEFAULT_TERRAIN);
    });

    it('gives every coastal Token water or sand, so a coast has a coastline', () => {
        // The reason `ocean` exists. Sandbar Shores stamped `shore` on all of
        // them, so the water substrate went unused and a coast was a beach with
        // nothing beside it.
        expect(terrainForToken('token_coast')).toBe('ocean');
        expect(terrainForToken('token_fishing_net')).toBe('ocean');
        expect(terrainForToken('token_shrimp_coast')).toBe('shore');
        expect(terrainForToken('token_shrimp_market')).toBe('shore');
    });

    it('gives every tool the same dug-over ground', () => {
        for (const id of [
            'token_copper_pickaxe', 'token_iron_pickaxe', 'token_mythril_pickaxe',
            'token_adamantium_pickaxe', 'token_darkmetal_pickaxe',
            'token_rusty_pickaxe', 'token_copper_woodaxe', 'token_rusty_woodaxe'
        ]) {
            expect(terrainForToken(id), id).toBe('diggings');
        }
    });

    it('ignores a stamp naming a terrain that no longer exists', () => {
        // A stamp is written into a save (P1), so an old save can carry a
        // terrain id that has since been renamed. That must degrade to the
        // default, not paint nothing.
        expect(terrainForToken('token_wishing_well', 'swamp')).toBe(DEFAULT_TERRAIN);
    });

    it('always returns a terrain that really exists', () => {
        for (const typeId of Object.keys(TOKENS)) {
            expect(isTerrainId(terrainForToken(typeId)), typeId).toBe(true);
        }
    });
});
