// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { itemTipFacts, ItemTipContent } from '../ui/components/drawer/ItemTip.jsx';
import { secondsText } from '../ui/components/combat/fightView.js';
import { attackSpeedMs } from '../config/FormulaRegistry.js';

/**
 * A weapon's tooltip is a stat block of short label and value rows, its speed in the seconds the
 * enemy card and the fight panel use.
 */

const weapon = (extra) => ({ id: 'sb_weapon', equipSlot: 'hand', styles: ['melee'], damage: 2, ...extra });
const rows = (item) => itemTipFacts(item).stats.map(({ label, value }) => [label, value]);

afterEach(cleanup);

describe('a weapon\'s stat block', () => {
    it('lists damage, type, skill and speed, in that order', () => {
        expect(rows(weapon({ damage: 3, speed: 'slow' }))).toEqual([
            ['DMG', '3'], ['Type', 'Slash'], ['Skill', 'Melee'], ['Speed', 'Slow (4 s)']
        ]);
    });

    it('adds Hands 2 only on a two-handed weapon', () => {
        expect(rows(weapon({ speed: 'slow', hands: 2 })).at(-1)).toEqual(['Hands', '2']);
        expect(rows(weapon({ speed: 'slow' })).map(([label]) => label)).not.toContain('Hands');
    });

    it.each([['fast', 'Fast (2 s)'], ['normal', 'Normal (3 s)'], ['slow', 'Slow (4 s)']])('reads speed %s', (speed, value) => {
        expect(Object.fromEntries(rows(weapon({ speed }))).Speed).toBe(value);
    });

    it('an unnamed or unknown speed reads as the normal swing the fight gives it', () => {
        expect(Object.fromEntries(rows(weapon({}))).Speed).toBe('Normal (3 s)');
        expect(Object.fromEntries(rows(weapon({ speed: 'blazing' }))).Speed).toBe('Normal (3 s)');
    });

    it('agrees with the seconds the combat cards show', () => {
        expect(Object.fromEntries(rows(weapon({ speed: 'slow' }))).Speed).toContain(secondsText(attackSpeedMs('slow')));
    });

    it('names its own damage type and the style it fights in', () => {
        expect(rows(weapon({ styles: ['magic'], damage: 2, damageType: 'fire' })).slice(0, 3))
            .toEqual([['DMG', '2'], ['Type', 'Fire'], ['Skill', 'Magic']]);
    });

    it('⚠️ is absent on what is not a weapon', () => {
        expect(itemTipFacts({ id: 'sb_hat', equipSlot: 'hat' }).stats).toBeNull();
    });
});

describe('the tooltip draws it', () => {
    it('as two columns of dim labels and bright values, in place of the old sentences', () => {
        const { container } = render(React.createElement(ItemTipContent, { item: weapon({ damage: 3, speed: 'slow', hands: 2 }) }));
        const block = container.querySelector('[data-item-tip-stats]');
        expect(block.className).toContain('grid-cols-[auto_1fr]');
        const cells = [...block.children];
        expect(cells.map(c => c.textContent)).toEqual(['DMG', '3', 'Type', 'Slash', 'Skill', 'Melee', 'Speed', 'Slow (4 s)', 'Hands', '2']);
        cells.forEach((cell, i) => expect(cell.className).toContain(i % 2 ? 'text-white' : 'text-gi-muted'));
        const text = container.textContent;
        for (const gone of ['Hits ', 'swing, every', 'Takes both hands']) expect(text).not.toContain(gone);
    });

    it('⚠️ draws no block on an item with no stats', () => {
        const { container } = render(React.createElement(ItemTipContent, { item: { id: 'sb_hat', equipSlot: 'hat' } }));
        expect(container.querySelector('[data-item-tip-stats]')).toBeNull();
    });
});
