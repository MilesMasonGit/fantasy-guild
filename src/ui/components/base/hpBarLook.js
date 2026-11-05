import { useSyncExternalStore } from 'react';

/**
 * Which HP bar look the hero bar and the sheet draw, while the owner picks one in the QA panel.
 * ⚠️ A picking aid: once a look is chosen this file, `HpLookDevSection` and the other looks in
 * `VitalBar` go, and the chosen look is simply how the bar is drawn.
 */
export const HP_BAR_LOOK = Object.freeze({ PLATE: 'plate', TICKS: 'ticks', HEART: 'heart' });

const KEY = 'fantasy_guild_hp_bar_look';
const isLook = (v) => Object.values(HP_BAR_LOOK).includes(v);

function stored() {
    try {
        const v = localStorage.getItem(KEY);
        return isLook(v) ? v : HP_BAR_LOOK.PLATE;
    } catch {
        return HP_BAR_LOOK.PLATE;
    }
}

let current = stored();
const listeners = new Set();

export function setHpBarLook(look) {
    if (!isLook(look) || look === current) return;
    current = look;
    try { localStorage.setItem(KEY, look); } catch { /* the pick just lasts this session */ }
    for (const l of listeners) l();
}

export const getHpBarLook = () => current;

const subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export const useHpBarLook = () => useSyncExternalStore(subscribe, getHpBarLook);
