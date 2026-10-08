import { describe, it, expect } from 'vitest';
import { lifecycleLines, formatDuration, TONE, passiveHoverLines } from '../ui/components/drawer/lifecycleLines.js';

/**
 * Token Lifecycle slice 8.1 — the inspection panel's lifecycle lines. The
 * module is pure, so every engine read is a stub here.
 */

const TYPES = {
    forest: {
        name: 'Oak Forest',
        spawner: {
            spawns: [{ typeId: 'sapling', weight: 1 }], allowance: 5, intervalMs: 20000,
            upkeep: [{ itemId: 'item_oak_seed', quantity: 1 }]
        }
    },
    free_forest: {
        name: 'Free Forest',
        spawner: { spawns: [{ typeId: 'sapling', weight: 1 }], allowance: 5, intervalMs: 20000, upkeep: [] }
    },
    sapling: { name: 'Oak Sapling', grows: { into: 'tree', afterMs: 30000 } },
    tree: { name: 'Oak Tree' },
    coast: {
        name: 'Coast',
        turns: { into: [{ typeId: 'shrimp', weight: 1 }, { typeId: 'crab', weight: 1 }], everyMs: 60000, chance: 30 }
    },
    /** A turns block with neither cycle nor chance: the defaults, 1 min and 30%. */
    bay: { name: 'Bay', turns: { into: [{ typeId: 'shrimp', weight: 1 }] } },
    shrimp: { name: 'Shrimp Coast' },
    crab: { name: 'Crab Coast' },
    foundation: { name: 'Stone Foundation', foundation: { kind: 'stone', skill: 'construction' } },
    furnace: { name: 'Furnace' },
    hall: { name: 'Guild Hall' }
};

const ITEMS = { item_oak_seed: 'Oak Seed', item_water: 'Water' };

/** The Hall's Passive Production as `PassiveProduction` would report it; `well` adds the Wishing Well's Water. */
const hallPassive = (well = 0) => (i) => (i.typeId !== 'hall' ? { lines: [], nextInMs: 300000 } : {
    lines: [
        { itemId: 'item_oak_seed', quantity: 2, source: 'token' },
        ...(well ? [{ itemId: 'item_water', quantity: 10 * well, source: 'wishing_well' }] : [])
    ],
    nextInMs: 300000 - (i.clocks?.passiveMs || 0)
});
const FURNACE_RECIPE = { id: 'build_furnace', durationMs: 30000, outputs: [{ tokenId: 'furnace', quantity: 1 }] };

function src(overrides = {}) {
    return {
        typeOf: (id) => TYPES[id] || null,
        tokenName: (id) => TYPES[id]?.name || id,
        itemName: (id) => ITEMS[id] || id,
        spawnerStatus: () => null,
        selectedRecipe: () => null,
        originOf: (i) => (i.origin === 'spawned' ? 'spawned' : 'placed'),
        passive: hallPassive(),
        dev: false,
        ...overrides
    };
}

const byLabel = (lines, label) => lines.find(l => l.label === label);

describe('formatDuration', () => {
    it('reads seconds, minutes and hours, rounding up to the second', () => {
        expect(formatDuration(0)).toBe('0 s');
        expect(formatDuration(1)).toBe('1 s');
        expect(formatDuration(12000)).toBe('12 s');
        expect(formatDuration(90000)).toBe('1 min 30 s');
        expect(formatDuration(300000)).toBe('5 min');
        expect(formatDuration(7500000)).toBe('2 h 5 min');
        expect(formatDuration(3600000)).toBe('1 h');
        expect(formatDuration(-5)).toBe('0 s');
    });
});

