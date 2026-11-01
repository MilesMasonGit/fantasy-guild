import { HALL_STARS_FILE, normaliseHallSky } from '../../../src/config/hallStars.js';

/**
 * The Guild Hall's authored sky in the workspace: two collections keyed by id, `hallConstellations`
 * and `hallStars` (the game's shapes, `src/config/hallStars.js`). Sync writes `data/hallStars.json`
 * from them as `{ constellations, stars }`, leaving out a star with no rank.
 *
 * ⚠️ Null means this workspace never held a sky (an older workspace, or one restored before any
 * existed): Sync then leaves `data/hallStars.json` alone, as it does the Starter Camp and the perks.
 */

export { HALL_STARS_FILE };

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** One collection as the workspace keeps it: keyed by id, or null when there is none to hold. */
function keyedOrNull(value) {
  if (!isPlainObject(value)) return null;
  const out = {};
  for (const [id, record] of Object.entries(value)) {
    if (isPlainObject(record)) out[id] = { ...record, id: record.id || id };
  }
  return out;
}

/**
 * The workspace's two collections from `data/hallStars.json` (or a backup holding them), or nulls
 * when it holds none. A backup keeps the workspace's own keys; the file its own.
 * @returns {{ hallConstellations: object|null, hallStars: object|null }}
 */
export function workspaceSkyFrom(data) {
  const file = isPlainObject(data?.hallSky) ? data.hallSky : null;
  return {
    hallConstellations: keyedOrNull(data?.hallConstellations ?? file?.constellations),
    hallStars: keyedOrNull(data?.hallStars ?? file?.stars),
  };
}

/** Whether the workspace holds a sky to write (either collection, even an empty one). */
export function holdsSky(workspace) {
  return workspace?.hallConstellations != null || workspace?.hallStars != null;
}

/** What Sync writes into `data/`: both collections, normalised, keyed by id. */
export function hallSkyFile(workspace) {
  const { constellations, stars } = normaliseHallSky({
    constellations: workspace?.hallConstellations || {},
    stars: workspace?.hallStars || {},
  });
  return {
    constellations: Object.fromEntries(constellations.map((c) => [c.id, c])),
    stars: Object.fromEntries(stars.map((s) => [s.id, s])),
  };
}

/** The stars and constellations a file holds, keyed for the Sync guard. */
export function keyedHallSky(file) {
  const out = new Map();
  const { constellations, stars } = normaliseHallSky(file || {});
  for (const c of constellations) out.set(`constellation:${c.id}`, c.name);
  for (const s of stars) out.set(`star:${s.id}`, s.name);
  return out;
}
