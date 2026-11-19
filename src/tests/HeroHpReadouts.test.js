// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, cleanup, act } from '@testing-library/react';

vi.mock('../systems/board/Flags.js', () => ({
    statusOf: () => ({ state: 'docked', instanceId: null, typeId: null, limping: false })
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { HeroDrawer } from '../ui/components/dock/HeroDrawer.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { HERO_HP_EVENTS, movesHeroHp } from '../ui/hooks/heroHpEvents.js';

/**
 * ⭐ A fighting hero's health moves on the hero bar and in the Hero drawer as it does over their
 * head on the mat: the engine changes `hp` in place and says so mid-fight only through the hit,
 * the meal and the status tick, never `HEROES_UPDATED`. Each case mutates `hp` in place and
 * publishes exactly what the engine publishes, with its real payload.
 */

const h = React.createElement;

const hero = (id, name) => ({ id, name, spriteId: 'hn_recruit_por', hp: { current: 100, max: 100 }, status: 'combat', equipment: {}, skills: {} });
const hpOf = (id) => GameState.state.heroes.find(x => x.id === id).hp;

const mount = () => render(h(DeckDndProvider, null,
    h(BottomHeroDock, { selectedHeroId: 'h1' }),
    h(HeroDrawer, { menuRight: false, selectedHeroId: 'h1' })
));
const dockHp = (view, id) => view.container.querySelector(`[data-dock-hero="${id}"] [data-dock-hp] [data-hp-numbers]`).textContent;
const drawerHp = (view) => view.container.querySelector('[data-hero-panel-hp] [data-hp-numbers]').textContent;

const say = async (event, payload) => {
    await act(async () => { EventBus.publish(event, payload); await Promise.resolve(); });
};

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [hero('h1', 'Aldric'), hero('h2', 'Brenna')];
    setLiveMatFit(1);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('⭐ the hero bar and the Hero drawer move with every blow, meal and tick', () => {
    it('an enemy hit (COMBAT_ENEMY_ATTACK) moves both', async () => {
        const view = mount();
        expect(dockHp(view, 'h1')).toBe('100/100');
        expect(drawerHp(view)).toBe('100/100');
        hpOf('h1').current = 83;
        await say(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, {
            cardId: 'fight_1', instanceId: 'tok_e', heroId: 'h1', enemyId: 'enemy_1', damage: 17, hit: true, crit: false, heroHpRemaining: 83
        });
        expect(dockHp(view, 'h1')).toBe('83/100');
        expect(drawerHp(view)).toBe('83/100');
    });

    it('a meal eaten in the fight (COMBAT_HERO_ATE) moves both', async () => {
        hpOf('h1').current = 40;
        const view = mount();
        hpOf('h1').current = 65;
        await say(ENGINE_EVENTS.COMBAT_HERO_ATE, { cardId: 'fight_1', heroId: 'h1', itemId: 'food_bread', healed: 25 });
        expect(dockHp(view, 'h1')).toBe('65/100');
        expect(drawerHp(view)).toBe('65/100');
    });

    it('a poison or burn tick on the hero (STATUS_DOT_TICK) moves both', async () => {
        const view = mount();
        hpOf('h1').current = 96;
        await say(ENGINE_EVENTS.STATUS_DOT_TICK, { targetType: 'hero', targetId: 'h1', statusId: 'poison', stacks: 2, hpChange: -4 });
        expect(dockHp(view, 'h1')).toBe('96/100');
        expect(drawerHp(view)).toBe('96/100');
    });

    it('each readout hears only its own hero: another hero\'s hit moves only that hero\'s figure', async () => {
        const view = mount();
        hpOf('h2').current = 70;
        await say(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { cardId: 'fight_2', heroId: 'h2', enemyId: 'enemy_1', damage: 30, hit: true, heroHpRemaining: 70 });
        expect(dockHp(view, 'h2')).toBe('70/100');
        expect(dockHp(view, 'h1')).toBe('100/100');
        expect(drawerHp(view)).toBe('100/100');
    });
});

describe('the filter, pure', () => {
    it('a fight event about another hero, or a tick on an enemy, cannot move this hero', () => {
        const E = ENGINE_EVENTS;
        expect(movesHeroHp('h1', { heroId: 'h1' }, E.COMBAT_ENEMY_ATTACK)).toBe(true);
        expect(movesHeroHp('h1', { heroId: 'h2' }, E.COMBAT_ENEMY_ATTACK)).toBe(false);
        expect(movesHeroHp('h1', { heroId: 'h2' }, E.COMBAT_HERO_ATE)).toBe(false);
        expect(movesHeroHp('h1', { targetType: 'hero', targetId: 'h1' }, E.STATUS_DOT_TICK)).toBe(true);
        expect(movesHeroHp('h1', { targetType: 'enemy', targetId: 'h1' }, E.STATUS_DOT_TICK)).toBe(false);
        // Everything else may have moved anyone's health.
        expect(movesHeroHp('h1', { source: 'order', heroId: 'h2' }, E.HEROES_UPDATED)).toBe(true);
        expect(movesHeroHp('h1', { reason: 'catch_up' }, E.GAME_RESET)).toBe(true);
    });
});

describe('one list, shared', () => {
    const read = (rel) => readFileSync(join(process.cwd(), 'src', rel), 'utf8');
    it.each([
        'ui/components/board/MatHero.jsx',
        'ui/components/dock/DockHeroFigure.jsx',
        'ui/components/drawer/HeroInspectionSheet.jsx'
    ])('%s reads health on the shared HERO_HP_EVENTS', (file) => {
        const src = read(file);
        expect(src).toMatch(/import \{[^}]*HERO_HP_EVENTS[^}]*\} from '[./]*\/hooks\/heroHpEvents\.js'/);
        expect(src).not.toMatch(/const HERO_HP_EVENTS\s*=/);
    });

    it('the list is the hit, the meal, the tick, the roster and a reset', () => {
        expect([...HERO_HP_EVENTS].sort()).toEqual([
            ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, ENGINE_EVENTS.COMBAT_HERO_ATE,
            ENGINE_EVENTS.STATUS_DOT_TICK, ENGINE_EVENTS.GAME_RESET
        ].sort());
    });
});
