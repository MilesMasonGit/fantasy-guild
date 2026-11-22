// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as SaveFiles from '../systems/core/SaveFiles.js';
import * as SlotHelper from '../systems/core/SaveSlotHelper.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import * as Banners from '../systems/notifications/banners.js';
import * as ItemStubs from '../systems/notifications/itemStubs.js';
import { getAllItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { CatchUpOverlay } from '../ui/components/hud/CatchUpOverlay.jsx';
import { MARK_KEY, attachMark, fingerprint, readMark } from '../systems/core/unansweredSummary.js';
import { fakeSaveDisk } from './fixtures/fakeSaveDisk.js';

/**
 * ⭐ An unanswered "While you were away" summary is offered again (owner, 2026-11-16). Until the
 * player presses Return to the Guild or Load as I left it, every save of the slot carries the
 * summary's mark and the slot's backup keeps the game as left; closing the game (the window's X,
 * a reload, an autosave before it) is not an answer, and the next start shows the summary and
 * both choices again. Return discards the copy; Load as I left it puts it back. Both builds: the
 * browser's storage and the desktop build's files.
 */

const NOW = 1_800_000_000_000;
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const PLAYED_BEFORE = 5000;

class SilentAudio {
    constructor(src = '') { this.src = src; this.paused = true; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

let disk = null;
/** `SaveFiles.useBackend`, which is no React hook, under a name the hooks rule does not take for one. */
const swapBackend = SaveFiles.useBackend;

/** Writes to slot 0's key throw, as a full browser storage does; the returned function stops it. */
function fillStorage() {
    const setItem = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
        if (key === SaveManager.getSlotKey(0)) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return setItem.call(this, key, value);
    });
    return () => spy.mockRestore();
}

const BUILDS = {
    'the browser storage': {
        async open() { swapBackend(null); },
        main: () => localStorage.getItem(SaveManager.getSlotKey(0)),
        backup: () => localStorage.getItem(SlotHelper.getBackupKey(0)),
        plant: (text) => localStorage.setItem(SaveManager.getSlotKey(0), text),
        plantBackup: (text) => localStorage.setItem(SlotHelper.getBackupKey(0), text),
        /** The page going away (the tab closed, F5): its save on leaving. */
        close: () => window.dispatchEvent(new Event('beforeunload')),
        failWrites: fillStorage
    },
    'the desktop files': {
        async open() {
            disk = fakeSaveDisk();
            swapBackend(disk);
            await SaveManager.loadSaveFiles();
            SaveManager.installCloseSave();
        },
        main: () => disk.main(0),
        backup: () => disk.backup(0),
        plant: (text) => disk.files.set('slot1.json', text),
        plantBackup: (text) => disk.files.set('slot1.backup.json', text),
        /** The window's X: the app asks the page to save, then closes. */
        close: () => window.dispatchEvent(new CustomEvent(SaveFiles.CLOSE_REQUESTED_EVENT)),
        /** As the app's own write fails: the backup rolled first, then the save's write refused. */
        failWrites: () => {
            disk.failWrites(new Error('The device is not ready.'), { afterBackup: true });
            return () => disk.failWrites(null);
        }
    }
};

const q = (sel) => document.querySelector(sel);
const marked = (text) => JSON.parse(text)[MARK_KEY];
const played = (text) => JSON.parse(text).state.time.gameTimeMs;

/** Slot 1's save: an empty game with 5 s played, saved `msAgo` before NOW. */
function saveText(msAgo) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    GameState.state.time.gameTimeMs = PLAYED_BEFORE;
    const save = JSON.parse(GameState.serializeJson());
    save.savedAt = NOW - msAgo;
    return JSON.stringify(save);
}

/** Open slot 1 as the slot screen's Load does, the clock at `at`. */
async function start(at, options) {
    vi.mocked(Date.now).mockReturnValue(at);
    let opened;
    await act(async () => { opened = await EngineBootstrap.startSlot(0, options); });
    await SaveFiles.flush();
    GameLoop.stop();
    return opened;
}

/** What a closed window or a reload leaves: the storage or the files, and nothing in memory. */
async function reload() {
    await SaveFiles.flush();
    cleanup();
    GameLoop.stop();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    CatchUp.forgetUndo();
    Banners.reset();
    ItemStubs.reset();
    if (SaveFiles.isActive()) await SaveFiles.refreshAll();
    render(React.createElement(CatchUpOverlay));
}

async function click(sel) {
    await act(async () => { fireEvent.click(q(sel)); });
}

const answerReturn = async () => { await click('[data-summary-close]'); await click('[data-summary-confirm-yes]'); };
const answerUndo = async () => { await click('[data-summary-undo]'); await click('[data-summary-confirm-yes]'); };

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    CatchUp.forgetUndo();
    Banners.reset();
    ItemStubs.reset();
    render(React.createElement(CatchUpOverlay));
});

