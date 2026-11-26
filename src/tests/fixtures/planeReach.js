import * as StarterCamp from '../../systems/atlas/StarterCamp.js';
import { getTokenType, getAllTokenTypes } from '../../config/registries/tokenRegistry.js';
import { recipesForToken } from '../../config/registries/recipePoolRegistry.js';
import { getItem, getAllItems } from '../../config/registries/itemRegistry.js';
import { starterToolIds, neededToolOf, isToolKind } from '../../config/registries/toolKinds.js';
import { catchPoolsOf, hasCatchPools, poolFits } from '../../config/registries/catchPools.js';
import { rareTableOf } from '../../config/registries/rareTables.js';
import { worldTables } from '../../config/registries/worldTablesRegistry.js';
import { spotOf, arrivesByItself, groundWaterKinds } from '../../config/registries/fishingSpots.js';
import { kitBiome } from '../../config/worldTablesShape.js';
import { biomeRow } from '../../config/biomeTerrain.js';
import { STARTER_CAMP_GROUND } from '../../systems/progression/ledger/engine.js';
import { getEffect } from '../../config/registries/effectRegistry.js';
import { getUpgradeDef, rankEffectOf, WISHING_WELL_STAR } from '../../config/guildUpgrades.js';

/**
 * What the first planes of the world put in the game, on paper, read off the content in force:
 * shared by the new-game reachability check (`NewGameOpening.test.js`) and the starter-tool rule
 * (`ToolsAsGear.test.js`). A plane is a ring of the world map.
 */

/** What the Wishing Well's first rank pays each lap (Water), item ids. */
export const wellItems = () => (rankEffectOf(getUpgradeDef(WISHING_WELL_STAR), 1)?.lines || []).map(l => l.itemId);

/** The effects a Token or item carries, followed through `applies` (a potion's effect on its drinker). */
function effectsOf(def) {
    const out = [];
    const seen = new Set();
    const walk = (effectId) => {
        if (!effectId || seen.has(effectId)) return;
        seen.add(effectId);
        const effect = getEffect(effectId);
        if (!effect) return;
        out.push(effect);
        for (const s of effect.statements || []) if (s.keyword === 'applies') walk(s.payload?.effectId);
    };
    for (const e of def?.effects || []) walk(e?.effectId);
    return out;
}

/** What a Token's or item's effects add when it works or is used: bonus drops and spawned Tokens. */
export function effectYields(def) {
    const items = [];
    const tokens = [];
    for (const effect of effectsOf(def)) {
        for (const s of effect.statements || []) {
            if (s.keyword === 'grants' && s.payload?.itemId) items.push(s.payload.itemId);
            if (s.keyword === 'spawns' && s.payload?.typeId) tokens.push(s.payload.typeId);
        }
    }
    for (const block of def?.effectBlocks || []) {
        for (const m of block.modifiers || []) if (m.type === 'BONUS_DROP' && m.itemId) items.push(m.itemId);
    }
    return { items, tokens };
}

/**
 * The Tokens the world map's cells of rings 1 to `maxRing` write, from the world tables in force:
 * each line's origins, key origins and guaranteed camps of those rings, and their chests. Any cell may draw any
 * extra its ring allows.
 */
export function worldTokens(maxRing) {
    const tables = worldTables();
    const out = new Set();
    for (let ring = 1; ring <= maxRing; ring++) {
        for (const line of tables.lines) for (const o of line.origins[ring] || []) out.add(o.id);
        for (const id of tables.keys[ring] || []) out.add(id);
        // The camps the ring guarantees.
        for (const camp of tables.camps?.[ring] || []) out.add(camp.id);
        // A place's arrival: its enemies and bosses.
        for (const e of [...(tables.arrival[ring]?.enemies || []), ...(tables.arrival[ring]?.bosses || [])]) out.add(e.id);
    }
    // Every kit's camps, and the boss camp a combat specialty makes one of them.
    for (const kit of tables.kits) for (const id of [...kit.camps, ...kit.bossCamps]) out.add(id);
    for (const extra of tables.extras) {
        if (extra.rings && !extra.rings.some(r => r <= maxRing)) continue;
        if (extra.kind === 'treasure') out.add(extra.id);
    }
    return out;
}

/**
 * The fishing spot kinds that drift in by themselves on the water of a place the planes hold: the
 * Starter Camp's pond (meadow, fresh water, `StarterCampPond.test.js`) and the ground of every kit
 * a world cell may stand on, with the water its biome's terrain row may roll. Any cell may draw any
 * kit, as any may draw any extra its ring allows. A spot kind that only an event lands is not here.
 */
export function arrivingSpots() {
    const places = planePlaces();
    const fits = (spot, place) => (!spot.biomes.length || spot.biomes.includes(place.biome))
        && spot.water.some(w => place.waters.includes(w));
    return Object.values(getAllTokenTypes())
        .filter(def => arrivesByItself(spotOf(def)) && places.some(place => fits(spotOf(def), place)))
        .map(def => def.id);
}

/**
 * The ground a Token of the planes may stand on, `{ biome, waters }`: the Starter Camp's and that of
 * every kit a world cell may draw, with the water its biome's terrain row may roll.
 */
