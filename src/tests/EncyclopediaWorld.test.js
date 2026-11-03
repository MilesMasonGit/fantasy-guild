import { describe, it, expect } from 'vitest';
import { buildEncyclopedia, encyclopedia } from '../ui/components/encyclopedia/encyclopediaModel.js';
import { waysIn, wayInRequirement, chartOf, layoutChart } from '../ui/components/encyclopedia/encyclopediaChart.js';
import { HOW, tokenKey } from '../systems/progression/ledger/engine.js';
import { ledgerContent } from './fixtures/ledgerWorld.js';
import { t } from '../i18n/index.js';

/**
 * The encyclopedia places things where the world map does: a vein's way in is its wedge and ring,
 * settled on the world map at the ring's level; a guaranteed camp shows its ring; the retired map
 * items are no way in anywhere.
 */

const worldOf = (way) => way.how === HOW.WORLD;
const captionText = (way) => t(`encyclopedia.via.${way.caption}`, way.captionArgs);

describe('the shipped encyclopedia reads the world tables', () => {
    const book = encyclopedia();

    it('Iron Ore Vein comes in from Ores ring 2, settled at Mining 15', () => {
        const ways = waysIn(book, tokenKey('token_iron_ore_vein'));
        const [first] = ways;
        expect(first.how).toBe(HOW.WORLD);
        expect(first.from).toBeNull();
        expect(captionText(first)).toBe('Ores ring 2\nsettled on the world map');
        expect(wayInRequirement(book, first)).toEqual({ skill: 'mining', level: 15 });
    });

    it('settling Arcane asks Magic itself, not Combat', () => {
        const [arcane] = waysIn(book, tokenKey('token_quartz_deposit')).filter(worldOf);
        expect(captionText(arcane)).toBe('Arcane ring 2\nsettled on the world map');
        expect(wayInRequirement(book, arcane)).toEqual({ skill: 'magic', level: 15 });
    });

    it('a guaranteed camp shows its ring', () => {
        const ways = waysIn(book, tokenKey('token_wolf_den')).filter(worldOf);
        expect(ways[0]).toMatchObject({ how: HOW.WORLD, place: expect.objectContaining({ ring: 1, maybe: false }) });
        expect(captionText(ways[0])).toMatch(/ring 1\nsettled on the world map$/i);
    });

    it('a camp only some worlds hold says so, at its first ring', () => {
        const ways = waysIn(book, tokenKey('token_goblin_camp')).filter(worldOf);
        expect(ways).toHaveLength(1);
        expect(ways[0].place).toMatchObject({ ring: 1, maybe: true });
        expect(captionText(ways[0])).toMatch(/ring 1\nin some worlds$/i);
    });
});

describe('world ways over the fixture tables', () => {
    const content = ledgerContent();
    const book = buildEncyclopedia(content);

    it('a vein one wedge holds: that wedge and ring, its settle level on the line', () => {
        const [vein] = waysIn(book, tokenKey('token_iron_vein'));
        expect(vein).toMatchObject({ how: HOW.WORLD, from: null, caption: 'worldLine', captionArgs: { line: 'Ores', ring: 2 } });
        expect(wayInRequirement(book, vein)).toEqual({ skill: 'mining', level: 15 });
        // No map writes it any more.
    });

    it('a guaranteed camp every wedge may hold: one way for its ring, no single skill on the line', () => {
        const ways = waysIn(book, tokenKey('token_chief_tent')).filter(worldOf);
        expect(ways).toHaveLength(1);
        expect(ways[0]).toMatchObject({ caption: 'worldRing', captionArgs: { ring: 1 } });
        expect(wayInRequirement(book, ways[0])).toBeNull();
    });

    it('the chart lays a world way out as words on the left, with their ring', () => {
        const chart = chartOf(book, tokenKey('token_iron_vein'));
        const layout = layoutChart(chart);
        const caption = layout.captions.find(c => c.words === 'worldLine');
        expect(caption).toMatchObject({ label: false, args: { line: 'Ores', ring: 2 } });
    });
});
