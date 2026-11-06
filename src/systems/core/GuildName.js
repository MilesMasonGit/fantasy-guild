// the Guild's name: given on the new-game screen, shown on its save slot, renamed in Settings

import { GameState } from '../../state/GameState.js';

/** The longest name a Guild may have, so a slot's title never has to wrap. */
export const GUILD_NAME_MAX = 24;

/** A name as kept: trimmed, inner runs of spaces made one, cut to {@link GUILD_NAME_MAX}; null when nothing is left. */
export function cleanGuildName(text) {
    const name = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, GUILD_NAME_MAX).trim();
    return name || null;
}

/** The Guild's name in a game's state, or null (a game from before Guilds had names). */
export function guildNameOf(state = GameState.state) {
    return cleanGuildName(state?.meta?.guildName);
}

/** Rename the Guild of the game being played. False when there is no game or nothing is left of the name. */
export function renameGuild(text) {
    const meta = GameState.state?.meta;
    const name = cleanGuildName(text);
    if (!meta || !name) return false;
    meta.guildName = name;
    return true;
}
