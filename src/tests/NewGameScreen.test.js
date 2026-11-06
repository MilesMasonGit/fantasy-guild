// @vitest-environment jsdom
// The new-game screen: the Guild's name, the world's three strict rings with a free Reroll, and the
// first hero with the hero edit window's own controls; Begin hands the choices on, Back keeps nothing.
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { NewGameScreen } from '../ui/components/title/NewGameScreen.jsx';
import { previewView } from '../ui/components/atlas/worldPreview.js';
import * as World from '../systems/world/World.js';
import { STRICT_RINGS } from '../config/worldTablesShape.js';
import { HERO_PORTRAITS } from '../config/registries/heroPortraits.js';

const h = React.createElement;
const q = (sel) => document.querySelector(sel);
const worldSeed = () => Number(q('[data-new-game-world]').getAttribute('data-new-game-world'));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function open() {
    const onBegin = vi.fn();
    const onBack = vi.fn();
    render(h(NewGameScreen, { slotIndex: 2, onBegin, onBack }));
    return { onBegin, onBack };
}

describe('the new-game screen', () => {
    it('Reroll rolls another world, for nothing, and Begin hands on the world shown and every choice', () => {
        const { onBegin } = open();
        const first = worldSeed();
        fireEvent.click(q('button[data-new-game-reroll]'));
        fireEvent.click(q('button[data-new-game-reroll]'));
        const shown = worldSeed();
        expect(shown).not.toBe(first);

        fireEvent.change(q('[data-new-game-guild-name]'), { target: { value: 'Ash Hollow' } });
        const hero = q('[data-new-game-hero]');
        fireEvent.change(hero.querySelector('input[type="text"]'), { target: { value: 'Wren' } });
        fireEvent.click(hero.querySelector(`button[title="${HERO_PORTRAITS[3]}"]`));
        fireEvent.click(hero.querySelector('[data-flag-swatch="orange"]'));
        fireEvent.click(q('button[data-new-game-begin]'));

        expect(onBegin).toHaveBeenCalledTimes(1);
        expect(onBegin.mock.calls[0][0]).toEqual({
            guildName: 'Ash Hollow',
            worldSeed: shown,
            hero: { name: 'Wren', spriteId: HERO_PORTRAITS[3], flagColour: 'orange' }
        });
    });

    it('a hero needs a name; a Guild left unnamed takes the default', () => {
        const { onBegin } = open();
        const nameBox = q('[data-new-game-hero] input[type="text"]');
        fireEvent.change(nameBox, { target: { value: '   ' } });
        expect(q('button[data-new-game-begin]').disabled).toBe(true);
        fireEvent.change(nameBox, { target: { value: 'Bram' } });
        fireEvent.click(q('button[data-new-game-begin]'));
        expect(onBegin.mock.calls[0][0].guildName).toBe('The Guild');
    });

    it('Back returns to the slots, handing nothing on', () => {
        const { onBegin, onBack } = open();
        fireEvent.click(q('button[data-new-game-back]'));
        expect(onBack).toHaveBeenCalledTimes(1);
        expect(onBegin).not.toHaveBeenCalled();
    });

    it('the preview shows the three strict rings round the Hall, where the guild starts; past them stays fog', () => {
        const view = previewView(World.previewWorld(77));
        expect(view.rings).toBe(STRICT_RINGS);
        expect(view.cells.filter(c => c.shown).every(c => c.ring <= STRICT_RINGS)).toBe(true);
        expect(view.cells.some(c => !c.shown)).toBe(true);
        expect(view.cells.find(c => c.here).ring).toBe(0);
        open();
        // Read-only: no cell can be picked.
        expect(document.querySelectorAll('[data-world-cell]')).toHaveLength(0);
        expect(document.querySelectorAll('[data-world-tile]').length).toBe(view.cells.filter(c => c.shown).length);
    });
});
