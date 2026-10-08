import { describe, it, expect } from 'vitest';
import { addMoment, liveMoments, stackOf, momentText, MAX_BUBBLES, MOMENT_TTL_MS, speaksMoment, MOMENT_SPOKEN } from '../ui/components/board/heroSpeech.js';

describe('A hero’s stack of speech bubbles', () => {
    it('keeps a moment until its time is up, then lets it go', () => {
        const list = addMoment([], { key: 'a', text: 'A' }, 1000);
        expect(liveMoments(list, 1000 + MOMENT_TTL_MS - 1)).toHaveLength(1);
        expect(liveMoments(list, 1000 + MOMENT_TTL_MS)).toHaveLength(0);
    });

    it('replaces a repeat of the same moment instead of stacking it', () => {
        let list = addMoment([], { key: 'level:Mining', text: 'Mining is now level 2.' }, 0);
        list = addMoment(list, { key: 'level:Mining', text: 'Mining is now level 3.' }, 100);
        expect(list.map(m => m.text)).toEqual(['Mining is now level 3.']);
    });

    it('puts the blocked line nearest the head, after the moments', () => {
        let list = addMoment([], { key: 'a', text: 'A' }, 0);
        list = addMoment(list, { key: 'b', text: 'B' }, 1);
        expect(stackOf(list, 'Stuck.', 2).map(b => b.text)).toEqual(['A', 'B', 'Stuck.']);
    });

    it('never shows more than three — the oldest moment gives way, the blocked line stays', () => {
        let list = [];
        ['a', 'b', 'c', 'd'].forEach((k, i) => { list = addMoment(list, { key: k, text: k }, i); });
        const stack = stackOf(list, 'Stuck.', 10);
        expect(stack).toHaveLength(MAX_BUBBLES);
        expect(stack.map(b => b.text)).toEqual(['c', 'd', 'Stuck.']);
    });

    it('has no stack when there is nothing to say', () => {
        expect(stackOf([], null, 0)).toEqual([]);
    });

    it('words the moments plainly', () => {
        expect(momentText.arrived('Campfire')).toBe('Working at Campfire.');
        expect(momentText.idle()).toBe('No work in range.');
        expect(momentText.levelUp('Mining', 25, 4)).toBe('Leveled up Mining to 25! (+4)');
        expect(momentText.depleted('Oak Tree')).toBe('Oak Tree Depleted');
    });

    it('says only unusual moments: arriving at a job is routine and silent (FB-21)', () => {
        expect(speaksMoment('arrived')).toBe(false);
        expect(speaksMoment('idle')).toBe(true);
        expect(speaksMoment('levelUp')).toBe(true);
        expect(speaksMoment('depleted')).toBe(true);
        expect(speaksMoment('something_new')).toBe(false);
        expect(Object.keys(MOMENT_SPOKEN).sort()).toEqual(Object.keys(momentText).sort());
    });
});
