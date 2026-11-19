// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { pointerToMat } from '../ui/components/board/matPoint.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { buildRealistic } from '../../bench/scenarios/realistic.mjs';
import { installDragKit } from '../../bench/browser/dragKit.mjs';

/**
 * The drag bench's free spot (`dragKit.freeSpot`) is where its hero, flag, Token and Shop drags are
 * let go, so it must be bare ground as the drop reads it. S2's Guild Hall is a 2×2 whose art circle
 * (144 u) lies inside the empty ring around it, the clearest ground on the board when clearance is
 * counted from Token centres; a hero let go on the Hall is sent home and their flag comes down, which
 * the bench reported as "the hero has no flag".
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

/** A seeded `Math.random`, so the picks are the same on every run. */
function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// The drag bench's window (1600 × 1000): the S2 mat drawn at 0.76 of its size, 207 px from the left
// and 78 px from the top, as measured in Chrome.
const SCALE = 0.76;
const MAT_LEFT = 207;
const MAT_TOP = 78;

let kit;
let rect;
let mat;
let surface;
/** jsdom hit-tests nothing: the bare mat everywhere, as on open ground. */
const bareEverywhere = () => surface;

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();

    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    BoardCombat.clearAll();
    buildRealistic({ fixtures, setMatTuning });
    TileModifiers.rebuildAll();

    const w = matW() * SCALE;
    const h = matH() * SCALE;
    rect = { left: MAT_LEFT, top: MAT_TOP, width: w, height: h, right: MAT_LEFT + w, bottom: MAT_TOP + h, x: MAT_LEFT, y: MAT_TOP };
    mat = document.createElement('div');
    mat.setAttribute('data-board-origin', 'true');
    mat.setAttribute('data-natural-width', String(matW()));
    mat.setAttribute('data-board-scale', String(SCALE));
    mat.getBoundingClientRect = () => rect;
    surface = document.createElement('div');
    surface.setAttribute('data-mat-surface', '');
    mat.appendChild(surface);
    document.body.appendChild(mat);
    document.elementFromPoint = bareEverywhere;

    window.__perf = { game: EngineBootstrap.getEngine() };
    installDragKit();
    kit = window.__dragKit;
});

afterAll(() => {
    delete document.elementFromPoint;
    delete window.__perf;
    delete window.__dragKit;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe("the drag bench's free spot on S2", () => {
    it('is never on a Token as the drop reads it, the Guild Hall included', () => {
        const hall = BoardState.tokens().find(t => t.typeId === 'bench_hall');
        expect(hall).toBeTruthy();
        const random = vi.spyOn(Math, 'random').mockImplementation(seeded(610));
        const onTokens = [];
        try {
            for (let i = 0; i < 200; i++) {
                const spot = kit.freeSpot();
                expect(spot).toBeTruthy();
                // Where the release lands: the whole-pixel screen point, read back as `Board.jsx` does.
                const dropAt = pointerToMat(spot.screen, rect);
                const under = Flags.tokenAtPoint(dropAt);
                if (under) onTokens.push(under.typeId);
            }
        } finally {
            random.mockRestore();
        }
        expect(onTokens).toEqual([]);
    });

    it('takes a dropped hero there as a spot order: their flag planted at the aim, never sent home', () => {
        const random = vi.spyOn(Math, 'random').mockImplementation(seeded(611));
        const heroId = 'hero_bench_5';
        try {
            for (let i = 0; i < 40; i++) {
                const spot = kit.freeSpot();
                const result = Orders.orderAt(heroId, pointerToMat(spot.screen, rect));
                expect(result.order).toBe('spot');
                const flag = BoardState.flagOf(heroId);
                expect(flag?.spot).toBe(true);
                expect(Math.hypot(flag.x - spot.mat.x, flag.y - spot.mat.y)).toBeLessThan(2);
            }
        } finally {
            random.mockRestore();
        }
    });

    /**
     * The flag kind drags the one flag it can press: every other has faded once its hero arrived.
     * Let go under the hero bar's level-up bubbles (the overlays pass keeps them up, over the mat's
     * bottom edge) or under a hero, that flag could not be pressed either, and every later flag
     * drag of the pass was skipped (48 of 50 on 2026-11-18, on main's build and on U1's alike).
     */
    it('leaves a planted flag where it can be pressed: never under the hero bar bubbles or a hero', () => {
        const bubbles = document.createElement('div');
        bubbles.setAttribute('data-bar-bubbles', 'hero_bench_0');
        document.body.appendChild(bubbles);
        const hero = document.createElement('button');
        hero.setAttribute('data-board-hero', 'hero_bench_1');
        mat.appendChild(hero);
        // The bubbles stand over the mat's bottom fifth; a hero stands mid-mat, 120 px across.
        const bandTop = rect.top + rect.height * 0.8;
        const heroAt = kit.matToScreen({ x: matW() * 0.5, y: matH() * 0.5 });
        const underHero = (x, y) => Math.abs(x - heroAt.x) <= 60 && Math.abs(y - heroAt.y) <= 60;
        document.elementFromPoint = (x, y) => (y >= bandTop ? bubbles : underHero(x, y) ? hero : surface);
        const random = vi.spyOn(Math, 'random').mockImplementation(seeded(612));
        const covered = [];
        try {
            for (let i = 0; i < 200; i++) {
                const spot = kit.freeSpot();
                expect(spot).toBeTruthy();
                // Where its flag is drawn: a 24 px box up and right of the spot.
                const { x, y } = spot.screen;
                for (const [dx, dy] of [[0, 0], [-20, -22], [20, -22], [-20, 6], [20, 6]]) {
                    if (y + dy >= bandTop || underHero(x + dx, y + dy)) { covered.push(spot.screen); break; }
                }
            }
        } finally {
            random.mockRestore();
            document.elementFromPoint = bareEverywhere;
            bubbles.remove();
            hero.remove();
        }
        expect(covered).toEqual([]);
    });
});
