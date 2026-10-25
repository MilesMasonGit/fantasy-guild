// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { KIT_SECTIONS } from '../ui/dev/StyleSheetPage.jsx';
import { CombatMockups } from '../ui/dev/CombatMockups.jsx';
import { COMBAT_OPTIONS, ENEMY_CARDS, FLOAT_SAMPLES, FIGHT, hpLabel, hpPercent } from '../ui/dev/combatMockups.js';
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
 * The combat screen's mock-ups are pictures for the owner to pick from: on the
 * style sheet page as an unapproved piece, each option showing the same things, and nowhere in
 * the game.
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

    it('draw each option with the fight on the mat, every float, both enemy cards and the panel', () => {
        const view = render(React.createElement(CombatMockups));
        const doc = view.container;
        expect(COMBAT_OPTIONS.map(o => o.id)).toEqual(['A', 'B', 'C']);
        for (const o of COMBAT_OPTIONS) {
            const box = doc.querySelector(`[data-c6-option="${o.id}"]`);
            expect(box, o.id).not.toBeNull();
            const mat = box.querySelector('[data-c6-shot="mat"]');
            expect(mat.querySelectorAll('[data-c6-cost="bars"]').length).toBeGreaterThan(0);
            expect(mat.querySelector('[data-c6-cost="icon"]')).not.toBeNull();
            expect(mat.querySelector('[data-c6-cost="plate"]')).not.toBeNull();
            expect(mat.textContent).toContain(hpLabel(FIGHT.hero.hp, FIGHT.hero.maxHp));
            expect(mat.textContent).toContain(hpLabel(FIGHT.enemy.hp, FIGHT.enemy.maxHp));
            const floats = box.querySelectorAll('[data-c6-shot="floats"] [data-c6-float]');
            expect([...floats].map(f => f.dataset.c6Float)).toEqual(FLOAT_SAMPLES.map(s => s.id));
            // The ruling: the word "Crit!" and the word "Miss" both show.
            expect(box.querySelector('[data-c6-float="enemy-crit"]').textContent).toMatch(/crit!/i);
            expect(box.querySelector('[data-c6-float="hero-miss"]').textContent).toMatch(/miss/i);
            for (const e of ENEMY_CARDS) {
                const card = box.querySelector(`[data-c6-card="${e.id}"]`);
                expect(card, `${o.id} ${e.id}`).not.toBeNull();
                expect(card.textContent).toContain(`${e.level}/99`);
                // Kinds show only once the guild has fought one.
                expect(card.textContent.includes('Brute')).toBe(e.known);
            }
            const panel = box.querySelector(`[data-c6-panel="${o.id}"]`);
            expect(panel).not.toBeNull();
            expect(panel.querySelector('[data-c6-status="poison"]').textContent).toContain('×2');
            const elixirIcons = panel.querySelectorAll('[data-c6-elixir]').length;
            const elixirNames = ['Valor', 'Ironskin'].every(n => panel.textContent.includes(n));
            expect(elixirIcons === 2 || elixirNames, `${o.id} elixirs`).toBe(true);
            expect(panel.textContent).toContain('Brute');
            expect(panel.querySelector('[data-c6-log]')).not.toBeNull();
        }
    });

    it('use real elixirs for the fixture hero', () => {
        for (const e of FIGHT.hero.elixirs) expect(getItem(e.itemId)?.type).toBe('potion');
    });

    it('are not wired into the game: only the style sheet page imports them', () => {
        const root = path.resolve(__dirname, '..');
        const importers = sources(root)
            .filter(f => !f.includes(`${path.sep}tests${path.sep}`))
            .filter(f => /from '\.\/(CombatMockups|combatMockups)(\.jsx?)?'|CombatMockups\.jsx|combatMockups\.js/.test(readFileSync(f, 'utf8')))
            .map(f => path.relative(root, f).split(path.sep).join('/'));
        expect(importers.sort()).toEqual(['ui/dev/CombatMockups.jsx', 'ui/dev/StyleSheetPage.jsx']);
    });
});
