import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as LimesLessons from '../systems/quests/LimesLessons.js';

/**
 * A lesson step waiting for its content (the scrap heap) joins the list the day its target is set.
 * A game already past it must not be sent back to it, and one not yet there meets it in its turn.
 * The heap's target is set now; the test stands in for the day before by leaving its step out until
 * it switches the step on.
 */

const plan = vi.hoisted(() => ({ heap: false }));

vi.mock('../systems/quests/lessonPlan.js', async (importOriginal) => {
    const real = await importOriginal();
    const lessonSteps = () => real.LESSON_STEPS.filter(s =>
        (!s.needs || real.LESSON_TARGETS[s.needs]) && (s.needs !== 'scrapHeap' || plan.heap));
    return { ...real, lessonSteps, allSteps: () => [...lessonSteps(), real.GOAL_STEP] };
});

/** Marks steps done the way play does: through the reports they count. */
const REPORT = {
    bush: ['hero_deployed', { typeId: 'token_redberry_bush' }],
    collect: ['loot_collected', {}],
    heap: ['cycle_completed', { typeId: 'token_scrap_heap' }],
    axe: ['hero_equipped', { toolKind: 'woodaxe' }],
    chop: ['cycle_completed', { skill: 'forestry', gathered: true }],
    bunk_beds: ['guild_upgrade_purchased', { upgradeId: 'roster_size' }],
    foundation: ['token_purchased', { typeId: 'token_wood_foundation' }],
    build: ['token_built', { typeId: 'token_workbench' }],
    craft: ['cycle_completed', { crafted: true }],
    weapon: ['hero_equipped', { weapon: true }],
    food: ['hero_equipped', { category: 'food' }],
    fight: ['combat_victory', { enemyId: 'token_small_slime' }],
    settle: ['place_settled', {}]
};
const doStep = (id) => LimesLessons.report(REPORT[id][0], 1, REPORT[id][1]);

beforeEach(() => {
    plan.heap = false;
    GameState.initNew();
    LimesLessons.startLessons();
});

describe('a lesson step that gains its content', () => {
    it('is counted done in a game already past it', () => {
        for (const id of ['bush', 'collect', 'axe', 'chop']) doStep(id);
        expect(LimesLessons.currentStep().id).toBe('bunk_beds');

        plan.heap = true;

        expect(LimesLessons.currentStep().id).toBe('bunk_beds');
        expect(LimesLessons.isStepDone('heap')).toBe(true);
    });

    it('is counted done in a game that has done every lesson', () => {
        for (const id of Object.keys(REPORT)) if (id !== 'heap') doStep(id);
        expect(LimesLessons.currentStep()).toBeNull();

        plan.heap = true;

        expect(LimesLessons.currentStep()).toBeNull();
    });

    it('is met in its turn by a game not yet there', () => {
        doStep('bush');
        plan.heap = true;

        expect(LimesLessons.currentStep().id).toBe('collect');
        doStep('collect');
        expect(LimesLessons.currentStep().id).toBe('heap');
    });

    it('is not skipped in a game that began with it, by a later step done early', () => {
        plan.heap = true;
        GameState.initNew();
        LimesLessons.startLessons();

        for (const id of ['bush', 'collect', 'axe']) doStep(id);

        expect(LimesLessons.currentStep().id).toBe('heap');
    });

    it('is counted done in a save from before the list was kept, already past it', () => {
        GameState.state.guide.progress = { done: ['bush', 'collect', 'axe', 'chop'], counts: {}, moments: {} };
        plan.heap = true;

        expect(LimesLessons.currentStep().id).toBe('bunk_beds');
    });

    it('a step id stays as saved', () => {
        for (const id of ['bush', 'collect', 'axe', 'chop']) doStep(id);
        plan.heap = true;
        LimesLessons.currentStep();
        expect(GameState.state.guide.progress.done).toEqual(['bush', 'collect', 'axe', 'chop', 'heap']);
    });
});
