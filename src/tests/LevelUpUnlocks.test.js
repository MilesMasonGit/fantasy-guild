// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('../systems/board/Flags.js', () => ({
    statusOf: () => ({ state: 'docked', instanceId: null, typeId: null, limping: false })
}));
vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', () => ({
    HeroInspectionSheet: () => React.createElement('div', { 'data-testid': 'hero-sheet' })
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { unlocksBetween, levelUpUnlocks, unlockSummary, unlockGroups, mergeUnlocks } from '../ui/components/dock/levelUnlocks.js';
import { bubblesOf, clearAllHeroBubbles } from '../ui/components/dock/heroBarBubbles.js';
import { floatsOf, clearAllFloats } from '../ui/components/board/levelUpFloats.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { xpForLevel } from '../utils/XPCurve.js';

/**
 * A level-up is shown with what it unlocks: the perk reached, the recipes the hero can now make,
 * the Tokens they can now work and the gear they can now wear, read off the rules the game runs
 * (a recipe's level, a Token's skill requirement, gear's level requirements). The float says it
 * short; the hero bar's alert, clicked, lists each by name.
 */

const h = React.createElement;
const SKILL = 'k524skill';

registerEffects({
    k524_felling: {
        id: 'k524_felling', name: 'Clean Felling',
        statements: [{
            id: 'stm_k524_felling', keyword: KEYWORD.PROVIDES,
            payload: { type: EFFECT_TYPES.XP_BONUS, bucket: 'percentage', value: 0.1, category: SKILL },
            to: { mode: 'all', value: '' }, reach: 'nearby'
        }]
    }
});
registerRecipePools({
    [SKILL]: [
        { id: 'k524_r10', name: 'Pine Plank', levelRequirement: 10 },
        { id: 'k524_r24', name: 'Oak Plank', levelRequirement: 24 },
        { id: 'k524_r25', name: 'Birch Plank', levelRequirement: 25 },
        { id: 'k524_r40', name: 'Maple Plank', levelRequirement: 40 }
    ]
});
registerTokenTypes({
    k524_grove: { id: 'k524_grove', name: 'Birch Grove', config: { skill: SKILL, skillRequired: 25 } },
    k524_far: { id: 'k524_far', name: 'Maple Grove', config: { skill: SKILL, skillRequired: 45 } }
});
registerItems({
    k524_axe: { id: 'k524_axe', name: 'Birch Axe', equipSlot: 'hat', requirements: [{ skill: SKILL, level: 25 }] },
    k524_both: { id: 'k524_both', name: 'Twin Hat', equipSlot: 'hat', requirements: [{ skill: SKILL, level: 25 }, { skill: 'mining', level: 50 }] },
    k524_food: { id: 'k524_food', name: 'Birch Bread', equipSlot: 'food' }
});

const lvl = (level) => ({ level, xp: xpForLevel(level) });
const hero = (id, level, extra = {}) => ({
    id, name: id, spriteId: 'hn_recruit_por', hp: { current: 11, max: 11 }, status: 'idle', equipment: {},
    skills: { [SKILL]: lvl(level), mining: lvl(12) }, ...extra
});
const level = (heroId, oldLevel, newLevel) =>
    act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId, heroName: heroId, skillId: SKILL, skillName: 'Woodcraft', oldLevel, newLevel }); });

