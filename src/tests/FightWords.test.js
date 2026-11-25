// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { startFightWatch, resetFightWatch, fightsOf, OUTCOME } from '../ui/components/combat/fightWatch.js';
import { FightLog, resultWord } from '../ui/components/combat/FightPanel.jsx';
import { fightPanelView } from '../ui/components/combat/fightView.js';
import { bannerText } from '../systems/notifications/bannerKinds.js';
import { momentText } from '../ui/components/board/heroSpeech.js';
import en from '../i18n/en.json';

/**
 * The fight's words and logs: an elixir drunk mid-fight is in that fight's log at once, and a
 * fight's end is said one way, Defeated, for winning and losing alike (owner, 2026-11-20).
 */

const fights = new Map();
const heroes = new Map();

vi.mock('../systems/board/BoardCombat.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getFight: (id) => fights.get(id) || null,
    fightOfHero: (heroId) => [...fights.values()].find(f => f.assignedHeroId === heroId) || null
}));
vi.mock('../systems/hero/HeroManager.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getHero: (id) => heroes.get(id) || null
}));

registerItems({
    fw_elixir: { id: 'fw_elixir', name: 'Elixir of Words', type: 'potion', stackable: true, equipSlot: 'consumable' }
});

let stop = null;
beforeEach(() => {
    resetFightWatch();
    fights.clear();
    heroes.clear();
    heroes.set('h1', { id: 'h1', name: 'Kira', hp: { current: 30, max: 30 } });
    stop = startFightWatch();
});
afterEach(() => {
    stop?.();
    cleanup();
    resetFightWatch();
    vi.useRealTimers();
});

const engage = (instanceId = 'e1', name = 'Goblin') => {
    fights.set(instanceId, { instanceId, assignedHeroId: 'h1', enemy: { id: 'fw_goblin', name, hp: 20 }, combat: { enemyHp: { current: 20, max: 20 } } });
    EventBus.publish(BOARD_EVENTS.COMBAT_ENGAGED, { heroId: 'h1', instanceId, typeId: 'fw_goblin' });
};
const swing = (instanceId = 'e1') => EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { heroId: 'h1', instanceId, hit: true, damage: 3, enemyHpRemaining: 17 });
const drink = () => EventBus.publish(ENGINE_EVENTS.HERO_CONSUMED, { heroId: 'h1', itemId: 'fw_elixir', elixir: true });
const resolve = (outcome, instanceId = 'e1') => {
    EventBus.publish(BOARD_EVENTS.COMBAT_RESOLVED, { heroId: 'h1', instanceId, outcome });
    fights.delete(instanceId);
};
const keys = (record) => record.log.map(l => l.key);

describe('an elixir drunk mid-fight', () => {
    it('is in this fight\'s log the moment it is drunk', () => {
        engage();
        swing();
        drink();
        expect(keys(fightsOf('h1').current)).toEqual(['heroHits', 'drinks']);
        expect(fightsOf('h1').current.log.at(-1).vars).toEqual({ hero: 'Kira', item: 'Elixir of Words' });
    });

    it('is not told again when the next fight starts', () => {
        engage();
        drink();
        resolve('victory');
        engage('e2', 'Wolf');
        expect(keys(fightsOf('h1').last)).toEqual(['drinks', 'won']);
        expect(keys(fightsOf('h1').current)).toEqual([]);
    });

    it('⚠️ drunk as a new fight engages while the one before is still open: the new fight\'s', () => {
        engage();
        // The hero moved on to the Wolf with no word yet: their Goblin record is still open.
        fights.delete('e1');
        fights.set('e2', { instanceId: 'e2', assignedHeroId: 'h1', enemy: { id: 'fw_wolf', name: 'Wolf', hp: 20 }, combat: { enemyHp: { current: 20, max: 20 } } });
        drink();
        EventBus.publish(BOARD_EVENTS.COMBAT_ENGAGED, { heroId: 'h1', instanceId: 'e2', typeId: 'fw_wolf' });
        expect(keys(fightsOf('h1').last)).toEqual([]);
        expect(keys(fightsOf('h1').current)).toEqual(['drinks']);
    });

    it('drunk as a fight engages, before its record, still opens that fight\'s log', () => {
        drink();
        engage();
        expect(keys(fightsOf('h1').current)).toEqual(['drinks']);
    });
});

