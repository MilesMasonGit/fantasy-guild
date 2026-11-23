import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Banners from '../systems/notifications/banners.js';
import { nameList, bannerText } from '../systems/notifications/bannerKinds.js';

/**
 * The banner queue: three on screen newest on top, the rest counted ("+N"), problems waiting
 * ahead of milestones, same-kind waiting banners merged, one moment always one banner.
 */

const hero = (name, extra = {}) => ({ kind: 'hero', parts: { heroes: [name] }, ...extra });
const knockout = (name) => ({ kind: 'knockout', parts: { heroes: [name], lost: [] }, subjects: [{ type: 'hero', id: name }] });
const upgrade = (name) => ({ kind: 'upgrade', parts: { upgrades: [name], detail: 'more' } });

beforeEach(() => Banners.reset());
afterEach(() => { Banners.reset(); Banners.setOnShow(null); });

describe('the stack', () => {
    it('shows up to three, newest on top, then counts the rest', () => {
        for (const n of ['A', 'B', 'C', 'D']) Banners.push(upgrade(n));
        const view = Banners.getView();
        expect(view.shown.map(b => b.parts.upgrades[0])).toEqual(['C', 'B', 'A']);
        expect(view.waiting).toBe(1);
    });

    it('a click dismisses, and the next waiting one comes on screen on top', () => {
        Banners.push(upgrade('A'));
        Banners.push(hero('Bram'));
        Banners.push(upgrade('C'));
        Banners.push(hero('Dana'));
        const [top] = Banners.getView().shown;
        Banners.dismiss(top.id);
        const view = Banners.getView();
        expect(view.shown.map(b => b.line)).toEqual(['Dana joined the guild', 'Bram joined the guild', 'A: more']);
        expect(view.waiting).toBe(0);
    });

    it('problems wait ahead of milestones', () => {
        for (const n of ['A', 'B', 'C']) Banners.push(upgrade(n));
        Banners.push(hero('Bram'));                     // a milestone waits
        Banners.push(knockout('Aela'));                 // a problem arrives later
        const view = Banners.getView();
        expect(view.waiting).toBe(2);
        expect(view.problemWaiting).toBe(true);
        Banners.dismiss(view.shown[0].id);
        expect(Banners.getView().shown[0].kind).toBe('knockout');
    });

    it('same-kind waiting banners merge into one', () => {
        for (const n of ['A', 'B', 'C']) Banners.push(upgrade(n));
        Banners.push(knockout('Aela'));
        Banners.push(knockout('Bram'));
        expect(Banners.getView().waiting).toBe(1);
        const waiting = Banners.getAll()[3];
        expect(waiting.line).toBe('Aela and Bram knocked out and carried home. Nothing was lost.');
        expect(waiting.subjects.map(s => s.id)).toEqual(['Aela', 'Bram']);
    });

    it('a banner on screen is not changed by a later one of its kind', () => {
        Banners.push(knockout('Aela'));
        Banners.push(knockout('Bram'));
        expect(Banners.getView().shown.map(b => b.parts.heroes)).toEqual([['Bram'], ['Aela']]);
    });

    it('one moment (a groupKey) is one banner, on screen or waiting', () => {
        const recipe = (name) => ({ kind: 'recipe', groupKey: 'lvl:aela:cooking:4', parts: { heroes: ['Aela'], recipes: [name] } });
        Banners.push(recipe('Cider'));
        Banners.push(recipe('Apple Pie'));
        Banners.push(recipe('Stew'));
        const view = Banners.getView();
        expect(view.shown).toHaveLength(1);
        expect(view.shown[0].title).toBe('New recipes!');
        expect(view.shown[0].line).toBe('Aela unlocked 3 recipes: Cider, Apple Pie, ...');
    });

    it('a lasting problem (the Bank full) folds into the one on screen', () => {
        Banners.push({ kind: 'bankFull', parts: { items: ['Oak Log'] } });
        Banners.push({ kind: 'bankFull', parts: { items: ['Copper Ore'] } });
        const view = Banners.getView();
        expect(view.shown).toHaveLength(1);
        expect(view.shown[0].line).toBe('Oak Log and Copper Ore wait on the mat until the Bank has room');
    });

    it('each save problem is its own banner', () => {
        Banners.push({ kind: 'save', groupKey: 'a', parts: { title: 'Save Failed!', message: 'x' } });
        Banners.push({ kind: 'save', groupKey: 'b', parts: { title: 'Save Restored', message: 'y' } });
        Banners.push({ kind: 'save', groupKey: 'a', parts: { title: 'Save Failed!', message: 'x' } });
        expect(Banners.getView().shown.map(b => b.title)).toEqual(['Save Restored', 'Save Failed!']);
    });

    it('makes its sound as each banner comes on screen, not while it waits or merges', () => {
        const heard = vi.fn();
        Banners.setOnShow(heard);
        for (const n of ['A', 'B', 'C', 'D']) Banners.push(upgrade(n));
        expect(heard).toHaveBeenCalledTimes(3);
        Banners.dismiss(Banners.getView().shown[0].id);
        expect(heard).toHaveBeenCalledTimes(4);
        expect(heard.mock.calls[3][0].parts.upgrades).toEqual(['D']);
    });

    it('an unknown kind raises nothing', () => {
        expect(Banners.push({ kind: 'nonsense' })).toBeNull();
        expect(Banners.getAll()).toEqual([]);
    });
});

