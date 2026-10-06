import { filterOptions, nearestOptions } from '../../utils/constants';

/** The panel's lists, as plain functions. Kept out of `RulesLine.jsx` because a component file that also exports helpers breaks Vite's hot reload; shared by the line (what Enter and the arrows pick) and the panel (what is drawn), so the highlighted option is always the one that commits. */

/** ⚠️ The item and Token vocabularies run to hundreds; a short list plus a count keeps typing the fast path. */
export const LIST_CAP = 30;

export function visibleOptions(slot, query) {
  const typed = (query || '').trim();
  const hits = typed ? filterOptions(slot, typed) : (slot?.options || []);
  if (typed && hits.length === 0) {
    // Not a word here, so offer the nearest real ones instead of nothing.
    const near = nearestOptions(slot, typed);
    return { shown: near, total: near.length, near: true };
  }
  return { shown: hits.slice(0, LIST_CAP), total: hits.length, near: false };
}

export function visibleSuggestions(slot, query) {
  const typed = (query || '').trim().toLowerCase();
  const all = (slot?.suggestions || []).filter((t) => !typed || t.toLowerCase().includes(typed));
  return { shown: all.slice(0, LIST_CAP).map((t) => ({ id: t, label: t })), total: all.length, near: false };
}
