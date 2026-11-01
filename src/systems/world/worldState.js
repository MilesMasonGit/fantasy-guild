// this game's world as the save holds it (a leaf)

import { GameState } from '../../state/GameState.js';

/** This game's world (the live record: do not hand it to the screen), or null. */
export function currentWorld() {
    const world = GameState.state?.world;
    return world && Array.isArray(world.cells) ? world : null;
}
