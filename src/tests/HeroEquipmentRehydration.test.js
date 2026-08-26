import { describe, it, expect, beforeEach } from 'vitest';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { GameState } from '../state/GameState.js';
import { GRID_SLOT_COUNT } from '../config/registries/equipmentConstants.js';

// CR2-040 regression net.
//
// The bug: `rehydrateHero` ran `existing.filter(Boolean)` unconditionally and
// re-wrote the survivors from index 0, so every gap the player left in their
// nine-slot loadout was squeezed out on load. Gear placed in slots 2, 4 and 8
// came back in slots 0, 1 and 2.
//
// Why nothing caught it: `SaveRoundtrip.test.js` covers `serialize` and
// `migrateState`, but the damage happens later, in the rehydration step that
// only the boot / slot-selection route reaches (`GameState.initFromSave` →
// `_rehydrateAll` → `rehydrateHero`). Calling `SaveManager.loadSlot` does NOT
// reproduce it. So these tests drive `rehydrateHero` and `initFromSave`
// directly — anything shallower passes while the bug is still present.

/** A hero shaped like one coming off disk, with the given equipment field. */
function savedHero(equipment) {
    const hero = generateHero();
    hero.equipment = equipment;
    return hero;
}

describe('CR2-040: hero loadout survives rehydration at its own indices', () => {
    beforeEach(() => {
        GameState.initNew();
    });

    // --- The bug itself ---

    it('keeps gear in the slots the player chose, gaps and all', () => {
        // The exact arrangement from the ticket's runtime repro.
        const saved = [
            null, null, 'item_water',
            null, 'item_blueberry', null,
            null, null, 'item_shrimp'
        ];
        const hero = savedHero([...saved]);

        rehydrateHero(hero);

        expect(hero.equipment).toEqual(saved);
    });

    it('does not re-pack through the real load path (initFromSave)', async () => {
        // This is the route the boot / slot-selection screen takes, and the
        // only one that reproduced the fault at runtime.
        const saved = [
            null, null, 'item_water',
            null, 'item_blueberry', null,
            null, null, 'item_shrimp'
        ];
        const hero = savedHero([...saved]);
        const state = { ...GameState.state, heroes: [hero] };

        await GameState.initFromSave(state);

        expect(GameState.heroes[0].equipment).toEqual(saved);
    });

    it('survives repeated loads without drifting toward the front', () => {
        // The original fault compounded: every load re-packed again. A grid
        // that is already normalised must be a fixed point.
        const saved = [null, 'item_water', null, null, null, null, null, null, 'item_shrimp'];
        const hero = savedHero([...saved]);

        rehydrateHero(hero);
        rehydrateHero(hero);
        rehydrateHero(hero);

        expect(hero.equipment).toEqual(saved);
    });

    // --- The other saved shapes that must keep loading ---

    it('leaves a full, gapless grid exactly as it was', () => {
        const saved = Array.from({ length: GRID_SLOT_COUNT }, () => 'item_water');
        const hero = savedHero([...saved]);

        rehydrateHero(hero);

        expect(hero.equipment).toEqual(saved);
    });

    it('pads a short array up to GRID_SLOT_COUNT, keeping indices', () => {
        const hero = savedHero(['item_water', null, 'item_shrimp']);

        rehydrateHero(hero);

        expect(hero.equipment).toHaveLength(GRID_SLOT_COUNT);
        expect(hero.equipment[0]).toBe('item_water');
        expect(hero.equipment[1]).toBeNull();
        expect(hero.equipment[2]).toBe('item_shrimp');
        expect(hero.equipment.slice(3).every(slot => slot === null)).toBe(true);
    });

    it('truncates an over-long array to GRID_SLOT_COUNT, keeping indices', () => {
        const saved = [
            'item_water', null, 'item_shrimp', null, null,
            null, null, null, 'item_blueberry',
            'item_redberry', 'item_redberry'   // beyond the grid
        ];
        const hero = savedHero([...saved]);

        rehydrateHero(hero);

        expect(hero.equipment).toHaveLength(GRID_SLOT_COUNT);
        expect(hero.equipment).toEqual(saved.slice(0, GRID_SLOT_COUNT));
    });

    it('gives a hero with no equipment field an empty grid', () => {
        const hero = generateHero();
        delete hero.equipment;

        rehydrateHero(hero);

        expect(hero.equipment).toHaveLength(GRID_SLOT_COUNT);
        expect(hero.equipment.every(slot => slot === null)).toBe(true);
    });

    it('normalises undefined and empty-string holes to null', () => {
        const hero = savedHero(['item_water', undefined, '', 'item_shrimp']);

        rehydrateHero(hero);

        expect(hero.equipment).toEqual([
            'item_water', null, null, 'item_shrimp',
            null, null, null, null, null
        ]);
    });

    // --- The legacy migration this collapse actually exists for ---

    it('still collapses a legacy named-slot OBJECT into grid order', () => {
        // The pre-D-7 shape: named slots, some empty. Collapsing is correct
        // here — the names carry no index, so order is all there is.
        const hero = savedHero({
            hand1: 'item_water',
            hand2: null,
            hat: 'item_shrimp',
            chest: null,
            trinket1: 'item_blueberry',
            trinket2: null
        });

        rehydrateHero(hero);

        expect(hero.equipment).toHaveLength(GRID_SLOT_COUNT);
        expect(hero.equipment).toEqual([
            'item_water', 'item_shrimp', 'item_blueberry',
            null, null, null, null, null, null
        ]);
    });
});
