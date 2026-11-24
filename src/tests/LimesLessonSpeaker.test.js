// @vitest-environment jsdom
// Limes's lessons, spoken: the step the guild is on opens Limes's bubble through the Limes the
// player can see (the Starter Camp's on the mat, a screen's small Limes while that screen is
// open), outlines what it names, closes when the step is done; a big moment is said once and ended
// by its Close; the lessons off (or none) say nothing; the goal's arrival opens the world map.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as LimesLessons from '../systems/quests/LimesLessons.js';
import * as LimesGuide from '../systems/quests/LimesGuide.js';
import { LESSON_TARGETS, lessonSteps, GOAL_STEP } from '../systems/quests/lessonPlan.js';
import { LIMES_TEXT } from '../systems/quests/limesText.js';
import { LimesLessonSpeaker } from '../ui/components/limes/LimesLessonSpeaker.jsx';
import { lessonSpeech, fillLessonWords, LESSON_OUTLINES } from '../ui/components/limes/lessonScreens.js';
import { getLimes, resetLimes, limesClose, collapseLimesStep, openLimesStep, LIMES_MAT } from '../ui/components/limes/limesStore.js';
import { LimesBlurb } from '../ui/components/limes/LimesBlurb.jsx';
import { LIMES_TARGET } from '../ui/components/limes/limesMark.js';
import { useWorldMapRequests, WorldMapRequests } from '../ui/hooks/useWorldMapRequests.js';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { DEFEAT_PENALTY } from '../config/loopConstants.js';
import { fractionWords, oneInWords } from '../utils/limesNumbers.js';
import { tokenName } from '../config/registries/tokenRegistry.js';

const h = React.createElement;

/** Puts the guild at a place of `kind` (the Starter Camp is 'starter'). */
function placeGuild(kind) {
    GameState.state.atlas.regions = { region_1: { id: 'region_1', kind } };
    GameState.state.atlas.activeRegionId = 'region_1';
    EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, { reason: 'travelled', regionId: 'region_1' });
}

const report = (id) => {
    const s = [...lessonSteps(), GOAL_STEP].find(x => x.id === id);
    LimesLessons.report(s.targetType, 1, { ...(s.match || {}) });
};
const step = () => getLimes().step;

beforeEach(() => {
    GameState.initNew();
    resetLimes();
    LimesLessons.startLessons();
    placeGuild('starter');
});
afterEach(() => {
    cleanup();
    resetLimes();
});

