import { useEffect, useRef } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { activeRegion, REGION_KIND } from '../../../systems/atlas/Atlas.js';
import * as LimesGuide from '../../../systems/quests/LimesGuide.js';
import * as LimesLessons from '../../../systems/quests/LimesLessons.js';
import { openLimesStep, closeLimesStep, subscribeLimes, getLimes } from './limesStore.js';
import { lessonSpeech } from './lessonScreens.js';

const SEP = '|';

/** Where the lessons stand, as one string: whether Limes speaks of them, its step, the moment due, whether the guild is at the camp. */
function lessonSignature() {
    const on = LimesGuide.lessonsOn() && LimesLessons.hasLessons();
    if (!on) return '';
    const stepId = LimesLessons.currentStep()?.id ?? '';
    const moment = LimesLessons.dueMoment() ?? '';
    const atCamp = activeRegion()?.kind === REGION_KIND.STARTER ? '1' : '';
    return [stepId, moment, atCamp].join(SEP);
}

/**
 * Limes's lessons, spoken: opens Limes's bubble on the step the guild is on (`LimesLessons`),
 * through the Limes the player can see (`lessonSpeech`), and closes it when the step is done.
 * Draws nothing itself; mounted once. With the lessons off, or in a game with none, it says
 * nothing. A bubble the player shrank stays shrunk when the same step comes back to the same
 * Limes (after a look at another screen).
 * @param {{ screens: { guildHall?: boolean, star?: string|null, worldMap?: boolean, bank?: boolean, shop?: boolean } }} props
 */
export function LimesLessonSpeaker({ screens }) {
    const signature = useGameState(lessonSignature, [
        ENGINE_EVENTS.LIMES_LESSON, ENGINE_EVENTS.ATLAS_CHANGED, ENGINE_EVENTS.GAME_RESET
    ]);
    let speech = null;
    if (signature) {
        const [stepId, moment, atCamp] = signature.split(SEP);
        speech = lessonSpeech({ stepId: stepId || null, moment: moment || null }, screens, atCamp === '1');
    }
    const key = speech?.key ?? '';

    const shown = useRef('');
    const shrunk = useRef(new Map());
    useEffect(() => subscribeLimes(() => {
        const step = getLimes().step;
        if (step && step.id === shown.current) shrunk.current.set(step.id, step.collapsed);
    }), []);

    useEffect(() => {
        shown.current = key;
        if (!speech) {
            closeLimesStep();
            return;
        }
        const moment = speech.moment;
        openLimesStep({
            id: speech.key,
            lines: speech.lines,
            spot: speech.spot,
            target: speech.target,
            collapsed: shrunk.current.get(speech.key) ?? false,
            onClose: moment ? () => LimesLessons.hearMoment(moment) : null
        });
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => closeLimesStep(), []);
    return null;
}
