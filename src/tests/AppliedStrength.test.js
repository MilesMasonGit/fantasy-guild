import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { scaleStatement, expandBearer } from '../systems/effects/effectLibrary.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import * as CombatFormulas from '../systems/combat/CombatFormulas.js';
import { ROLE } from '../config/registries/roleRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { registerStatusFixtures, SUNDER } from './fixtures/statusEffects.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A strength on an "Applies" effect: the bearer's strength sets the applied effect's strength (an
 * Elixir of Brambles at 3 gives Brambles at 3), for an item, a perk and a Token alike. A status
 * still lands one stack a hit, at that strength. Two items applying one effect add up as that
 * effect's own landing rule says: a plain effect keeps the stronger, a status gains a stack.
 */

const SPOT = { x: 400, y: 400 };

/** "When a fight starts, applies <effect> to the hero for the fight." */
const forTheFight = (effectId) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
    payload: { effectId, scale: 1, durationMs: 0, forFight: true, chance: 100 }
});

/** "When a fight starts, applies <status> to the hero" (a status keeps its own lifetime). */
const statusOnHero = (effectId) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
    target: { role: ROLE.ACTOR },
    payload: { effectId, scale: 1, durationMs: 0, chance: 100 }
});

const damage = (value) => ({
    ...makeStatement(KEYWORD.PROVIDES),
    payload: { type: 'DAMAGE', bucket: 'flat', value },
    to: null
});

registerEffects({
    as_fx_brambles: { id: 'as_fx_brambles', name: 'Brambles', statements: [damage(1)] },
    as_fx_elixir_brambles: { id: 'as_fx_elixir_brambles', name: 'Elixir of Brambles', statements: [forTheFight('as_fx_brambles')] },
    as_fx_tonic_brambles: { id: 'as_fx_tonic_brambles', name: 'Bramble Tonic', statements: [forTheFight('as_fx_brambles')] },
    as_fx_sundering: { id: 'as_fx_sundering', name: 'Sundering', statements: [statusOnHero(SUNDER)] },
    as_fx_cracking: { id: 'as_fx_cracking', name: 'Cracking', statements: [statusOnHero(SUNDER)] }
});

registerItems({
    as_elixir_1: { id: 'as_elixir_1', name: 'Brambles', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'as_fx_elixir_brambles', scale: 1 }] },
    as_elixir_3: { id: 'as_elixir_3', name: 'Brambles', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'as_fx_elixir_brambles', scale: 3 }] },
    as_tonic_2: { id: 'as_tonic_2', name: 'Tonic', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'as_fx_tonic_brambles', scale: 2 }] },
    as_sunder_3: { id: 'as_sunder_3', name: 'Sunder', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'as_fx_sundering', scale: 3 }] },
    as_crack_2: { id: 'as_crack_2', name: 'Crack', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'as_fx_cracking', scale: 2 }] }
});

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 60, xp: 0 };
    hero.equipment = Array(9).fill(null);
    hero.aggregator = new ModifierAggregator(hero.id);
    return hero;
}

let hero;
let engagements;
let offs = [];

function placeEnemy(heroId = 'hero_as') {
    const instance = BoardState.createTokenInstance('fixture_enemy', tokenStartingUses('fixture_enemy'));
    Placement.placeTokenAt(instance, SPOT);
    TileModifiers.rebuildAround([instance]);
    if (heroId) Orders.orderAt(heroId, SPOT);
    return instance;
}

function untilEngaged() {
    const target = engagements.length + 1;
    for (let i = 0; i < 20000 && engagements.length < target; i++) BoardRunner.tick(100);
    expect(engagements.length).toBe(target);
}

/** Equip `items` (one in the Bank each) and start one fight. */
function fightWith(...items) {
    items.forEach((itemId, slot) => {
        hero.equipment[slot] = itemId;
        InventoryManager.addItem(itemId, 1);
    });
    placeEnemy();
    untilEngaged();
}

const carried = (effectId) => hero.effects.filter(e => e.effectId === effectId);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    LoadoutMoments.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    TriggerSystem.init();
    registerStatusFixtures();
    LiveEffects.resetClock();
    hero = makeHero('hero_as');
    GameState.state.heroes = [hero];
    GameState.state.inventory.maxSlots = 50;

    offs.forEach(off => off());
    engagements = [];
    offs = [EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engagements.push(p))];
});

