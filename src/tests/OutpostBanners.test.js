import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as OutpostManager from '../systems/loop/OutpostManager.js';

// Locks the Outpost banner split (D-16) and playmat membership/order
// (D-58/D-59/D-67): Outposts are standalone banners, a hero works exactly one
// banner, and taking a banner off the mat halts it and frees its hero without
// destroying anything else.

function seed() {
    GameState.initNew();
    GameState.state.outposts = undefined;
    GameState.state.playmatOrder = undefined;
    GameState.state.collection.unlockedAreaSets = ['area_a', 'area_b'];
    GameState.state.areaStates = {
        area_a: { deckSlots: [], assignedHeroId: null, status: 'running', onPlaymat: true },
        area_b: { deckSlots: [], assignedHeroId: null, status: 'running', onPlaymat: true }
    };
}

beforeEach(seed);

describe('Outpost banners (D-16)', () => {
    it('starts the player with exactly one Outpost', () => {
        const outposts = OutpostManager.getOutposts();
        expect(outposts).toHaveLength(OutpostManager.STARTING_OUTPOSTS);
        expect(outposts[0].id).toBe('outpost_1');
        expect(outposts[0].activeStationCardId).toBeNull();
    });

    it('grants a card when a new Outpost is unlocked (D-35)', () => {
        const outpost = OutpostManager.unlockOutpost('station_wood_kiln');
        expect(outpost.id).toBe('outpost_2');
        expect(outpost.activeStationCardId).toBe('station_wood_kiln');
        expect(OutpostManager.getOutposts()).toHaveLength(2);
    });

    it('pulls a hero off every other banner when assigned (D-24)', () => {
        OutpostManager.unlockOutpost();
        GameState.areaStates.area_a.assignedHeroId = 'hero_1';

        OutpostManager.assignHero('outpost_1', 'hero_1');
        expect(GameState.areaStates.area_a.assignedHeroId).toBeNull();
        expect(OutpostManager.getOutpost('outpost_1').assignedHeroId).toBe('hero_1');

        // Moving on to a second Outpost vacates the first.
        OutpostManager.assignHero('outpost_2', 'hero_1');
        expect(OutpostManager.getOutpost('outpost_1').assignedHeroId).toBeNull();
        expect(OutpostManager.getOutpost('outpost_2').assignedHeroId).toBe('hero_1');
    });

    it('only ticks Outposts that are on the playmat (D-59)', () => {
        OutpostManager.unlockOutpost();
        expect(OutpostManager.getActiveOutposts()).toHaveLength(2);

        OutpostManager.setOnPlaymat('outpost_2', false);
        expect(OutpostManager.getActiveOutposts().map(o => o.id)).toEqual(['outpost_1']);
    });
});

describe('Playmat membership (D-59 / D-67)', () => {
    it('halts an area and frees its hero when taken off the mat', () => {
        GameState.areaStates.area_a.assignedHeroId = 'hero_1';

        OutpostManager.setOnPlaymat('area_a', false);

        expect(OutpostManager.isOnPlaymat('area_a')).toBe(false);
        expect(GameState.areaStates.area_a.assignedHeroId).toBeNull();
        expect(GameState.areaStates.area_a.status).toBe('paused');
    });

    it('keeps the deck and installed card when a banner leaves the mat', () => {
        GameState.areaStates.area_a.deckSlots = [{ templateId: 't_mine' }];
        const outpost = OutpostManager.getOutpost('outpost_1');
        outpost.activeStationCardId = 'station_wood_kiln';
        outpost.selectedRecipeId = 'recipe_x';
        outpost.producedCount = 7;

        OutpostManager.setOnPlaymat('area_a', false);
        OutpostManager.setOnPlaymat('outpost_1', false);

        // Nothing is destroyed — putting it back must restore it intact.
        expect(GameState.areaStates.area_a.deckSlots).toEqual([{ templateId: 't_mine' }]);
        expect(outpost.activeStationCardId).toBe('station_wood_kiln');
        expect(outpost.selectedRecipeId).toBe('recipe_x');
        expect(outpost.producedCount).toBe(7);

        OutpostManager.setOnPlaymat('area_a', true);
        expect(OutpostManager.isOnPlaymat('area_a')).toBe(true);
    });

    it('treats a banner with no explicit flag as on the mat', () => {
        delete GameState.areaStates.area_b.onPlaymat;
        expect(OutpostManager.isOnPlaymat('area_b')).toBe(true);
    });
});

describe('Playmat order (D-58)', () => {
    it('lists every area and Outpost, areas first by default', () => {
        expect(OutpostManager.getPlaymatOrder()).toEqual(['area_a', 'area_b', 'outpost_1']);
    });

    it('appends newly unlocked banners without disturbing the order', () => {
        OutpostManager.moveBanner('outpost_1', -1);
        expect(OutpostManager.getPlaymatOrder()).toEqual(['area_a', 'outpost_1', 'area_b']);

        OutpostManager.unlockOutpost();
        GameState.state.collection.unlockedAreaSets.push('area_c');
        GameState.areaStates.area_c = { deckSlots: [], assignedHeroId: null };

        expect(OutpostManager.getPlaymatOrder())
            .toEqual(['area_a', 'outpost_1', 'area_b', 'area_c', 'outpost_2']);
    });

    it('drops ids for banners that no longer exist', () => {
        GameState.state.playmatOrder = ['area_ghost', 'area_a', 'area_b', 'outpost_1'];
        expect(OutpostManager.getPlaymatOrder()).toEqual(['area_a', 'area_b', 'outpost_1']);
    });

    it('refuses to move a banner off either end', () => {
        expect(OutpostManager.moveBanner('area_a', -1).success).toBe(false);
        expect(OutpostManager.moveBanner('outpost_1', 1).success).toBe(false);
        expect(OutpostManager.getPlaymatOrder()).toEqual(['area_a', 'area_b', 'outpost_1']);
    });
});
