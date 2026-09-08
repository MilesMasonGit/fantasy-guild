import { saveAs } from 'file-saver';
import { useEntityStore } from '../stores/useEntityStore';
import { useGlobalStore } from '../stores/useGlobalStore';
import { syncFiles } from './recipeSync';

/**
 * Workspace save, load, and one-way game data sync (CMS-53).
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

/**
 * One-way full-file sync to project `data/` directory (CMS-53).
 * Runs the economy recalculation, then writes `data/items.json`,
 * `data/tokens.json`, `data/maps.json`, `data/tokenRecipes.json` and
 * `data/effects.json`.
 *
 * All five files are written from the recalculation's output — recipes
 * included, since the bypass that routed them around it is retired, and the
 * effect library, which `tokens.json` is now only a set of references into.
 *
 * ⚠️ **Sync writes from the STORE, never from `data/`.** Loading a workspace
 * backup is what puts content in the store; a browser that has never loaded one
 * syncs whatever it happens to hold. The recalculation's write-back deletes the
 * retired fields on the way past, so a stale workspace cannot put them back
 * into the game files — but it can still overwrite `data/` with older content.
 *
 * @returns {Promise<{ success: boolean, filesWritten: Array<string> }>}
 */
export async function syncToGame() {
  const state = useEntityStore.getState();
  const globals = useGlobalStore.getState();

  // Run full economy recalculation before sync so output is 100% consistent
  const balanced = state.recalculateEconomy(globals);

  const payload = { files: syncFiles(balanced) };

  const response = await fetch('/api/sync-game-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown sync error' }));
    throw new Error(err.error || 'Failed to sync game data');
  }

  return response.json();
}