describe('where a step speaks (pure)', () => {
    const at = (stepId, screens = {}, atCamp = true) => lessonSpeech({ stepId, moment: null }, screens, atCamp);

    it('on the mat at the Starter Camp, outlining what it names; nowhere when the guild is away and no screen is open', () => {
        expect(at('bush')).toMatchObject({
            spot: LIMES_MAT,
            lines: [...LIMES_TEXT.lessons.bush.mat],
            target: { kind: LIMES_TARGET.TOKEN_TYPE, id: LESSON_TARGETS.berryBush }
        });
        expect(at('bush', {}, false)).toBeNull();
        expect(at('collect').target).toBeNull();
    });

    it('through the open screen\'s small Limes when the step has words for it', () => {
        expect(at('axe', { bank: true })).toMatchObject({
            spot: 'bank', target: { kind: LIMES_TARGET.BANK_ITEM, id: LESSON_TARGETS.woodaxe }
        });
        expect(at('axe')).toMatchObject({ spot: LIMES_MAT, target: { kind: LIMES_TARGET.NAV, id: 'bank' } });
        // Away from the camp, a screen's Limes still speaks.
        expect(at('axe', { bank: true }, false)).toMatchObject({ spot: 'bank' });
        expect(at('foundation', { shop: true })).toMatchObject({ spot: 'foundation' });
        expect(at('settle', { worldMap: true })).toMatchObject({ spot: 'worldMap' });
        expect(at('settle')).toMatchObject({ spot: LIMES_MAT, target: { kind: LIMES_TARGET.NAV, id: 'atlas' } });
    });

    it('Bunk Beds: the Hall\'s Limes outlines the star; its Upgrade drawer\'s Limes speaks only on Bunk Beds', () => {
        expect(at('bunk_beds', { guildHall: true })).toMatchObject({
            spot: 'guildHall', target: { kind: LIMES_TARGET.HALL_STAR, id: LESSON_TARGETS.bunkBeds }
        });
        expect(at('bunk_beds', { guildHall: true, star: 'bank_tabs' })).toMatchObject({ spot: 'guildHall' });
        expect(at('bunk_beds', { guildHall: true, star: LESSON_TARGETS.bunkBeds })).toMatchObject({ spot: 'hallStar', target: null });
        expect(at('bunk_beds')).toMatchObject({ spot: LIMES_MAT, target: { kind: LIMES_TARGET.NAV, id: 'guild' } });
    });

    it('a step with no words for the open screen stays with the mat\'s Limes', () => {
        expect(at('chop', { bank: true })).toMatchObject({ spot: LIMES_MAT });
        expect(at('chop', { bank: true }, false)).toBeNull();
    });

    it('a big moment comes first, through the first Limes the player can see, with no outline', () => {
        const moment = (screens, atCamp) => lessonSpeech({ stepId: 'chop', moment: 'first_settle' }, screens, atCamp);
        expect(moment({}, true)).toMatchObject({ spot: LIMES_MAT, moment: 'first_settle', target: null, lines: [...LIMES_TEXT.moments.first_settle] });
        expect(moment({ bank: true }, true)).toMatchObject({ spot: 'bank', moment: 'first_settle' });
        expect(moment({ guildHall: true, star: 'roster_size' }, true)).toMatchObject({ spot: 'guildHall' });
        // Away from the camp the moment is not said, even with a screen open; the step can't speak either.
        expect(moment({ bank: true }, false)).toBeNull();
        expect(moment({ guildHall: true, star: 'roster_size' }, false)).toBeNull();
        expect(moment({}, false)).toBeNull();
    });

    describe('the Defeat warning before the first fight', () => {
        const fightLines = () => LIMES_TEXT.lessons.fight.mat.map(fillLessonWords);
        const saved = { ...DEFEAT_PENALTY };
        afterEach(() => Object.assign(DEFEAT_PENALTY, saved));

        it('comes in order before the fight line, worded from the penalty', () => {
            const lines = fightLines();
            expect(lines[0]).toBe('Careful! If your hero is Defeated, you lose a quarter of each food and drink they brought.');
            expect(lines[1]).toBe('And each piece of gear they wear has a 1 in 10 chance to break. Win, and you lose nothing!');
            expect(lines[2]).toMatch(/^Now a little fight!/);
        });

        it('follows a tuning change', () => {
            DEFEAT_PENALTY.CONSUMABLE_LOSS_RATIO = 0.5;
            DEFEAT_PENALTY.GEAR_LOSS_CHANCE = 0.2;
            const lines = fightLines();
            expect(lines[0]).toContain('lose half of each');
            expect(lines[1]).toContain('a 1 in 5 chance');
        });

        it('words a fraction, falling back to a percentage', () => {
            expect(fractionWords(1 / 3)).toBe('a third');
            expect(fractionWords(0.4)).toBe('40%');
            expect(oneInWords(0.25)).toBe('1 in 4');
            expect(oneInWords(0.15)).toBe('15%');
        });
    });

    it('names in braces come from the content, so the words follow the ids', () => {
        expect(fillLessonWords('Pick the {building} on the {foundation}, then fight a {foe}.'))
            .toBe(`Pick the ${tokenName(LESSON_TARGETS.craftBuilding)} on the ${tokenName(LESSON_TARGETS.foundation)}, then fight a ${tokenName(LESSON_TARGETS.foe)}.`);
        expect(fillLessonWords('A {nothing} stays.')).toBe('A {nothing} stays.');
        for (const [id, words] of Object.entries(LIMES_TEXT.lessons)) {
            for (const line of Object.values(words).flat()) expect(fillLessonWords(line), id).not.toMatch(/\{\w+\}/);
        }
    });

    it('every step has its outlines, and every outline of a screen has words there', () => {
        expect(Object.keys(LESSON_OUTLINES).sort()).toEqual(Object.keys(LIMES_TEXT.lessons).sort());
        for (const [id, outlines] of Object.entries(LESSON_OUTLINES)) {
            for (const where of Object.keys(outlines)) expect(LIMES_TEXT.lessons[id][where]?.length, `${id}.${where}`).toBeGreaterThan(0);
        }
    });
});

