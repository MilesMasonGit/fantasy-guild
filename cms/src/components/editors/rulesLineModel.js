import { filterOptions, nearestOptions } from '../../utils/constants';

/**
 * The panel's lists, as plain functions (Rules Line P3).
 *
 * Kept out of `RulesLine.jsx` on purpose: a component file that also exports
 * helpers breaks Vite's hot reload for the whole editor, and these are shared
 * by the line (what Enter and the arrows pick) and the panel (what is drawn) —
 * one definition, so the highlighted option is always the one that commits.
 */

/**
 * How many options the panel lists at once.
 *
 * ⚠️ The item and Token vocabularies run to hundreds. Listing them all turns
 * "pick the item" into scrolling a wall; a short list plus a count keeps typing
 * the fast path, which is what a search is.
 */
export const LIST_CAP = 30;

/** What the panel shows for a vocabulary, given what has been typed. */
export function visibleOptions(slot, query) {
  const typed = (query || '').trim();
  const hits = typed ? filterOptions(slot, typed) : (slot?.options || []);
  if (typed && hits.length === 0) {
    // E-4: not a word here, so offer the nearest real ones instead of nothing.
    const near = nearestOptions(slot, typed);
    return { shown: near, total: near.length, near: true };
  }
  return { shown: hits.slice(0, LIST_CAP), total: hits.length, near: false };
}

/** A tag slot's suggestions, narrowed and capped the same way. */
export function visibleSuggestions(slot, query) {
  const typed = (query || '').trim().toLowerCase();
  const all = (slot?.suggestions || []).filter((t) => !typed || t.toLowerCase().includes(typed));
  return { shown: all.slice(0, LIST_CAP).map((t) => ({ id: t, label: t })), total: all.length, near: false };
}
