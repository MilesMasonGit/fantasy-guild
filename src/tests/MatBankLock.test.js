import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AlphaPointerSensor } from '../ui/dnd/DndKit.jsx';
import { matAccepts } from '../ui/components/board/Board.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import {
    isMatBankLocked, setMatBankLocked
} from '../ui/hooks/useMatBankLock.js';

/**
 * ⭐ CR3-402 (round 3 review R7, owner ruling 2026-09-30): "while the Bank is
 * open, the playmat cannot be interacted with at all — the Bank covers it."
 *
 * Two halves, each enforced at its own call site:
 * - No Token, flag or hero drag can START from the mat
 *   (`AlphaPointerSensor`'s activator, the same box disallow mode already
 *   refuses — `DndKit.jsx`).
 * - Nothing can be DROPPED onto the mat (`Board.jsx`'s `matAccepts`, which
 *   dnd-kit consults before it will ever call the mat's `onDrop`).
 */

/** The pointer-down activator every drag source goes through (mirrors DisallowMode.test.js). */
const activates = (target = null) => AlphaPointerSensor.activators[0].handler({
    nativeEvent: { isPrimary: true, button: 0, target, clientX: 0, clientY: 0 }
});

/** A press on something inside the mat's box, and one outside it (the dock, the Bank). */
function pressTargets() {
    const mat = document.createElement('div');
    mat.setAttribute('data-board-origin', '');
    const onMat = document.createElement('div');
    mat.appendChild(onMat);
    const offMat = document.createElement('div');
    document.body.append(mat, offMat);
    return { onMat, offMat, cleanup: () => { mat.remove(); offMat.remove(); } };
}

beforeEach(() => setMatBankLocked(false));
afterEach(() => setMatBankLocked(false));

describe('the Bank lock store', () => {
    it('starts off, and only notifies when the value actually changes', () => {
        expect(isMatBankLocked()).toBe(false);
        setMatBankLocked(true);
        expect(isMatBankLocked()).toBe(true);
        setMatBankLocked(true); // no-op, no listener call to assert — just must not throw
        setMatBankLocked(false);
        expect(isMatBankLocked()).toBe(false);
    });
});

describe('⭐ while the Bank is open, no mat drag can start (CR3-402)', () => {
    it('a press on the mat is refused once the Bank opens', () => {
        const { onMat, cleanup } = pressTargets();
        expect(activates(onMat)).toBe(true);
        setMatBankLocked(true);
        expect(activates(onMat)).toBe(false);
        setMatBankLocked(false);
        expect(activates(onMat)).toBe(true);
        cleanup();
    });

    it('the dock and the Bank itself still drag (the mat only is locked)', () => {
        const { offMat, cleanup } = pressTargets();
        setMatBankLocked(true);
        expect(activates(offMat)).toBe(true);
        cleanup();
    });
});

describe('⭐ while the Bank is open, nothing can be dropped onto the mat (CR3-402)', () => {
    const token = { kind: DRAG_KIND.TOKEN, typeId: 'x', from: { instanceId: 't1' } };
    const flagWithHero = { kind: DRAG_KIND.FLAG, heroId: 'hero_1' };
    const heroFromDock = { kind: DRAG_KIND.HERO, heroId: 'hero_1' };

    it('a Token, a flag and a hero are all accepted with the Bank closed', () => {
        expect(matAccepts(token)).toBe(true);
        expect(matAccepts(flagWithHero)).toBe(true);
        expect(matAccepts(heroFromDock)).toBe(true);
    });

    it('every one of them is refused the moment the Bank opens', () => {
        setMatBankLocked(true);
        expect(matAccepts(token)).toBe(false);
        expect(matAccepts(flagWithHero)).toBe(false);
        expect(matAccepts(heroFromDock)).toBe(false);
    });

    it('accepts normally again once the Bank closes', () => {
        setMatBankLocked(true);
        expect(matAccepts(token)).toBe(false);
        setMatBankLocked(false);
        expect(matAccepts(token)).toBe(true);
    });
});
