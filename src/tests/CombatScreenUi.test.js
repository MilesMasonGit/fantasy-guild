// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameState } from '../state/GameState.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { KIT_SECTIONS } from '../ui/dev/StyleSheetPage.jsx';
import { CombatKit } from '../ui/dev/CombatKit.jsx';
import { KIT_CURRENT, KIT_LAST, kitPanelView } from '../ui/dev/combatKit.js';
import { FightPanelView } from '../ui/components/combat/FightPanel.jsx';
import { buildFloat } from '../ui/components/board/fx/fightFloats.js';
import { MOMENT, statusIcon } from '../ui/components/combat/fightWatch.js';
import { EnemyCardRows } from '../ui/components/combat/EnemyCard.jsx';
import { enemyCardView } from '../ui/components/combat/fightView.js';
import { fightChipPlace, CHIP, CHIP_PX } from '../ui/components/board/fightPlate.js';
import { plateUnit } from '../ui/components/board/workPlate.js';
import { HP_BAR } from '../ui/components/board/healthBar.js';
import { panelPlace } from '../ui/components/combat/FightPanelPopup.jsx';
import { t } from '../i18n/index.js';

/**
 * The combat screen's pieces drawn (brief 220, C6b; owner's picks 2026-10-24/25): the floats' look,
 * the fight panel (the versus card, the log closed until asked for, This fight / Last fight), the
 * enemy card fought and never fought, the chip's place beside the enemy's number, the panel's place
 * beside the chip, and the style sheet's entry drawn by the real components.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const q = (root, sel) => root.querySelector(sel);
const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim();
/** An element's words as read: each leaf's text, joined by a space. */
const words = (el) => [...el.querySelectorAll('*')].filter(n => !n.children.length).map(n => n.textContent.trim()).filter(Boolean).join(' ');

afterEach(() => cleanup());

describe('floats: what each says and its colour', () => {
    const float = (m) => buildFloat({ heroId: 'h', instanceId: 'e', ...m });

    it('a hit: white on the enemy, red on the hero, the number alone', () => {
        const onEnemy = float({ kind: MOMENT.HIT, on: 'enemy', amount: 4 });
        expect(onEnemy.className).toContain('gi-ff-white');
        expect(onEnemy.textContent).toBe('4');
        const onHero = float({ kind: MOMENT.HIT, on: 'hero', amount: 1 });
        expect(onHero.className).toContain('gi-ff-red');
        expect(onHero.className).not.toContain('gi-ff-white');
    });

    it('a crit: a gold "Crit!" over a big number, in the side\'s colour', () => {
        const el = float({ kind: MOMENT.CRIT, on: 'enemy', amount: 8 });
        expect(el.className).toContain('gi-fight-float-crit');
        expect(q(el, '.gi-ff-crit-word').textContent).toBe(t('fight.float.crit'));
        expect(q(el, '.gi-ff-crit-number').textContent).toBe('8');
        expect(float({ kind: MOMENT.CRIT, on: 'hero', amount: 4 }).className).toContain('gi-ff-red');
    });

    it('a miss says Miss; a heal is green with its plus', () => {
        expect(float({ kind: MOMENT.MISS, on: 'hero', amount: null }).textContent).toBe('Miss');
        const heal = float({ kind: MOMENT.HEAL, on: 'hero', amount: 5 });
        expect(heal.className).toContain('gi-ff-green');
        expect(heal.textContent).toBe('+5');
    });

    it('⭐ poison and burn ticks are red with a drop or a flame (no colour of their own)', () => {
        const poison = float({ kind: MOMENT.TICK, on: 'hero', amount: 2, statusId: 'effect_poison' });
        expect(poison.className).toContain('gi-ff-red');
        expect(q(poison, '[data-glyph="drop"]')).not.toBeNull();
        expect(poison.textContent).toBe('2');
        const burn = float({ kind: MOMENT.TICK, on: 'enemy', amount: 1, statusId: 'effect_burn' });
        expect(burn.className).toContain('gi-ff-red');
        expect(q(burn, '[data-glyph="flame"]')).not.toBeNull();
        expect(statusIcon('qa_fx_burn')).toBe('flame');
        expect(statusIcon('effect_poison')).toBe('drop');
    });

    it('starts hidden: it shows only while it rises', () => {
        expect(float({ kind: MOMENT.HIT, on: 'enemy', amount: 3 }).style.visibility).toBe('hidden');
    });
});

