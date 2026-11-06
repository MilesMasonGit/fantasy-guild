// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION } from '../state/StateSchema.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as SaveFiles from '../systems/core/SaveFiles.js';
import * as SlotHelper from '../systems/core/SaveSlotHelper.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import * as Banners from '../systems/notifications/banners.js';
import { fakeSaveDisk } from './fixtures/fakeSaveDisk.js';

/**
 * The desktop build's saves are files (`SaveFiles.js`, `src-tauri/src/saves.rs`), and keep every
 * promise the browser's saves make: the backup, damaged-save recovery, refusing another version,
 * the save on closing the window. Here the app's file commands are a fake folder
 * (`fakeSaveDisk`) with the same rules; the Rust side's own tests prove the real writes.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));

vi.mock('../systems/core/SettingsManager.js', () => ({
    SettingsManager: { get: vi.fn(() => 10) }
}));

const DAMAGED = 'This save appears to be damaged and could not be loaded.';
const OLD_VERSION = 'This save is from a previous version and cannot be loaded. Please start a new game.';

let disk;

/** A game with `gameTimeMs` played, as the save text the game writes. */
function gameText(gameTimeMs) {
    GameState.initNew();
    GameState.state.time.gameTimeMs = gameTimeMs;
    return GameState.serializeJson();
}

const played = (text) => JSON.parse(text).state.time.gameTimeMs;
const messages = () => vi.mocked(NotificationSystem.notify).mock.calls.map(c => c[0]);
const bannerTitles = () => Banners.getAll().map(b => b.parts?.title ?? b.title);

beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(NotificationSystem.notify).mockClear();
    Banners.reset();
    disk = fakeSaveDisk();
    SaveFiles.useBackend(disk);
    await SaveManager.loadSaveFiles();
    SaveManager.currentSlot = null;
    SaveManager.isResetting = false;
    SaveManager.keepBackupSlot = null;
    SaveManager.resumeSaving();
});

afterEach(() => {
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveFiles.useBackend(null);
});

describe('which builds save to files', () => {
    const invoke = vi.fn();
    const tauri = { __TAURI__: { core: { invoke } } };

    it('the desktop build (Tauri, not a dev build) only', () => {
        expect(SaveFiles.detectBackend(tauri, { DEV: false })).not.toBeNull();
        expect(SaveFiles.detectBackend(tauri, { DEV: true })).toBeNull();
        expect(SaveFiles.detectBackend({}, { DEV: false })).toBeNull();
        // A browser build or a test: localStorage, as before.
        expect(SaveFiles.detectBackend()).toBeNull();
    });

    it('sends a save as bytes with its slot, and reads one back as text', async () => {
        const backend = SaveFiles.tauriBackend(invoke);
        invoke.mockResolvedValueOnce(undefined);
        await backend.write(1, '{"é":1}', { rollBackup: false });
        const [cmd, body, options] = invoke.mock.calls.at(-1);
        expect(cmd).toBe('save_write');
        // Tauri sends any typed array as the raw body.
        expect(ArrayBuffer.isView(body)).toBe(true);
        expect(new TextDecoder().decode(body)).toBe('{"é":1}');
        expect(options.headers).toEqual({ 'fg-slot': '1', 'fg-roll-backup': '0' });

        invoke.mockResolvedValueOnce(new TextEncoder().encode('{"a":2}').buffer);
        expect(await backend.read(0, true)).toBe('{"a":2}');
        expect(invoke).toHaveBeenLastCalledWith('save_read', { slot: 0, backup: true });
        invoke.mockResolvedValueOnce(null);
        expect(await backend.read(0, false)).toBeNull();
    });
});

