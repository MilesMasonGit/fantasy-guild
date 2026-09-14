import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Flags from '../systems/board/Flags.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { tileCentre } from '../config/boardGeometry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The worker seam (Free Playmat slices 1.4a, 1.4b).
 *
 * `workerOf`, `workTileOf` and `displayTileOf` are the only way anything
 * outside `BoardState` learns where a hero is. Slice 1.4a pinned what they
 * answered from `heroTiles`; slice 1.4b swapped flags and claims in behind them,
 * and these tests now pin the flag answers (roadmap §2).
 */

describe('the worker seam answers from flags and claims', () => {
    beforeEach(() => {
        GameState.state = {
            board: { tiles: {}, flags: {}, nextFlagOrder: 0, vacancies: {}, tray: [], tokenBank: {}, maps: [] },
            heroes: [
                { id: 'hero_1', name: 'Althea', skills: { logging: { level: 5, xp: 0 } }, level: 1 },
                { id: 'hero_2', name: 'Brom', skills: { logging: { level: 5, xp: 0 } }, level: 1 }
            ]
        };
        registerTokenTypes({
            fixture_seam_small: {
                id: 'fixture_seam_small', name: 'Small', size: 1, uses: 10, requiresHero: true,
                config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 5000, inputs: [], outputs: [] }
            },
            fixture_seam_large: {
                id: 'fixture_seam_large', name: 'Large', size: 2, uses: 50, requiresHero: true,
                config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 10000, inputs: [], outputs: [] }
            }
        });
    });

    it('a docked hero has no work tile and no display tile', () => {
        expect(BoardState.workTileOf('hero_1')).toBeNull();
        expect(BoardState.displayTileOf('hero_1')).toBeNull();
        expect(BoardState.workTileOf(null)).toBeNull();
    });

    it('an empty tile nobody stands on has no worker', () => {
        expect(BoardState.workerOf(9)).toBeNull();
        expect(BoardState.workerOf(null)).toBeNull();
        expect(BoardState.workerOf(-1)).toBeNull();
    });

    it('1×1: the hero working a Token is its worker, and it is their work and display tile', () => {
        Placement.placeToken(9, BoardState.createTokenInstance('fixture_seam_small', 10));
        Placement.placeHero('hero_1', 9);

        expect(BoardState.workerOf(9)).toBe('hero_1');
        expect(BoardState.workTileOf('hero_1')).toBe(9);
        expect(BoardState.displayTileOf('hero_1')).toBe(9);
        expect(BoardState.workerOf(10)).toBeNull();
    });

    it('⚠️ tile 0 is a real answer, not "nowhere"', () => {
        Placement.placeToken(0, BoardState.createTokenInstance('fixture_seam_small', 10));
        Placement.placeHero('hero_1', 0);

        expect(BoardState.workerOf(0)).toBe('hero_1');
        expect(BoardState.workTileOf('hero_1')).toBe(0);
        expect(BoardState.displayTileOf('hero_1')).toBe(0);
    });

    it('⭐ 2×2: the worker is found on EVERY tile of the footprint (1.4b), work tile is the anchor', () => {
        Placement.placeToken(0, BoardState.createTokenInstance('fixture_seam_large', 50));
        Placement.placeHero('hero_1', 7);

        for (const tile of [0, 1, 6, 7]) {
            expect(BoardState.workerOf(tile)).toBe('hero_1');
        }
        expect(BoardState.workerOf(2)).toBeNull();
        expect(BoardState.workTileOf('hero_1')).toBe(0);
        expect(BoardState.displayTileOf('hero_1')).toBe(0);
    });

    it('⭐ a bare tile has no worker, even with a flag planted on it (1.4b)', () => {
        Flags.plant('hero_2', tileCentre(14));

        expect(BoardState.getToken(14)).toBeNull();
        expect(BoardState.workerOf(14)).toBeNull();
        expect(BoardState.workTileOf('hero_2')).toBeNull();
        // Drawn at their flag.
        expect(BoardState.displayTileOf('hero_2')).toBe(14);
    });

    it('recall clears all three answers', () => {
        Placement.placeToken(9, BoardState.createTokenInstance('fixture_seam_small', 10));
        Placement.placeHero('hero_1', 9);
        Placement.recallHero(9);

        expect(BoardState.workerOf(9)).toBeNull();
        expect(BoardState.workTileOf('hero_1')).toBeNull();
        expect(BoardState.displayTileOf('hero_1')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Source guards
// ---------------------------------------------------------------------------

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '..');

function sourceFiles(dir = SRC) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'tests' ? [] : sourceFiles(full);
        return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
    });
}