describe('Defeated, for winning and losing', () => {
    const heading = (fightsNow) => {
        const { container } = render(React.createElement(FightLog, { fights: fightsNow, open: true, tab: 'last', onTab: () => {} }));
        return container.querySelector('[data-fight-log-heading]')?.textContent;
    };
    const timed = (ms) => {
        const record = fightsOf('h1').last;
        record.endedAt = record.startedAt + ms;
        return fightsOf('h1');
    };

    it('a win heads its log Defeated Goblin in 42s', () => {
        engage();
        resolve('victory');
        expect(heading(timed(42_000))).toBe('Defeated Goblin in 42s');
    });

    it('a loss heads its log Defeated by Goblin after 1m 5s', () => {
        engage();
        resolve('defeat');
        expect(heading(timed(65_000))).toBe('Defeated by Goblin after 1m 5s');
    });

    it('the log\'s last line says it the same way', async () => {
        const { t } = await import('../i18n/index.js');
        engage();
        resolve('victory');
        const won = fightsOf('h1').last.log.at(-1);
        expect(t(`fight.log.${won.key}`, won.vars)).toBe('Kira defeats Goblin');
        engage('e2', 'Wolf');
        resolve('defeat', 'e2');
        const lost = fightsOf('h1').last.log.at(-1);
        expect(t(`fight.log.${lost.key}`, lost.vars)).toBe('Kira is defeated by Wolf');
    });

    it('the window\'s title bar and tab between fights', () => {
        expect(resultWord(OUTCOME.WON, 'Goblin').text).toBe('Defeated Goblin');
        expect(resultWord(OUTCOME.LOST, 'Goblin').text).toBe('Defeated by Goblin');
        expect(resultWord(OUTCOME.LEFT, 'Goblin')).toBeNull();
    });

    it('the banner and the hero who won say Defeated', () => {
        expect(bannerText('knockout', { heroes: ['Aela'], lost: [] }).title).toBe('Defeated!');
        expect(bannerText('knockout', { heroes: ['Aela', 'Bram'], losses: [] }).line).toBe('Aela and Bram were defeated and carried home. Nothing was lost.');
        expect(momentText.beaten('Goblin')).toBe('Goblin Defeated');
    });

    it('⚠️ no player-facing string says knock-out or knocked out', () => {
        const strings = [];
        const walk = (node) => {
            if (typeof node === 'string') strings.push(node);
            else if (node && typeof node === 'object') Object.values(node).forEach(walk);
        };
        walk(en);
        const said = /knock(ed)?[- ]?out/i;
        expect(strings.filter(s => said.test(s))).toEqual([]);
        // The banner's lines are written in code, not in en.json.
        const banners = readFileSync('src/systems/notifications/bannerKinds.js', 'utf8');
        const literals = banners.match(/`[^`]*`|'[^'\n]*'/g) || [];
        expect(literals.filter(s => said.test(s) && !/^'[\w.]+'$/.test(s))).toEqual([]);
    });
});

describe('the combat screen\'s leftovers are gone', () => {
    it('the panel\'s view carries no title, clock or health text nobody shows', () => {
        engage();
        const view = fightPanelView('h1', fightsOf('h1'));
        expect(view).not.toHaveProperty('title');
        expect(view).not.toHaveProperty('clock');
        expect(view.hero).not.toHaveProperty('hpText');
        expect(view.enemy).not.toHaveProperty('hpText');
    });

    it('the unused log switch words are gone', () => {
        expect(en.fight.panel).not.toHaveProperty('showLog');
        expect(en.fight.panel).not.toHaveProperty('hideLog');
    });
});
