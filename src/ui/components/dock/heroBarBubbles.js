import { useSyncExternalStore } from 'react';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { momentText } from '../board/heroSpeech.js';

/**
 * The hero bar's level-up bubbles. Unlike the mat's (`heroSpeech.js`, gone in a few seconds)
 * these stay until the player clears them, so after a long AFK session the bar shows every
 * level gained. One bubble per skill: a later level-up of the same skill rewrites it, counting
 * from the level the bubble started at, so the wording matches the mat's ("LVL UP! 25 Mining!
 * (+4)").
 * UI memory only: never saved, emptied when a game is started or loaded (a page reload, as
 * "Load as I left it" does, starts it empty).
 */

/** Bubbles drawn per hero at once; arrows page through the rest. */
export const BAR_BUBBLES_SHOWN = 3;

/** How long a clicked bubble takes to fade before it is cleared. */
export const BAR_BUBBLE_FADE_MS = 250;

/**
 * Add a level-up to one hero's list (oldest first). A skill already up keeps its starting
 * level and moves to the newest place.
 *
 * @returns a new list; the input is untouched
 */
export function addLevelUp(list, { skillName, oldLevel, newLevel }) {
    const key = `level:${skillName}`;
    const earlier = list.find(b => b.key === key);
    const from = earlier ? earlier.from : (Number.isFinite(oldLevel) ? oldLevel : newLevel - 1);
    const text = momentText.levelUp(skillName, newLevel, newLevel - from);
    return [...list.filter(b => b.key !== key), { key, from, text }];
}

const NONE = Object.freeze([]);
let byHero = new Map();
const listeners = new Set();

function emit() {
    for (const l of listeners) l();
}

/** One hero's bubbles, oldest first (the same array until it changes). */
export function bubblesOf(heroId) {
    return byHero.get(heroId) || NONE;
}

/** Clear one hero's bubbles. */
export function clearHeroBubbles(heroId) {
    if (!byHero.has(heroId)) return;
    byHero = new Map(byHero);
    byHero.delete(heroId);
    emit();
}

/** Clear one bubble (`key`, e.g. `level:Mining`) from one hero's list. */
export function clearHeroBubble(heroId, key) {
    const list = byHero.get(heroId);
    if (!list || !list.some(b => b.key === key)) return;
    const rest = list.filter(b => b.key !== key);
    byHero = new Map(byHero);
    if (rest.length) byHero.set(heroId, rest);
    else byHero.delete(heroId);
    emit();
}

/** Clear everyone's. */
export function clearAllHeroBubbles() {
    if (byHero.size === 0) return;
    byHero = new Map();
    emit();
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** One hero's bubbles, re-rendering only when that hero's list changes. */
export function useHeroBarBubbles(heroId) {
    return useSyncExternalStore(subscribe, () => bubblesOf(heroId), () => NONE);
}

function addLevelUps(rows) {
    byHero = new Map(byHero);
    for (const { heroId, skillName, oldLevel, newLevel } of rows) {
        byHero.set(heroId, addLevelUp(byHero.get(heroId) || NONE, { skillName, oldLevel, newLevel }));
    }
    emit();
}

/**
 * A shown catch-up's level-ups, waiting for the `GAME_RESET` that follows it: a catch-up plays
 * with the bus quiet, so they never arrive as `HERO_LEVELED`. ⚠️ Added on that reset, not on
 * `CATCH_UP_FINISHED`: a load's catch-up finishes before the load's own reset, which would wipe
 * them. Taken once, so a later reset cannot add them again.
 */
let pendingCatchUp = null;

const offs = [
    EventBus.subscribe(ENGINE_EVENTS.HERO_LEVELED, ({ heroId, skillName, newLevel, oldLevel } = {}) => {
        if (!heroId || !skillName || !Number.isFinite(newLevel)) return;
        addLevelUps([{ heroId, skillName, oldLevel, newLevel }]);
    }, UI_LISTENER),
    EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_FINISHED, ({ show, summary } = {}) => {
        const rows = show ? (summary?.levelUps || []).filter(r => r.heroId && r.skillName && Number.isFinite(r.to)) : [];
        pendingCatchUp = rows.length ? rows : null;
    }, UI_LISTENER),
    // Another save's heroes. A dev time-skip or a sleeping PC's catch-up keeps them: the same game
    // moved on, with bubbles the player may not have read yet.
    EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, ({ reason } = {}) => {
        if (reason !== 'dev_time_skip' && reason !== 'catch_up') clearAllHeroBubbles();
        if (!pendingCatchUp) return;
        const rows = pendingCatchUp;
        pendingCatchUp = null;
        addLevelUps(rows.map(r => ({ heroId: r.heroId, skillName: r.skillName, oldLevel: r.from, newLevel: r.to })));
    }, UI_LISTENER)
];

if (import.meta.hot) import.meta.hot.dispose(() => offs.forEach(off => off()));