afterEach(async () => {
    await SaveFiles.flush();
    cleanup();
    GameLoop.stop();
    vi.mocked(Date.now).mockRestore();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    CatchUp.forgetUndo();
    SaveFiles.useBackend(null);
    disk = null;
    Banners.reset();
    ItemStubs.reset();
    localStorage.clear();
    sessionStorage.clear();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe.each(Object.entries(BUILDS))('with %s', (_name, build) => {
    /** A save 3 h old, loaded: the summary is up. Then the game is closed without an answer. */
    async function closeOnTheSummary() {
        await build.open();
        const asLeft = saveText(3 * HOUR);
        build.plant(asLeft);
        if (SaveFiles.isActive()) await SaveFiles.refreshAll();
        expect(await start(NOW)).toBe(true);
        expect(q('[data-catch-up-summary]')).not.toBeNull();
        build.close();
        await SaveFiles.flush();
        return asLeft;
    }

    it('closing with the summary open is not an answer: the next start shows it again, with both choices', async () => {
        await build.open();
        const asLeft = saveText(3 * HOUR);
        build.plant(asLeft);
        if (SaveFiles.isActive()) await SaveFiles.refreshAll();
        expect(await start(NOW)).toBe(true);
        expect(q('[data-catch-up-summary]')).not.toBeNull();
        expect(q('[data-summary-again]')).toBeNull();

        // The caught-up game is saved with the mark; the backup is the game as left, byte for byte.
        expect(played(build.main())).toBe(PLAYED_BEFORE + 3 * HOUR);
        expect(marked(build.main())).toMatchObject({ since: NOW - 3 * HOUR, check: fingerprint(asLeft) });
        expect(marked(build.main()).result).toMatchObject({ simulatedMs: 3 * HOUR, show: true });
        expect(build.backup()).toBe(asLeft);

        // An autosave, then the window closed: each carries the mark and keeps the copy.
        vi.mocked(Date.now).mockReturnValue(NOW + 10 * SEC);
        expect(SaveManager.save(false)).toBe(true);
        await SaveFiles.flush();
        expect(build.backup()).toBe(asLeft);
        build.close();
        await SaveFiles.flush();
        expect(marked(build.main()).since).toBe(NOW - 3 * HOUR);
        expect(build.backup()).toBe(asLeft);

        // The next start, half a minute later: the same summary, and both choices.
        await reload();
        expect(await start(NOW + 40 * SEC)).toBe(true);
        expect(q('[data-catch-up-summary]')).not.toBeNull();
        expect(q('[data-summary-again]')?.textContent).toBe('You closed the game before choosing, so here it is again.');
        expect(q('[data-summary-away]').textContent).toContain('3 h');
        expect(q('[data-summary-close]')).not.toBeNull();
        expect(q('[data-summary-undo]')).not.toBeNull();
        expect(q('[data-summary-undo-since]')).toBeNull();
        expect(CatchUp.undoSince()).toBe(NOW - 3 * HOUR);
        // The half minute played on, quietly, on top of the time away.
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 3 * HOUR + 30 * SEC);
        expect(marked(build.main()).since).toBe(NOW - 3 * HOUR);
        expect(build.backup()).toBe(asLeft);
    });

    it('Return to the Guild on it discards the copy: the start after offers nothing', async () => {
        const asLeft = await closeOnTheSummary();
        await reload();
        await start(NOW + 30 * SEC);
        expect(q('[data-summary-again]')).not.toBeNull();

        await answerReturn();
        await SaveFiles.flush();
        expect(q('[data-catch-up-summary]')).toBeNull();
        expect(CatchUp.canUndo()).toBe(false);
        expect(marked(build.main())).toBeUndefined();
        expect(build.backup()).not.toBe(asLeft);
        expect(played(build.main())).toBe(PLAYED_BEFORE + 3 * HOUR + 30 * SEC);

        await reload();
        await start(NOW + 60 * SEC);
        expect(q('[data-catch-up-summary]')).toBeNull();
        expect(CatchUp.canUndo()).toBe(false);
    });

    it('Load as I left it on it puts the game as left back, and the page that opens offers nothing', async () => {
        const asLeft = await closeOnTheSummary();
        await reload();
        await start(NOW + 30 * SEC);
        const reloadPage = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            await answerUndo();
            await SaveFiles.flush();
            expect(reloadPage).toHaveBeenCalledTimes(1);
        } finally {
            reloadPage.mockRestore();
        }
        const restored = JSON.parse(build.main());
        expect(restored.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
        expect(restored.savedAt).toBe(NOW + 30 * SEC);
        expect(restored[MARK_KEY]).toBeUndefined();
        // Written back without rolling: the copy stayed safe until the write was on the disk.
        expect(build.backup()).toBe(asLeft);

        await reload();
        expect(SaveManager.takeResumeSlot()).toBe(0);
        await start(NOW + 31 * SEC, { catchUp: false });
        expect(q('[data-catch-up-summary]')).toBeNull();
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
    });

    it('a Load as I left it that fails keeps the copy: closing then, the next start offers it again', async () => {
        const asLeft = await closeOnTheSummary();
        await reload();
        await start(NOW + 30 * SEC);
        const reloadPage = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            const stop = build.failWrites();
            try {
                await answerUndo();
                await SaveFiles.flush();
            } finally {
                stop();
            }
            expect(reloadPage).not.toHaveBeenCalled();
        } finally {
            reloadPage.mockRestore();
        }
        expect(q('[data-summary-undo-failed]')).not.toBeNull();
        expect(build.backup()).toBe(asLeft);
        expect(marked(build.main()).since).toBe(NOW - 3 * HOUR);

        build.close();
        await reload();
        await start(NOW + 60 * SEC);
        expect(q('[data-summary-again]')).not.toBeNull();
        expect(q('[data-summary-undo]')).not.toBeNull();
        expect(CatchUp.undoSince()).toBe(NOW - 3 * HOUR);
    });

    it('back two minutes or more later: the new time away is shown, and Load as I left it still goes back before the first', async () => {
        const asLeft = await closeOnTheSummary();
        await reload();
        await start(NOW + HOUR);
        // The hour's own summary, as a second absence while it is open shows it.
        expect(q('[data-catch-up-summary]')).not.toBeNull();
        expect(q('[data-summary-again]')).toBeNull();
        expect(q('[data-summary-away]').textContent).toContain('1 h');
        expect(q('[data-summary-undo-since]')).not.toBeNull();
        expect(CatchUp.undoSince()).toBe(NOW - 3 * HOUR);
        expect(build.backup()).toBe(asLeft);
        expect(marked(build.main())).toMatchObject({ since: NOW - 3 * HOUR, check: fingerprint(asLeft) });
        expect(marked(build.main()).result.simulatedMs).toBe(HOUR);

        const reloadPage = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            await answerUndo();
            await SaveFiles.flush();
            expect(reloadPage).toHaveBeenCalledTimes(1);
        } finally {
            reloadPage.mockRestore();
        }
        expect(played(build.main())).toBe(PLAYED_BEFORE);
    });

    it('a second time away while the summary was open, then closed: the newest comes back, going back before both', async () => {
        await build.open();
        const asLeft = saveText(3 * HOUR);
        build.plant(asLeft);
        if (SaveFiles.isActive()) await SaveFiles.refreshAll();
        await start(NOW);
        // The PC sleeps two hours with the summary up.
        vi.mocked(Date.now).mockReturnValue(NOW + 2 * HOUR);
        await act(async () => { await CatchUp.run({ savedAt: NOW, yieldFn: () => Promise.resolve() }); });
        await SaveFiles.flush();
        // The game as it stood was written before that catch-up, and neither save rolled the copy away.
        expect(build.backup()).toBe(asLeft);
        expect(marked(build.main())).toMatchObject({ since: NOW - 3 * HOUR, check: fingerprint(asLeft) });

        build.close();
        await reload();
        await start(NOW + 2 * HOUR + 30 * SEC);
        expect(q('[data-summary-again]')).not.toBeNull();
        expect(q('[data-summary-away]').textContent).toContain('2 h');
        expect(q('[data-summary-undo-since]')).not.toBeNull();
        expect(CatchUp.undoSince()).toBe(NOW - 3 * HOUR);

        const reloadPage = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            await answerUndo();
            await SaveFiles.flush();
        } finally {
            reloadPage.mockRestore();
        }
        expect(played(build.main())).toBe(PLAYED_BEFORE);
    });

    it('the copy gone: the summary still comes back, without Load as I left it, and says why', async () => {
        await closeOnTheSummary();
        build.plantBackup(saveText(9 * HOUR));
        await reload();
        await start(NOW + 30 * SEC);
        expect(q('[data-summary-again]')).not.toBeNull();
        expect(q('[data-summary-undo]')).toBeNull();
        expect(q('[data-summary-undo-gone]')?.textContent).toBe('The save from before your time away is gone, so Load as I left it cannot be offered.');
        expect(CatchUp.canUndo()).toBe(false);
        // Still unanswered, and no longer looked for.
        expect(marked(build.main())).toMatchObject({ since: NOW - 3 * HOUR, check: null });

        await answerReturn();
        await SaveFiles.flush();
        expect(marked(build.main())).toBeUndefined();
    });
});

