import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { FIRST_NAMES, getRandomName } from '../config/registries/nameRegistry.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { hireHero } from '../ui/dev/qaTools.js';

/**
 * ⭐ No two heroes share a name: a recruit draws from the names no hero on the roster holds (any
 * name once every one is taken), with one random draw as before; a name the player typed stays as
 * typed. The list holds about twice the first 96.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.rosterLimit = 400;
});
afterEach(() => vi.restoreAllMocks());

describe('⭐ the name list', () => {
    it('holds about twice the first 96, every one different', () => {
        expect(FIRST_NAMES.length).toBeGreaterThanOrEqual(180);
        expect(new Set(FIRST_NAMES.map(n => n.toLowerCase())).size).toBe(FIRST_NAMES.length);
        for (const n of FIRST_NAMES) expect(n).toMatch(/^[A-Z][a-z]+$/);
    });
});

describe('⭐ a random name avoids the names held', () => {
    it('never draws a held name, whatever the roll', () => {
        const taken = FIRST_NAMES.filter((_, i) => i % 3 !== 0);
        for (const roll of [0, 0.25, 0.5, 0.75, 0.999999]) {
            vi.spyOn(Math, 'random').mockReturnValue(roll);
            expect(taken).not.toContain(getRandomName(taken));
            vi.restoreAllMocks();
        }
    });

    it('a held name matches without case or outer spaces', () => {
        const taken = FIRST_NAMES.filter(n => n !== 'Wren').map(n => ` ${n.toUpperCase()} `);
        expect(getRandomName(taken)).toBe('Wren');
    });

    it('draws from every name once all are taken', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(getRandomName(FIRST_NAMES)).toBe(FIRST_NAMES[0]);
    });

    it('is one random draw, held names or not', () => {
        const spy = vi.spyOn(Math, 'random');
        getRandomName(FIRST_NAMES.slice(0, 50));
        expect(spy).toHaveBeenCalledTimes(1);
    });
});

describe('⭐ a recruit takes a name no hero holds', () => {
    it('every recruit of a full roster has its own name', () => {
        const names = [];
        for (let i = 0; i < FIRST_NAMES.length; i++) names.push(HeroManager.createHero({}, true).name);
        expect(new Set(names).size).toBe(FIRST_NAMES.length);
    });

    it('with one name left, the recruit gets it', () => {
        GameState.state.heroes = FIRST_NAMES.filter(n => n !== 'Lark').map((name, i) => ({ id: `h${i}`, name }));
        expect(HeroManager.createHero({}, true).name).toBe('Lark');
    });

    it('a name the player chose stays, even when a hero holds it', () => {
        HeroManager.createHero({ name: 'Wren' }, true);
        expect(HeroManager.createHero({ name: 'Wren' }, true).name).toBe('Wren');
    });

    it('the QA panel\'s hire button takes a free name too', () => {
        GameState.state.heroes = [{ id: 'h0', name: FIRST_NAMES[0] }];
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(hireHero().name).toBe(FIRST_NAMES[1]);
    });
});
