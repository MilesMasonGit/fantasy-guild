import { useSyncExternalStore } from 'react';
import { subscribeLevelUps } from '../board/levelUpFeed.js';

/**
 * The hero bar's level-up alerts. Unlike the number floating over the hero on the mat (gone in
 * about 30 s) these stay until the player clears them, so after a long AFK session the bar shows
 * every level gained. One alert per skill, worded with the level it reached ("50 Stealth!"): a
 * later level-up of the same skill rewrites it.
 * UI memory only: never saved, emptied when a game is started or loaded (a page reload, as
 * "Load as I left it" does, starts it empty).
 */

/** Bubbles drawn per hero at once; arrows page through the rest. */
export const BAR_BUBBLES_SHOWN = 3;

/** How long a clicked bubble takes to fade before it is cleared. */
export const BAR_BUBBLE_FADE_MS = 250;

/** An alert's words: the level reached and the skill. */
export const barLevelUpText = (skillName, level) => `${level} ${skillName}!`;

/**
 * Add a level-up to one hero's list (oldest first). A skill already up moves to the newest
 * place with its new level.
 *
 * @returns a new list; the input is untouched
 */
export function addLevelUp(list, { skillName, newLevel }) {
    const key = `level:${skillName}`;
    return [...list.filter(b => b.key !== key), { key, text: barLevelUpText(skillName, newLevel) }];
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
    for (const { heroId, skillName, newLevel } of rows) {
        byHero.set(heroId, addLevelUp(byHero.get(heroId) || NONE, { skillName, newLevel }));
    }
    emit();
}

// A catch-up's level-ups too (a silent one's: a background tab plays its hours in them).
const off = subscribeLevelUps({ onLevelUps: addLevelUps, onReset: clearAllHeroBubbles });

if (import.meta.hot) import.meta.hot.dispose(off);
