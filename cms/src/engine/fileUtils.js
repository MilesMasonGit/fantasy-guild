import { saveAs } from 'file-saver';
import { useEntityStore } from '../stores/useEntityStore';

/**
 * Workspace save and load — the CMS's own file format, not the game's.
 *
 * ## What used to be here
 * ~310 further lines of per-entity **projectors** (`projectItem`, `projectCard`,
 * `projectEnemy`, `projectQuest`, `projectArea`, `projectPassthrough`) plus
 * `buildGamePackage`/`exportGamePackage`, which turned the CMS's store shape
 * into the game's `data/` shape for the old merge-sync and the ZIP export.
 *
 * All of it went with CMS-53 and CMS-4. The projectors existed to emit "only
 * the fields the CMS models" so a field-level merge could preserve everything
 * else; a one-way **full-file write** has no such requirement, because the CMS
 * models everything in its scope and nothing is authored outside it. The new
 * write path is Phase 10's job and will be a much smaller thing: serialise
 * these three collections, write three files.
 *
 * What survives is the part that was never about the game's format at all —
 * saving and restoring the author's own working state.
 */

/** The collections a workspace file carries. One place, so save and load agree. */
function snapshot(state) {
    return {
        items: state.items,
        tokens: state.tokens,
        maps: state.maps,
        recipePools: state.recipePools,
    };
}

/** Download the whole workspace as a dated JSON file. */
export function exportWorkspace() {
    const blob = new Blob([JSON.stringify(snapshot(useEntityStore.getState()), null, 2)], {
        type: 'application/json',
    });
    saveAs(blob, `cms-workspace-${new Date().toISOString().slice(0, 10)}.json`);
}

/**
 * Read a workspace JSON file and replace the current workspace with it.
 *
 * ⚠️ Replaces rather than merges — `hydrate` overwrites all three collections.
 * Loading a backup discards unsaved work, exactly as it always did.
 */
export async function importWorkspace(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                useEntityStore.getState().hydrate(JSON.parse(e.target.result));
                resolve();
            } catch {
                reject(new Error('Failed to parse backup file. Invalid JSON.'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(file);
    });
}