describe('the file layer', () => {
    it('writes go out in order, one at a time; a waiting write is replaced by a newer one', async () => {
        const release = disk.holdWrites();
        const first = SaveFiles.writeSave(0, '{"n":1}');
        const second = SaveFiles.writeSave(0, '{"n":2}');
        const third = SaveFiles.writeSave(0, '{"n":3}');
        // The slot screen's copy is the newest at once.
        expect(SaveFiles.savedText(0)).toBe('{"n":3}');
        release();
        expect(await first).toEqual({ ok: true });
        expect(await second).toEqual({ ok: true });
        expect(await third).toEqual({ ok: true });
        expect(disk.writes().map(w => w[3])).toEqual(['{"n":1}', '{"n":3}']);
        expect(disk.main(0)).toBe('{"n":3}');
        expect(disk.backup(0)).toBe('{"n":1}');
    });

    it('flush waits for every write still going', async () => {
        const release = disk.holdWrites();
        SaveFiles.writeSave(0, '{"n":1}');
        SaveFiles.writeSave(2, '{"n":2}');
        let flushed = false;
        const done = SaveFiles.flush().then(() => { flushed = true; });
        await Promise.resolve();
        expect(flushed).toBe(false);
        release();
        await done;
        expect(disk.main(0)).toBe('{"n":1}');
        expect(disk.main(2)).toBe('{"n":2}');
    });

    it('a write that fails leaves the last good file, and the copy follows the disk again', async () => {
        await SaveFiles.writeSave(0, '{"good":1}');
        disk.failWrites();
        const result = await SaveFiles.writeSave(0, '{"bad":1}');
        expect(result.ok).toBe(false);
        expect(disk.main(0)).toBe('{"good":1}');
        expect(SaveFiles.savedText(0)).toBe('{"good":1}');
    });

    it('a re-read while a write waits does not undo the newer copy', async () => {
        await SaveFiles.writeSave(0, '{"n":1}');
        const release = disk.holdWrites();
        SaveFiles.writeSave(0, '{"n":2}');
        const reread = SaveFiles.refresh(0);
        release();
        await reread;
        expect(SaveFiles.savedText(0)).toBe('{"n":2}');
        expect(disk.main(0)).toBe('{"n":2}');
    });

    it('a write that was to keep the backup still keeps it when a newer one replaces it', async () => {
        await SaveFiles.writeSave(0, '{"n":1}');
        await SaveFiles.writeSave(0, '{"n":2}');
        const release = disk.holdWrites();
        SaveFiles.writeSave(0, '{"n":3}');
        SaveFiles.writeSave(0, '{"n":4}', { rollBackup: false });
        SaveFiles.writeSave(0, '{"n":5}');
        release();
        await SaveFiles.flush();
        expect(disk.writes().map(w => [w[3], w[2]]).slice(-2)).toEqual([['{"n":3}', true], ['{"n":5}', false]]);
    });

    it('re-reading the folder tells the slot screen only when a file changed', async () => {
        const heard = vi.fn();
        const off = SaveFiles.onChange(heard);
        try {
            await SaveFiles.refreshAll();
            expect(heard).not.toHaveBeenCalled();
            disk.files.set('slot2.json', '{"copied":1}');
            await SaveFiles.refreshAll();
            expect(heard).toHaveBeenCalledTimes(1);
            expect(SaveFiles.savedText(1)).toBe('{"copied":1}');
        } finally {
            off();
        }
    });

    it('a delete still waiting when a write comes is done first', async () => {
        await SaveFiles.writeSave(0, '{"n":1}');
        await SaveFiles.writeSave(0, '{"n":2}');
        const release = disk.holdWrites();
        SaveFiles.writeSave(1, '{}');
        SaveFiles.deleteSave(0);
        SaveFiles.writeSave(0, '{"new":1}');
        release();
        await SaveFiles.flush();
        expect(disk.main(0)).toBe('{"new":1}');
        expect(disk.backup(0)).toBeNull();
    });
});