describe('lifecycleLines', () => {
    it('shows nothing for a Token with no lifecycle block, or no instance', () => {
        expect(lifecycleLines({ id: 't1', typeId: 'tree' }, src())).toEqual([]);
        expect(lifecycleLines(null, src())).toEqual([]);
        expect(lifecycleLines({ id: 'x', typeId: 'missing' }, src())).toEqual([]);
    });

    describe('a spawner', () => {
        const forest = { id: 'f1', typeId: 'forest', clocks: { spawnMs: 8000 } };

        it('spawning: family count and cap, next spawn, upkeep paid', () => {
            const lines = lifecycleLines(forest, src({
                spawnerStatus: () => ({ state: 'spawning', nextInMs: 12000, count: 4, cap: 5, familyLabel: 'Oak Sapling' })
            }));
            expect(byLabel(lines, 'Spawns').value).toBe('Oak Sapling');
            expect(byLabel(lines, 'Family').value).toBe('Oak Sapling family 4 / 5');
            expect(byLabel(lines, 'Family').tone).toBeUndefined();
            expect(byLabel(lines, 'Next spawn').value).toBe('in 12 s');
            expect(byLabel(lines, 'Upkeep per spawn')).toEqual({
                label: 'Upkeep per spawn', value: '1 Oak Seed (paid from the Bank, then loot on the mat)', tone: TONE.GOOD
            });
        });

        it('at_cap', () => {
            const lines = lifecycleLines(forest, src({
                spawnerStatus: () => ({ state: 'at_cap', count: 5, cap: 5, familyLabel: 'Oak Sapling' })
            }));
            expect(byLabel(lines, 'Family')).toMatchObject({ value: 'Oak Sapling family 5 / 5', tone: TONE.WARNING });
            expect(byLabel(lines, 'Next spawn')).toMatchObject({ value: 'At cap: waits for room in the family', tone: TONE.WARNING });
        });

        it('needs_item names the item it waits for, and the upkeep is unpaid', () => {
            const lines = lifecycleLines(forest, src({
                spawnerStatus: () => ({ state: 'needs_item', needs: ['item_oak_seed'], count: 2, cap: 5, familyLabel: 'Oak Sapling' })
            }));
            expect(byLabel(lines, 'Next spawn')).toMatchObject({ value: 'Waiting for Oak Seed', tone: TONE.DANGER });
            expect(byLabel(lines, 'Upkeep per spawn')).toMatchObject({ value: '1 Oak Seed (not paid: Bank and mat short)', tone: TONE.DANGER });
        });

        it('no_room', () => {
            const lines = lifecycleLines(forest, src({
                spawnerStatus: () => ({ state: 'no_room', count: 2, cap: 5, familyLabel: 'Oak Sapling' })
            }));
            expect(byLabel(lines, 'Next spawn')).toMatchObject({ value: 'No room to spawn nearby', tone: TONE.WARNING });
        });

        it('mat_full (T-102)', () => {
            const lines = lifecycleLines(forest, src({
                spawnerStatus: () => ({ state: 'mat_full', count: 2, cap: 5, familyLabel: 'Oak Sapling' })
            }));
            expect(byLabel(lines, 'Next spawn')).toMatchObject({ value: 'Token cap full: waits until the mat has room', tone: TONE.WARNING });
        });

        it('free upkeep reads Free', () => {
            const lines = lifecycleLines({ id: 'f2', typeId: 'free_forest' }, src({
                spawnerStatus: () => ({ state: 'spawning', nextInMs: 1000, count: 0, cap: 5, familyLabel: 'Oak Sapling' })
            }));
            expect(byLabel(lines, 'Upkeep per spawn')).toMatchObject({ value: 'Free', tone: TONE.MUTED });
        });

        it('shows no spawner lines when the engine reports none (not a working spawner)', () => {
            expect(lifecycleLines(forest, src())).toEqual([]);
        });
    });

    it('a growing Token: time left and what it becomes', () => {
        const lines = lifecycleLines({ id: 's1', typeId: 'sapling', clocks: { growMs: 18000 } }, src());
        expect(lines).toEqual([{ label: 'Grows into Oak Tree', value: 'in 12 s' }]);
        // No clock yet reads as the full time.
        expect(lifecycleLines({ id: 's2', typeId: 'sapling' }, src())[0].value).toBe('in 30 s');
    });

    it('a turning Token: its next chance to turn, into what, and the odds (TL-12, FB-14)', () => {
        const lines = lifecycleLines({ id: 'c1', typeId: 'coast', clocks: { turnMs: 26000 } }, src());
        expect(lines[0]).toEqual({ label: 'Next chance to turn into Shrimp Coast or Crab Coast', value: 'in 34 s (30%)' });
        expect(byLabel(lines, 'Turns')).toEqual({
            label: 'Turns', value: '30% chance every 1 min, and the same to turn back', tone: TONE.MUTED
        });
        expect(byLabel(lines, 'Stays turned for')).toBeUndefined();
    });

    it('a turns block without a cycle or chance reads the defaults, 1 min and 30%', () => {
        const lines = lifecycleLines({ id: 'b1', typeId: 'bay' }, src());
        expect(lines[0]).toEqual({ label: 'Next chance to turn into Shrimp Coast', value: 'in 1 min (30%)' });
        const back = lifecycleLines({ id: 'b2', typeId: 'shrimp', turnedFrom: 'bay', clocks: { turnMs: 45000 } }, src());
        expect(back).toEqual([{ label: 'Next chance to turn back into Bay', value: 'in 15 s (30%)' }]);
    });

    it('a turned Token: its next chance to turn back, on the original type’s cycle and odds', () => {
        const lines = lifecycleLines({ id: 'c2', typeId: 'shrimp', turnedFrom: 'coast', clocks: { turnMs: 20000 } }, src());
        expect(lines).toEqual([{ label: 'Next chance to turn back into Coast', value: 'in 40 s (30%)' }]);
    });

    it('a turned Token shows only its turn back, not its own blocks', () => {
        // A turned instance runs only its turn-back clock (TimedChanges).
        const lines = lifecycleLines({ id: 'c3', typeId: 'sapling', turnedFrom: 'coast', clocks: { turnMs: 0 } }, src());
        expect(lines.map(l => l.label)).toEqual(['Next chance to turn back into Coast']);
    });

    describe('a Foundation', () => {
        it('with nothing chosen asks for a recipe', () => {
            const lines = lifecycleLines({ id: 'fd', typeId: 'foundation' }, src());
            expect(lines).toEqual([{ label: 'Building', value: 'Choose what to build', tone: TONE.WARNING }]);
        });

        it('chosen but not started', () => {
            const lines = lifecycleLines({ id: 'fd', typeId: 'foundation' }, src({ selectedRecipe: () => FURNACE_RECIPE }));
            expect(byLabel(lines, 'Building').value).toBe('Furnace');
            expect(byLabel(lines, 'Build progress')).toMatchObject({ value: 'Not started (30 s of work)', tone: TONE.MUTED });
        });

        it('part-built shows its progress against the recipe time', () => {
            const lines = lifecycleLines(
                { id: 'fd', typeId: 'foundation', cycleElapsedMs: 12000 },
                src({ selectedRecipe: () => FURNACE_RECIPE })
            );
            expect(byLabel(lines, 'Build progress').value).toBe('40% (12 s of 30 s)');
        });
    });

    it('Passive Production: what one lap pays, the shared timer, and when next (T-099)', () => {
        const lines = lifecycleLines({ id: 'h', typeId: 'hall', clocks: { passiveMs: 60000 } }, src({ passive: hallPassive(1) }));
        expect(lines).toEqual([{
            label: 'Passive Production', value: '2 Oak Seed, 10 Water (Wishing Well) every 5 min (next in 4 min)', tone: TONE.GOOD
        }]);
    });

    it('origin shows in dev mode only', () => {
        const spawned = { id: 't', typeId: 'tree', origin: 'spawned' };
        expect(lifecycleLines(spawned, src())).toEqual([]);
        expect(lifecycleLines(spawned, src({ dev: true }))).toEqual([
            { label: 'Origin (dev)', value: 'spawned', tone: TONE.MUTED }
        ]);
        expect(lifecycleLines({ id: 'p', typeId: 'tree' }, src({ dev: true }))[0].value).toBe('placed');
    });
});

describe('passiveHoverLines (FB-30, T-099)', () => {
    it('says when the shared timer pays next, then what it pays', () => {
        expect(passiveHoverLines({ id: 'h', typeId: 'hall', clocks: { passiveMs: 100000 } }, src()))
            .toEqual(['Passive Production every 5 min (next in 3 min 20 s):', '2 Oak Seed']);
    });

    it('starts a fresh clock at the full lap, and names the Wishing Well', () => {
        expect(passiveHoverLines({ id: 'h', typeId: 'hall' }, src({ passive: hallPassive(2) })))
            .toEqual(['Passive Production every 5 min (next in 5 min):', '2 Oak Seed', '20 Water (Wishing Well)']);
    });

    it('is empty for a Token that pays nothing, or no Token', () => {
        expect(passiveHoverLines({ id: 't', typeId: 'tree' }, src())).toEqual([]);
        expect(passiveHoverLines(null, src())).toEqual([]);
    });
});
