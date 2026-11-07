/**
 * A fake saves folder for `SaveFiles.useBackend`: the app's file commands (`src-tauri/src/saves.rs`)
 * over a Map of file names to text, with the same rules: a write lands whole through a temp
 * file, the save it replaces becomes the backup (unless it is not JSON, or the write says to keep
 * the backup), and a missing file reads as null. Tests can hold writes in flight, make them fail
 * part-way (the temp file written, the save untouched), and make a file unreadable.
 */
export function fakeSaveDisk() {
    const files = new Map();
    const log = [];
    const unreadable = new Set();
    let held = null;
    let failing = null;

    const mainName = (slot) => `slot${slot + 1}.json`;
    const backupName = (slot) => `slot${slot + 1}.backup.json`;
    const isJson = (text) => { try { JSON.parse(text); return true; } catch { return false; } };

    const disk = {
        files,
        log,
        mainName,
        backupName,
        closed: 0,
        claimed: 0,
        opened: 0,
        folderPath: 'C:\\Users\\player\\AppData\\Roaming\\com.fantasyguild.game\\saves',

        main: (slot) => files.get(mainName(slot)) ?? null,
        backup: (slot) => files.get(backupName(slot)) ?? null,
        /** Every file as it stands, to compare before and after. */
        snapshot: () => new Map(files),
        writes: () => log.filter(e => e[0] === 'write'),

        /** Writes wait until the returned function is called. */
        holdWrites() {
            let release;
            held = new Promise(resolve => { release = resolve; });
            return () => { held = null; release(); };
        },
        /** The next writes fail after the temp file is written (`null` to stop). */
        failWrites(error = new Error('The device is not ready.')) { failing = error; },
        makeUnreadable(name) { unreadable.add(name); },

        async read(slot, backup) {
            const name = backup ? backupName(slot) : mainName(slot);
            log.push(['read', slot, backup]);
            if (unreadable.has(name)) throw new Error(`Access is denied: ${name}`);
            return files.has(name) ? files.get(name) : null;
        },
        async write(slot, text, { rollBackup }) {
            log.push(['write', slot, rollBackup, text]);
            if (held) await held;
            const main = mainName(slot);
            files.set(`${main}.tmp`, text);
            if (failing) throw failing;
            if (rollBackup && files.has(main) && isJson(files.get(main))) files.set(backupName(slot), files.get(main));
            files.set(main, text);
            files.delete(`${main}.tmp`);
        },
        async remove(slot) {
            log.push(['remove', slot]);
            if (held) await held;
            if (failing) throw failing;
            for (const name of [mainName(slot), backupName(slot), `${mainName(slot)}.tmp`]) files.delete(name);
        },
        async folder() { return disk.folderPath; },
        async openFolder() { disk.opened++; },
        async claimCloseSave() { disk.claimed++; },
        async closeWindow() { disk.closed++; log.push(['close']); }
    };
    return disk;
}