const FILES = sourceFiles().map(file => ({
    path: path.relative(SRC, file).replace(/\\/g, '/'),
    text: fs.readFileSync(file, 'utf8')
}));

function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('⭐ nothing reads hero position except through the seam (Free Playmat 1.4a, 1.4b)', () => {
    /**
     * The retired storage. Only the save conversion may name it in code;
     * `StateSchema.js` may still explain it in a comment.
     */
    it('heroTiles appears only in SaveMigration.js (and StateSchema comments)', () => {
        const offenders = FILES
            .filter(f => f.path !== 'systems/core/SaveMigration.js')
            .filter(f => {
                const text = f.path === 'state/StateSchema.js' ? stripComments(f.text) : f.text;
                return /heroTiles/.test(text);
            })
            .map(f => f.path);
        expect(offenders).toEqual([]);
    });

    it('the retired primitives heroOnTile / tileOfHero / setHeroTile are gone everywhere', () => {
        const offenders = FILES
            .filter(f => /heroOnTile\(|tileOfHero\(|setHeroTile\(/.test(stripComments(f.text)))
            .map(f => f.path);
        expect(offenders).toEqual([]);
    });

    /**
     * `board.flags` is storage: `BoardState` owns it, `StateSchema` declares it
     * and `SaveMigration` writes it while converting. Everything else asks
     * `BoardState` or `Flags`.
     */
    it('board.flags is read only in BoardState.js (declared in StateSchema, written by SaveMigration)', () => {
        const allowed = new Set(['systems/board/BoardState.js', 'state/StateSchema.js', 'systems/core/SaveMigration.js']);
        const offenders = FILES
            .filter(f => !allowed.has(f.path))
            .filter(f => /\bboard\??\.flags\b|\.board\??\.flags\b/.test(stripComments(f.text)))
            .map(f => f.path);
        expect(offenders).toEqual([]);
    });

    it('the scan actually sees the engine and UI files it guards', () => {
        const paths = FILES.map(f => f.path);
        for (const p of ['systems/board/Placement.js', 'systems/board/Flags.js', 'ui/components/board/Board.jsx', 'ui/components/dock/HeroDockTab.jsx', 'systems/core/SaveMigration.js']) {
            expect(paths).toContain(p);
        }
    });
});

describe('HeroDockTab listens only for board events something publishes', () => {
    const CODE = FILES.map(f => ({ ...f, text: stripComments(f.text) }));
    const tab = CODE.find(f => f.path === 'ui/components/dock/HeroDockTab.jsx');

    /** Every `board:` event the tab names, by literal or by BOARD_EVENTS key. */
    function boardEventsNamedIn(text) {
        const literals = [...text.matchAll(/['"](board:[a-z_]+)['"]/g)].map(m => m[1]);
        const keys = [...text.matchAll(/BOARD_EVENTS\.([A-Z_]+)/g)].map(m => BOARD_EVENTS[m[1]] ?? `BOARD_EVENTS.${m[1]}`);
        return [...new Set([...literals, ...keys])];
    }

    function isPublished(eventName) {
        const key = Object.keys(BOARD_EVENTS).find(k => BOARD_EVENTS[k] === eventName);
        const byKey = key ? new RegExp(`publish\\(\\s*BOARD_EVENTS\\.${key}\\b`) : null;
        const byLiteral = new RegExp(`publish\\(\\s*['"]${eventName}['"]`);
        return CODE.some(f => (byKey && byKey.test(f.text)) || byLiteral.test(f.text));
    }

    it('names at least the hero-moved event', () => {
        expect(tab).toBeDefined();
        expect(boardEventsNamedIn(tab.text)).toContain(BOARD_EVENTS.HERO_MOVED);
    });

    it('every board event it names has a publisher (the dead hero_placed / hero_recalled fail this)', () => {
        const dead = boardEventsNamedIn(tab.text).filter(name => !isPublished(name));
        expect(dead).toEqual([]);
    });
});
