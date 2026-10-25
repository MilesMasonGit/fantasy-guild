// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SRC, listFiles, readSource, rel, setScanTimeout } from './fixtures/sourceScan.js';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { INITIAL_STATE, createEmptyBoard } from '../state/StateSchema.js';
import { fingerprint } from '../../bench/lib/fingerprint.mjs';

/**
 * The discard bin is gone: demolition replaced it (Atlas A3b). Nothing in the game may bring it back
 * by name, a new board has no bin, and the engine bench's bin hash still reads the empty bin's hash,
 * so the bench's work is unchanged.
 */

setScanTimeout();

/** Every game source file, tests left out. */
const sourceFiles = () => listFiles(SRC, { ext: /\.(js|jsx|mjs)$/ });

const BIN_NAMES = /DiscardBin|binTokens|BIN_CHANGED|binnedId|data-discard-bin|data-bin-slot|unbinToken|discardAll/;

describe('no discard bin', () => {
    afterEach(() => { delete globalThis.__bench; });

    it('its modules are deleted', () => {
        expect(fs.existsSync(path.join(SRC, 'systems/board/DiscardBin.js'))).toBe(false);
        expect(fs.existsSync(path.join(SRC, 'ui/components/board/DiscardBinPanel.jsx'))).toBe(false);
    });

    it('no game file names it', () => {
        const hits = sourceFiles()
            .filter(f => BIN_NAMES.test(readSource(f)))
            .map(f => rel(f));
        expect(hits).toEqual([]);
    });

    it('a new board has no bin', () => {
        expect('bin' in createEmptyBoard()).toBe(false);
        expect('bin' in INITIAL_STATE.board).toBe(false);
        GameState.initNew();
        expect('bin' in GameState.state.board).toBe(false);
    });

    it('the engine bench reads an absent bin as the empty bin it always hashed', () => {
        globalThis.__bench = { draws: () => 0 };
        GameState.initNew();
        expect(fingerprint().binHash).toBe('811c9dc5');
    });
});
