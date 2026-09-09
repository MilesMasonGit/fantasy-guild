import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { getPaletteEntry, bucketsFor } from '../config/registries/modifierPalette.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Combat numbers — Unified Effects P7.
 *
 * Combat has queried `ARMOR`, `ACCURACY`, `BLOCK`, `RESIST_FLAT` and `DAMAGE`
 * off the hero's aggregator for a long time, and **nothing has written them**
 * since the legacy gear pipeline was deleted (CR2-074's territory). This phase
 * closes the write side: content can feed those numbers, from a hero's own gear
 * or from the enemy they are fighting.
 *
 * Nothing about the combat engine changed to allow it, which is the point.
 */

const TILE = 10;
const provides = (type, value, bucket = 'flat') => ({
    ...makeStatement(KEYWORD.PROVIDES),
    payload: { type, bucket, value },
});

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 60, xp: 0 };
    hero.equipment = Array(9).fill(null);
    hero.aggregator = new ModifierAggregator();
    return hero;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;

    registerEffects({
        fixture_effect_plating: {
            id: 'fixture_effect_plating',
            name: 'Plating',
            statements: [provides(EFFECT_TYPES.ARMOR, 3)],
        },
        fixture_effect_corrosive: {
            id: 'fixture_effect_corrosive',
            name: 'Corrosive Aura',
            statements: [provides(EFFECT_TYPES.ARMOR, -2)],
        },
        fixture_effect_pct_armor: {
            id: 'fixture_effect_pct_armor',
            name: 'Percent Armor',
            statements: [provides(EFFECT_TYPES.ARMOR, 0.5, 'percentage')],
        },
    });

    registerItems({
        fixture_plate: { id: 'fixture_plate', name: 'Plate', effects: [{ effectId: 'fixture_effect_plating', scale: 1 }] },
        fixture_plate_ii: { id: 'fixture_plate_ii', name: 'Plate II', effects: [{ effectId: 'fixture_effect_plating', scale: 2 }] },
        fixture_pct_plate: { id: 'fixture_pct_plate', name: 'Percent Plate', effects: [{ effectId: 'fixture_effect_pct_armor' }] },
    });

    for (const id of ['fixture_plate', 'fixture_plate_ii', 'fixture_pct_plate']) {
        InventoryManager.addItem(id, 5);
    }
});

describe('the palette only offers axes combat actually reads', () => {
    it('declares each combat axis in EFFECT_TYPES rather than as a bare string', () => {
        for (const axis of ['ARMOR', 'ACCURACY', 'BLOCK', 'RESIST_FLAT', 'DAMAGE']) {
            expect(EFFECT_TYPES[axis], axis).toBe(axis);
        }
    });

    it('offers only the flat bucket on the ones whose reader sums flats', () => {
        // `ModifierAggregator.query` — what these readers call — sums flats and
        // silently skips percentage and multiplier entries, so offering another
        // bucket would offer something discarded.
        for (const axis of ['ARMOR', 'ACCURACY', 'BLOCK', 'RESIST_FLAT']) {
            expect(bucketsFor(getPaletteEntry(axis)), axis).toEqual(['flat']);
        }
    });

    it('⚠️ makes DAMAGE the exception, because it has a real percentage reader', () => {
        /**
         * `computeHeroDamage` genuinely multiplies by a percentage bucket, and
         * that is what makes a Well Fed style buff — *"+10% damage for a
         * while"* — expressible as an ordinary library effect rather than as a
         * hardcoded status type (V7).
         *
         * The rule has not changed: a bucket is offered where a reader consumes
         * it. DAMAGE is the one combat axis where that is true of percentages.
         */
        expect(bucketsFor(getPaletteEntry('DAMAGE'))).toEqual(['flat', 'percentage']);
    });

    it('leaves every other effect accepting all three buckets', () => {
        expect(bucketsFor(getPaletteEntry('YIELD'))).toHaveLength(3);
    });

    it('does not offer DEFENSE — combat sums it into ARMOR and nothing writes it', () => {
        expect(getPaletteEntry('DEFENSE')).toBeNull();
    });
});

describe('a hero’s gear feeds the numbers combat reads', () => {
    it('registers a carried Armor rule onto the aggregator combat queries', () => {
        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_plate';

        EquipmentManager.recalculateEquipmentModifiers(hero);

        expect(hero.aggregator.query('ARMOR')).toBe(3);
    });

    it('carries the reference’s scale through', () => {
        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_plate_ii';

        EquipmentManager.recalculateEquipmentModifiers(hero);

        expect(hero.aggregator.query('ARMOR')).toBe(6);
    });

    it('merges two items naming one effect rather than double-counting', () => {
        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_plate';      // scale 1
        hero.equipment[1] = 'fixture_plate_ii';   // scale 2

        EquipmentManager.recalculateEquipmentModifiers(hero);

        // One merged effect at scale 3, not 3 + 6.
        expect(hero.aggregator.query('ARMOR')).toBe(9);
    });

    it('drops the contribution when the gear comes off', () => {
        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_plate';
        EquipmentManager.recalculateEquipmentModifiers(hero);
        expect(hero.aggregator.query('ARMOR')).toBe(3);

        hero.equipment[0] = null;
        EquipmentManager.recalculateEquipmentModifiers(hero);
        expect(hero.aggregator.query('ARMOR')).toBe(0);
    });

    it('ignores a non-flat bucket rather than registering something unread', () => {
        // `query` skips percentage entries, so registering one would be an
        // effect that is authored, stored, and silently never read.
        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_pct_plate';

        EquipmentManager.recalculateEquipmentModifiers(hero);

        expect(HeroEffects.loadoutCombatContributions(hero)).toEqual([]);
        expect(hero.aggregator.query('ARMOR')).toBe(0);
    });
});

