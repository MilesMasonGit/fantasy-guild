import { beforeEach, afterEach } from 'vitest';
import { GUILD_UPGRADES, UPGRADE_SPRITES, placeholderPrices } from '../../config/guildUpgrades.js';

/**
 * A test-only star beyond Bank Tabs. Every shipped upgrade links to the Hall, so the web's
 * lock rule (a node opens once a linked node is bought) needs a node of its own to be tested.
 */
export const OUTER_UPGRADE_ID = 'test_outer_vault';

export const OUTER_UPGRADE = {
    id: OUTER_UPGRADE_ID,
    constellation: 'vault',
    name: 'Outer Vault',
    description: 'A test star beyond Bank Tabs.',
    node: { x: -0.95, y: 0 },
    links: ['bank_tabs'],
    maxRank: 3,
    prices: placeholderPrices(3),
    statLabel: rank => `${rank} vaults`,
    nextStatLabel: rank => `${rank + 1} vaults`,
    sprite: UPGRADE_SPRITES.bank_tabs
};

/** Add {@link OUTER_UPGRADE} to the web for every test of the calling file. */
export function useOuterUpgrade() {
    beforeEach(() => {
        if (!GUILD_UPGRADES.includes(OUTER_UPGRADE)) GUILD_UPGRADES.push(OUTER_UPGRADE);
    });
    afterEach(() => {
        const i = GUILD_UPGRADES.indexOf(OUTER_UPGRADE);
        if (i !== -1) GUILD_UPGRADES.splice(i, 1);
    });
}
