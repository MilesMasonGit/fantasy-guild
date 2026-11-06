// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { enemyMovesOf } from '../config/registries/enemyMoves.js';
import { buildFloat } from '../ui/components/board/fx/fightFloats.js';
import { startFightWatch, resetFightWatch, fightsOf, subscribeMoments, MOMENT } from '../ui/components/combat/fightWatch.js';
import { FightPanelView } from '../ui/components/combat/FightPanel.jsx';
import { EnemyCardRows } from '../ui/components/combat/EnemyCard.jsx';
import { enemyCardView, movesView, moveEffectText, enemyHitTypes } from '../ui/components/combat/fightView.js';
import { kitPanelView, KIT_CURRENT } from '../ui/dev/combatKit.js';
import { t } from '../i18n/index.js';

/**
 * Enemy moves on the combat screen (brief 280 V3): the float names the move over its hit or miss, or
 * alone beside the enemy for a move that does not hit; the log says "Chicken's Peck hits Aela"; the
 * panel lists the moves with the last one made bright; the enemy card lists them with what each hits
 * with or does.
 */

const q = (root, sel) => root.querySelector(sel);
const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim();
/** An element's words as read: each leaf's text, joined by a space. */
const words = (el) => [...el.querySelectorAll('*')].filter(n => !n.children.length).map(n => n.textContent.trim()).filter(Boolean).join(' ');

registerEffects({
    emu_flutter: { id: 'emu_flutter', name: 'Flutter', statements: [] },
    emu_venom: { id: 'emu_venom', name: 'Venom', status: { stacks: 3, ticks: 0 }, statements: [] }
});
const CHICKEN_MOVES = [
    { name: 'Peck', damageType: 'stab' },
    { name: 'Scratch', damageType: 'slash' },
    { name: 'Flutter', hits: false, effectId: 'emu_flutter', target: 'self', lasts: 'attack' }
];
registerTokenTypes({
    emu_chicken: {
        id: 'emu_chicken', name: 'Chicken', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, sprite: 'e_chicken',
        enemy: { level: 2, style: 'melee', moves: CHICKEN_MOVES },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0 }
    }
});

beforeEach(() => resetFightWatch());
afterEach(() => {
    cleanup();
    resetFightWatch();
});

describe('a move is said in a bubble over the enemy, not in the floats (owner\'s pick, 2026-11-05)', () => {
    const float = (m) => buildFloat({ heroId: 'h', instanceId: 'e', ...m });

    it('a hit, a crit or a miss made by a move floats with no move word', () => {
        const hit = float({ kind: MOMENT.HIT, on: 'hero', amount: 2, types: ['stab'], move: 'Peck' });
        expect(hit.hasAttribute('data-fight-float-move')).toBe(false);
        expect(hit.textContent).toBe('2');
        const crit = float({ kind: MOMENT.CRIT, on: 'hero', amount: 3, types: ['slash'], verdict: 'resisted', move: 'Scratch' });
        expect(crit.querySelector('.gi-ff-move-word')).toBeNull();
        expect(crit.textContent).toBe(`${t('fight.float.crit')}3`);
        const miss = float({ kind: MOMENT.MISS, on: 'hero', amount: null, move: 'Peck' });
        expect(miss.textContent).toBe(t('fight.float.miss'));
    });

    it('a move that does not hit draws no float at all', () => {
        expect(float({ kind: MOMENT.MOVE, on: 'enemy', move: 'Flutter' })).toBeNull();
    });
});

describe('the log and the moments', () => {
    const engage = () => EventBus.publish(BOARD_EVENTS.COMBAT_ENGAGED, { heroId: 'h1', instanceId: 'e1', typeId: 'emu_chicken' });
    const swing = (p) => EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { cardId: 'fight_e1', instanceId: 'e1', heroId: 'h1', enemyId: 'emu_chicken', heroHpRemaining: 20, ...p });

    it('each swing names its move; a move that does not hit is a line of its own', () => {
        GameState.initNew();
        const stop = startFightWatch();
        const moments = [];
        const off = subscribeMoments((m) => moments.push(m));
        engage();
        swing({ damage: 2, hit: true, crit: false, types: ['stab'], verdict: 'resisted', move: 'Peck' });
        swing({ damage: 4, hit: true, crit: true, types: ['slash'], verdict: null, move: 'Scratch' });
        swing({ damage: 0, hit: false, crit: false, move: 'Peck' });
        swing({ damage: 0, hit: false, crit: false, move: 'Flutter', effectOnly: true });
        swing({ damage: 1, hit: true, crit: false, types: ['physical'], verdict: null });
        off();
        stop();
        const record = fightsOf('h1').current;
        const lines = record.log.map(l => [l.key, t(`fight.log.${l.key}`, l.vars), l.amount ?? null]);
        expect(lines.map(l => l[0])).toEqual(['enemyMoveHits', 'enemyMoveCrits', 'enemyMoveMisses', 'enemyUsesMove', 'enemyHits']);
        expect(lines[0][1]).toBe('Chicken\'s Peck hits h1');
        expect(lines[0][2]).toBe('−2');
        expect(lines[3][1]).toBe('Chicken uses Flutter');
        expect(record.lastMove).toBe('Flutter');
        expect(moments.map(m => [m.kind, m.on, m.move ?? null])).toEqual([
            [MOMENT.HIT, 'hero', 'Peck'], [MOMENT.CRIT, 'hero', 'Scratch'], [MOMENT.MISS, 'hero', 'Peck'],
            [MOMENT.MOVE, 'enemy', 'Flutter'], [MOMENT.HIT, 'hero', null]
        ]);
    });

    it('a move with no name is called Attack', () => {
        GameState.initNew();
        const stop = startFightWatch();
        engage();
        swing({ damage: 1, hit: true, crit: false, types: ['physical'], move: '' });
        stop();
        expect(t('fight.log.enemyMoveHits', fightsOf('h1').current.log[0].vars)).toBe(`Chicken's ${t('fight.moves.unnamed')} hits h1`);
    });
});