describe('the words', () => {
    it('lists names the way a person would', () => {
        expect(nameList(['Aela'])).toBe('Aela');
        expect(nameList(['Aela', 'Bram'])).toBe('Aela and Bram');
        expect(nameList(['Aela', 'Bram', 'Cara'])).toBe('Aela, Bram and Cara');
        expect(nameList(['A', 'B', 'C', 'D', 'E'])).toBe('A, B and 3 more');
    });

    it('says each kind', () => {
        expect(bannerText('recipe', { heroes: ['Aela'], recipes: ['Cider'] })).toEqual({ title: 'New recipe!', line: 'Aela unlocked Cider' });
        expect(bannerText('recipe', { heroes: ['Aela'], recipes: ['Cider', 'Apple Pie'] }).line).toBe('Aela unlocked Cider, Apple Pie');
        expect(bannerText('knockout', { heroes: ['Aela'], lost: ['Iron Sword'] }).line).toBe('Aela was carried home, injured. Lost: Iron Sword.');
        expect(bannerText('knockout', { heroes: ['Aela'], lost: [] }).line).toBe('Aela was carried home, injured. Nothing was lost.');
    });

    it('⭐ a knock-out banner for several heroes says what each one lost', () => {
        for (const n of ['A', 'B', 'C']) Banners.push(upgrade(n));
        Banners.push({ ...knockout('Aela'), parts: { heroes: ['Aela'], lost: ['Iron Sword'] } });
        Banners.push({ ...knockout('Bram'), parts: { heroes: ['Bram'], lost: ['3 Shrimp'] } });
        Banners.push({ ...knockout('Cara'), parts: { heroes: ['Cara'], lost: [] } });
        Banners.push({ ...knockout('Aela'), parts: { heroes: ['Aela'], lost: ['3 Shrimp'] } });
        expect(Banners.getView().waiting).toBe(1);
        expect(Banners.getAll()[3].line).toBe('Aela, Bram and Cara knocked out and carried home. Aela lost: Iron Sword, 3 Shrimp. Bram lost: 3 Shrimp.');
    });
});

describe('the clear rule: a banner rewritten from what still stands', () => {
    const full = (...ids) => ({ kind: 'bankFull', parts: { items: ids, itemIds: ids } });
    const keepOnly = (keep) => (parts) => {
        const still = parts.itemIds.filter(id => keep.includes(id));
        if (still.length === parts.itemIds.length) return parts;
        return still.length ? { items: still, itemIds: still } : null;
    };

    it('drops what is fixed and rewrites its line; goes when nothing is left', () => {
        Banners.push(full('Oak'));
        Banners.push(full('Stone'));
        expect(Banners.getAll()).toHaveLength(1);
        Banners.revise('bankFull', keepOnly(['Stone']));
        expect(Banners.getAll()[0].line).toBe('Stone waits on the mat until the Bank has room');
        Banners.revise('bankFull', keepOnly([]));
        expect(Banners.getAll()).toEqual([]);
        expect(Banners.hasKind('bankFull')).toBe(false);
    });

    it('touches no other kind, and says nothing when nothing changed', () => {
        Banners.push(hero('Bram'));
        Banners.push(full('Oak'));
        const before = Banners.getVersion();
        Banners.revise('bankFull', (parts) => parts);
        expect(Banners.getVersion()).toBe(before);
        Banners.revise('bankFull', () => null);
        expect(Banners.getAll().map(b => b.kind)).toEqual(['hero']);
    });

    it('a waiting one can go too', () => {
        for (const n of ['A', 'B', 'C']) Banners.push(upgrade(n));
        Banners.push(full('Oak'));
        expect(Banners.getView().waiting).toBe(1);
        Banners.revise('bankFull', () => null);
        expect(Banners.getView().waiting).toBe(0);
    });

    it('a shown one going brings the next waiting one on screen, with its sound', () => {
        const heard = [];
        Banners.setOnShow((b) => heard.push(b.kind));
        Banners.push(upgrade('A'));
        Banners.push(full('Oak'));
        Banners.push(upgrade('B'));
        Banners.push(hero('Bram'));
        expect(Banners.getView().waiting).toBe(1);
        heard.length = 0;
        Banners.revise('bankFull', () => null);
        expect(Banners.getView().shown.map(b => b.kind)).toEqual(['hero', 'upgrade', 'upgrade']);
        expect(heard).toEqual(['hero']);
    });
});
