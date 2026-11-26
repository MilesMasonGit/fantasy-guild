// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { DiscoveryManager } from '../systems/core/DiscoveryManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getEnemyProfile } from '../config/registries/enemyProfile.js';
import { enemyFightNumbers } from '../systems/effects/enemyKindEffects.js';
import { TokenCard } from '../ui/components/board/TokenCard.jsx';
import { tokenCardModel, CARD_BLOCK, enemyMovesOnCard, enemyKindsOnCard } from '../ui/components/board/tokenCard.js';
import { t } from '../i18n/index.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * An enemy has no hover: its Token card shows everything. Level, style, health, its hit, moves,
 * resistances, how often it attacks and drops from the start; its kinds once the guild has fought
 * one of it, until then a line saying to fight one.
 */

registerEffects({ etc_flutter: { id: 'etc_flutter', name: 'Flutter', statements: [] } });
registerTokenTypes({
    etc_hen: {
        id: 'etc_hen', name: 'Card Hen', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, sprite: 'e_chicken',
        requiresHero: true,
        enemy: {
            level: 4, style: 'ranged', kinds: ['effect_brute', 'effect_nimble'],
            resistances: { slash: 25, crush: 25, stab: 25, fire: -50 },
            moves: [
                { name: 'Peck', damageType: 'stab' },
                { name: 'Flutter', hits: false, effectId: 'etc_flutter', target: 'self', lasts: 'attack' }
            ]
        },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [],
            outputs: [
                { itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 2 },
                { itemId: 'item_copper_ore', chance: 30, minQty: 1, maxQty: 1 }
            ]
        }
    }
});

const h = React.createElement;
const q = (root, sel) => root.querySelector(sel);
const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim();
const words = (el) => [...el.querySelectorAll('*')].filter(n => !n.children.length).map(n => n.textContent.trim()).filter(Boolean).join(' ');
const fightBlock = (id = null) => tokenCardModel('etc_hen', id).blocks.find(b => b.id === CARD_BLOCK.FIGHT);

function put(typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, { x: 400, y: 300 });
    return instance;
}

const mountCard = (instanceId) => render(h(DndContext, null, h(TokenCard, { typeId: 'etc_hen', instanceId })));

/** What the engine does on a fight's first swing: the attack event, which the discovery record hears. */
function fightOne() {
    EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { enemyId: 'etc_hen', heroId: 'h1', damage: 1, hit: true });
}

beforeAll(() => {
    Flags.init();
    DiscoveryManager.init();
});
afterAll(() => Flags.teardown());
afterEach(() => cleanup());
beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
});

describe('the model: every field, read from the enemy', () => {
    it('blocks in order: name, health, combat, fight, drops', () => {
        const hen = put('etc_hen');
        expect(tokenCardModel('etc_hen', hen.id).blocks.map(b => b.id))
            .toEqual([CARD_BLOCK.NAME, CARD_BLOCK.HP, CARD_BLOCK.COMBAT, CARD_BLOCK.FIGHT, CARD_BLOCK.DROPS]);
    });

    it('level, style and health are the profile’s', () => {
        const profile = getEnemyProfile('etc_hen');
        const model = tokenCardModel('etc_hen');
        expect(model.blocks.find(b => b.id === CARD_BLOCK.COMBAT)).toMatchObject({ skillId: 'ranged', level: 4, xp: profile.xpAwarded });
        expect(model.blocks.find(b => b.id === CARD_BLOCK.HP)).toMatchObject({ cur: profile.hp, max: profile.hp });
    });

    // What a fight starts from: Brute's Damage +33 % and slower attacks added to the level's.
    it('its hit, moves, resistances and attack speed', () => {
        const numbers = enemyFightNumbers(getTokenType('etc_hen'));
        const fight = fightBlock();
        expect(fight).toMatchObject({ hit: numbers.hit, hitTypes: ['stab'], attackEveryMs: numbers.attackSpeed });
        expect(numbers.attackSpeed).toBe(4000);
        expect(fight.moves.map(m => [m.name, m.hits, m.type])).toEqual([['Peck', true, 'stab'], ['Flutter', false, null]]);
        expect(fight.resists).toEqual([{ id: 'slash', value: 25 }, { id: 'crush', value: 25 }, { id: 'stab', value: 25 }, { id: 'fire', value: -50 }]);
    });

    it('drops with their chances', () => {
        const drops = tokenCardModel('etc_hen').blocks.find(b => b.id === CARD_BLOCK.DROPS).drops;
        expect(drops.map(d => [d.itemId, d.min, d.max, d.chance])).toEqual([['item_bones', 1, 2, 100], ['item_copper_ore', 1, 1, 30]]);
    });

    it('⭐ kinds are hidden until one has been fought, then named', () => {
        expect(fightBlock().kinds).toBeNull();
        fightOne();
        expect(fightBlock().kinds.map(k => k.id)).toEqual(['effect_brute', 'effect_nimble']);
        expect(fightBlock().kinds[0]).toMatchObject({ name: 'Brute', tip: 'Hits +33%; attacks every 4s' });
    });

    it('an enemy with no kinds, fought, says it has none (an empty list, not hidden)', () => {
        expect(enemyKindsOnCard({ kinds: [] }, true)).toEqual([]);
        expect(enemyKindsOnCard({ kinds: ['effect_brute'] }, false)).toBeNull();
    });

    it('an enemy with no moves makes a plain Crush Strike and lists none', () => {
        expect(enemyMovesOnCard({ moves: [] })).toEqual({ moves: null, hitTypes: ['crush'] });
    });
});