describe('what the screen lists', () => {
    it('each move: its name, the type it hits with or what its effect does, its share of the swings', () => {
        const moves = enemyMovesOf({ moves: [...CHICKEN_MOVES, { name: 'Bite', damageType: 'poison', effectId: 'emu_venom', weight: 3 }] });
        expect(movesView(moves)).toEqual([
            { name: 'Peck', hits: true, type: 'stab', effect: null, share: 17 },
            { name: 'Scratch', hits: true, type: 'slash', effect: null, share: 17 },
            { name: 'Flutter', hits: false, type: null, effect: 'Flutter on itself, for one attack', share: 17 },
            { name: 'Bite', hits: true, type: 'poison', effect: 'Venom on the hero', share: 50 }
        ]);
        expect(movesView([])).toBeNull();
        expect(enemyHitTypes(moves)).toEqual(['stab', 'slash', 'poison']);
        expect(enemyHitTypes(undefined)).toEqual(['physical']);
        expect(moveEffectText(enemyMovesOf({ moves: [{ name: 'X', effectId: 'emu_flutter', target: 'self', lasts: 'swing' }] })[0])).toBe('Flutter on itself, for the swing');
        expect(moveEffectText(enemyMovesOf({ moves: [{ name: 'X', effectId: 'emu_flutter' }] })[0])).toBe('Flutter on the hero, for the fight');
    });

    it('the enemy card: the hit with each type\'s glyph, and a Moves row', () => {
        GameState.initNew();
        const card = enemyCardView('emu_chicken');
        expect(card.hitTypes).toEqual(['stab', 'slash']);
        const root = render(React.createElement(EnemyCardRows, { card })).container;
        expect([...root.querySelectorAll('[data-enemy-card-hit] [data-glyph]')].length).toBe(2);
        expect([...root.querySelectorAll('[data-enemy-card-move]')].map(words)).toEqual([
            'Peck Stab', 'Scratch Slash', 'Flutter Flutter on itself, for one attack'
        ]);
    });

    it('an enemy without moves keeps its card as it was: one Physical glyph and its name, no Moves row', () => {
        GameState.initNew();
        const card = enemyCardView('token_goblin') || enemyCardView('emu_chicken');
        const plain = { ...card, hitType: 'physical', hitTypes: ['physical'], moves: null };
        const root = render(React.createElement(EnemyCardRows, { card: plain })).container;
        expect(text(q(root, '[data-enemy-card-hit]'))).toBe(`${plain.hit}Physical`);
        expect(root.querySelectorAll('[data-enemy-card-hit] [data-glyph]')).toHaveLength(1);
        expect(q(root, '[data-enemy-card-moves]')).toBeNull();
    });

    it('the panel: the moves in the enemy\'s column, the last one bright; the hit row shows each type', () => {
        const view = kitPanelView();
        const moves = movesView(enemyMovesOf({ moves: CHICKEN_MOVES }));
        view.enemy = { ...view.enemy, name: 'Chicken', hitType: 'stab', hitTypes: ['stab', 'slash'], moves, lastMove: 'Scratch' };
        const root = render(React.createElement(FightPanelView, {
            view, fights: { current: KIT_CURRENT, last: null }, onClose: () => {}, logOpen: false, onToggleLog: () => {}, tab: 'this', onTab: () => {}
        })).container;
        const listed = [...root.querySelectorAll('[data-fight-effects="enemy"] [data-fight-move]')];
        expect(listed.map(e => e.getAttribute('data-fight-move'))).toEqual(['Peck', 'Scratch', 'Flutter']);
        expect(listed.map(e => e.getAttribute('data-fight-move-last'))).toEqual(['false', 'true', 'false']);
        expect(listed[1].className).toContain('text-white');
        expect([...root.querySelectorAll('[data-fight-row="hit"] [data-fight-side="enemy"] [data-fight-hit-type]')].map(e => e.getAttribute('data-fight-hit-type'))).toEqual(['stab', 'slash']);
    });

    it('every new line has its words in the strings file', () => {
        for (const key of ['fight.log.enemyMoveHits', 'fight.log.enemyMoveCrits', 'fight.log.enemyMoveMisses', 'fight.log.enemyUsesMove',
            'fight.moves.unnamed', 'fight.moves.selfAttack', 'fight.moves.selfSwing', 'fight.moves.selfFight', 'fight.moves.selfStatus',
            'fight.moves.heroAttack', 'fight.moves.heroSwing', 'fight.moves.heroFight', 'fight.moves.heroStatus', 'fight.moves.noHit',
            'fight.moves.share', 'fight.moves.lastMove', 'fight.tip.enemyMoves', 'fight.card.moves']) {
            expect(t(key, { n: 1 }), key).not.toBe(key);
        }
    });
});
