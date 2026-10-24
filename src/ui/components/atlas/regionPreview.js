// what the Region page shows of a settled Region: its ground as a preview plan, and its facts

import * as Atlas from '../../../systems/atlas/Atlas.js';
import { GameState } from '../../../state/GameState.js';
import { isGuildHall } from '../../../systems/board/MatCap.js';
import { flagCountOn } from '../../../systems/board/BoardState.js';
import { isQuestToken } from '../../../systems/quests/QuestTokens.js';
import { isLandmarkType, tokenName } from '../../../config/registries/tokenRegistry.js';
import { getLook } from '../../../config/registries/terrainRegistry.js';
import { STARTER_CAMP_BIOME } from '../../../config/areaBanners.js';

/**
 * The board Region `region` keeps: the live board for the one the guild is in (its record holds
 * none while the guild is there), else its frozen copy. Null when it has none.
 */
export function boardOf(region) {
    if (!region) return null;
    if (region.id === Atlas.activeRegionId()) return GameState.state?.board || null;
    return region.board || null;
}

/** The Region's own Tokens: everything on its board but the Hall and the quests, which travel with the guild. */
function ownTokens(board) {
    return Object.values(board?.tokens || {}).filter(t => t?.typeId && !isGuildHall(t) && !isQuestToken(t));
}

/**
 * Where the Hall stands on Region `region`: where it stands now in the Region the guild is in,
 * where it stood when the guild left, else null (the middle of the mat, where it lands on a first
 * visit).
 */
export function hallSpotOf(region) {
    const live = Object.values(GameState.state?.board?.tokens || {}).find(t => isGuildHall(t));
    if (!live) return null;
    const spot = region?.id === Atlas.activeRegionId() ? live : region?.travellers?.[live.id];
    return spot && Number.isFinite(spot.x) && Number.isFinite(spot.y) ? { x: spot.x, y: spot.y } : null;
}

/**
 * A settled Region as a plan `MapPreview` draws (`mapPreview.previewPicture`): its stored seed,
 * cell map and ground, and its Tokens where they stand on its board now. Read once when the Region
 * is chosen; the picture is not redrawn as its Tokens change.
 */
export function regionPlan(region) {
    if (!region) return null;
    const nodes = ownTokens(boardOf(region)).map(t => ({ typeId: t.typeId, x: t.x, y: t.y }));
    const hall = hallSpotOf(region);
    return {
        seed: region.seed,
        layout: { terrain: region.terrain || null, nodes, ...(hall ? { hallAt: hall } : {}) },
        summary: { ground: region.ground || null }
    };
}

/** A biome's name as the ground's look calls it ("flower_meadow" → "Flower meadow"). */
export function biomeName(id) {
    const name = getLook(id)?.name;
    if (name) return name;
    const words = String(id || '').replace(/_/g, ' ').trim();
    return words ? words[0].toUpperCase() + words.slice(1) : '';
}

/**
 * The biomes of Region `region`'s ground, main first: its maps' biomes, else meadow, the ground a
 * Region with no stored map is drawn with (`regionGround`).
 */
export function regionBiomes(region) {
    if (!region) return [];
    const main = region.ground?.main || null;
    const weights = region.biome && typeof region.biome === 'object' ? Object.keys(region.biome) : [];
    const ids = [...new Set([main, ...weights].filter(Boolean))];
    if (!ids.length) ids.push(STARTER_CAMP_BIOME);
    return ids;
}

/**
 * What the Region page says of Region `region`: its biomes, how many of its own Tokens stand on it,
 * how many heroes have a flag there, its landmarks (one entry per landmark type, with a count), and
 * its other Tokens by type, biggest count first (`contents`).
 */
export function regionFacts(region) {
    const board = boardOf(region);
    const tokens = ownTokens(board);
    const landmarks = new Map();
    const held = new Map();
    for (const t of tokens) {
        if (!isLandmarkType(t.typeId)) {
            held.set(t.typeId, (held.get(t.typeId) || 0) + 1);
            continue;
        }
        const entry = landmarks.get(t.typeId) || { typeId: t.typeId, name: tokenName(t.typeId) || t.typeId, count: 0 };
        entry.count++;
        landmarks.set(t.typeId, entry);
    }
    return {
        biomes: regionBiomes(region).map(biomeName),
        tokens: tokens.length,
        heroes: flagCountOn(board),
        landmarks: [...landmarks.values()],
        contents: [...held].map(([typeId, count], i) => ({ typeId, count, i }))
            .sort((a, b) => b.count - a.count || a.i - b.i)
            .map(({ typeId, count }) => ({ typeId, count }))
    };
}
