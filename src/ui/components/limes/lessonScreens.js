import { LESSON_TARGETS as T } from '../../../systems/quests/lessonPlan.js';
import { LIMES_TEXT } from '../../../systems/quests/limesText.js';
import { tokenName } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { LIMES_TARGET } from './limesMark.js';
import { LIMES_MAT } from './limesStore.js';

/**
 * Where a lesson step speaks and what it outlines. The words, and so which screens a step speaks
 * on, are `LIMES_TEXT.lessons`; the ids outlined are `LESSON_TARGETS` (`lessonPlan.js`).
 */

const tokenType = (id) => (id ? { kind: LIMES_TARGET.TOKEN_TYPE, id } : null);
const nav = (id) => ({ kind: LIMES_TARGET.NAV, id });
const bankItem = (id) => (id ? { kind: LIMES_TARGET.BANK_ITEM, id } : null);
const hallStar = (id) => ({ kind: LIMES_TARGET.HALL_STAR, id });

/** What each step outlines, by where it speaks (none where a step names nothing to point at). */
export const LESSON_OUTLINES = Object.freeze({
    bush: { mat: tokenType(T.berryBush) },
    collect: {},
    heap: { mat: tokenType(T.scrapHeap) },
    axe: { mat: nav('bank'), bank: bankItem(T.woodaxe) },
    chop: { mat: tokenType(T.tree) },
    bunk_beds: { mat: nav('guild'), guildHall: hallStar(T.bunkBeds) },
    foundation: { mat: nav('shop') },
    build: { mat: tokenType(T.foundation) },
    craft: { mat: tokenType(T.craftBuilding) },
    weapon: { mat: nav('bank'), bank: bankItem(T.weapon) },
    food: { mat: nav('bank'), bank: bankItem(T.food) },
    fight: { mat: tokenType(T.foe) },
    settle: { mat: nav('atlas') }
});

/** The names a lesson line may carry in braces (`limesText.js`), read from the content as it is said. */
const NAMES = Object.freeze({
    foundation: () => tokenName(T.foundation),
    building: () => tokenName(T.craftBuilding),
    craft: () => getItem(T.craftItem)?.name || T.craftItem,
    foe: () => tokenName(T.foe)
});

/** A line with its names filled in; a brace naming nothing known is left as written. */
export function fillLessonWords(line) {
    return String(line).replace(/\{(\w+)\}/g, (all, key) => (NAMES[key] ? NAMES[key]() || all : all));
}

/** A screen's words said through another small Limes than the screen's own: the Foundation card's in the Shop. */
const SPOT_FOR = Object.freeze({
    foundation: { shop: 'foundation' }
});

/**
 * The screens Limes can speak on besides the mat, most specific first, and whether each is open.
 * `screens`: `{ guildHall, star, worldMap, bank, shop }`, `star` the Guild Hall star whose
 * Upgrade drawer is open. The Upgrade drawer counts only on the star the step points at.
 */
const SCREENS = [
    { key: 'hallStar', open: (s, outlines) => !!s.guildHall && !!s.star && outlines?.guildHall?.id === s.star },
    { key: 'guildHall', open: (s) => !!s.guildHall },
    { key: 'worldMap', open: (s) => !!s.worldMap },
    { key: 'bank', open: (s) => !!s.bank },
    { key: 'shop', open: (s) => !!s.shop }
];

/**
 * What Limes says now, and where: the big moment waiting (said through the first Limes the player
 * can see, ended by its Close), else the lesson step (through the open screen's small Limes when
 * the step has words for it, else the Starter Camp's Limes). Null when no Limes the player can see
 * has anything to say.
 * @param {{ stepId: string|null, moment: string|null }} lesson
 * @param {object} screens what is open (see {@link SCREENS})
 * @param {boolean} atCamp whether the guild is at the Starter Camp, where the mat's Limes lives
 * @returns {{ key: string, spot: string, lines: string[], target: object|null, moment: string|null }|null}
 */
export function lessonSpeech({ stepId, moment }, screens = {}, atCamp = false) {
    if (moment) {
        const lines = LIMES_TEXT.moments[moment];
        if (lines?.length) {
            const open = SCREENS.find(s => s.key !== 'hallStar' && s.open(screens));
            const spot = open ? open.key : (atCamp ? LIMES_MAT : null);
            if (spot) return { key: `moment:${moment}:${spot}`, spot, lines: lines.map(fillLessonWords), target: null, moment };
        }
    }
    if (!stepId) return null;
    const words = LIMES_TEXT.lessons[stepId];
    if (!words) return null;
    const outlines = LESSON_OUTLINES[stepId] || {};
    const screen = SCREENS.find(s => words[s.key]?.length && s.open(screens, outlines));
    const where = screen ? screen.key : (atCamp && words.mat?.length ? 'mat' : null);
    if (!where) return null;
    const spot = where === 'mat' ? LIMES_MAT : (SPOT_FOR[stepId]?.[where] || where);
    return { key: `lesson:${stepId}:${where}`, spot, lines: words[where].map(fillLessonWords), target: outlines[where] || null, moment: null };
}
