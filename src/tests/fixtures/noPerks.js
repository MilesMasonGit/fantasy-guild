// Fantasy Guild — tests: take the shipped milestone perks off.

import { registerSkillPerks, skillsWithPerks } from '../../config/registries/perkRegistry.js';

/**
 * Clear every skill's perk table, for a test about something other than perks. The tables are
 * content (`data/skillPerks.json`, written by the CMS), and a test hero at a perk's level holds it:
 * works faster, rolls for double loot or levels up with an extra alert. Lasts for the test file
 * (each file loads its own registry); a test may register its own fixture tables after it.
 */
export function withoutShippedPerks() {
    registerSkillPerks(Object.fromEntries(skillsWithPerks().map(skillId => [skillId, { perks: [] }])));
}
