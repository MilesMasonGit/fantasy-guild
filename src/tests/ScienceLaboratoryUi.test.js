import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Laboratories from '../systems/board/Laboratories.js';
import * as Mastery from '../systems/progression/Mastery.js';
import { effectBreakdown, SOURCE_KIND } from '../systems/board/EffectBreakdown.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { LABORATORY_KIND } from '../config/registries/mastery.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as Banners from '../systems/notifications/banners.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { gearStateOf, isGearOnlyAlert } from '../ui/components/board/centreAlert.js';
import { problemOf, problemText, SEVERITY } from '../ui/components/board/problemMark.js';
import { tokenDetailOf } from '../ui/components/board/useTokenDetail.js';
import { masteryLinesOf } from '../ui/components/encyclopedia/encyclopediaMastery.js';
import { KIND } from '../ui/components/encyclopedia/encyclopediaModel.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * What the player sees of Science (brief 810 K6): the Laboratory's card picks a node in reach with
 * the gear and a list, says the node and its kind's mastery; a node's card shows its kind's rank and
 * the next buff; a rank reached is a banner; a mastered buff names its source on the badges; the
 * Encyclopedia says the kind's rank and next buff.
 */

const FX = 'fixture_scu_yield';
const FX2 = 'fixture_scu_speed';
const LAB = 'fixture_scu_lab';
const VEIN = 'fixture_scu_vein';
const DEEP = 'fixture_scu_deep';
const STUMP = 'fixture_scu_stump';

const track = (...ranks) => ({ ranks: ranks.map(([points, effectId]) => ({ points, effectId, scale: 1 })) });
const vein = (id, name, level, extra = {}) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_ore_vein_copper', requiresHero: true,
    uses: 5, endChance: 0.000001, respawn: { mode: 'refill', afterMs: 30000 },
    config: { skill: 'mining', skillRequired: level, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: 'item_copper_ore', chance: 100, minQty: 1, maxQty: 1 }] },
    ...extra
});

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    registerEffects({
        [FX]: { id: FX, name: 'Keen Eye', statements: [{ id: 'stm_scu_yield', keyword: KEYWORD.PROVIDES, to: null, reach: 'self', payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.25 } }] },
        [FX2]: { id: FX2, name: 'Quick Hands', statements: [{ id: 'stm_scu_speed', keyword: KEYWORD.PROVIDES, to: null, reach: 'self', payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.1 } }] }
    });
    registerTokenTypes({
        [LAB]: {
            id: LAB, name: 'Fixture Lab', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire', requiresHero: true,
            config: { skill: 'science', skillRequired: 1, cycleTimeMs: 2000, xp: 3, inputs: [], outputs: [] },
            laboratory: { maxLevel: 20 },
            statements: [{ id: 'stm_scu_works', keyword: KEYWORD.STATION, payload: { skill: 'science', stationKind: LABORATORY_KIND } }]
        },
        [VEIN]: vein(VEIN, 'Fixture Glow Vein', 5, { mastery: track([2, FX], [5, FX2]) }),
        [DEEP]: vein(DEEP, 'Fixture Deep Vein', 30, { mastery: track([2, FX]) }),
        [STUMP]: {
            id: STUMP, name: 'Fixture Glow Stump', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_stump_oak', requiresHero: false, config: null, grows: { into: VEIN, afterMs: 10000 }
        }
    });
});

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
    Mastery.apply();
});

function scene() {
    const lab = fixtures.placeAt(LAB, 800, 500);
    const node = fixtures.placeAt(VEIN, 960, 500);
    const deep = fixtures.placeAt(DEEP, 800, 660);
    TileModifiers.rebuildAll();
    return { lab, node, deep };
}

describe('the Laboratory on the mat: the gear picks its node', () => {
    it('a Laboratory gets the gear, pulsing until a node is chosen, and its choice is a yellow mark', () => {
        const { lab, node } = scene();
        const detail = tokenDetailOf(lab.id, getTokenType(LAB));
        expect(detail).toMatchObject({ isLaboratory: true, nodeChosen: false });
        expect(gearStateOf(detail)).toEqual({ show: true, pulsing: true });
        expect(problemOf({ choose: 'node' })).toEqual({ kind: ALERT.CHOOSE_NODE, severity: SEVERITY.WAITING });
        expect(problemText({ kind: ALERT.CHOOSE_NODE }, lab.id)).toBe('Choose a node to study');
        expect(isGearOnlyAlert(ALERT.CHOOSE_NODE)).toBe(true);
        Laboratories.setTarget(lab, node.id);
        const chosen = tokenDetailOf(lab.id, getTokenType(LAB));
        expect(gearStateOf(chosen)).toEqual({ show: true, pulsing: false });
    });

    it('a kind fully mastered says so, naming it', () => {
        const { lab, node } = scene();
        Laboratories.setTarget(lab, node.id);
        GameState.state.progress.mastery[VEIN] = 5;
        expect(problemText({ kind: ALERT.NODE_MASTERED }, lab.id)).toBe('Fixture Glow Vein is fully mastered: choose another node');
    });
});

