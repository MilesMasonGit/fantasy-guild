// the eye-check scene for coin costs and coin drops: two coin camps, one in a Counting House's reach, and two Shop Tokens that ask coins
// ⚠️ QA BUILDS ONLY, and temporary: wired to a QA panel button for the owner's look, then deleted.

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as SpawnerSystem from '../../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as SkillSystem from '../../systems/hero/SkillSystem.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { GameState } from '../../state/GameState.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { registerHallSky, authoredHallSky } from '../../config/registries/hallStarRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { KEYWORD } from '../../systems/effects/statements.js';
import { reachRadius } from '../../systems/board/nearby.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Made in memory for this check only (never written to `data/`, gone on reload):
 * - two QA Coin Camps of QA Coin Goblins (two at most each), every goblin dropping 5 coins; one camp
 *   stands in a QA Counting House's reach (Coin Find +100%), so its goblins drop 10;
 * - in the Shop, first in the list: a QA Coin Foundation (a Wood Foundation for 2 Oak Wood and 40
 *   coins) and a QA Coin Farmland (a Farmland for 2 Oak Wood and 25 coins);
 * - in the Guild Hall's sky, a QA Coin Star linked to the Hall: rank 1 for 1 Oak Wood and 30 coins,
 *   rank 2 for 60 coins (it gives nothing);
 * - QA Fighter (Melee 40) at the Guild Hall, to send at the camps.
 * ⚠️ Changes the game, like Spawn Party.
 */
const GOBLIN = 'qa_coin_goblin';
const CAMP = 'qa_coin_camp';
const HOUSE = 'qa_counting_house';
const FOUNDATION = 'qa_coin_foundation';
const FARMLAND = 'qa_coin_farmland';
const COIN_DROP = 5;
const FIGHTER_LEVEL = 40;
const STAR = 'qa_coin_star';

/** The authored sky with the QA Coin Star beside the Hall, in a QA constellation of its own. */
function registerStar() {
    const sky = authoredHallSky() || {};
    registerHallSky({
        constellations: { ...(sky.constellations || {}), qa_coins: { id: 'qa_coins', name: 'QA Coins', label: { x: 0, y: 1.6 } } },
        stars: {
            ...(sky.stars || {}),
            [STAR]: {
                id: STAR, constellation: 'qa_coins', name: 'QA Coin Star', description: 'Asks coins; gives nothing.',
                node: { x: 0, y: 1.2 }, links: ['hall'],
                ranks: [
                    { price: [{ itemId: 'item_oak_wood', quantity: 1 }], coins: 30, rules: [], lines: [] },
                    { price: [], coins: 60, rules: [], lines: [] }
                ]
            }
        }
    });
    GuildUpgradeManager.recompute();
}

function registerScene() {
    const goblin = getTokenType('token_goblin');
    const camp = getTokenType('token_goblin_camp');
    const foundation = getTokenType('token_wood_foundation');
    const farmland = getTokenType('token_farmland');
    const priced = (def, coins) => ({ ...(def?.shop || {}), price: [{ itemId: 'item_oak_wood', quantity: 2 }], coins, order: 0, group: undefined });
    registerTokenTypes({
        [GOBLIN]: { ...goblin, id: GOBLIN, name: 'QA Coin Goblin', enemy: { ...(goblin.enemy || {}), coinDrop: COIN_DROP } },
        [CAMP]: {
            ...camp, id: CAMP, name: 'QA Coin Camp',
            spawner: { spawns: [{ typeId: GOBLIN, weight: 1 }], allowance: 2, intervalMs: 8000, upkeep: [] }
        },
        [HOUSE]: {
            id: HOUSE, name: 'QA Counting House', tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null, sprite: 't_campfire',
            statements: [{
                id: `stm_${HOUSE}_find`, keyword: KEYWORD.PROVIDES, to: { mode: 'all' },
                payload: { type: EFFECT_TYPES.COIN_FIND, bucket: 'percentage', value: 1.0 }
            }]
        },
        [FOUNDATION]: { ...foundation, id: FOUNDATION, name: 'QA Coin Foundation', shop: priced(foundation, 40) },
        [FARMLAND]: { ...farmland, id: FARMLAND, name: 'QA Coin Farmland', shop: priced(farmland, 25) }
    });
}

function place(typeId, near) {
    const at = MatPlacement.findSpot(typeId, near, { reach: 200 });
    const instance = at ? BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)) : null;
    return instance && Placement.placeTokenAt(instance, at)?.success ? instance : null;
}

function addFighter() {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, GameState.state.heroes.length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name: 'QA Fighter', takenNames: HeroManager.getAllHeroes().map(h => h.name) });
    if (!HeroManager.addHero(hero)) return null;
    const need = xpForLevel(FIGHTER_LEVEL) - (hero.skills?.melee?.xp || 0);
    if (need > 0) SkillSystem.addXP(hero.id, 'melee', need);
    if (hero.hp) hero.hp.current = hero.hp.max;
    return hero;
}

/**
 * Lays the scene out on the current mat: the two camps either side of its middle, the Counting
 * House beside the left one only.
 * @returns {{ok: boolean, error?: string}}
 */
export function setUpCoinScene() {
    for (const id of ['token_goblin', 'token_goblin_camp', 'token_wood_foundation', 'token_farmland']) {
        if (!getTokenType(id)) return { ok: false, error: `No ${id} in the content` };
    }
    registerScene();
    registerStar();
    const centre = Placement.centreOfBoard();
    const apart = Math.round(reachRadius() * 1.6);
    const rich = place(CAMP, { x: centre.x - apart, y: centre.y });
    const plain = place(CAMP, { x: centre.x + apart, y: centre.y });
    if (!rich || !plain) return { ok: false, error: 'No room on the mat for the QA Coin Camps' };
    const house = place(HOUSE, { x: rich.x, y: rich.y + Math.round(reachRadius() * 0.5) });
    if (!house) return { ok: false, error: 'No room on the mat for the QA Counting House' };
    for (const camp of [rich, plain]) for (let i = 0; i < 2; i++) SpawnerSystem.attemptSpawn(camp, getTokenType(CAMP));
    TileModifiers.rebuildAll();
    const fighter = addFighter();
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_coin_scene' });
    EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED);
    if (!fighter) return { ok: false, error: 'The roster would not take the QA Fighter' };
    return { ok: true };
}
