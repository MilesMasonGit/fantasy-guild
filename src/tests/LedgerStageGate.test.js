import { describe, it, expect } from 'vitest';

import { buildLedger, wedgeKey, ringKey } from '../systems/progression/ledger/engine.js';
import { buildPace, PROFILE } from '../../cms/src/engine/ledger/pace.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';
import { WORLD_FIXTURE_RAW, worldWorkspace, contentOf, LINE_SKILL } from './fixtures/ledgerWorldMap.js';

/**
 * ⭐ Leaving a stage means settling the next place (owner, 2026-11-26; BALANCE_RULES section 8): one
 * hero reaches the place's level in the one or two skills it asks and pays its price. The stage's
 * budget times that, the way out, with the stage's heroes; everything else the stage offers is done
 * over the following hours, so its full content is shown beside it as information and held to no
 * budget.
 */

const paceOf = (content, settings = null) => buildPace(content, buildLedger(content), settings);

/** The world fixture, its Copper Ore selling for a coin, its ring 1 places asking `ring1` (skills and coins) over the fixture's own. */
function gateWorld(ring1 = {}) {
    const ws = worldWorkspace();
    ws.items.item_copper_ore.value = 1;
    const raw = structuredClone(WORLD_FIXTURE_RAW);
    raw.prices[1] = { ...raw.prices[1], skills: [{ skill: 'line', level: 3 }], ...ring1 };
    return { ...contentOf(ws), worldTables: normaliseWorldTables(raw) };
}

const levelWork = (pace, skill, level) => pace.trackOf(skill).levels[level - 2].cumulativeWork[PROFILE.MAXED];
const stageFindings = (pace, tier) => pace.findings().filter(f => f.check === 'stage-budget' && f.key === `stage:${tier}`);