describe('the Laboratory\'s card', () => {
    it('with nothing chosen: no node, Choose a node, and the nodes in reach, the one above its level greyed', () => {
        const { lab, node, deep } = scene();
        const model = tokenCardModel(LAB, lab.id);
        const study = model.blocks.find(b => b.id === CARD_BLOCK.STUDY);
        expect(study).toMatchObject({ node: null, lost: false, change: { label: 'Choose a node', chosen: false }, skillName: 'Science', maxLevel: 20 });
        expect(study.options.map(o => [o.id, o.refusal, o.level])).toEqual([[node.id, null, 5], [deep.id, 'level', 30]]);
        expect(model.blocks.some(b => b.id === CARD_BLOCK.RECIPE)).toBe(false);
    });

    it('with a node chosen: the node, its level as the work\'s, its kind\'s mastery and the next buff', () => {
        const { lab, node } = scene();
        Laboratories.setTarget(lab, node.id);
        GameState.state.progress.mastery[VEIN] = 1;
        const model = tokenCardModel(LAB, lab.id);
        expect(model.blocks.find(b => b.id === CARD_BLOCK.WORK)).toMatchObject({ skillId: 'science', level: 5, xp: 3 });
        const study = model.blocks.find(b => b.id === CARD_BLOCK.STUDY);
        expect(study.node).toMatchObject({ id: node.id, name: 'Fixture Glow Vein', level: 5, rank: 0, ranks: 2 });
        expect(study.change).toEqual({ label: 'Change node', chosen: true });
        expect(study.mastery).toMatchObject({ rank: 0, points: 1, pips: [false, false], next: { rank: 1, roman: 'I', points: 2, buff: 'Keen Eye', toGo: 1 } });
    });

    it('a node moved out of reach reads as lost', () => {
        const { lab, node } = scene();
        Laboratories.setTarget(lab, node.id);
        BoardState.setTokenPoint(node.id, 1700, 500);
        expect(tokenCardModel(LAB, lab.id).blocks.find(b => b.id === CARD_BLOCK.STUDY)).toMatchObject({ node: null, lost: true });
    });
});

describe('a node\'s card and the badges', () => {
    it('a node of a kind with a track shows its mastery; a rank held names Science as the buff\'s source', () => {
        const { node } = scene();
        GameState.state.progress.mastery[VEIN] = 2;
        Mastery.apply();
        const block = tokenCardModel(VEIN, node.id).blocks.find(b => b.id === CARD_BLOCK.MASTERY);
        expect(block).toMatchObject({ kind: VEIN, rank: 1, roman: 'I', pips: [true, false], next: { roman: 'II', buff: 'Quick Hands', toGo: 3 } });
        expect(block.held.map(h => h.buff)).toEqual(['Keen Eye']);
        const yieldBadge = effectBreakdown(node.id).effects.find(e => e.type === EFFECT_TYPES.YIELD);
        expect(yieldBadge.sources).toEqual([expect.objectContaining({ kind: SOURCE_KIND.MASTERY, name: 'Fixture Glow Vein mastery I', amount: 25 })]);
    });

    it('a Stump shows its tree\'s mastery; a Token of no tracked kind shows none', () => {
        const { lab } = scene();
        const stump = fixtures.placeAt(STUMP, 960, 340);
        expect(tokenCardModel(STUMP, stump.id).blocks.find(b => b.id === CARD_BLOCK.MASTERY)).toMatchObject({ kind: VEIN });
        expect(tokenCardModel(LAB, lab.id).blocks.find(b => b.id === CARD_BLOCK.MASTERY)).toBeUndefined();
    });
});

describe('a rank reached is a banner; the Encyclopedia says the rank', () => {
    beforeEach(() => { Banners.reset(); wireNotifications(); });
    afterEach(() => { unwireNotifications(); Banners.reset(); });

    it('a rank up is one gold banner naming the kind, the rank and its buff', () => {
        Mastery.addPoints(VEIN, 2);
        const all = Banners.getAll();
        expect(all.map(b => [b.kind, b.tone])).toEqual([['mastery', 'milestone']]);
        expect(all[0].title).toBe('Mastery!');
        expect(all[0].line).toBe('Fixture Glow Vein mastery I: Keen Eye on every Fixture Glow Vein');
    });

    it('the Encyclopedia: a Token entry\'s kind, rank and next buff; full mastery; none for a kind with no track', () => {
        expect(masteryLinesOf({ kind: KIND.TOKEN, id: VEIN })).toEqual(['Fixture Glow Vein mastery: rank 0 of 2', 'Next, rank I: Keen Eye in 2 studies']);
        expect(masteryLinesOf({ kind: KIND.TOKEN, id: STUMP })[0]).toBe('Fixture Glow Vein mastery: rank 0 of 2');
        GameState.state.progress.mastery[VEIN] = 9;
        expect(masteryLinesOf({ kind: KIND.TOKEN, id: VEIN })).toEqual(['Fixture Glow Vein mastery: rank 2 of 2', 'Fully mastered']);
        expect(masteryLinesOf({ kind: KIND.TOKEN, id: LAB })).toEqual([]);
        expect(masteryLinesOf({ kind: KIND.ITEM, id: 'item_x' })).toEqual([]);
    });
});

describe('a rank reached while away', () => {
    it('is heard by the engine as it is reached (the banner waits for the loud bus)', () => {
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.MASTERY_RANK_UP, (p) => heard.push(p.rank));
        Mastery.addPoints(VEIN, 5);
        off();
        expect(heard).toEqual([1, 2]);
    });
});
