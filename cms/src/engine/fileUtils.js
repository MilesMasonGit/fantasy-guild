import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useEntityStore } from '../stores/useEntityStore';

/**
 * Downloads a complete backup of the CMS state as a JSON file.
 */
export function exportWorkspace() {
  const state = useEntityStore.getState();
  const backup = {
    items: state.items,
    tasks: state.tasks,
    recipes: state.recipes,
    encounters: state.encounters,
    workstations: state.workstations,
    enemies: state.enemies,
    areas: state.areas,
    quests: state.quests,
    subskills: state.subskills,
    effects: state.effects,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  saveAs(blob, `cms-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

/**
 * Reads a JSON file and applies it to the CMS state.
 */
export async function importWorkspace(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const state = useEntityStore.getState();
        // Hydrate the store
        state.hydrate(data);
        resolve();
      } catch (err) {
        reject(new Error('Failed to parse backup file. Invalid JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

/**
 * Generates a ZIP file containing individual JSON files for each registry,
 * formatted exactly as the game engine expects them (as arrays).
 */
export async function exportGamePackage() {
  const state = useEntityStore.getState();
  const zip = new JSZip();

  // Convert dictionary objects to arrays for game engine
  const formatRegistry = (registry) => Object.values(registry || {});

  zip.file('items.json', JSON.stringify(formatRegistry(state.items), null, 2));
  zip.file('tasks.json', JSON.stringify(formatRegistry(state.tasks), null, 2));
  zip.file('recipes.json', JSON.stringify(formatRegistry(state.recipes), null, 2));
  zip.file('encounters.json', JSON.stringify(formatRegistry(state.encounters), null, 2));
  zip.file('workstations.json', JSON.stringify(formatRegistry(state.workstations), null, 2));
  zip.file('enemies.json', JSON.stringify(formatRegistry(state.enemies), null, 2));
  zip.file('areas.json', JSON.stringify(formatRegistry(state.areas), null, 2));
  zip.file('quests.json', JSON.stringify(formatRegistry(state.quests), null, 2));
  zip.file('subskills.json', JSON.stringify(formatRegistry(state.subskills), null, 2));
  zip.file('effects.json', JSON.stringify(formatRegistry(state.effects), null, 2));

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `fantasy_guild_export_${new Date().toISOString().slice(0, 10)}.zip`);
}
