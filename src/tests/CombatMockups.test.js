// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { KIT_SECTIONS } from '../ui/dev/StyleSheetPage.jsx';
import { CombatMockups } from '../ui/dev/CombatMockups.jsx';
import { PANEL_OPTIONS, ENEMY_CARDS, FLOAT_SAMPLES, FIGHT, hpLabel, hpPercent } from '../ui/dev/combatMockups.js';
import { getItem } from '../config/registries/itemRegistry.js';

/** Every source file under `dir`, recursively. */
function sources(dir) {
    return readdirSync(dir).flatMap(name => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return sources(full);
        return /\.(jsx?|mjs)$/.test(name) ? [full] : [];
    });
}

/**
 * The combat screen's mock-ups are pictures for the owner to pick from: on the style sheet page
 * as an unapproved piece, the fight on the mat as settled and three fight panel options, and
 * nowhere in the game.
 */
describe('Combat screen mock-ups', () => {
    afterEach(() => cleanup());

    it('are a new, unapproved piece of the style sheet page', () => {
        const entry = KIT_SECTIONS.find(s => s.id === 'combat-screen');
        expect(entry?.status).toBe('unapproved');
        expect(entry.Demo).toBe(CombatMockups);
    });

    it('write HP as the number and the percentage, rounded halves up', () => {
        expect(hpLabel(8, 16)).toBe('8 · 50%');
        expect(hpPercent(1, 8)).toBe(13);
        expect(hpLabel(17, 30)).toBe('17 · 57%');
        expect(hpLabel(-3, 30)).toBe('0 · 0%');
    });

    it('draw the settled fight on the mat: both bars, the icon, the plate with fights left, every float', () => {
        const doc = render(React.createElement(CombatMockups)).container;
        const mat = doc.querySelector('[data-c6-shot="mat"]');
        expect(mat.querySelectorAll('[data-c6-cost="bars"]').length).toBe(2);
        expect(mat.textContent).toContain(hpLabel(FIGHT.hero.hp, FIGHT.hero.maxHp));
        expect(mat.textContent).toContain(hpLabel(FIGHT.enemy.hp, FIGHT.enemy.maxHp));
        expect(mat.querySelector('[data-c6-cost="icon"]')).not.toBeNull();
        const plate = mat.querySelector('[data-c6-cost="plate"]');
        for (const e of FIGHT.hero.elixirs) expect(plate.querySelector(`[data-c6-elixir="${e.name}"]`).textContent).toContain(String(e.fightsLeft));
        const floats = doc.querySelectorAll('[data-c6-shot="floats"] [data-c6-float]');
        expect([...floats].map(f => f.dataset.c6Float)).toEqual(FLOAT_SAMPLES.map(s => s.id));
        expect(doc.querySelector('[data-c6-float="enemy-crit"]').textContent).toMatch(/crit!/i);
        expect(doc.querySelector('[data-c6-float="hero-miss"]').textContent).toMatch(/miss/i);
        // Poison and burn ticks carry their icon (red, no colour of their own).
        expect(doc.querySelector('[data-c6-float="hero-poison"] [data-glyph="drop"]')).not.toBeNull();
        expect(doc.querySelector('[data-c6-float="hero-burn"] [data-glyph="flame"]')).not.toBeNull();
        for (const e of ENEMY_CARDS) {
            const card = doc.querySelector(`[data-c6-card="${e.id}"]`);
            expect(card.textContent).toContain(`${e.level}/99`);
            expect(card.textContent.includes('Brute')).toBe(e.known);
        }
    });

    it('draw each panel with both fighters on the battlefield, both sides’ numbers, and the log closed until asked for', () => {
        const doc = render(React.createElement(CombatMockups)).container;
        expect(PANEL_OPTIONS.map(o => o.id)).toEqual(['1', '2', '3']);
        for (const o of PANEL_OPTIONS) {
            const box = doc.querySelector(`[data-c6-panel-option="${o.id}"]`);
            const closed = box.querySelector('[data-c6-shot="closed"] [data-c6-panel]');
            const open = box.querySelector('[data-c6-shot="open"] [data-c6-panel]');
            for (const panel of [closed, open]) {
                expect(panel.querySelector('[data-c6-scene] [data-c6-fighter="hero"]'), o.id).not.toBeNull();
                expect(panel.querySelector('[data-c6-scene] [data-c6-fighter="enemy"]'), o.id).not.toBeNull();
                const text = panel.textContent;
                for (const v of [FIGHT.hero.swing, FIGHT.enemy.swing, hpLabel(FIGHT.hero.hp, FIGHT.hero.maxHp), hpLabel(FIGHT.enemy.hp, FIGHT.enemy.maxHp)]) {
                    expect(text, `${o.id} ${v}`).toContain(v);
                }
                expect(panel.querySelector('[data-c6-status="poison"]').textContent).toContain('×2');
                expect(panel.querySelectorAll('[data-c6-elixir]').length).toBe(2);
                expect(panel.querySelector('[data-c6-kinds]').textContent).toMatch(/Brute[\s\S]*Venomous/);
            }
            expect(closed.querySelector('[data-c6-log]'), o.id).toBeNull();
            expect(closed.querySelector('[data-c6-log-toggle="closed"]')).not.toBeNull();
            expect(open.querySelector('[data-c6-log]')).not.toBeNull();
        }
    });

    it('open and close the log with its button', () => {
        const doc = render(React.createElement(CombatMockups)).container;
        const closed = () => doc.querySelector('[data-c6-panel-option="1"] [data-c6-shot="closed"]');
        fireEvent.click(closed().querySelector('[data-c6-log-toggle]'));
        expect(closed().querySelector('[data-c6-log]')).not.toBeNull();
        fireEvent.click(closed().querySelector('[data-c6-log-toggle]'));
        expect(closed().querySelector('[data-c6-log]')).toBeNull();
    });

    it('use real elixirs for the fixture hero', () => {
        for (const e of FIGHT.hero.elixirs) expect(getItem(e.itemId)?.type).toBe('potion');
    });

    it('are not wired into the game: only the style sheet page imports them', () => {
        const root = path.resolve(__dirname, '..');
        const importers = sources(root)
            .filter(f => !f.includes(`${path.sep}tests${path.sep}`))
            .filter(f => /CombatMockups\.jsx|combatMockups\.js/.test(readFileSync(f, 'utf8')))
            .map(f => path.relative(root, f).split(path.sep).join('/'));
        expect(importers.sort()).toEqual(['ui/dev/CombatMockups.jsx', 'ui/dev/StyleSheetPage.jsx']);
    });
});