describe('⭐ the speaker (drawn)', () => {
    const mount = (screens = {}) => render(h(LimesLessonSpeaker, { screens }));

    it('opens the step on the mat at a new game, outlined; moves on as each step is done', async () => {
        mount();
        expect(step()).toMatchObject({ id: 'lesson:bush:mat', spot: LIMES_MAT, collapsed: false });
        expect(step().target).toEqual({ kind: LIMES_TARGET.TOKEN_TYPE, id: LESSON_TARGETS.berryBush });
        await act(async () => report('bush'));
        expect(step()).toMatchObject({ id: 'lesson:collect:mat' });
        // A step done early does not show; the next one left does.
        await act(async () => { report('axe'); report('heap'); report('collect'); });
        expect(step()).toMatchObject({ id: 'lesson:chop:mat' });
    });

    it('follows the open screen, and a bubble shrunk to "…" stays shrunk when its step comes back', () => {
        report('bush');
        report('collect');
        report('heap');
        const { rerender } = mount();
        expect(step()).toMatchObject({ id: 'lesson:axe:mat' });
        act(() => collapseLimesStep(true));
        rerender(h(LimesLessonSpeaker, { screens: { bank: true } }));
        expect(step()).toMatchObject({ id: 'lesson:axe:bank', spot: 'bank', collapsed: false });
        rerender(h(LimesLessonSpeaker, { screens: {} }));
        expect(step()).toMatchObject({ id: 'lesson:axe:mat', collapsed: true });
    });

    it('at another place Limes keeps quiet on the mat, and speaks again back at the camp', async () => {
        mount();
        expect(step()).not.toBeNull();
        await act(async () => placeGuild('settled'));
        expect(step()).toBeNull();
        await act(async () => placeGuild('starter'));
        expect(step()).toMatchObject({ id: 'lesson:bush:mat' });
    });

    it('with the lessons off, nothing opens and nothing is outlined; the progress still counts', async () => {
        LimesGuide.setLessons(false);
        mount();
        expect(step()).toBeNull();
        await act(async () => report('bush'));
        expect(step()).toBeNull();
        expect(LimesLessons.currentStep()?.id).toBe('collect');
    });

    it('a game with no lessons (an older save) says nothing', () => {
        GameState.state.guide.progress = null;
        mount();
        expect(step()).toBeNull();
    });

    it('a reload speaks the step again: the speaker reads the save on a new game or a load', async () => {
        report('bush');
        report('collect');
        report('heap');
        mount();
        expect(step()).toMatchObject({ id: 'lesson:axe:mat' });
        const saved = JSON.parse(JSON.stringify(GameState.serialize().state));
        await act(async () => {
            GameState.initFromSave(saved);
            placeGuild('starter');
            EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' });
        });
        expect(step()).toMatchObject({ id: 'lesson:axe:mat' });
    });

    it('the first settle\'s moment: said once, before the step; its Close ends it and it is not said again', async () => {
        mount();
        await act(async () => report('settle'));
        expect(step()).toMatchObject({ id: 'moment:first_settle:mat', spot: LIMES_MAT });
        expect(LimesLessons.dueMoment()).toBe('first_settle');
        await act(async () => limesClose('step'));
        expect(LimesLessons.dueMoment()).toBeNull();
        expect(step()).toMatchObject({ id: 'lesson:bush:mat' });
    });

    it('every lesson done and the moment heard: Limes says nothing by itself', () => {
        for (const s of lessonSteps()) report(s.id);
        report('settle');
        LimesLessons.hearMoment('first_settle');
        mount();
        expect(step()).toBeNull();
    });
});