describe('⭐ an enemy lends its own numbers to the hero fighting it', () => {
    beforeEach(() => {
        registerTokenTypes({
            fixture_corrosive_enemy: {
                id: 'fixture_corrosive_enemy', name: 'Corrosive Enemy', tokenType: 'enemy',
                rarity: 'common', uses: 20, sprite: 'skill_occult',
                enemy: { level: 2, style: 'melee' },
                effects: [{ effectId: 'fixture_effect_corrosive', scale: 1 }],
                config: {
                    skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0,
                    inputs: [], outputs: [{ itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 1 }],
                },
            },
        });
    });

    it('applies the enemy’s Armor rule to the hero for the fight', () => {
        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_plate';
        EquipmentManager.recalculateEquipmentModifiers(hero);
        GameState.state.heroes = [hero];

        expect(hero.aggregator.query('ARMOR')).toBe(3);

        const instance = BoardState.createTokenInstance('fixture_corrosive_enemy', tokenStartingUses('fixture_corrosive_enemy'));
        Placement.placeToken(TILE, instance);
        TileModifiers.rebuildAround(TILE);
        Placement.placeHero('hero_1', TILE);
        BoardRunner.tick(100);

        // The enemy's -2 stacks with the hero's own +3.
        expect(hero.aggregator.query('ARMOR')).toBe(1);
    });

    it('takes it back when the fight ends — a debuff cannot outlive its creature', () => {
        const hero = makeHero('hero_1');
        hero.equipment[0] = 'fixture_plate';
        EquipmentManager.recalculateEquipmentModifiers(hero);
        GameState.state.heroes = [hero];

        const instance = BoardState.createTokenInstance('fixture_corrosive_enemy', tokenStartingUses('fixture_corrosive_enemy'));
        Placement.placeToken(TILE, instance);
        TileModifiers.rebuildAround(TILE);
        Placement.placeHero('hero_1', TILE);
        BoardRunner.tick(100);
        expect(hero.aggregator.query('ARMOR')).toBe(1);

        BoardCombat.endFight(TILE);
        expect(hero.aggregator.query('ARMOR')).toBe(3);
    });

    it('clears every borrowed number on teardown', () => {
        const hero = makeHero('hero_1');
        GameState.state.heroes = [hero];

        const instance = BoardState.createTokenInstance('fixture_corrosive_enemy', tokenStartingUses('fixture_corrosive_enemy'));
        Placement.placeToken(TILE, instance);
        TileModifiers.rebuildAround(TILE);
        Placement.placeHero('hero_1', TILE);
        BoardRunner.tick(100);
        expect(hero.aggregator.query('ARMOR')).toBe(-2);

        BoardCombat.clearAll();
        expect(hero.aggregator.query('ARMOR')).toBe(0);
    });
});

describe('a combat rule tells the truth about who it reaches', () => {
    it('never claims to reach adjacent Tokens', () => {
        const sentence = renderStatement(provides(EFFECT_TYPES.ARMOR, 3), {});
        expect(sentence).not.toContain('adjacent');
        expect(sentence).toContain('in combat');
        expect(sentence).toContain('hero carrying this item');
        expect(sentence).toContain('hero fighting it');
    });

    it('leaves a non-combat effect’s sentence exactly as it was', () => {
        const sentence = renderStatement(provides('YIELD', 0.05, 'percentage'), {});
        expect(sentence).toContain('adjacent');
    });
});

describe('the audit names a combat rule that reaches nobody', () => {
    it('flags a plain Token carrying one, because nothing reads it there', () => {
        registerTokenTypes({
            fixture_confused_forge: {
                id: 'fixture_confused_forge', name: 'Confused Forge', tokenType: 'station',
                rarity: 'common', uses: 100, sprite: 'skill_occult',
                effects: [{ effectId: 'fixture_effect_plating' }],
                config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] },
            },
        });

        const findings = auditContent();
        const mine = findings.filter((f) => f.where.includes('fixture_confused_forge'));

        // ⚠️ The wording generalised in Effects Robustness P4. The check keys on
        // the palette's `heroOnly` flag rather than on `group === 'Combat'`,
        // because `STATUS_IMMUNITY` has exactly the same property and is not
        // combat — so the message can no longer say "combat numbers".
        expect(mine.some((f) => /only reaches a hero/.test(f.what))).toBe(true);
    });

    it('says nothing about the same rule on an ENEMY, where it does work', () => {
        const findings = auditContent();
        const mine = findings.filter((f) => f.where.includes('fixture_corrosive_enemy'));
        expect(mine.some((f) => /combat numbers only reach a hero/.test(f.what))).toBe(false);
    });
});
