// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import * as FormulaRegistry from '../config/FormulaRegistry.js';
import * as Ammo from '../systems/combat/Ammo.js';
import { startFightWatch, resetFightWatch, fightsOf } from '../ui/components/combat/fightWatch.js';
import { t } from '../i18n/index.js';
import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';

/**
 * The combat styles' leftovers (brief 750 S4): a shot's log line names its arrow; a carried arrow
 * is checked like gear; no text promises a hero with no style; the CMS offers the four combat skills
 * as a weapon's style; the weapon tier table is an authoring rule, not code.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

registerItems({
    sl_bow: { id: 'sl_bow', name: 'Bow', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['ranged'], damage: 1 },
    sl_arrow: { id: 'sl_arrow', name: 'Copper Arrow', type: 'material', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'stab' } },
    // An arrow for archers of Ranged 30: carried by a lower hero, never shot.
    sl_heavy_arrow: {
        id: 'sl_heavy_arrow', name: 'Heavy Arrow', type: 'material', equipSlot: 'consumable', stackable: true,
        arrow: { damage: 3, damageType: 'stab' }, skillRequired: 'ranged', levelRequired: 30
    }
});
registerTokenTypes({
    sl_dummy: {
        id: 'sl_dummy', name: 'Dummy', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult', requiresHero: true,
        enemy: { level: 1, style: 'ranged', hp: 500 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

function archer(level) {
    const hero = generateHero({ name: 'Cara' });
    hero.status = 'idle';
    hero.skills.ranged = { level, xp: 0 };
    hero.hp = { current: 300, max: 300 };
    GameState.state.heroes.push(hero);
    InventoryManager.addItem('sl_bow', 1);
    expect(EquipmentManager.equipItem(hero.id, 'sl_bow').success).toBe(true);
    return hero;
}
const carry = (hero, itemId, n) => {
    InventoryManager.addItem(itemId, n);
    hero.equipment[hero.equipment.indexOf(null)] = itemId;
};
function fight(hero) {
    const enemy = BoardState.createTokenInstance('sl_dummy', tokenStartingUses('sl_dummy'));
    Placement.placeTokenAt(enemy, { x: 400, y: 300 });
    TileModifiers.rebuildAround([enemy]);
    Orders.orderAt(hero.id, { x: 400, y: 300 });
}
const play = (ms) => { for (let n = 0; n < ms; n += 100) BoardRunner.tick(100); };

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    Flags.init();
    GameState.state.heroes = [];
});
afterEach(() => { resetFightWatch(); cleanup(); vi.restoreAllMocks(); });

describe('Ranged', () => {
    it('a shot names its arrow in the fight log', () => {
        const stop = startFightWatch();
        const hero = archer(10);
        carry(hero, 'sl_arrow', 5);
        fight(hero);
        play(10000);
        const shots = (fightsOf(hero.id).current?.log || []).filter(l => /^hero(Hits|Crits|Misses)/.test(l.key));
        expect(shots.length).toBeGreaterThan(1);
        expect(shots.every(l => l.key.endsWith('Arrow') && l.vars.arrow === 'Copper Arrow')).toBe(true);
        expect(t(`fight.log.${shots[0].key}`, shots[0].vars)).toMatch(/^Cara's Copper Arrow (hits|crits|misses)/);
        stop();
    });

    it('a carried arrow asking a level the hero lacks is never shot, as gear below its level lends nothing', () => {
        const hero = archer(10);
        carry(hero, 'sl_heavy_arrow', 5);
        expect(Ammo.carriedArrowIds(hero)).toEqual([]);
        expect(Ammo.leavesWithout(hero)).toBe(true);
        const shots = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => shots.push(p));
        fight(hero);
        play(8000);
        off();
        expect(shots).toHaveLength(0);
        expect(InventoryManager.getItemCount('sl_heavy_arrow')).toBe(5);

        const veteran = archer(30);
        carry(veteran, 'sl_heavy_arrow', 5);
        expect(Ammo.carriedArrowIds(veteran)).toEqual(['sl_heavy_arrow']);
    });

    it('the hero who carries only an arrow above them names the first arrow they may shoot', () => {
        const hero = archer(10);
        carry(hero, 'sl_heavy_arrow', 1);
        const needs = [];
        const off = EventBus.subscribe(BOARD_EVENTS.INPUT_NEEDED, (p) => needs.push(p));
        fight(hero);
        play(3000);
        off();
        expect(needs[0]?.itemId).toBeTruthy();
        expect(needs[0].itemId).not.toBe('sl_heavy_arrow');
    });
});

describe('styles', () => {
    it('no fight-window text speaks of a hero with no style', () => {
        expect(t('fight.tip.noStyle')).toBe('fight.tip.noStyle');
        expect(t('fight.tip.noStyleArmed')).toBe('fight.tip.noStyleArmed');
    });

    it('the weapon tier table is not in the code: the content guide holds it', () => {
        expect(FormulaRegistry).not.toHaveProperty('WEAPON_TIERS');
        const guide = fs.readFileSync(path.resolve(__dirname, '../../docs/reference/CONTENT_PHILOSOPHY.md'), 'utf8');
        expect(guide).toMatch(/## Weapon tiers/);
        expect(guide).toMatch(/\| Copper \| 1 \| 1 \| 2 \| 3 \|/);
    });
});

describe('the CMS', () => {
    const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    let storedBefore;
    beforeAll(() => {
        storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
        useEntityStore.persist.setOptions({ storage: noStorage });
    });
    afterEach(() => expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore));

    it('offers the four combat skills as a weapon\'s style', () => {
        const store = useEntityStore.getState();
        store.hydrate({ items: [], tokens: [], effects: [], recipePools: {} });
        const id = useEntityStore.getState().addItem({ name: 'Style Fixture', equipSlot: 'hand' });
        useEntityStore.getState().setActiveEntity(id, 'item');
        const { container } = render(React.createElement(ItemEditor));
        const options = [...container.querySelector('[data-field="weapon-style"]').options].map(o => o.value);
        expect(options).toEqual([...COMBAT_SKILL_IDS]);
    });
});