describe('around the summary offered again', () => {
    it('what it held for the banners and stubs comes once it is answered at the next start', async () => {
        const asLeft = saveText(3 * HOUR);
        localStorage.setItem(SaveManager.getSlotKey(0), asLeft);
        const found = () => GameState.state.collection.discoveredItems;
        let item = null;
        GameLoop.onTick('test_find', () => {
            item = Object.values(getAllItems()).find(i => i?.id && !found()[i.id] && i.stackable !== false)?.id;
            InventoryManager.addItem(item, 2);
            GameLoop.offTick('test_find');
        }, 1);
        try {
            await start(NOW);
        } finally {
            GameLoop.offTick('test_find');
        }
        expect(item).toBeTruthy();
        expect(marked(localStorage.getItem(SaveManager.getSlotKey(0))).result.summary.news.finds).toEqual([{ itemId: item, count: 2 }]);
        window.dispatchEvent(new Event('beforeunload'));

        await reload();
        await start(NOW + 30 * SEC);
        expect(q('[data-summary-again]')).not.toBeNull();
        expect(ItemStubs.getStub(item)).toBeNull();
        await answerReturn();
        expect(ItemStubs.getStub(item)).toMatchObject({ isNew: true, added: 2 });
    });

    it('a mark in the backup is never offered: loaded from the backup, its own copy is gone', async () => {
        // As after Return to the Guild: the save that carried the mark rolled into the backup.
        const inner = saveText(5 * HOUR);
        const mark = { since: NOW - 5 * HOUR, check: fingerprint(inner), result: { awayMs: 9 * HOUR, show: true, summary: {} }, earlier: [] };
        localStorage.setItem(SlotHelper.getBackupKey(0), attachMark(saveText(30 * SEC), JSON.stringify(mark)));
        localStorage.setItem(SaveManager.getSlotKey(0), '{"state": cut off');
        await start(NOW);
        expect(Banners.getAll().map(b => b.parts?.title)).toContain('Save restored');
        expect(q('[data-catch-up-summary]')).toBeNull();
        expect(CatchUp.canUndo()).toBe(false);
        SaveManager.save(false);
        expect(marked(localStorage.getItem(SaveManager.getSlotKey(0)))).toBeUndefined();
    });

    it('a summary that cannot be turned down leaves no mark: a short time away, or one that does not save', async () => {
        localStorage.setItem(SaveManager.getSlotKey(0), saveText(90 * SEC));
        await start(NOW);
        expect(q('[data-catch-up-summary]')).toBeNull();
        expect(marked(localStorage.getItem(SaveManager.getSlotKey(0)))).toBeUndefined();

        const before = localStorage.getItem(SaveManager.getSlotKey(0));
        await act(async () => { await CatchUp.run({ savedAt: NOW - 3 * HOUR, save: false, yieldFn: () => Promise.resolve() }); });
        expect(localStorage.getItem(SaveManager.getSlotKey(0))).toBe(before);
        expect(SaveManager.hasUnanswered()).toBe(false);
        SaveManager.save(false);
        expect(marked(localStorage.getItem(SaveManager.getSlotKey(0)))).toBeUndefined();
    });
});