describe('the fight panel', () => {
    const kit = () => render(React.createElement(CombatKit)).container;
    const panels = (root) => root.querySelectorAll('[data-fight-panel]');

    it('the versus card reads across: level and style, health as "number · %", hit, armour, swing', () => {
        const panel = panels(kit())[0];
        const row = (id) => [...panel.querySelectorAll(`[data-fight-row="${id}"] [data-fight-side]`)].map(text);
        expect(row('hit')).toEqual(['4', '3']);
        expect(row('armour')).toEqual(['2', '0']);
        expect(row('swing')).toEqual(['3 s', '4 s']);
        expect(text(q(panel, '[data-fight-hp="hero"]'))).toBe('17 · 57%');
        expect(text(q(panel, '[data-fight-hp="enemy"]'))).toBe('24 · 60%');
        expect(words(q(panel, '[data-fight-row="style"]'))).toBe('20/99 vs 20/99');
        // The hero's elixirs with the fights each has left, and statuses with stacks; the enemy's kinds.
        expect(text(q(panel, '[data-fight-elixir="item_elixir_of_valor"]'))).toBe('7');
        expect(text(q(panel, '[data-fight-elixir="item_elixir_of_ironskin"]'))).toBe('3');
        expect(words(q(panel, '[data-fight-status="effect_poison"]'))).toBe('Poison ×2');
        expect([...panel.querySelectorAll('[data-fight-kind]')].map(text)).toEqual(['Brute', 'Venomous']);
    });

    it('the strip: the hero at its left end, the enemy at its right, both at 1×', () => {
        const panel = panels(kit())[0];
        const hero = q(panel, '[data-fight-strip] [data-fight-fighter="hero"]');
        const enemy = q(panel, '[data-fight-strip] [data-fight-fighter="enemy"]');
        expect(hero.style.left).toBe('18px');
        expect(enemy.style.right).toBe('18px');
        expect(hero.style.width).toBe('64px');
        // A Goblin has no animation sheet: it stands still.
        expect(enemy.getAttribute('data-fight-enemy-moves')).toBe('false');
    });

    it('⭐ the log is closed until asked for, then holds this fight and the last one', () => {
        const root = kit();
        const panel = panels(root)[0];
        expect(q(panel, '[data-fight-log]').getAttribute('data-fight-log')).toBe('closed');
        expect(q(panel, '[data-fight-log-line]')).toBeNull();
        expect(text(q(panel, '[data-fight-log-toggle]'))).toBe(t('fight.panel.showLog'));

        act(() => { fireEvent.click(q(panel, '[data-fight-log-toggle]')); });
        expect(q(panel, '[data-fight-log]').getAttribute('data-fight-log')).toBe('open');
        expect(q(panel, '[data-fight-log-tab="this"]').getAttribute('aria-selected')).toBe('true');
        // The whole fight, newest first.
        const lines = [...panel.querySelectorAll('[data-fight-log-line]')];
        expect(lines).toHaveLength(KIT_CURRENT.log.length);
        expect(words(lines[0])).toBe('Poison hurts Aela −2');
        expect(words(lines.at(-1))).toBe('Aela drinks Elixir of Valor');

        act(() => { fireEvent.click(q(panel, '[data-fight-log-tab="last"]')); });
        const last = [...panel.querySelectorAll('[data-fight-log-line]')];
        expect(last).toHaveLength(KIT_LAST.log.length);
        expect(words(last[0])).toBe('Aela beats Goblin Warlord');
        expect(text(q(panel, '[data-fight-log-heading]'))).toBe('Beat Goblin Warlord in 0:42');

        act(() => { fireEvent.click(q(panel, '[data-fight-log-toggle]')); });
        expect(q(panel, '[data-fight-log-line]')).toBeNull();
    });

    it('with no fight before this one, the last tab says so', () => {
        const root = render(React.createElement(FightPanelView, {
            view: kitPanelView(), fights: { current: KIT_CURRENT, last: null }, onClose: () => {},
            logOpen: true, onToggleLog: () => {}, tab: 'last', onTab: () => {}
        })).container;
        expect(text(q(root, '[data-fight-log-empty]'))).toBe(t('fight.panel.noLastFight'));
        expect(q(root, '[data-fight-log-line]')).toBeNull();
    });
});

describe('the enemy card', () => {
    registerTokenTypes({
        cs_ui_brute: {
            id: 'cs_ui_brute', name: 'Card Brute', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, sprite: 's_crime',
            enemy: { level: 20, style: 'melee', kinds: ['brute', 'venomous'] },
            config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0 }
        }
    });

    it('⭐ shows its kinds only once the guild has fought it', () => {
        GameState.initNew();
        const unknown = enemyCardView('cs_ui_brute');
        expect(unknown.kinds).toBeNull();
        let root = render(React.createElement(EnemyCardRows, { card: unknown })).container;
        expect(q(root, '[data-enemy-card-kinds]').getAttribute('data-enemy-card-kinds')).toBe('unknown');
        expect(text(q(root, '[data-enemy-card-kinds]'))).toBe(t('fight.panel.unknownKinds'));
        cleanup();

        GameState.state.collection.discoveredEnemies.cs_ui_brute = true;
        const known = enemyCardView('cs_ui_brute');
        root = render(React.createElement(EnemyCardRows, { card: known })).container;
        expect([...root.querySelectorAll('[data-enemy-card-kind]')].map(e => e.getAttribute('data-enemy-card-kind'))).toEqual(['brute', 'venomous']);
        expect(text(q(root, '[data-enemy-card-kind="brute"]'))).toBe('Brute Big hits every 4 s');
    });

    it('its numbers are the level table\'s and the kinds\' (level 20 Brute: 40 health, hits 3 every 4 s)', () => {
        GameState.initNew();
        const card = enemyCardView('cs_ui_brute');
        expect(card).toMatchObject({ level: 20, style: 'melee', hp: 40, hit: 3, armour: 0, swingMs: 4000 });
        const root = render(React.createElement(EnemyCardRows, { card })).container;
        expect(text(q(root, '[data-enemy-card-level]'))).toBe('20/99');
        expect(text(q(root, '[data-enemy-card-swing]'))).toBe('every 4 s');
    });
});