beforeEach(() => {
    vi.useFakeTimers();
    clearAllHeroBubbles();
    clearAllFloats();
    GameState.initNew();
    GameState.state.heroes = [hero('h1', 25)];
    setLiveMatFit(1);
    registerSkillPerks({ [SKILL]: { perks: [{ level: 25, effectId: 'k524_felling' }] } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
afterAll(() => registerSkillPerks({ [SKILL]: { perks: [] } }));

describe('what a level-up unlocks, by the rules the game runs', () => {
    const lists = {
        recipes: [
            { id: 'a', name: 'A', skill: SKILL, levelRequirement: 10 },
            { id: 'b', name: 'B', skill: SKILL, levelRequirement: 25 },
            { id: 'c', name: 'C', skill: 'other', levelRequirement: 25 },
            { id: 'd', name: 'D', skill: SKILL }
        ],
        tokenTypes: {
            t1: { id: 't1', name: 'T1', config: { skill: SKILL, skillRequired: 25 } },
            t2: { id: 't2', name: 'T2', config: { skill: SKILL, skillRequired: 26 } },
            t3: { id: 't3', name: 'T3', config: { skill: 'other', skillRequired: 25 } },
            t4: { id: 't4', name: 'T4', foundation: { skill: SKILL } }
        },
        items: {
            g1: { id: 'g1', name: 'G1', equipSlot: 'chest', requirements: [{ skill: SKILL, level: 20 }] },
            g2: { id: 'g2', name: 'G2', equipSlot: 'chest', requirements: [{ skill: SKILL, level: 20 }, { skill: 'mining', level: 99 }] },
            g3: { id: 'g3', name: 'G3', equipSlot: 'chest', requirements: [{ skill: SKILL, level: 30 }] },
            g4: { id: 'g4', name: 'G4', requirements: [{ skill: SKILL, level: 20 }] }
        }
    };
    const names = (rows) => rows.map(r => r.name);

    it('counts what sits above the old level and at or below the new one', () => {
        const u = unlocksBetween({ skillId: SKILL, fromLevel: 15, toLevel: 25, hero: hero('x', 25) }, lists);
        expect(names(u.recipes)).toEqual(['B']);
        expect(names(u.tokens)).toEqual(['T1']);
        // G2 also asks Mining 99, which the hero lacks; G4 is not gear at all.
        expect(names(u.gear)).toEqual(['G1']);
    });

    it('finds nothing for a level that crosses no requirement', () => {
        const u = unlocksBetween({ skillId: SKILL, fromLevel: 11, toLevel: 12, hero: hero('x', 12) }, lists);
        expect(u).toEqual({ recipes: [], tokens: [], gear: [] });
    });

    it('lists no gear for a villager, who cannot wear any', () => {
        const u = unlocksBetween({ skillId: SKILL, fromLevel: 15, toLevel: 25, hero: hero('x', 25, { isVillager: true }) }, lists);
        expect(u.gear).toEqual([]);
    });

    it('says it short and lists it whole', () => {
        const u = levelUpUnlocks('h1', SKILL, 24, 25);
        expect(u).toEqual({ perks: ['Clean Felling'], recipes: ['Birch Plank'], tokens: ['Birch Grove'], gear: ['Birch Axe'] });
        expect(unlockSummary(u)).toBe('Clean Felling, +1 recipe, +1 Token, +1 gear');
        expect(unlockSummary({ perks: ['Clean Felling'], recipes: ['A', 'B'], tokens: [], gear: [] })).toBe('Clean Felling, +2 recipes');
        expect(unlockSummary({ perks: [], recipes: [], tokens: [], gear: [] })).toBe('');
        expect(unlockGroups(u).map(g => [g.label, g.names])).toEqual([
            ['Perk', ['Clean Felling']], ['Recipe', ['Birch Plank']], ['Token', ['Birch Grove']], ['Gear', ['Birch Axe']]
        ]);
        expect(unlockGroups({ perks: [], recipes: ['A', 'B'], tokens: [], gear: [] }).map(g => g.label)).toEqual(['Recipes']);
    });

    it('merges two level-ups\' unlocks, each name once', () => {
        const a = { perks: ['P'], recipes: ['A'], tokens: [], gear: [] };
        const b = { perks: ['P'], recipes: ['A', 'B'], tokens: ['T'], gear: [] };
        expect(mergeUnlocks(a, b)).toEqual({ perks: ['P'], recipes: ['A', 'B'], tokens: ['T'], gear: [] });
    });
});

describe('the level-up float says it short', () => {
    const heroes = [{ heroId: 'h1', state: 'working', x: 300, y: 500, moving: false, tokenId: null, alert: null }];

    it('names the perk, and counts the rest on a line below it, under the number; a plain level says nothing more', () => {
        GameState.state.heroes = [hero('h1', 25), hero('h2', 13)];
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        act(() => { vi.advanceTimersByTime(10); });
        level('h1', 24, 25);
        const float = container.querySelector(`[data-level-float="${SKILL}"]`);
        expect(float.querySelector('[data-level-unlocks]').getAttribute('aria-label')).toBe('Clean Felling, +1 recipe, +1 Token, +1 gear');
        expect(float.querySelector('[data-level-counts]').textContent).toBe('+1 recipe, +1 Token, +1 gear');
        expect([...float.querySelectorAll('[data-level-perk]')].map(n => n.textContent)).toEqual(['Clean Felling']);
        act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId: 'h2', skillId: 'mining', skillName: 'Mining', oldLevel: 12, newLevel: 13 }); });
        expect(floatsOf('h2')[0].unlocks).toEqual({ perks: [], recipes: [], tokens: [], gear: [] });
    });

    it('keeps what an earlier level-up unlocked while the float is still up', () => {
        level('h1', 9, 10);
        level('h1', 24, 25);
        expect(floatsOf('h1')[0].unlocks.recipes).toEqual(['Pine Plank', 'Birch Plank']);
    });
});

