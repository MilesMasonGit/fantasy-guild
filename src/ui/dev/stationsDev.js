// the QA panel's station pools check (brief 230 S6a): a Furnace that offers only smelting and a Smithy that offers only smithing
// ⚠️ DEV BUILDS ONLY: reached from `StationsDevSection`, which TestDashboard renders behind `import.meta.env.DEV`.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import { qaOrder } from './qaOrders.js';
import * as StationRecipe from '../../systems/board/StationRecipe.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, registerTokenTypes, tokenStartingUses, tokenName } from '../../config/registries/tokenRegistry.js';
import { getSkillRecipePool, registerRecipePools } from '../../config/registries/recipePoolRegistry.js';
import { stationKindLabel } from '../../config/registries/tokenConstants.js';
import { stationKindOf } from '../../systems/effects/statements.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Test Tokens and recipes made in memory for this check only (never written to `data/`, gone on
 * reload). They show the shape the content pack (S8) gives the real Furnace and Smithy:
 * - a QA Furnace: works as Smithing, station kind Furnace;
 * - a QA Smithy: works as Smithing, station kind Smithy;
 * - a copy of every shipped Smithing recipe, the ingots marked Furnace and everything else marked
 *   Smithy (the copper weapons and nails without their anvil, as S8 will author them).
 * ⚠️ A test registration takes over its skill (`registerRecipePools`): until reload, every
 * Smithing station (the shipped Furnace too) sees only these copies.
 */
export const QA_TYPES = Object.freeze({
    FURNACE: 'qa_s6a_furnace',
    SMITHY: 'qa_s6a_smithy'
});
const QA_RECIPE_PREFIX = 'qa_s6a_';

const station = (id, name, sprite, stationKind) => ({
    id, name, tokenType: 'station', rarity: 'common', theme: 'qa', uses: null, sprite, requiresHero: true,
    config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 6000, xp: 1, inputs: [], outputs: [] },
    statements: [{ id: `stm_${id}`, keyword: 'station', payload: { skill: 'smithing', stationKind } }]
});

/** Whether a shipped Smithing recipe smelts (its outputs are ingots). */
const smelts = (recipe) => (recipe.outputs || []).some(o => /ingot/i.test(o?.itemId || ''));

let registered = false;
function registerQa() {
    if (registered) return;
    const furnaceSprite = getTokenType('token_furnace')?.sprite || 's_flask';
    const smithySprite = getTokenType('token_copper_anvil')?.sprite || furnaceSprite;
    registerTokenTypes({
        [QA_TYPES.FURNACE]: station(QA_TYPES.FURNACE, 'QA Furnace', furnaceSprite, 'furnace'),
        [QA_TYPES.SMITHY]: station(QA_TYPES.SMITHY, 'QA Smithy', smithySprite, 'smithy')
    });
    const copies = getSkillRecipePool('smithing').map(r => ({
        ...r,
        id: `${QA_RECIPE_PREFIX}${r.id}`,
        requiresContext: [],
        stationKinds: [smelts(r) ? 'furnace' : 'smithy']
    }));
    registerRecipePools({ smithing: copies });
    registered = true;
}

let scene = null;

function put(typeId, point) {
    const inst = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    return Placement.placeTokenAt(inst, point)?.success ? inst : null;
}

/**
 * Below the Guild Hall, the QA Furnace (left) and the QA Smithy (right), and a Smith with Smithing
 * 40 flagged on the Furnace. Clicking either station and opening its recipe list shows only its own
 * kind: the Furnace the ingots, the Smithy the tools, weapons and nails.
 * ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpStationsScene() {
    if (!getSkillRecipePool('smithing').length && !registered) return { ok: false, error: 'No Smithing recipes in the content' };
    registerQa();
    const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall' || getTokenType(t.typeId)?.isGuildHall);
    const c = hall ? { x: hall.x, y: hall.y } : { x: 880, y: 560 };
    const furnace = put(QA_TYPES.FURNACE, { x: c.x - 160, y: c.y + 260 });
    const smithy = put(QA_TYPES.SMITHY, { x: c.x + 160, y: c.y + 260 });
    if (!furnace || !smithy) return { ok: false, error: 'No room below the Guild Hall for the scene' };

    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const smith = generateHero({ name: 'QA Smith' });
    for (const id of Object.keys(smith.skills || {})) smith.skills[id] = { ...smith.skills[id], level: 40, xp: xpForLevel(40) };
    if (HeroManager.addHero(smith)) qaOrder(smith.id, { x: furnace.x, y: furnace.y });

    scene = { furnace: furnace.id, smithy: smithy.id };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_stations_scene' });
    return { ok: true };
}

/**
 * What each station offers, read from the same pool the recipe picker lists.
 * @returns {string[]}
 */
export function stationsReadout() {
    if (!scene) return [];
    const lines = [];
    for (const id of [scene.furnace, scene.smithy]) {
        const t = BoardState.getTokenById(id);
        if (!t) continue;
        const def = getTokenType(t.typeId);
        const names = StationRecipe.poolFor(def).map(r => r.name || r.id);
        lines.push(`${tokenName(t.typeId)} (${stationKindLabel(stationKindOf(def))}): ${names.length} recipes: ${names.join(', ')}`);
    }
    return lines;
}