afterEach(() => {
    registerSkillPerks({ melee: { perks: [] } });
});

describe('a strength on an Applies statement', () => {
    it('sets the applied effect strength to the bearer strength', () => {
        const applies = forTheFight('as_fx_brambles');
        expect(scaleStatement(applies, 3).payload.scale).toBe(3);
    });

    it('multiplies a strength the rule already names, capped at 5', () => {
        const applies = forTheFight('as_fx_brambles');
        const two = { ...applies, payload: { ...applies.payload, scale: 2 } };
        expect(scaleStatement(two, 2).payload.scale).toBe(4);
        expect(scaleStatement(two, 4).payload.scale).toBe(5);
    });

    it('reads a rule with no strength of its own as 1', () => {
        const applies = forTheFight('as_fx_brambles');
        const bare = { ...applies, payload: { effectId: 'as_fx_brambles', forFight: true } };
        expect(scaleStatement(bare, 2).payload.scale).toBe(2);
    });

    it('at strength 1 hands back the very same statement', () => {
        const applies = forTheFight('as_fx_brambles');
        expect(scaleStatement(applies, 1)).toBe(applies);
    });

    it('reaches the rule of a Token whose reference carries a strength', () => {
        const enemy = expandBearer({ id: 'as_token', effects: [{ effectId: 'as_fx_elixir_brambles', scale: 2 }] },
            { as_fx_elixir_brambles: { id: 'as_fx_elixir_brambles', name: 'Elixir of Brambles', statements: [forTheFight('as_fx_brambles')] } });
        expect(enemy.statements[0].payload.scale).toBe(2);
    });
});

describe('an item whose effect applies another, with a strength', () => {
    it('at strength 1 gives the applied effect at 1, as before', () => {
        const before = CombatFormulas.heroBaseDamage(hero);
        fightWith('as_elixir_1');
        expect(carried('as_fx_brambles').map(e => e.scale)).toEqual([1]);
        expect(CombatFormulas.heroBaseDamage(hero)).toBe(before + 1);
    });

    it('at strength 3 gives the applied effect at 3', () => {
        const before = CombatFormulas.heroBaseDamage(hero);
        fightWith('as_elixir_3');
        expect(carried('as_fx_brambles').map(e => e.scale)).toEqual([3]);
        expect(CombatFormulas.heroBaseDamage(hero)).toBe(before + 3);
    });

    it('lands a status one stack at a time, at the item strength', () => {
        fightWith('as_sunder_3');
        const [sunder] = carried(SUNDER);
        expect(sunder.stacks).toBe(1);
        expect(sunder.scale).toBe(3);
        const values = LiveEffects.liveStatements(hero)
            .filter(s => s.payload?.type === EFFECT_TYPES.SUNDER).map(s => s.payload.value);
        expect(values).toEqual([30]);
    });
});

describe('two items applying one effect', () => {
    it('a plain effect is carried once, at the stronger of the two', () => {
        const before = CombatFormulas.heroBaseDamage(hero);
        fightWith('as_tonic_2', 'as_elixir_3');
        expect(carried('as_fx_brambles').map(e => e.scale)).toEqual([3]);
        expect(CombatFormulas.heroBaseDamage(hero)).toBe(before + 3);
    });

    it('a status gains a stack from each, at the stronger strength', () => {
        fightWith('as_crack_2', 'as_sunder_3');
        const [sunder] = carried(SUNDER);
        expect(sunder.stacks).toBe(2);
        expect(sunder.scale).toBe(3);
    });
});

describe('a perk whose effect applies another, with a strength', () => {
    it('gives the applied effect at the perk strength', () => {
        registerSkillPerks({ melee: { perks: [{ level: 10, effectId: 'as_fx_elixir_brambles', scale: 2 }] } });
        const before = CombatFormulas.heroBaseDamage(hero);
        placeEnemy();
        untilEngaged();
        expect(carried('as_fx_brambles').map(e => e.scale)).toEqual([2]);
        expect(CombatFormulas.heroBaseDamage(hero)).toBe(before + 2);
    });
});
