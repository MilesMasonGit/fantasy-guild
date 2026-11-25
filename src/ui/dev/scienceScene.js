// the eye-check scene for Science (brief 810 K6): a Laboratory beside QA Oaks, a scientist on it, a University
// ⚠️ QA BUILDS ONLY, and temporary: wired to a QA panel button for the owner's look, then deleted with
// its test once that eye-check is accepted.

import { EventBus } from '../../systems/core/EventBus.js';
import { GameState } from '../../state/GameState.js';
import { ENGINE_EVENTS } from '../../systems/core/engineEvents.js';
import * as BoardState from '../../systems/board/BoardState.js';
import * as Placement from '../../systems/board/Placement.js';
import * as MatPlacement from '../../systems/board/MatPlacement.js';
import * as TileModifiers from '../../systems/board/TileModifiers.js';
import * as Orders from '../../systems/board/Orders.js';
import * as HeroManager from '../../systems/hero/HeroManager.js';
import * as Mastery from '../../systems/progression/Mastery.js';
import { GuildUpgradeManager } from '../../systems/progression/GuildUpgradeManager.js';
import { generateHero } from '../../systems/hero/HeroGenerator.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { registerEffects } from '../../config/registries/effectRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { LABORATORY_KIND } from '../../config/registries/mastery.js';
import { EFFECT_TYPES } from '../../systems/effects/constants.js';
import { reachRadius } from '../../systems/board/nearby.js';
import { xpForLevel } from '../../utils/XPCurve.js';

/**
 * Made in memory for this check only (never written to `data/`, gone on reload):
 * - QA Oak Tree: an Oak Tree (its art, Oak Wood, Forestry 1) with a five-rank mastery track reached at
 *   2, 4, 6, 8 and 10 studies: QA Quick Felling (Speed 20 %), QA Rich Grain (Yield 25 %), QA Deep Roots
 *   (Refresh 15 %), QA Keen Eye (Lucky 50 %), QA Twin Logs (Double Item 10 % on Oak Wood). It runs out
 *   by chance at 2 % a study or a cut, and rests 30 s where it stands, so it is seldom away;
 * - QA Laboratory (studies nodes up to level 20, a study every 4 s) and QA University (Speed 25 % for
 *   Science in its reach) beside it.
 * Two QA Oaks stand in the Laboratory's reach and one far off, to show the buff reaches every one.
 * QA Scientist (Science 25) is ordered onto the Laboratory, which has no node chosen yet: the gear
 * pulses until the owner picks a QA Oak on its card. ⚠️ Changes the game, like Spawn Party. Each run
 * clears the guild's QA Oak mastery, so the ranks rise again from none.
 */
export const QA_OAK = 'qa_science_oak';
const LAB = 'qa_science_lab';
const UNIVERSITY = 'qa_science_university';
const WOOD = 'item_oak_wood';
const STUDY_MS = 4000;

const fx = (id, name, payload) => ({
    id, name, statements: [{ id: `stm_${id}`, keyword: 'provides', chargeDelta: 0, reach: 'self', target: null, when: null, upkeep: null, to: { mode: 'all', value: '' }, payload }]
});

