// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as FightRoom from '../systems/board/FightRoom.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { setUpCombatCrowd, CROWD } from '../ui/dev/combatScreenDev.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * The QA panel's crowd of seven fights below the Guild Hall (`setUpCombatCrowd`), played in the
 * engine as the owner's eye-check plays it: the heroes walk out from the Hall, and the fights that
 * would cover one another step apart before they start.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

/** Every pair of fights whose boxes crowd each other, the enemies at `places`. */
function crowdedPairs(fights, places) {
    const boxes = fights.map((f, i) => FightRoom.fightBox(f.typeId, places[i], f.side));
    const pairs = [];
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) if (FightRoom.crowds(boxes[i], boxes[j])) pairs.push([fights[i].name, fights[j].name]);
    }
    return pairs;
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterAll(() => {
    BoardState.setInstantArrival(true);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ the QA crowd of fights steps apart', () => {
    it('the fights that would cover one another step to open space, and fewer pairs crowd', () => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        BoardState.setInstantArrival(false);
        FightRoom.resetStats();
        fixtures.placeAt('token_guild_hall', Math.round(matW() / 2), Math.round(matH() / 3));

        expect(setUpCombatCrowd()).toMatchObject({ ok: true, fights: CROWD.length });
        const heroes = GameState.state.heroes.filter(h => CROWD.some(c => c.name === h.name));
        const placed = new Map(heroes.map(h => {
            const enemy = BoardState.getTokenById(BoardState.flagOf(h.id).pinnedTo);
            return [h.id, { x: enemy.x, y: enemy.y }];
        }));

        for (let i = 0; i < 300 && !heroes.every(h => BoardCombat.fightOfHero(h.id)); i++) GameLoop.runHandlers(100);
        expect(heroes.every(h => BoardCombat.fightOfHero(h.id))).toBe(true);

        const fights = heroes.map(h => {
            const enemy = BoardState.getTokenById(BoardCombat.fightOfHero(h.id).instanceId);
            return { name: h.name, typeId: enemy.typeId, side: BoardState.heroBodyOf(h.id).side, enemy };
        });
        const before = crowdedPairs(fights, heroes.map(h => placed.get(h.id)));
        const after = crowdedPairs(fights, fights.map(f => f.enemy));
        const { stepped, walked, farthest, searches } = FightRoom.stats();
        console.info(`crowd: ${stepped} of ${searches} crowded fights stepped, ${walked.toFixed(0)} u in all, ${farthest.toFixed(0)} u at most; crowded pairs ${before.length} -> ${after.length}`,
            fights.map(f => `${f.name} ${placed.get(heroes.find(h => h.name === f.name).id).x},${placed.get(heroes.find(h => h.name === f.name).id).y} -> ${f.enemy.x},${f.enemy.y}`).join('; '));

        expect(stepped).toBeGreaterThanOrEqual(2);
        expect(farthest).toBeLessThanOrEqual(FightRoom.STEP_REACH);
        expect(after.length).toBeLessThan(before.length);
    }, 60_000);
});
