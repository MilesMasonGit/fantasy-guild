// The QA panel's building-nodes check: Wood Foundations on Stone, at the shore and on grass, and test builds that need each
// ⚠️ QA BUILDS ONLY: reached from `AtlasDevSection`, which TestDashboard renders behind `QA_TOOLS`.

import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as GroundRules from '../../systems/board/GroundRules.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { addXP, getSkillLevel } from '../../systems/hero/SkillSystem.js';
import { xpForLevel } from '../../utils/XPCurve.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import { cellCentre, TERRAIN } from '../../systems/atlas/TerrainMap.js';
import { getTokenType, registerTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../../config/registries/recipePoolRegistry.js';

/**
 * Test Tokens and building recipes made in memory for this check only (never written to `data/`,
 * gone on reload), standing for what the content pack gives the real ones:
 * - a Test Copper Mine and a Test Quarry that stand only on Stone;
 * - a Test Clay Pit that stands only at the shore;
 * - a Test Planted Forest that goes anywhere dry and, built, spawns 50 % slower than a wild one;
 * - a Test Crystal Growth that stands only within reach of the Test Leyline.
 * Each is built on the shipped Wood Foundation, beside its shipped recipes.
 */
export const QA_W4 = Object.freeze({
    MINE: 'qa_w4_mine',
    QUARRY: 'qa_w4_quarry',
    CLAY_PIT: 'qa_w4_clay_pit',
    FOREST: 'qa_w4_forest',
    LEYLINE: 'qa_w4_leyline',
    CRYSTAL: 'qa_w4_crystal'
});

const FOUNDATION = 'token_wood_foundation';

const node = (id, name, looksLike, extra = {}) => ({
    id, name, description: `Dev only: ${name}.`, sprite: getTokenType(looksLike)?.sprite ?? null,
    tokenType: 'buff', rarity: 'common', theme: 'qa', tags: [], size: 1, uses: null, requiresHero: false, config: null, ...extra
});

const build = (id, name, tokenId) => ({
    id, name, levelRequirement: 1, foundationKinds: ['wood'], inputs: [],
    outputs: [{ tokenId, chance: 100, minQty: 1, maxQty: 1 }], durationMs: 3000, xp: 1
});

function register() {
    if (getTokenType(QA_W4.MINE)) return;
    const oak = getTokenType('token_oak_forest');
    registerTokenTypes({
        [QA_W4.MINE]: node(QA_W4.MINE, 'Test Copper Mine (Stone only)', 'token_copper_mine', { standsOn: ['stone'] }),
        [QA_W4.QUARRY]: node(QA_W4.QUARRY, 'Test Quarry (Stone only)', 'token_quarry', { standsOn: ['stone'] }),
        [QA_W4.CLAY_PIT]: node(QA_W4.CLAY_PIT, 'Test Clay Pit (shore only)', 'token_clay_deposit', { standsOn: ['shore'] }),
        [QA_W4.FOREST]: oak
            ? { ...oak, id: QA_W4.FOREST, name: 'Test Planted Forest (built)', effects: [] }
            : node(QA_W4.FOREST, 'Test Planted Forest (built)', 'token_oak_forest'),
        [QA_W4.LEYLINE]: node(QA_W4.LEYLINE, 'Test Leyline', 'token_forge_altar'),
        [QA_W4.CRYSTAL]: node(QA_W4.CRYSTAL, 'Test Crystal Growth (near the Test Leyline)', 'token_forge_altar', { standsNear: [QA_W4.LEYLINE] })
    });
    registerRecipePools({
        construction: [
            build('qa_w4_build_mine', 'Build Test Copper Mine', QA_W4.MINE),
            build('qa_w4_build_quarry', 'Build Test Quarry', QA_W4.QUARRY),
            build('qa_w4_build_clay_pit', 'Build Test Clay Pit', QA_W4.CLAY_PIT),
            build('qa_w4_plant_forest', 'Plant Test Forest', QA_W4.FOREST),
            build('qa_w4_grow_crystal', 'Grow Test Crystal', QA_W4.CRYSTAL)
        ]
    }, { takeOver: false });
}

/** The ground cell nearest `from` that `test` accepts, as its centre, or null. */
function nearestCell(from, test) {
    const ground = GroundRules.groundHere();
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < ground.terrains.length; i++) {
        if (!test(ground, i)) continue;
        const c = cellCentre(ground, i);
        const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
        if (d < bestD) {
            best = c;
            bestD = d;
        }
    }
    return best;
}