describe('a save written and loaded', () => {
    it('a new game claims its slot with a file, and the next save keeps the one before as the backup', async () => {
        SaveManager.currentSlot = 1;
        GameState.initNew();
        GameState.state.time.gameTimeMs = 100;
        expect(SaveManager.save(false)).toBe(true);
        GameState.state.time.gameTimeMs = 200;
        SaveManager.save(false);
        await SaveFiles.flush();
        expect(played(disk.main(1))).toBe(200);
        expect(played(disk.backup(1))).toBe(100);
        expect(localStorage.getItem(SlotHelper.getSlotKey(1))).toBeNull();
        expect(SlotHelper.hasSlot(1)).toBe(true);
        expect(SlotHelper.getSlotInfo(1)).toMatchObject({ slotIndex: 1, version: GAME_VERSION });

        GameState.state.time.gameTimeMs = 999;
        expect(await SaveManager.loadSlot(1, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(200);
    });

    it('a load reads the file as it is now: one copied in or edited after the slot screen read it', async () => {
        disk.files.set('slot3.json', gameText(4242));
        // The slot screen has not seen it yet...
        expect(SlotHelper.hasSlot(2)).toBe(false);
        // ...the window regains focus there, and it has.
        await SaveFiles.refreshAll();
        expect(SlotHelper.hasSlot(2)).toBe(true);

        disk.files.set('slot3.json', gameText(5151));
        expect(await SaveManager.loadSlot(2, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(5151);
    });

    it('nothing is written to the disk until a save, and a save is refused while saving is suspended', async () => {
        SaveManager.currentSlot = 0;
        GameState.initNew();
        SaveManager.suspendSaving();
        expect(SaveManager.save(false)).toBe(false);
        await SaveFiles.flush();
        expect(disk.writes()).toHaveLength(0);
    });

    it('a file that cannot be written raises the save problem banner; the last good file stays', async () => {
        SaveManager.currentSlot = 0;
        GameState.initNew();
        GameState.state.time.gameTimeMs = 1;
        SaveManager.save(false);
        await SaveFiles.flush();
        disk.failWrites();
        GameState.state.time.gameTimeMs = 2;
        SaveManager.save(false);
        await SaveFiles.flush();
        await Promise.resolve();
        expect(bannerTitles()).toContain('Save Failed!');
        expect(played(disk.main(0))).toBe(1);
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(1);
    });

    it('deleting a slot removes its save and its backup', async () => {
        SaveManager.currentSlot = 0;
        GameState.initNew();
        SaveManager.save(false);
        SaveManager.save(false);
        await SaveFiles.flush();
        expect(disk.backup(0)).not.toBeNull();
        SaveManager.deleteSlot(0);
        expect(SlotHelper.hasSlot(0)).toBe(false);
        expect(SlotHelper.getSlotInfo(0)).toBeNull();
        await SaveFiles.flush();
        expect(disk.main(0)).toBeNull();
        expect(disk.backup(0)).toBeNull();
    });
});

describe('a damaged, edited or old file', () => {
    /** Slot 1 holds a good save (100) and a later one (200) rolled over it into the backup. */
    async function twoSaves() {
        SaveManager.currentSlot = 0;
        GameState.initNew();
        GameState.state.time.gameTimeMs = 100;
        SaveManager.save(false);
        GameState.state.time.gameTimeMs = 200;
        SaveManager.save(false);
        await SaveFiles.flush();
        SaveManager.currentSlot = null;
    }

    it('a broken file loads the backup, with the Save Restored banner, and the backup survives the next save', async () => {
        await twoSaves();
        disk.files.set('slot1.json', disk.main(0).slice(0, 500));
        await SaveFiles.refreshAll();
        expect(SlotHelper.getSlotInfo(0)).toMatchObject({ damaged: true });

        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(100);
        expect(bannerTitles()).toContain('Save Restored');
        // Loading wrote nothing.
        expect(disk.main(0).length).toBe(500);

        GameState.state.time.gameTimeMs = 300;
        SaveManager.save(false);
        await SaveFiles.flush();
        expect(played(disk.main(0))).toBe(300);
        expect(played(disk.backup(0))).toBe(100);
        // From then on the backup rolls as usual.
        GameState.state.time.gameTimeMs = 400;
        SaveManager.save(false);
        await SaveFiles.flush();
        expect(played(disk.backup(0))).toBe(300);
    });

    it('an edited file that is not a valid save loads the backup too', async () => {
        await twoSaves();
        const edited = JSON.parse(disk.main(0));
        edited.state.heroes = 'lots';
        disk.files.set('slot1.json', JSON.stringify(edited));
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(100);
        expect(bannerTitles()).toContain('Save Restored');
    });

    it('with no good backup: the damaged-save message, no crash, and every file untouched', async () => {
        await twoSaves();
        SaveManager.currentSlot = 2;
        GameState.state.time.gameTimeMs = 777;
        SaveManager.save(false);
        await SaveFiles.flush();
        SaveManager.currentSlot = null;
        disk.files.set('slot1.json', '{"state": {"heroes": [');
        disk.files.set('slot1.backup.json', 'not a save at all');
        const before = disk.snapshot();

        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(false);
        expect(messages()).toContain(DAMAGED);
        await SaveFiles.flush();
        expect(disk.snapshot()).toEqual(before);
        // The other slots load as ever.
        expect(await SaveManager.loadSlot(2, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(777);
    });

    it('a file that cannot be read at all shows as damaged, is never taken for an empty slot, and loads its backup', async () => {
        await twoSaves();
        disk.makeUnreadable('slot1.json');
        await SaveFiles.refreshAll();
        expect(SlotHelper.hasSlot(0)).toBe(true);
        expect(SlotHelper.getSlotInfo(0)).toMatchObject({ damaged: true });
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        expect(GameState.state.time.gameTimeMs).toBe(100);
    });

    it('a file from another version is refused with the existing message, and left as it is', async () => {
        const old = JSON.parse(gameText(50));
        old.version = '0.7.0';
        old.state.meta.version = '0.7.0';
        disk.files.set('slot2.json', JSON.stringify(old));
        await SaveFiles.refreshAll();
        expect(SlotHelper.getSlotInfo(1)).toMatchObject({ version: '0.7.0' });
        const before = disk.snapshot();
        expect(await SaveManager.loadSlot(1, { catchUp: false })).toBe(false);
        expect(messages()).toContain(OLD_VERSION);
        expect(disk.snapshot()).toEqual(before);
    });
});

describe('closing the window', () => {
    const close = () => window.dispatchEvent(new CustomEvent(SaveFiles.CLOSE_REQUESTED_EVENT));
    const until = async (check) => {
        for (let i = 0; i < 50 && !check(); i++) await new Promise(r => setTimeout(r, 0));
    };

    beforeEach(() => {
        SaveManager.installCloseSave();
    });

    it('the app is told the page saves on closing', () => {
        expect(SaveManager._closeSaveBound).toBe(true);
    });

    it('saves the game, and the window closes only once the file is on the disk', async () => {
        SaveManager.currentSlot = 0;
        GameState.initNew();
        GameState.state.time.gameTimeMs = 31337;
        const release = disk.holdWrites();
        close();
        await until(() => disk.writes().length > 0);
        expect(disk.writes()).toHaveLength(1);
        // The write is still going: the window waits.
        expect(disk.closed).toBe(0);
        release();
        await until(() => disk.closed > 0);
        expect(disk.closed).toBe(1);
        expect(played(disk.main(0))).toBe(31337);
        const order = disk.log.filter(e => e[0] === 'write' || e[0] === 'close').map(e => e[0]);
        expect(order).toEqual(['write', 'close']);
    });

    it('waits for an autosave still being written, too', async () => {
        SaveManager.currentSlot = 0;
        GameState.initNew();
        const release = disk.holdWrites();
        SaveManager.save(false);
        SaveManager.currentSlot = null;           // e.g. the slot screen: nothing more to save
        close();
        await new Promise(r => setTimeout(r, 0));
        expect(disk.closed).toBe(0);
        release();
        await until(() => disk.closed > 0);
        expect(disk.main(0)).not.toBeNull();
    });

    it('during a catch-up nothing is saved: the file keeps the save from before, and the window still closes', async () => {
        SaveManager.currentSlot = 0;
        GameState.initNew();
        GameState.state.time.gameTimeMs = 5;
        SaveManager.save(false);
        await SaveFiles.flush();
        const before = disk.snapshot();
        GameState.state.time.gameTimeMs = 6;
        SaveManager.suspendSaving();
        close();
        await until(() => disk.closed > 0);
        expect(disk.closed).toBe(1);
        expect(disk.snapshot()).toEqual(before);
    });

    it('the slot screen, with no game open, closes at once', async () => {
        close();
        await until(() => disk.closed > 0);
        expect(disk.closed).toBe(1);
        expect(disk.writes()).toHaveLength(0);
    });
});

describe('the folder', () => {
    it('is found at boot and opens on request', async () => {
        expect(SaveFiles.folderPath()).toBe(disk.folderPath);
        expect(await SaveFiles.openFolder()).toBe(true);
        expect(disk.opened).toBe(1);
    });

    it('nothing of it exists in a browser build', async () => {
        SaveFiles.useBackend(null);
        expect(SaveFiles.isActive()).toBe(false);
        expect(SaveFiles.folderPath()).toBeNull();
        expect(await SaveFiles.openFolder()).toBe(false);
    });
});