describe('Limes shows the world map when the goal arrives', () => {
    function Probe({ open }) {
        useWorldMapRequests(open);
        return null;
    }

    it('opens it once as the last lesson is done, never on a load, never with the lessons off', () => {
        const open = vi.fn();
        render(h(Probe, { open }));
        for (const s of lessonSteps().slice(0, -1)) act(() => report(s.id));
        expect(open).not.toHaveBeenCalled();
        act(() => report(lessonSteps().at(-1).id));
        expect(open).toHaveBeenCalledTimes(1);
        act(() => EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }));
        act(() => EventBus.publish(ENGINE_EVENTS.LIMES_LESSON, { stepId: GOAL_STEP.id, arrived: false, moment: null }));
        expect(open).toHaveBeenCalledTimes(1);
        LimesGuide.setLessons(false);
        act(() => EventBus.publish(ENGINE_EVENTS.LIMES_LESSON, { stepId: GOAL_STEP.id, arrived: true, moment: null }));
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('done mid-drag, the map waits for the drag to end, then opens once', () => {
        const open = vi.fn();
        const at = (isDragging) => h(DeckDndContext.Provider, { value: { activePayload: isDragging ? {} : null, isDragging } },
            h(WorldMapRequests, { openAtlas: open }));
        const view = render(at(true));
        for (const s of lessonSteps()) act(() => report(s.id));
        expect(open).not.toHaveBeenCalled();
        view.rerender(at(true));
        expect(open).not.toHaveBeenCalled();
        view.rerender(at(false));
        expect(open).toHaveBeenCalledTimes(1);
        view.rerender(at(true));
        view.rerender(at(false));
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('done with no drag, it opens at once through the opener it is given', () => {
        const open = vi.fn();
        render(h(DeckDndContext.Provider, { value: { activePayload: null, isDragging: false } },
            h(WorldMapRequests, { openAtlas: open })));
        for (const s of lessonSteps()) act(() => report(s.id));
        expect(open).toHaveBeenCalledTimes(1);
    });
});

describe('a step\'s bubble on a screen that glides in follows its Limes', () => {
    it('placed where the Limes is at first (below the screen), it moves with it frame by frame, then stops', () => {
        const frames = [];
        vi.stubGlobal('requestAnimationFrame', (fn) => { frames.push(fn); return frames.length; });
        vi.stubGlobal('cancelAnimationFrame', () => {});
        let top = 900;
        const rect = () => ({ left: 40, top, width: 32, height: 32, right: 72, bottom: top + 32, x: 40, y: top });
        try {
            render(h(LimesBlurb, { spot: 'worldMap' }));
            const sprite = document.querySelector('[data-limes-blurb="worldMap"]');
            sprite.getBoundingClientRect = rect;
            act(() => openLimesStep({ id: 'goal', lines: ['Settle a place!'], spot: 'worldMap' }));
            const box = () => document.querySelector('[data-limes-blurb-box="worldMap"]');
            const at = () => Number(/translate3d\(-?\d+px, (-?\d+)px/.exec(box().style.transform)?.[1]);
            const before = at();
            // The world map glides up: the Limes ends near the top of the window.
            let time = 0;
            const run = (n) => { for (let i = 0; i < n && frames.length; i++) { const fn = frames.shift(); time += 16; act(() => fn(time)); } };
            for (const y of [700, 400, 120, 40]) { top = y; run(1); }
            const after = at();
            expect(after).toBeLessThan(before);
            expect(after).toBeGreaterThan(40);
            // Still for a while: the following stops.
            run(40);
            expect(frames).toHaveLength(0);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