/** A Wood Foundation put down near `aim`, on ground a Token of `siteOf` may stand on. */
function putFoundation(aim, siteOf = null) {
    if (!aim) return null;
    const spot = MatPlacement.findSpot(FOUNDATION, aim, { reach: 480, siteOf });
    if (!spot) return null;
    const inst = BoardState.createTokenInstance(FOUNDATION, tokenStartingUses(FOUNDATION));
    return Placement.placeTokenAt(inst, { x: spot.x, y: spot.y })?.success ? inst : null;
}

/**
 * On the mat the guild is on: a Wood Foundation on the Stone nearest the Guild Hall, one at the
 * nearest shore, two on plain ground (neither Stone nor shore), and a Test Leyline well away from
 * those two; a hero with Construction raised to 5, or a QA Builder when none holds it. Nothing is chosen on the Foundations: the check
 * picks each build from the Foundation's card. Settle a Highland or Riverside place first for
 * Stone and water.
 * ⚠️ Changes the game, like Spawn Party.
 *
 * @returns {{success: boolean, reason?: string, placed?: string[], missing?: string[]}}
 */
export function setUpBuildingScene() {
    if (!getTokenType(FOUNDATION)) return { success: false, reason: 'No Wood Foundation in the content' };
    register();
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    if (!hall) return { success: false, reason: 'No Guild Hall on this mat' };

    const placed = [];
    const missing = [];
    const stone = putFoundation(nearestCell(hall, (g, i) => g.terrains[i] === TERRAIN.STONE), QA_W4.MINE);
    (stone ? placed : missing).push('a Foundation on Stone');
    const shore = putFoundation(nearestCell(hall, (g, i) => g.shore[i] === 1), QA_W4.CLAY_PIT);
    (shore ? placed : missing).push('a Foundation at the shore');
    const offStone = (g, i) => g.terrains[i] !== TERRAIN.STONE && g.terrains[i] !== TERRAIN.WATER && g.shore[i] !== 1;
    const grass = putFoundation(nearestCell({ x: hall.x, y: hall.y + 260 }, offStone));
    const grass2 = grass && putFoundation({ x: grass.x + 180, y: grass.y });
    (grass && grass2 ? placed : missing).push('two Foundations on plain ground');
    if (grass) {
        const at = MatPlacement.findSpot(QA_W4.LEYLINE, { x: grass.x - 480, y: grass.y }, { reach: 300 });
        const inst = at && BoardState.createTokenInstance(QA_W4.LEYLINE, null);
        (inst && Placement.placeTokenAt(inst, at)?.success ? placed : missing).push('the Test Leyline');
    }

    const builder = (HeroManager.getAllHeroes() || []).find(h => !h.isVillager && h.skills?.construction);
    if (builder) {
        if ((getSkillLevel(builder.id, 'construction') || 0) < 5) {
            addXP(builder.id, 'construction', Math.max(1, xpForLevel(5) - (builder.skills.construction.xp || 0)));
        }
    } else {
        // No one here can build: a QA Builder joins, as the stations check's QA Smith does.
        const ranks = GuildUpgradeManager.getRanks();
        ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
        GuildUpgradeManager.recompute();
        const hero = generateHero({ name: 'QA Builder' });
        for (const id of Object.keys(hero.skills || {})) hero.skills[id] = { ...hero.skills[id], level: 10, xp: xpForLevel(10) };
        if (HeroManager.addHero(hero)) placed.push('a QA Builder');
        EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_building_scene' });
    }
    return { success: placed.length > 0, placed, missing, reason: placed.length ? undefined : 'Nowhere to put the Foundations' };
}