export function planePlaces() {
    const tables = worldTables();
    return [STARTER_CAMP_GROUND, ...tables.kits.map((kit) => {
        const biome = kitBiome(tables, kit.id);
        const row = biomeRow(tables, biome);
        return { biome, waters: groundWaterKinds(row.sea[1], row.water) };
    })];
}

/**
 * A water's catch pools that hold somewhere the planes' ground is (`catchPools.poolFits`): a pool
 * naming only biomes or water the planes never hold bites later, not here.
 */
export function poolsOnPlanes(def) {
    const places = planePlaces();
    return catchPoolsOf(def).filter(pool => places.some(place => (place.waters.length ? place.waters : [null])
        .some(water => poolFits(pool, { water, biomes: [place.biome] }))));
}

/**
 * The tool a Token's work needs on the planes: a water's kinds from the pools that bite there
 * ({@link poolsOnPlanes}), none when none does; any other Token's own need (`neededToolOf`).
 */
export function planeNeedOf(def) {
    if (!hasCatchPools(def)) return neededToolOf(def);
    const kinds = [...new Set(poolsOnPlanes(def).map(pool => pool.tool))].filter(isToolKind);
    return kinds.length ? { kind: kinds[0], kinds, minTier: 1 } : null;
}

/** The items a Token's rare drop table may land on a cycle or a kill (`rareTables.js`). */
export const rareFindsOf = (def) => (rareTableOf(def)?.entries || []).map(e => e.itemId).filter(Boolean);

/**
 * What planes 1 to `maxPlane` put in the game, on paper: the Starter Camp, the Shop, and every Token
 * the world map's rings up to it write, followed through everything those Tokens spawn, grow
 * into or build, whether or not their inputs can be had. `produced` is every item that world makes,
 * drops (its rare finds among them) or pays, and catches from the pools that bite on its ground;
 * `asked` every item it asks for (inputs, prices, costs, bait), each with who asks; `needs` the
 * tools its work needs there ({@link planeNeedOf}); `built` the Tokens it builds or sells. This is
 * the list the reachability check holds to account.
 */
export function planeWorld(maxPlane = 2) {
    const camp = StarterCamp.starterCamp();
    const allItems = getAllItems();
    const all = Object.values(getAllTokenTypes());
    const tokens = new Set([...StarterCamp.placementsOf(camp).map(t => t.typeId), ...worldTokens(maxPlane), ...arrivingSpots()]);
    const built = new Set();
    for (const def of all) if (def.shop) { tokens.add(def.id); built.add(def.id); }
    const produced = new Set([
        ...StarterCamp.openingBank(camp).map(i => i.itemId),
        ...starterToolIds(allItems),
        ...wellItems()
    ]);
    const asked = new Map();
    const ask = (list, by) => {
        for (const x of list || []) {
            if (!x?.itemId) continue;
            if (!asked.has(x.itemId)) asked.set(x.itemId, new Set());
            asked.get(x.itemId).add(by);
        }
    };
    const needs = new Map();
    const make = (outputs) => {
        for (const o of outputs || []) {
            if (o.itemId) produced.add(o.itemId);
            if (o.tokenId) { tokens.add(o.tokenId); built.add(o.tokenId); }
        }
    };

    let grew = true;
    while (grew) {
        const before = tokens.size + produced.size;
        for (const typeId of [...tokens]) {
            const def = getTokenType(typeId);
            if (!def) continue;
            for (const t of def.trickle || []) produced.add(t.itemId);
            for (const s of def.spawner?.spawns || []) tokens.add(s.typeId);
            if (def.grows?.into) { tokens.add(def.grows.into); ask(def.grows.cost, typeId); }
            if (def.shop) ask(def.shop.price, `${typeId} (Shop)`);
            if (def.config) {
                make(def.config.outputs);
                ask(def.config.inputs, typeId);
                const fx = effectYields(def);
                for (const id of fx.items) produced.add(id);
                for (const id of fx.tokens) tokens.add(id);
                for (const id of rareFindsOf(def)) produced.add(id);
            }
            const need = planeNeedOf(def);
            if (need) needs.set(typeId, need);
            for (const pool of poolsOnPlanes(def)) {
                for (const c of pool.catches) produced.add(c.itemId);
                if (pool.bait) ask([{ itemId: pool.bait }], `${typeId} (bait)`);
            }
            for (const r of recipesForToken(def) || []) {
                make(r.outputs);
                ask(r.inputs, r.id);
            }
        }
        for (const id of [...produced]) {
            for (const bonus of effectYields(getItem(id)).items) produced.add(bonus);
        }
        grew = tokens.size + produced.size > before;
    }
    return { tokens, produced, asked, needs, built };
}

/**
 * The tool kinds a plane's work needs with no starter tool among `items`, in kind order: `needs`
 * is {@link planeWorld}'s (Token id → need). A water needing any of several kinds needs each.
 */
export function startersMissing(needs, items) {
    const starters = new Set(starterToolIds(items).map(id => items[id]?.tool?.kind));
    const kinds = new Set();
    for (const need of needs.values()) for (const kind of need.kinds || [need.kind]) kinds.add(kind);
    return [...kinds].filter(kind => !starters.has(kind));
}
