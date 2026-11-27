import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { boostedBy, boosts } from '../systems/board/supportLinks.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * A Neighbours building variant: Speed to nearby Tokens of the skills it trades with, one
 * `Provides` Work Time rule per linked skill, each narrowed by the rule's "only for" skill
 * (`payload.category`). No engine code of its own: this proves the CMS can author it and the
 * board honours it.
 */

/** One linked skill's rule, authored exactly as the CMS Rules line writes it: slot by slot. */
function neighboursRule(skill) {
    let statement = makeStatement(KEYWORD.PROVIDES);
    const apply = (id, value) => {
        const slot = slotsOf(statement, {}).find(s => s.id === id);
        if (!slot) throw new Error(`no ${id} slot`);
        statement = { ...statement, ...slot.patch(value) };
    };
    apply('type', 'WORK_TIME');
    apply('value', -20);        // typed as 20 % faster
    apply('category', skill);
    apply('reach', 'nearby');
    return statement;
}

const MINING_RULE = neighboursRule('mining');
const FISHING_RULE = neighboursRule('fishing');

const producer = (id, skill) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5000, sprite: 's_nature',
    config: {
        skill, skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [],
        outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
    }
});

registerTokenTypes({
    fixture_smithy_neighbours: {
        id: 'fixture_smithy_neighbours', name: 'Smithy Neighbours', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_industry',
        config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 10000, xp: 1 },
        statements: [
            { id: 'stm_nb_smithy', keyword: KEYWORD.STATION, payload: { skill: 'smithing' } },
            MINING_RULE, FISHING_RULE
        ]
    },
    fixture_nb_mine: producer('fixture_nb_mine', 'mining'),
    fixture_nb_pond: producer('fixture_nb_pond', 'fishing'),
    fixture_nb_wood: producer('fixture_nb_wood', 'forestry')
});

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 1, xp: 0 };
    return { id, name: id, status: 'idle', level: 1, skills, hp: { current: 100, max: 100 } };
}

function place(point, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    TileModifiers.rebuildAround([instance]);
    return instance;
}

const P = (row, col) => ({ x: 400 + col * 160, y: 300 + row * 160 });
const BUILDING = P(1, 3);
const NEAR_MINE = P(1, 4);
const NEAR_POND = P(1, 2);
const NEAR_WOOD = P(0, 3);
const FAR_MINE = P(4, 0);       // ~540 u away, outside the 272 u reach

const BASE = 10000;
/** Work time as `BoardRunner` asks for it: the Token's own skill passed as the narrowing. */
const workTime = (instance) => TileModifiers.workTimeOf(instance.id, BASE, skillOf(instance));
const skillOf = (instance) => ({ fixture_nb_mine: 'mining', fixture_nb_pond: 'fishing', fixture_nb_wood: 'forestry' })[instance.typeId];

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    resetMatTuning();
    setMatTuning('reach', 272);
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
});

describe('a Neighbours variant, as the CMS authors it', () => {
    it('is one Provides Work Time rule per linked skill, narrowed by "only for", reaching nearby', () => {
        expect(MINING_RULE).toMatchObject({
            keyword: 'provides', reach: 'nearby', to: { mode: 'all' },
            payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.2, category: 'mining' }
        });
        expect(renderStatement(MINING_RULE)).toMatch(/^Speed \+20% on every nearby Mining Token/);
        expect(renderStatement(FISHING_RULE)).toMatch(/on every nearby Fishing Token/);
    });

    it('passes the content check', () => {
        const findings = auditContent().map(f => JSON.stringify(f));
        expect(findings.filter(f => f.includes('Smithy Neighbours') || f.includes('fixture_smithy_neighbours'))).toEqual([]);
    });
});

describe('a Neighbours variant on the mat', () => {
    it('speeds a nearby Token of each linked skill, and not one of another skill or one out of reach', () => {
        const mine = place(NEAR_MINE, 'fixture_nb_mine');
        const pond = place(NEAR_POND, 'fixture_nb_pond');
        const wood = place(NEAR_WOOD, 'fixture_nb_wood');
        const far = place(FAR_MINE, 'fixture_nb_mine');
        const building = place(BUILDING, 'fixture_smithy_neighbours');

        expect(workTime(mine)).toBeCloseTo(BASE * 0.8);
        expect(workTime(pond)).toBeCloseTo(BASE * 0.8);
        expect(workTime(wood)).toBe(BASE);
        expect(workTime(far)).toBe(BASE);

        // The support lines and badges read the same narrowing.
        expect(boostedBy(mine.id).map(r => r.id)).toEqual([building.id]);
        expect(boostedBy(wood.id)).toEqual([]);
        expect(boosts(building.id).map(r => r.id).sort()).toEqual([mine.id, pond.id].sort());
    });

    it('a hero on the nearby Mining Token finishes cycles faster than one on the Forestry Token', () => {
        place(BUILDING, 'fixture_smithy_neighbours');
        const mine = place(NEAR_MINE, 'fixture_nb_mine');
        const wood = place(NEAR_WOOD, 'fixture_nb_wood');
        Orders.orderAt('hero_1', NEAR_MINE);
        Orders.orderAt('hero_2', NEAR_WOOD);

        // 8 s cycles against 10 s over 100 s: about 12 against 10, whatever the short walk up.
        for (let t = 0; t < 100000; t += 100) BoardRunner.tick(100);
        const counts = GameState.state.collection.cyclesByTokenType;
        expect(counts[wood.typeId]).toBeGreaterThanOrEqual(8);
        expect(counts[mine.typeId]).toBeGreaterThanOrEqual(counts[wood.typeId] + 2);
    });
});