function register() {
    registerEffects({
        qa_sci_speed: fx('qa_sci_speed', 'QA Quick Felling', { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.2 }),
        qa_sci_yield: fx('qa_sci_yield', 'QA Rich Grain', { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.25 }),
        qa_sci_refresh: fx('qa_sci_refresh', 'QA Deep Roots', { type: EFFECT_TYPES.REFRESH, bucket: 'flat', value: 15 }),
        qa_sci_lucky: fx('qa_sci_lucky', 'QA Keen Eye', { type: EFFECT_TYPES.LUCKY, bucket: 'percentage', value: 0.5 }),
        qa_sci_double: fx('qa_sci_double', 'QA Twin Logs', { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 10, category: WOOD })
    });
    const oak = getTokenType('token_oak_tree') || {};
    registerTokenTypes({
        [QA_OAK]: {
            ...oak, id: QA_OAK, name: 'QA Oak Tree', theme: 'qa', uses: 5, endChance: 2,
            respawn: { mode: 'refill', afterMs: 30_000 }, effects: [], statements: [],
            config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: WOOD, chance: 100, minQty: 1, maxQty: 2 }] },
            mastery: { ranks: [
                { points: 2, effectId: 'qa_sci_speed', scale: 1 },
                { points: 4, effectId: 'qa_sci_yield', scale: 1 },
                { points: 6, effectId: 'qa_sci_refresh', scale: 1 },
                { points: 8, effectId: 'qa_sci_lucky', scale: 1 },
                { points: 10, effectId: 'qa_sci_double', scale: 1 }
            ] }
        },
        [LAB]: {
            id: LAB, name: 'QA Laboratory', tokenType: 'station', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_alembic_small', requiresHero: true, laboratory: { maxLevel: 20 },
            config: { skill: 'science', skillRequired: 1, cycleTimeMs: STUDY_MS, xp: 3, inputs: [], outputs: [] },
            statements: [{ id: `stm_${LAB}_works`, keyword: 'station', payload: { skill: 'science', stationKind: LABORATORY_KIND } }]
        },
        [UNIVERSITY]: {
            id: UNIVERSITY, name: 'QA University', tokenType: 'buff', rarity: 'common', theme: 'qa', uses: null,
            sprite: 't_school_wizard', requiresHero: false, config: null,
            statements: [{
                id: `stm_${UNIVERSITY}_speed`, keyword: 'provides', chargeDelta: 0, reach: 'nearby', target: null, when: null, upkeep: null,
                to: { mode: 'all', value: '' }, payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.25, category: 'science' }
            }]
        }
    });
}

function qaHero(name, skill, level) {
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HeroManager.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name });
    hero.skills = { ...(hero.skills || {}), [skill]: { ...(hero.skills?.[skill] || {}), level, xp: xpForLevel(level) } };
    return HeroManager.addHero(hero) ? hero : null;
}

function placeNear(typeId, aim, reach = 200) {
    const at = MatPlacement.findSpot(typeId, aim, { reach });
    const instance = at ? BoardState.createTokenInstance(typeId, tokenStartingUses(typeId)) : null;
    return instance && Placement.placeTokenAt(instance, at)?.success ? instance : null;
}

/**
 * Lays the scene out on the current mat, the Laboratory near its middle.
 * @returns {{ok: boolean, error?: string, labId?: string, oakIds?: string[], farOakId?: string}}
 */
export function setUpScienceScene() {
    if (!getItem(WOOD)) return { ok: false, error: 'No Oak Wood in the content' };
    register();
    const centre = Placement.centreOfBoard();
    const lab = placeNear(LAB, centre);
    if (!lab) return { ok: false, error: 'No room on the mat for the QA Laboratory' };
    const near = Math.round(reachRadius() * 0.6);
    const oaks = [placeNear(QA_OAK, { x: lab.x + near, y: lab.y }, 80), placeNear(QA_OAK, { x: lab.x, y: lab.y + near }, 80)];
    const university = placeNear(UNIVERSITY, { x: lab.x - near, y: lab.y }, 80);
    const far = placeNear(QA_OAK, { x: lab.x + reachRadius() * 2.5, y: lab.y }, 300);
    if (oaks.some(o => !o) || !university || !far) return { ok: false, error: 'No room on the mat around the QA Laboratory' };
    // The ranks rise again from none on each run.
    const mastery = GameState.state?.progress?.mastery;
    if (mastery && QA_OAK in mastery) delete mastery[QA_OAK];
    Mastery.apply();
    TileModifiers.rebuildAll();

    const scientist = qaHero('QA Scientist', 'science', 25);
    EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'dev_science_scene' });
    if (!scientist) return { ok: false, error: 'The roster would not take the QA Scientist' };
    const order = Orders.orderAt(scientist.id, { x: lab.x, y: lab.y });
    if (!order?.success) return { ok: false, error: order?.reason || 'The scientist would not take the Laboratory' };
    return { ok: true, labId: lab.id, oakIds: oaks.map(o => o.id), farOakId: far.id };
}
