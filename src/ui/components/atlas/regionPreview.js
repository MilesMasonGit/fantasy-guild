// a settled Region as the world map drawer's preview draws it: its ground and its Tokens

import * as Atlas from '../../../systems/atlas/Atlas.js';
import { GameState } from '../../../state/GameState.js';
import { isGuildHall } from '../../../systems/board/MatCap.js';
import { isQuestToken } from '../../../systems/quests/QuestTokens.js';

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
