// Fantasy Guild — the Guild Hall upgrade web's "which upgrade is inspected" fallback chain,
// extracted out of ReactRoot.jsx as a pure, testable selector (CR3-451).

/**
 * The upgrade the Guild Hall's inspection panel should show, or `null` for none.
 *
 * Three sources, in order:
 *   1. the `guild` pane's own explicit selection (`ui.inspect.getByPane('guild')`);
 *   2. the generic inspector's selection, if it happens to be a guild upgrade;
 *   3. the web's own "last picked" id (`selectedUpgradeId`), so clicking a node
 *      keeps it inspected even if nothing explicitly set the pane.
 *
 * CR3-451: the Close button only ever cleared source 1. Because source 3 was
 * never cleared alongside it, this chain fell straight through to the same
 * upgrade on the very next render — Close looked like it did nothing. The fix
 * is at the call site (clear `selectedUpgradeId` too); this function just
 * makes the chain's own contract explicit and testable: give it `null` for
 * every source and it gives back `null`.
 */
export function selectGuildInspectSelection({
    guildPaneSelection = null,
    globalSelection = null,
    selectedUpgradeId = null,
    getUpgradeDefFn
}) {
    if (guildPaneSelection) return guildPaneSelection;
    if (globalSelection?.type === 'guild_upgrade') return globalSelection;
    if (selectedUpgradeId == null) return null;
    const def = getUpgradeDefFn(selectedUpgradeId);
    return def ? { type: 'guild_upgrade', id: def.id, upgradeDef: def, pane: 'guild' } : null;
}

export default selectGuildInspectSelection;