describe('the card as drawn', () => {
    it('shows style, level, health, the fight rows and drops; no level or health twice', () => {
        const hen = put('etc_hen');
        const profile = getEnemyProfile('etc_hen');
        const root = mountCard(hen.id).container;
        expect([...root.querySelectorAll('[data-card-block]')].map(e => e.getAttribute('data-card-block')))
            .toEqual(['name', 'stats', 'fight', 'drops']);
        expect(q(root, '[data-card-style="ranged"]')).not.toBeNull();
        expect(text(q(root, '[data-card-style]'))).toBe('Ranged');
        expect(text(q(root, '[data-card-skill="ranged"]'))).toBe('4');
        expect(text(q(root, '[data-card-hp-text]'))).toBe(`${profile.hp}/${profile.hp}`);

        const fight = q(root, '[data-card-block="fight"]');
        expect(q(fight, '[data-enemy-card-level]')).toBeNull();
        expect(q(fight, '[data-enemy-card-hp]')).toBeNull();
        expect(q(fight, '[data-enemy-card-style]')).toBeNull();
        expect([...fight.querySelectorAll('[data-enemy-card-move]')].map(words)).toEqual(['Peck Stab', 'Flutter Flutter on itself, for one attack']);
        expect([...q(fight, '[data-enemy-card-resists="some"]').children].map(text)).toEqual(['Slash 25%', 'Crush 25%', 'Stab 25%']);
        expect(text(q(fight, '[data-enemy-card-weak="some"]'))).toBe('Fire 50%');
        expect(q(fight, '[data-enemy-card-attack-every]')).not.toBeNull();
        expect(q(fight, '[data-enemy-card-hit]')).not.toBeNull();
        expect(root.querySelectorAll('[data-card-block="drops"] [data-item-bar]')).toHaveLength(2);
    });

    it('⭐ kinds read "? fight one" before a fight, and the kinds after', () => {
        const hen = put('etc_hen');
        const first = mountCard(hen.id);
        let kinds = q(first.container, '[data-enemy-card-kinds]');
        expect(kinds.getAttribute('data-enemy-card-kinds')).toBe('unknown');
        expect(text(kinds)).toBe(t('fight.panel.unknownKinds'));

        fightOne();
        first.rerender(h(DndContext, null, h(TokenCard, { typeId: 'etc_hen', instanceId: hen.id })));
        kinds = q(first.container, '[data-enemy-card-kinds]');
        expect(kinds.getAttribute('data-enemy-card-kinds')).toBe('known');
        expect([...first.container.querySelectorAll('[data-enemy-card-kind]')].map(e => e.getAttribute('data-enemy-card-kind'))).toEqual(['effect_brute', 'effect_nimble']);
    });

    it('off the mat (no instance) the card shows the same fight rows', () => {
        const root = render(h(DndContext, null, h(TokenCard, { typeId: 'etc_hen' }))).container;
        expect(q(root, '[data-card-block="fight"] [data-enemy-card-moves]')).not.toBeNull();
        expect(q(root, '[data-enemy-card-kinds="unknown"]')).not.toBeNull();
    });
});
