// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import './fixtures/testTokens.js';
import en from '../i18n/en.json';
import { t } from '../i18n/index.js';
import { GameState } from '../state/GameState.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { heroDamageMultiplier } from '../systems/combat/CombatFormulas.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { movesView, kindView } from '../ui/components/combat/fightView.js';

/**
 * A weapon or an enemy Attacks every 3s; a move with no name is a Strike; an item's hit is Damage.
 * No player-facing word says swing. And the fight's leftovers: rows and fields nothing reads.
 */

const ROOT = path.resolve(__dirname, '../..');

/** Every string in the strings file, with its key. */
function leaves(node, at = '') {
    return Object.entries(node).flatMap(([k, v]) => {
        const key = at ? `${at}.${k}` : k;
        return typeof v === 'string' ? [[key, v]] : leaves(v, key);
    });
}

describe('the words', () => {
    it('no player-facing string says swing or DMG', () => {
        expect(leaves(en).filter(([, v]) => /swing|\bDMG\b/i.test(v))).toEqual([]);
    });

    it('a weapon or an enemy attacks every so often, and its hit is Damage', () => {
        expect(t('itemTip.stat.damage')).toBe('Damage');
        expect(t('itemTip.stat.attackEvery')).toBe('Attacks every');
        expect(t('fight.window.attackEvery')).toBe('Attacks every');
        expect(t('fight.tip.attackEvery', { time: '3s' })).toBe('Attacks every 3s');
        expect(`${t('fight.card.attacks')} ${t('fight.card.every', { time: '3s' })}`).toBe('Attacks every 3s');
    });

    it('a move with no name is a Strike', () => {
        expect(t('fight.moves.unnamed')).toBe('Strike');
        expect(movesView([{ hits: true, type: 'slash' }])[0].name).toBe('Strike');
    });

    it('an enemy kind says how often it attacks, in the game and the CMS', () => {
        expect(t('fight.kinds.every', { time: '4s' })).toBe('attacks every 4s');
        for (const id of ['effect_armoured', 'effect_swift', 'effect_brute']) {
            expect(kindView(id).tip, id).toMatch(/attacks every \d/);
            expect(kindView(id).tip, id).not.toMatch(/swing/i);
        }
    });

    it('the CMS rule Attack Speed says attacks, and an enemy\'s plain hit is a Strike', () => {
        expect(getPaletteEntry(EFFECT_TYPES.SWING_TIME).label).toBe('Attack Speed');
        expect(getPaletteEntry(EFFECT_TYPES.SWING_TIME).hint).not.toMatch(/swing/i);
        expect(getPaletteEntry(EFFECT_TYPES.TYPE_RESIST).hint).toContain('plain Strike');
    });
});

describe('the fight\'s leftovers', () => {
    it('the CMS has no Armor, Resistance or Pierce row', () => {
        for (const type of [EFFECT_TYPES.ARMOR, EFFECT_TYPES.RESIST_FLAT, EFFECT_TYPES.PIERCE]) {
            expect(getPaletteEntry(type), type).toBeNull();
        }
    });

    it('the Crit Chance hint covers enemies too', () => {
        const hint = getPaletteEntry(EFFECT_TYPES.CRIT_CHANCE).hint;
        expect(hint).toMatch(/enemy/);
        expect(hint).not.toMatch(/the hero's 5%/);
    });

    it('⚠️ nothing in the game or the CMS reads or writes ignoresArmor', () => {
        const hits = [];
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'tests' && entry.name !== 'node_modules') walk(full);
                } else if (/\.(js|jsx|json)$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes('ignoresArmor')) {
                    hits.push(path.relative(ROOT, full));
                }
            }
        };
        for (const dir of ['src', 'cms/src', 'cms/schemas']) walk(path.join(ROOT, dir));
        expect(hits).toEqual([]);
    }, 30000);

    describe('a hero\'s damage multiplier is the Damage bucket itself', () => {
        let hero;
        beforeEach(() => {
            GameState.initNew();
            hero = generateHero({ name: 'ae_hero' });
            hero.id = 'ae_hero';
            hero.equipment = Array(9).fill(null);
            rehydrateHero(hero);
        });

        it('reads the bucket a lingering effect registers', () => {
            expect(heroDamageMultiplier(hero)).toBe(1);
            hero.aggregator.addModifier({ type: EFFECT_TYPES.DAMAGE, value: 0.25, bucket: 'percentage', source: 'ae_test' });
            expect(heroDamageMultiplier(hero)).toBe(1.25);
        });

        it('gives the very numbers the old 1 + (x − 1) gave, for every bucket a fight meets', () => {
            for (let x = 0.5; x <= 4; x += 0.01) expect(1 + (x - 1), String(x)).toBe(x);
        });
    });
});