describe('the mark in the save', () => {
    it('sits beside the game in the envelope, leaving the game byte for byte as it was', () => {
        const save = saveText(0);
        const withMark = attachMark(save, JSON.stringify({ since: 1, check: 'x', result: { a: [1] }, earlier: [] }));
        const parsed = JSON.parse(withMark);
        expect(JSON.stringify({ ...parsed, [MARK_KEY]: undefined })).toBe(save);
        expect(readMark(parsed)).toEqual({ since: 1, check: 'x', result: { a: [1] }, earlier: [] });
    });

    it('a mark that is not one is no mark', () => {
        expect(readMark({})).toBeNull();
        expect(readMark({ [MARK_KEY]: 'yes' })).toBeNull();
        expect(readMark({ [MARK_KEY]: { since: 'soon', result: {} } })).toBeNull();
        expect(readMark({ [MARK_KEY]: { since: 5 } })).toBeNull();
        expect(readMark({ [MARK_KEY]: { since: 5, result: {}, check: 7, earlier: 'no' } }))
            .toEqual({ since: 5, check: null, result: {}, earlier: [] });
    });

    it('the fingerprint tells one save from another, a character apart', () => {
        const save = saveText(0);
        expect(fingerprint(save)).toBe(fingerprint(`${save}`));
        expect(fingerprint(save)).not.toBe(fingerprint(save.replace('"version"', '"versioN"')));
        expect(fingerprint(save)).toMatch(new RegExp(`^${save.length}:[0-9a-f]+$`));
    });
});