describe('the hero bar alert, clicked, lists each unlock by name', () => {
    const dock = () => render(h(DeckDndProvider, null, h(BottomHeroDock, {})));

    it('is one alert per skill, with the short version, that opens to the list and closes on the next click', () => {
        level('h1', 24, 25);
        const [b] = bubblesOf('h1');
        expect(bubblesOf('h1')).toHaveLength(1);
        expect(b.text).toBe('25 Woodcraft!');
        const r = dock();
        const el = r.container.querySelector(`[data-bar-bubble="${b.key}"]`);
        expect(el.querySelector('[data-bar-bubble-summary]').textContent).toBe('Clean Felling, +1 recipe, +1 Token, +1 gear');
        expect(el.querySelector('[data-bar-bubble-unlocks]')).toBeNull();
        fireEvent.click(el);
        const list = el.querySelector('[data-bar-bubble-unlocks]');
        expect([...list.children].map(n => n.textContent)).toEqual(['PerkClean Felling', 'RecipeBirch Plank', 'TokenBirch Grove', 'GearBirch Axe']);
        expect([...list.querySelectorAll('[data-bar-bubble-unlock]')].map(n => n.textContent)).toEqual(['Clean Felling', 'Birch Plank', 'Birch Grove', 'Birch Axe']);
        expect(bubblesOf('h1')).toHaveLength(1);
        fireEvent.click(el);
        act(() => { vi.advanceTimersByTime(1000); });
        expect(bubblesOf('h1')).toHaveLength(0);
    });

    it('clears a plain level-up\'s alert on the first click, as before', () => {
        level('h1', 30, 31);
        const [b] = bubblesOf('h1');
        const r = dock();
        const el = r.container.querySelector(`[data-bar-bubble="${b.key}"]`);
        expect(el.querySelector('[data-bar-bubble-summary]')).toBeNull();
        fireEvent.click(el);
        act(() => { vi.advanceTimersByTime(1000); });
        expect(bubblesOf('h1')).toHaveLength(0);
    });

    it('keeps everything the skill unlocked since the alert was last cleared', () => {
        level('h1', 9, 10);
        level('h1', 24, 25);
        const [b] = bubblesOf('h1');
        expect(b.text).toBe('25 Woodcraft!');
        expect(b.unlocks.recipes).toEqual(['Pine Plank', 'Birch Plank']);
        expect(b.unlocks.perks).toEqual(['Clean Felling']);
    });
});