describe('where the chip and the panel stand', () => {
    it('the chip stands beside the enemy\'s bar on its far side from the hero, past its number however wide', () => {
        const fit = 0.9;
        const u = plateUnit(fit);
        const at = { x: 800, y: 500, typeId: 'cs_ui_brute', fit };
        const right = fightChipPlace({ ...at, side: 1, labelW: 0 });
        const wide = fightChipPlace({ ...at, side: 1, labelW: 120 });
        const inner = at.x + (HP_BAR.W / 2) * u;
        // The hero on the right: the chip on the left, its right edge a gap before the bar or the number.
        expect(right.left + CHIP_PX * u).toBeCloseTo(inner - HP_BAR.W * u - CHIP.GAP * u, 0);
        expect(wide.left + CHIP_PX * u).toBeCloseTo(inner - 120 - CHIP.GAP * u, 0);
        // The hero on the left: mirrored.
        const left = fightChipPlace({ ...at, side: -1, labelW: 0 });
        expect(left.left).toBeCloseTo(at.x - (HP_BAR.W / 2) * u + HP_BAR.W * u + CHIP.GAP * u, 0);
        // Its foot level with the bar's: above the art, under nothing.
        expect(right.top).toBeLessThan(at.y);
    });

    it('the panel opens beside the chip on the side away from the fight, inside the window', () => {
        const chip = { left: 500, top: 400, right: 532, bottom: 432 };
        expect(panelPlace(chip, -1, 316, 400, 1920, 1080).left).toBe(500 - 10 - 316);
        expect(panelPlace(chip, 1, 316, 400, 1920, 1080).left).toBe(532 + 10);
        // No room on the asked side: the other one.
        expect(panelPlace({ ...chip, left: 100, right: 132 }, -1, 316, 400, 1920, 1080).left).toBe(142);
        // Never off the bottom of the window.
        expect(panelPlace({ ...chip, top: 1000, bottom: 1032 }, 1, 316, 400, 1920, 1080).top).toBe(1080 - 12 - 400);
    });
});

describe('the style sheet', () => {
    it('shows the combat screen drawn by the real components; the mock-ups are gone', () => {
        const entry = KIT_SECTIONS.find(s => s.id === 'combat-screen');
        expect(entry.status).toBe('unapproved');
        expect(entry.Demo).toBe(CombatKit);
        expect(existsSync(path.join(HERE, '..', 'ui', 'dev', 'CombatMockups.jsx'))).toBe(false);
        const root = render(React.createElement(CombatKit)).container;
        expect(root.querySelectorAll('[data-kit-combat="mat"] [data-health-bar]')).toHaveLength(2);
        expect(root.querySelectorAll('[data-kit-float]')).toHaveLength(9);
        expect(root.querySelectorAll('[data-fight-panel]')).toHaveLength(2);
        expect(root.querySelectorAll('[data-enemy-card]')).toHaveLength(2);
    });

    it('every line of the log and the screen has its words in the strings file', () => {
        const src = ['ui/components/combat/fightWatch.js', 'ui/components/combat/FightPanel.jsx', 'ui/components/combat/fightView.js',
            'ui/components/combat/EnemyCard.jsx', 'ui/components/board/fightPlate.js', 'ui/components/board/FightLayer.jsx',
            'ui/components/board/fx/fightFloats.js', 'ui/components/hud/CatchUpOverlay.jsx']
            .map(f => readFileSync(path.join(HERE, '..', f), 'utf8')).join('\n');
        const keys = new Set([...src.matchAll(/t\('((?:fight|catchUp)\.[\w.]+)'/g)].map(m => m[1]));
        for (const m of src.matchAll(/key: '(\w+)'/g)) keys.add(`fight.log.${m[1]}`);
        for (const m of src.matchAll(/key: (\w+) \? '(\w+)' : '(\w+)'/g)) { keys.add(`fight.log.${m[2]}`); keys.add(`fight.log.${m[3]}`); }
        expect(keys.size).toBeGreaterThan(30);
        for (const key of keys) expect(t(key, { count: 2 }), key).not.toBe(key);
    });
});
