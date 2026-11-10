// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false })
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { HeroDrawer } from '../ui/components/dock/HeroDrawer.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { heroCombatStats } from '../ui/components/dock/heroCombatStats.js';
import { heroSide, heroResistLines, damageText } from '../ui/components/combat/fightView.js';
import * as CombatFormulas from '../systems/combat/CombatFormulas.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { COMBAT_SKILL_IDS, heroSheetSkillIds, getAllSkillIds } from '../config/registries/skillRegistry.js';
import { xpForLevel } from '../utils/XPCurve.js';
import en from '../i18n/en.json';

const h = React.createElement;

/** An aggregator standing in for the engine's: what the hero carries, by `type:category`. */
const carrying = (table) => ({ query: (type, category) => table[`${type}:${category ?? ''}`] || 0 });

const fighter = (extra = {}) => ({
    id: 'h1', name: 'Aldric', spriteId: 'hn_recruit_por', hp: { current: 20, max: 30 }, status: 'idle',
    equipment: [null, null, null, null, null, null, null, null, null],
    skills: { melee: { level: 25, xp: xpForLevel(25) }, magic: { level: 10, xp: xpForLevel(10) } },
    ...extra
});

beforeEach(() => {
    vi.useFakeTimers();
    STATUS.clear();
    GameState.initNew();
    setLiveMatFit(1);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('the Combat view reads the fight\'s own numbers', () => {
    it('every number is what the combat code says, armed and carrying gear', () => {
        const hero = fighter({
            equipment: ['item_copper_sword', null, null, null, null, null, null, null, null],
            aggregator: carrying({
                [`${EFFECT_TYPES.ACCURACY}:`]: 4,
                [`${EFFECT_TYPES.DODGE}:`]: 3,
                [`${EFFECT_TYPES.CRIT_CHANCE}:`]: 2,
                [`${EFFECT_TYPES.STYLE_DAMAGE_CUT}:magic`]: 20,
                [`${EFFECT_TYPES.STYLE_DAMAGE_CUT}:stealth`]: 10,
                [`${EFFECT_TYPES.TYPE_RESIST}:physical`]: 15
            })
        });
        const s = heroCombatStats(hero);
        const side = heroSide(hero);
        expect(s.style).toBe(CombatFormulas.getHeroCombatStyle(hero));
        expect(s.style).toBe('melee');
        expect(s.level).toBe(25);
        expect(s.armed).toBe(true);
        expect(s.hit).toBe(side.hit);
        expect(s.hitParts).toEqual(side.hitParts);
        expect(s.swingMs).toBe(CombatFormulas.heroAttackSpeedMs(hero));
        expect(s.accuracy).toBe(4);
        expect(s.dodge).toBe(3);
        expect(s.critChance).toBe(CombatFormulas.heroCritChance(hero));
        expect(s.resists).toEqual(heroResistLines(hero));
        expect(s.resists.length).toBeGreaterThan(0);
        expect(s.cuts).toEqual([{ style: 'magic', n: 20 }, { style: 'stealth', n: 10 }]);
        // One landed hit against an enemy of each style: the matchup moves it, both ways.
        const blows = COMBAT_SKILL_IDS.map(style => CombatFormulas.heroBlow(hero, { combatType: style }).exact);
        expect(s.range.vs.map(v => v.hit)).toEqual(blows);
        expect(s.range.low).toBe(Math.min(...blows));
        expect(s.range.high).toBe(Math.max(...blows));
        expect(s.range.low).toBeLessThan(s.hit);
        expect(s.range.high).toBeGreaterThan(s.hit);
        expect(s.range.crit).toBe(Math.max(...COMBAT_SKILL_IDS.map(style => CombatFormulas.heroBlow(hero, { combatType: style }, { crit: true }).exact)));
    });

    it('barehanded, a fist in Melee', () => {
        const s = heroCombatStats(fighter());
        expect(s.armed).toBe(false);
        expect(s.style).toBe('melee');
        expect(s.cuts).toEqual([]);
        expect(s.effects).toEqual([]);
    });

    it('works its numbers out nowhere else: no formula constants, only the combat code (guard)', () => {
        const src = fs.readFileSync(path.resolve(__dirname, '../ui/components/dock/heroCombatStats.js'), 'utf8');
        expect(src).not.toMatch(/FormulaRegistry|CRIT_MULTIPLIER|MATCHUP|matchupMultiplier|BASE_CRIT_CHANCE/);
        expect(src).toMatch(/CombatFormulas\.heroBlow\(/);
        expect(src).toMatch(/heroSide\(hero\)/);
    });

    it('updates in the drawer when the loadout changes, the grid staying beside it', async () => {
        GameState.state.heroes = [fighter()];
        const r = render(h(DeckDndProvider, null, h(HeroDrawer, { menuRight: false, selectedHeroId: 'h1' })));
        fireEvent.click(r.container.querySelector('[data-hero-view-tab="combat"]'));
        const hit = () => r.container.querySelector('[data-hero-combat-stat="hit"]').textContent;
        const bare = hit();
        expect(bare).toContain(damageText(heroSide(GameState.state.heroes[0]).hit));
        // The store reads again in a microtask: an async act lets it run.
        await act(async () => {
            GameState.state.heroes[0].equipment = ['item_copper_sword', null, null, null, null, null, null, null, null];
            EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { heroId: 'h1', action: 'equip', slot: 0 });
        });
        expect(hit()).not.toBe(bare);
        expect(hit()).toContain(damageText(heroSide(GameState.state.heroes[0]).hit));
    });
});

describe('the skill purpose lines', () => {
    it('one line per skill, in the strings file for the owner to edit, and none for a skill that is gone', () => {
        const lines = en.skillPurpose;
        expect(Object.keys(lines).sort()).toEqual(getAllSkillIds().sort());
        for (const id of heroSheetSkillIds()) expect(typeof lines[id] === 'string' && lines[id].length > 0).toBe(true);
    });
});
