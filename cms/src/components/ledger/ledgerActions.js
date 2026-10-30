import { useEntityStore } from '../../stores/useEntityStore';
import { planPatch } from '../../engine/ledgerRows';

/** What the Ledger's pages do to the workspace: open an entry's editor, write its plan block. */

/** Open an entry in its editor: a recipe in the recipe view, an item or a Token in the entity editor. */
export function openInEditor(key, setCurrentView) {
  const store = useEntityStore.getState();
  const at = key.indexOf(':');
  const kind = key.slice(0, at);
  const id = key.slice(at + 1);
  if (kind === 'recipe') {
    store.focusRecipe(id);
    setCurrentView?.('recipes');
  } else {
    store.setActiveEntity(id, kind === 'item' ? 'item' : 'token');
    setCurrentView?.('editor');
  }
}

/** Write part of one row's plan block, where its record lives. */
export function writePlan(row, patch) {
  const store = useEntityStore.getState();
  if (row.kind === 'recipe') {
    const record = (store.recipePools[row.poolSkill] || [])[row.index];
    if (record) store.updateRecipe(row.poolSkill, row.index, planPatch(record, patch));
  } else if (row.collection === 'items') {
    const record = store.items[row.id];
    if (record) store.updateItem(row.id, planPatch(record, patch));
  } else {
    const record = store.tokens[row.id];
    if (record) store.updateToken(row.id, planPatch(record, patch));
  }
}
