import { useSyncExternalStore } from 'react';

/**
 * How the Bank's hero column writes a hero's name, while the owner picks a look in the QA panel.
 * ⚠️ A picking aid: once a look is chosen this file, `ColumnLookDevSection` and the other looks
 * in `HeroDockTab` go, and the chosen look is simply how the name is drawn.
 */
export const HERO_COLUMN_LOOK = Object.freeze({ PLATE: 'plate', RIBBON: 'ribbon', OUTLINE: 'outline' });

const KEY = 'fantasy_guild_hero_column_look';
const isLook = (v) => Object.values(HERO_COLUMN_LOOK).includes(v);

function stored() {
    try {
        const v = localStorage.getItem(KEY);
        return isLook(v) ? v : HERO_COLUMN_LOOK.PLATE;
    } catch {
        return HERO_COLUMN_LOOK.PLATE;
    }
}

let current = stored();
const listeners = new Set();

export function setHeroColumnLook(look) {
    if (!isLook(look) || look === current) return;
    current = look;
    try { localStorage.setItem(KEY, look); } catch { /* the pick just lasts this session */ }
    for (const l of listeners) l();
}

export const getHeroColumnLook = () => current;

const subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export const useHeroColumnLook = () => useSyncExternalStore(subscribe, getHeroColumnLook);
