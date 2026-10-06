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

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The worker seam (Free Playmat slices 1.4a, 1.4b).
 */

/** The scene, in mat units. */
const A = { x: 400, y: 300 };
const B = { x: 560, y: 300 };
const ELSEWHERE = { x: 1200, y: 800 };

describe('the worker seam answers from flags and claims', () => {
    beforeEach(() => {
        GameState.state = {
            board: {
                tokens: {}, nextTokenOrder: 0, flags: {}, nextFlagOrder: 0,
                tray: [], tokenBank: {}, maps: []
            },
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

    /** Put a Token down at a point, no rules, and hand back the instance. */
    function put(typeId, point, uses) {
        const instance = BoardState.createTokenInstance(typeId, uses);
        Placement.placeTokenAt(instance, point);
        return instance;
    }

    it('a docked hero has no work Token and no display point', () => {
        expect(BoardState.workTokenOf('hero_1')).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toBeNull();
        expect(BoardState.workTokenOf(null)).toBeNull();
    });

    it('a Token nobody stands on has no worker, and neither has nothing', () => {
        const alone = put('fixture_seam_small', A, 10);
        expect(BoardState.workerOf(alone.id)).toBeNull();
        expect(BoardState.workerOf(null)).toBeNull();
        expect(BoardState.workerOf('tok_nobody')).toBeNull();
    });

    it('1×1: the hero working a Token is its worker, and it is their work Token and display point', () => {
        const small = put('fixture_seam_small', A, 10);
        const other = put('fixture_seam_small', ELSEWHERE, 10);
        Placement.plantFlagAt('hero_1', A);

        expect(BoardState.workerOf(small.id)).toBe('hero_1');
        expect(BoardState.workTokenOf('hero_1')).toBe(small.id);
        expect(BoardState.displayPointOf('hero_1')).toEqual(A);
        expect(BoardState.workerOf(other.id)).toBeNull();
    });

    it('⚠️ the mat’s corner is a real answer, not "nowhere"', () => {
        const corner = { x: 64, y: 64 };
        const small = put('fixture_seam_small', corner, 10);
        Placement.plantFlagAt('hero_1', corner);

        expect(BoardState.workerOf(small.id)).toBe('hero_1');
        expect(BoardState.workTokenOf('hero_1')).toBe(small.id);
        expect(BoardState.displayPointOf('hero_1')).toEqual(corner);
    });

    it('⭐ 2×2: a big Token is found by its id like any other, and drawn at its own centre', () => {
        // There is no footprint to search any more (slice 1.6d-2) — a Token of
        // any size is one circle at one point, named by one instance id.
        const large = put('fixture_seam_large', A, 50);
        Placement.plantFlagAt('hero_1', A);

        expect(BoardState.workerOf(large.id)).toBe('hero_1');
        expect(BoardState.workTokenOf('hero_1')).toBe(large.id);
        expect(BoardState.displayPointOf('hero_1')).toEqual(A);
    });

    it('⭐ bare ground has no worker, even with a flag planted on it (1.4b)', () => {
        Flags.plant('hero_2', B);

        expect(BoardState.tokensAtPoint(B.x, B.y)).toHaveLength(0);
        expect(BoardState.workTokenOf('hero_2')).toBeNull();
        // Drawn at their flag.
        expect(BoardState.displayPointOf('hero_2')).toEqual(B);
    });

    it('recall clears all three answers', () => {
        const small = put('fixture_seam_small', A, 10);
        Placement.plantFlagAt('hero_1', A);
        Placement.recallHeroById('hero_1');

        expect(BoardState.workerOf(small.id)).toBeNull();
        expect(BoardState.workTokenOf('hero_1')).toBeNull();
        expect(BoardState.displayPointOf('hero_1')).toBeNull();
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
