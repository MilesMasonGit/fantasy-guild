// The Guild Hall upgrade web's 'which upgrade is inspected' fallback chain, a pure, testable
// selector.

/**
 * The upgrade the Guild Hall's inspection panel should show, or `null` for none. The star under
 * the pointer (`hoveredUpgradeId`) shows first, without pinning anything; then three sources,
 * in order:
 *   1. the `guild` pane's own explicit selection (`ui.inspect.getByPane('guild')`);
 *   2. the generic inspector's selection, if it happens to be a guild upgrade;
 *   3. the web's own 'last picked' id (`selectedUpgradeId`), so clicking a node keeps it inspected even if nothing explicitly set the pane.
 * ⚠️ A Close handler that clears only source 1 falls straight through to the same upgrade on
 * the next render, so Close looks like it did nothing: the call site must clear
 * `selectedUpgradeId` too. This function just makes the chain's own contract explicit and
 * testable: give it `null` for every source and it gives back `null`.
 */
export function selectGuildInspectSelection({
    hoveredUpgradeId = null,
    guildPaneSelection = null,
    globalSelection = null,
    selectedUpgradeId = null,
    getUpgradeDefFn
}) {
    const hovered = hoveredUpgradeId != null ? getUpgradeDefFn(hoveredUpgradeId) : null;
    if (hovered) return { type: 'guild_upgrade', id: hovered.id, upgradeDef: hovered, pane: 'guild' };
    if (guildPaneSelection) return guildPaneSelection;
    if (globalSelection?.type === 'guild_upgrade') return globalSelection;
    if (selectedUpgradeId == null) return null;
    const def = getUpgradeDefFn(selectedUpgradeId);
    return def ? { type: 'guild_upgrade', id: def.id, upgradeDef: def, pane: 'guild' } : null;
}

export default selectGuildInspectSelection;