describe('the way out of a stage', () => {
    it('⭐ is the soonest of the next tier\'s places: its level in the skill it asks, then its price', () => {
        const pace = paceOf(gateWorld());
        const g = pace.gateOf(0);
        expect(g).toMatchObject({ tier: 0, next: 1, why: null, heroes: 1, coins: 0, complete: true });
        // Every ring 1 place asks level 3 in its line's skill; the soonest had at Maxed is the way out.
        const places = Object.entries(LINE_SKILL)
            .map(([line, skill]) => ({ key: wedgeKey(line, 1), skill, hours: pace.hoursToLevel(skill, 3, PROFILE.MAXED, 0) }))
            .filter(p => Number.isFinite(p.hours))
            .sort((a, b) => a.hours - b.hours || a.key.localeCompare(b.key));
        expect(places.length).toBeGreaterThan(1);
        expect(g.place).toBe(places[0].key);
        expect(g.asks).toEqual([{ skill: places[0].skill, level: 3, hours: places[0].hours }]);
        expect(g.levelHours).toBeCloseTo(places[0].hours, 9);
        expect(g.pathHours).toBeCloseTo(places[0].hours, 9);
        expect(g.hours).toBeCloseTo(Math.max(g.pathHours, g.workHours), 9);
        expect(pace.stageOf(0).gate).toEqual(g);
    });

    it('⭐ asks its settle price too: the coins earned once the level is had', () => {
        const free = paceOf(gateWorld()).gateOf(0);
        const pace = paceOf(gateWorld({ coins: 30 }));
        const g = pace.gateOf(0);
        expect(g.coins).toBe(30);
        expect(g.priceHours).toBeGreaterThan(0);
        expect(g.pathHours).toBeCloseTo(g.levelHours + g.priceHours, 9);
        expect(g.hours).toBeGreaterThan(free.hours);
        expect(g.heroHours).toBeGreaterThan(free.heroHours);
    });

    it('⭐ is timed with the stage\'s heroes: one hero levels both skills a place asks in turn, eight side by side', () => {
        const two = { skills: [{ skill: 'line', level: 3 }, { skill: 'smithing', level: 2 }] };
        const one = paceOf(gateWorld(two));
        const g = one.gateOf(0);
        expect(g.asks.map(a => a.skill)).toContain('smithing');
        expect(g.asks).toHaveLength(2);
        const [a, b] = g.asks;
        expect(g.heroHours).toBeCloseTo(levelWork(one, a.skill, a.level) + levelWork(one, b.skill, b.level), 9);
        expect(g.pathHours).toBeCloseTo(Math.max(a.hours, b.hours), 9);
        expect(g.byWork).toBe(true);
        expect(g.hours).toBeCloseTo(g.workHours, 9);
        expect(g.hours).toBeGreaterThan(g.pathHours);
        const many = paceOf(gateWorld(two), { heroesByTier: [{ tier: 0, heroes: 8 }] }).gateOf(0);
        expect(many.byWork).toBe(false);
        expect(many.hours).toBeCloseTo(many.pathHours, 9);
    });

    it('⭐ is what the stage\'s budget times: a stage whose way out is on its budget is on it, however long its full content takes', () => {
        const first = paceOf(gateWorld());
        const out = first.gateOf(0).hours;
        const budget = first.settings.stages[0].budgetMinutes;
        // A pace rule that gives the Starter Camp exactly its way out's time (the way out asks no coins, so the curve moves it not).
        const paceRule = { ...first.settings.paceRule, startMinutes: first.settings.paceRule.startMinutes * out * 60 / budget };
        const pace = paceOf(gateWorld(), { paceRule });
        const B = pace.settings.stages[0].budgetMinutes;
        expect(B).toBeCloseTo(out * 60, 6);
        expect(pace.gateOf(0).hours).toBeCloseTo(out, 9);
        // The whole camp takes far longer than its budget: information only, no warning.
        const content = pace.stageOf(0);
        expect(content.entries).toBeGreaterThan(0);
        expect(content.hours * 60 / B - 1).toBeGreaterThan(pace.settings.tolerancePct / 100);
        expect(stageFindings(pace, 0)).toEqual([]);
    });

    it('⭐ warns when the way out is off its budget, naming the place, what it asks and the full content beside it', () => {
        const first = paceOf(gateWorld({ coins: 30 }));
        const out = first.gateOf(0).hours;
        const budget = first.settings.stages[0].budgetMinutes;
        // Half the way out's time.
        const paceRule = { ...first.settings.paceRule, startMinutes: first.settings.paceRule.startMinutes * out * 30 / budget };
        const pace = paceOf(gateWorld({ coins: 30 }), { paceRule });
        const g = pace.gateOf(0);
        const [f] = stageFindings(pace, 0);
        expect(f).toBeTruthy();
        expect(f.message).toMatch(new RegExp(`^Starter Camp's way out, settling .+ ring 1 \\(${g.asks[0].skill[0].toUpperCase()}${g.asks[0].skill.slice(1)} 3 and 30 coins\\), is had .+ into a new game at Maxed, \\d+ % over its budget of .+ \\(±25 %\\)\\.`));
        expect(f.message).toMatch(/Its full content \(\d+ entries, had .+ in\) is information, not held to the budget\./);
        expect(f.related).toEqual([g.place]);
    });

    it('⭐ the last stage has no way out, and a stage with no place after it says so', () => {
        const pace = paceOf(gateWorld());
        expect(pace.gateOf(7)).toMatchObject({ next: null, place: null, why: 'last' });
        expect(stageFindings(pace, 7)).toEqual([]);
        // The fixture's rings hold places of Planes 1 to 3: Plane 3's way out is not timed.
        expect(pace.gateOf(3)).toMatchObject({ next: 4, place: null, why: 'none' });
        const [f] = stageFindings(pace, 3);
        expect(f).toMatchObject({ severity: 'info' });
        expect(f.message).toMatch(/^Plane 3 has no place of Plane 4 to settle, so its way out is not timed against its budget of .+\. Its full content \(\d+ entries, had .+ in\) is information\.$/);
    });

    it('lists what settling the place needs besides its level and price, as information', () => {
        const pace = paceOf(gateWorld());
        const g = pace.gateOf(1);
        expect(g.next).toBe(2);
        expect(g.place).toMatch(/^wedge:\w+:2$/);
        const line = g.place.split(':')[1];
        expect(g.needs.map(n => n.key).sort()).toEqual([ringKey(2), wedgeKey(line, 1)].sort());
        for (const n of g.needs) expect(n.hours).toBeCloseTo(pace.arrivalOf(n.key, PROFILE.MAXED).hours, 9);
    });
});
