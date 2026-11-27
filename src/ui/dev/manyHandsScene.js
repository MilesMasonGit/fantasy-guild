// the eye-check scene for Many Hands: a crafter working two recipes at once at a Workshop (brief 800 P3)
// ⚠️ QA BUILDS ONLY, and temporary: wired to a QA panel button for the owner's look, then deleted with
// its test once that eye-check is accepted (or once the content agent's perk pack brings the real perk).

import { EventBus } from '../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Orders from '../../systems/board/Orders.js';
import * as StationRecipe from '../../systems/board/StationRecipe.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import { InventoryManager } from '../../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { registerEffects } from '../../config/registries/effectRegistry.js';
import { registerSkillPerks, perkRowsFor } from '../../config/registries/perkRegistry.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Made in memory for this check only (never written to `data/`, gone on reload): a Test Many Hands
 * perk at Crafting 99 beside Crafting's own perks, and a QA Crafter at Crafting 99 who holds it. The
 * scene puts a Workshop on the mat set to Charcoal and, as its second recipe, Leather, with 40 Oak
 * Wood and two Leathers' worth of Hide in the Bank (read from the recipe, whose count the balance
 * rules set), and sends the QA Crafter to it: both recipes run side by side, the Leather runs out of
 * Hide after two and its section on the card says Needs Hide while the Charcoal carries on, with no
 * mark on the mat.
 */
export const QA_MH = Object.freeze({
    STATION: 'token_workbench', FIRST_MAKES: 'item_charcoal', SECOND_MAKES: 'item_leather',
    WOOD: 'item_oak_wood', HIDE: 'item_hide', PERK: 'qa_mh_many_hands', HERO: 'QA Crafter'
});

function register() {
    registerEffects({
        [QA_MH.PERK]: {
            id: QA_MH.PERK, name: 'Test Many Hands',
            statements: [{
                id: `stm_${QA_MH.PERK}`, keyword: 'provides', chargeDelta: 0, target: null, when: null, upkeep: null, to: null,
                payload: { type: EFFECT_TYPES.SECOND_RECIPE, bucket: 'flat', value: 1, category: 'crafting' }
            }]
        }
    });
    // Crafting's own table keeps its rows; the Test perk is added beside them, once.
    const held = perkRowsFor('crafting').filter(r => r.effectId !== QA_MH.PERK);
    registerSkillPerks({ crafting: { perks: [...held, { level: 99, effectId: QA_MH.PERK }] } });
}

/** The first recipe in the station's pool that makes `itemId`, or null. */
function recipeMaking(def, itemId) {
    return StationRecipe.poolFor(def).find(r => (r.outputs || []).some(o => o?.itemId === itemId)) || null;
}

/** The Bank holds exactly `n` of `itemId`. */
function setBank(itemId, n) {
    const have = InventoryManager.getItemCount(itemId);
    if (have > n) InventoryManager.removeItem(itemId, have - n);
    if (have < n) InventoryManager.addItem(itemId, n - have);
}

/** A new QA hero at Crafting 99, the roster cap raised for them. */
function qaCrafter() {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name: QA_MH.HERO });
    hero.skills = { ...(hero.skills || {}), crafting: { ...(hero.skills?.crafting || {}), level: 99, xp: xpForLevel(99) } };
    return HeroManager.addHero(hero) ? hero : null;
}

/**
 * The scene: a Workshop set to Charcoal and Leather, the Bank's Wood and Hide set, a QA Crafter
 * holding Test Many Hands sent to it. ⚠️ Changes the game, like Spawn Party.
 * @returns {{ok: boolean, error?: string, instanceId?: string, heroId?: string}}
 */
export function setUpManyHandsScene() {
    register();
    const def = getTokenType(QA_MH.STATION);
    if (!def) return { ok: false, error: `No ${QA_MH.STATION} in the content` };
    const first = recipeMaking(def, QA_MH.FIRST_MAKES);
    const second = recipeMaking(def, QA_MH.SECOND_MAKES);
    if (!first || !second) return { ok: false, error: 'The Workshop makes no Charcoal or no Leather in the content' };

    const at = MatPlacement.findSpot(QA_MH.STATION, { x: 700, y: 640 }, { reach: 700 });
    const station = at ? BoardState.createTokenInstance(QA_MH.STATION, tokenStartingUses(QA_MH.STATION)) : null;
    if (!station || !Placement.placeTokenAt(station, at)?.success) return { ok: false, error: 'No room on the mat for the Workshop' };
    StationRecipe.setSelectedRecipe(station, first.id, def);
    if (!StationRecipe.setSecondRecipe(station, second.id, def)) return { ok: false, error: 'The Workshop would not take Leather as its second recipe' };

    const hidePerCraft = (second.inputs || []).find(i => i?.itemId === QA_MH.HIDE)?.quantity;
    if (!(hidePerCraft >= 1)) return { ok: false, error: 'The Leather recipe asks for no Hide in the content' };
    setBank(QA_MH.WOOD, 40);
    setBank(QA_MH.HIDE, 2 * hidePerCraft);
    const hero = qaCrafter();
    if (!hero) return { ok: false, error: 'The roster would not take a QA hero' };
    TileModifiers.rebuildAll();
    const order = Orders.orderAt(hero.id, { x: station.x, y: station.y });
    if (!order?.success) return { ok: false, error: order?.reason || 'The QA Crafter would not take their order' };
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_many_hands_scene' });
    return { ok: true, instanceId: station.id, heroId: hero.id };
}
