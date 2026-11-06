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
import { plateUnit } from '../ui/components/board/workPlate.js';
import { MAT_BAR, CHIP, CHIP_PX, fightBarShift, fightButtonPlace } from '../ui/components/board/healthBar.js';
import { panelPlace } from '../ui/components/combat/FightPanelPopup.jsx';
import { t } from '../i18n/index.js';

/**
 * The combat screen's pieces drawn (brief 220, C6b; owner's picks 2026-10-24/25): the floats' look,
 * the fight panel (the versus card, the log closed until asked for, This fight / Last fight), the
 * enemy card fought and never fought, the fight button's place between the two bars, the panel's
 * place beside it, and the style sheet's entry drawn by the real components.
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

    it('⭐ venom and burn ticks are red with a drop or a flame (no colour of their own)', () => {
        const poison = float({ kind: MOMENT.TICK, on: 'hero', amount: 2, statusId: 'effect_venom' });
        expect(poison.className).toContain('gi-ff-red');
        expect(q(poison, '[data-glyph="drop"]')).not.toBeNull();
        expect(poison.textContent).toBe('2');
        const burn = float({ kind: MOMENT.TICK, on: 'enemy', amount: 1, statusId: 'effect_burn' });
        expect(burn.className).toContain('gi-ff-red');
        expect(q(burn, '[data-glyph="flame"]')).not.toBeNull();
        expect(statusIcon('qa_fx_burn')).toBe('flame');
        expect(statusIcon('effect_venom')).toBe('drop');
        // Sunder wears a cracked shield.
        expect(statusIcon('effect_sunder')).toBe('sunder');
    });

    it('⭐ fewer floats on the mat: a hit is its number alone, no type glyph, Weak! or Resisted; a move alone does not float', () => {
        const plain = float({ kind: MOMENT.HIT, on: 'enemy', amount: 2, types: ['slash'], verdict: 'weak' });
        expect(plain.querySelector('[data-fight-float-type], .gi-ff-weak-word, .gi-ff-resisted-word, img')).toBeNull();
        expect(plain.textContent).toBe('2');
        const resisted = float({ kind: MOMENT.CRIT, on: 'hero', amount: 0, types: ['physical'], verdict: 'resisted', move: 'Peck' });
        expect(q(resisted, '.gi-ff-crit-word').textContent).toBe(t('fight.float.crit'));
        expect(q(resisted, '.gi-ff-crit-number').textContent).toBe('0');
        expect(resisted.querySelector('.gi-ff-resisted-word, .gi-ff-move-word')).toBeNull();
        expect(resisted.className).toContain('gi-ff-red');
        expect(float({ kind: MOMENT.MOVE, on: 'enemy', amount: null, move: 'Flutter' })).toBeNull();
    });

    it('a miss is in its side\'s colour: white on the enemy, red on the hero', () => {
        expect(float({ kind: MOMENT.MISS, on: 'enemy', amount: null }).className).toContain('gi-ff-white');
        expect(float({ kind: MOMENT.MISS, on: 'hero', amount: null }).className).toContain('gi-ff-red');
    });

    it('starts hidden: it shows only while it rises', () => {
        expect(float({ kind: MOMENT.HIT, on: 'enemy', amount: 3 }).style.visibility).toBe('hidden');
    });
});

describe('the fight panel', () => {
    const kit = () => render(React.createElement(CombatKit)).container;
    const panels = (root) => root.querySelectorAll('[data-fight-panel]');

    // Rewritten for the fight window (owner's pick B, 2026-11-05): each side's numbers are a stat
    // block like the Token card's, side by side; health is the bar with its numbers over each fighter.
    it('the stat blocks read across: style and level, hit with its type, swing, resistances; health over each fighter', () => {
        const panel = panels(kit())[0];
        const stat = (who, id) => text(q(panel, `[data-fight-stats="${who}"] [data-fight-stat="${id}"]`));
        expect(stat('hero', 'style')).toBe('Melee20/99');
        expect(stat('enemy', 'style')).toBe('Melee20/99');
        expect(stat('hero', 'hit')).toBe('Hit4');
        expect(stat('enemy', 'hit')).toBe('Hit3');
        expect([...panel.querySelectorAll('[data-fight-stat="hit"] [data-fight-hit-type]')].map(e => e.getAttribute('data-fight-hit-type'))).toEqual(['slash', 'physical']);
        expect(stat('hero', 'resists')).toBe('Resist25%');
        expect(stat('enemy', 'resists')).toBe('Resist50%−25%');
        expect([...panel.querySelectorAll('[data-fight-stats="enemy"] [data-fight-resist]')].map(e => e.getAttribute('data-fight-resist'))).toEqual(['fire', 'slash']);
        expect(stat('hero', 'swing')).toBe('Swing3 s');
        expect(stat('enemy', 'swing')).toBe('Swing4 s');
        expect(text(q(panel, '[data-fight-hp="hero"]'))).toBe('17/30');
        expect(text(q(panel, '[data-fight-hp="enemy"]'))).toBe('24/40');
        expect(text(q(panel, '[data-fight-title]'))).toBe('Aela vs Goblin Warlord');
        // The hero's elixirs with the fights each has left; statuses with stacks in two columns; the enemy's kinds.
        expect(text(q(panel, '[data-fight-elixir="item_elixir_of_valor"]'))).toBe('7');
        expect(text(q(panel, '[data-fight-elixir="item_elixir_of_ironskin"]'))).toBe('3');
        expect(words(q(panel, '[data-fight-effects="hero"] [data-fight-status="effect_venom"]'))).toBe('Venom ×2');
        expect(words(q(panel, '[data-fight-effects="enemy"]'))).toBe('On Goblin Warlord None');
        expect([...panel.querySelectorAll('[data-fight-kind]')].map(text)).toEqual(['Brute', 'Venomous']);
        // An enemy without moves has its one plain swing as its attack.
        expect([...panel.querySelectorAll('[data-fight-move]')].map(e => e.getAttribute('data-fight-move'))).toEqual(['Attack']);
    });

    it('the battle: the hero on the left, the enemy on the right, both at twice their art, whole pixels', () => {
        const panel = panels(kit())[0];
        const arena = q(panel, '[data-fight-arena]');
        const hero = q(arena, '[data-fight-fighter="hero"]');
        const enemy = q(arena, '[data-fight-fighter="enemy"]');
        expect(hero.style.width).toBe('128px');
        expect(parseFloat(hero.style.left)).toBeLessThan(parseFloat(enemy.style.left));
        for (const v of [hero.style.left, enemy.style.left, enemy.style.width]) expect(Number.isInteger(parseFloat(v))).toBe(true);
        // A Goblin has no animation sheet: it stands still.
        expect(enemy.getAttribute('data-fight-enemy-moves')).toBe('false');
    });

    it('⭐ the log is closed until asked for, then holds this fight and the last one', () => {
        const root = kit();
        const panel = panels(root)[0];
        expect(q(panel, '[data-fight-log]').getAttribute('data-fight-log')).toBe('closed');
        expect(q(panel, '[data-fight-log-line]')).toBeNull();
        expect(text(q(panel, '[data-fight-log-toggle]'))).toBe(t('fight.window.log'));

        act(() => { fireEvent.click(q(panel, '[data-fight-log-toggle]')); });
        expect(q(panel, '[data-fight-log]').getAttribute('data-fight-log')).toBe('open');
        expect(q(panel, '[data-fight-log-tab="this"]').getAttribute('aria-selected')).toBe('true');
        // The whole fight, newest first.
        const lines = [...panel.querySelectorAll('[data-fight-log-line]')];
        expect(lines).toHaveLength(KIT_CURRENT.log.length);
        expect(words(lines[0])).toBe('Venom hurts Aela −2');
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
        expect(card).toMatchObject({ level: 20, style: 'melee', hp: 40, hit: 3, hitType: 'physical', resists: [], swingMs: 4000 });
        const root = render(React.createElement(EnemyCardRows, { card })).container;
        expect(text(q(root, '[data-enemy-card-level]'))).toBe('20/99');
        expect(q(root, '[data-enemy-card-resists="none"]')).not.toBeNull();
        expect(q(root, '[data-enemy-card-armour]')).toBeNull();
        expect(text(q(root, '[data-enemy-card-swing]'))).toBe('every 4 s');
    });
});

describe('where the fight button and the panel stand', () => {
    it('⭐ the button stands halfway between the fighters, its middle on the lower bar\'s middle', () => {
        const fit = 0.9;
        const u = plateUnit(fit);
        const at = { heroX: 900, enemyX: 800, heroArtTop: 436, enemyBoxTop: 436, u, fit };
        const p = fightButtonPlace(at);
        expect(p.size).toBe(CHIP_PX * u);
        expect(p.left + p.size / 2).toBeCloseTo(850, 0);
        const barMid = 436 - (MAT_BAR.GAP + MAT_BAR.H / 2) * u;
        expect(p.top + p.size / 2).toBeCloseTo(barMid, 0);
        // A boss's bar rides higher: the button stays on the hero's line.
        const boss = fightButtonPlace({ ...at, enemyBoxTop: 380 });
        expect(boss.top).toBe(p.top);
        // On whole screen pixels.
        expect(Math.abs(p.left * fit - Math.round(p.left * fit))).toBeLessThan(1e-9);
    });

    it('⭐ bars move outward only as far as the button needs, a gap clear of it', () => {
        const u = 1;
        const need = (MAT_BAR.W / 2 + CHIP.GAP + CHIP_PX / 2) * u;
        expect(fightBarShift(2 * need + 40, u)).toBe(0);
        expect(fightBarShift(-(2 * need + 40), u)).toBe(0);
        expect(fightBarShift(96, u)).toBe(need - 48);
        // At the shift, each bar's inner edge is exactly the gap from the button.
        const apart = 96;
        const barInner = apart / 2 + fightBarShift(apart, u) - MAT_BAR.W / 2;
        expect(barInner).toBeCloseTo(CHIP_PX / 2 + CHIP.GAP, 9);
    });

    it('the panel opens beside the fight on the side away from it, inside the window', () => {
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
            'ui/components/combat/EnemyCard.jsx', 'ui/components/board/callouts.js', 'ui/components/board/FightLayer.jsx',
            'ui/components/board/fx/fightFloats.js', 'ui/components/hud/CatchUpOverlay.jsx']
            .map(f => readFileSync(path.join(HERE, '..', f), 'utf8')).join('\n');
        const keys = new Set([...src.matchAll(/t\('((?:fight|catchUp)\.[\w.]+)'/g)].map(m => m[1]));
        for (const m of src.matchAll(/key: '(\w+)'/g)) keys.add(`fight.log.${m[1]}`);
        for (const m of src.matchAll(/key: (\w+) \? '(\w+)' : '(\w+)'/g)) { keys.add(`fight.log.${m[2]}`); keys.add(`fight.log.${m[3]}`); }
        expect(keys.size).toBeGreaterThan(30);
        for (const key of keys) expect(t(key, { count: 2 }), key).not.toBe(key);
    });
});
