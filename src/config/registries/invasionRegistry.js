// Fantasy Guild - Invasion Registry
// Phase 32: Invasion System - Invasion Templates

/**
 * InvasionRegistry - Defines templates for invasion events.
 * 
 * Each invasion has:
 * - id: unique identifier
 * - name: display name
 * - description: user-facing text
 * - enemyId: the primary enemy type (from enemyRegistry)
 * - count: total enemies in the horde
 * - threatRate: threat points gained per second (Game Time)
 * - maxThreat: usually 100
 * - milestones: triggers for debuffs [ { threat, debuffId, stacks } ]
 * - rewards: items given on completion
 * - xpRewards: skill XP given on completion
 */


export const INVASIONS = {
    chicken_raid: {
        id: 'chicken_raid',
        name: 'The Feathered Menace',
        description: 'An unnatural number of chickens have descended upon the guild. They are everywhere.',
        enemyId: 'farmland_t1_chicken',
        count: 50,
        threatRate: 0.5, // 200 seconds to full threat
        maxThreat: 100,
        milestones: [
            { threat: 25, debuffId: 'spoilage', stacks: 1 },
            { threat: 50, debuffId: 'clumsiness', stacks: 1 },
            { threat: 75, debuffId: 'thorns', stacks: 1 },
            { threat: 100, debuffId: 'rotten_food', stacks: 2 }
        ],
        rewards: [
            { itemId: 'feather', count: 50 },
            { itemId: 'raw_chicken', count: 20 }
        ],
        xpRewards: [
            { skill: 'nature', amount: 500 }
        ]
    },

    wolf_pack_siege: {
        id: 'wolf_pack_siege',
        name: 'Night of the Crimson Moon',
        description: 'A massive wolf pack has been driven from the forest. They are hunting anything that moves.',
        enemyId: 'forest_t1_wolf',
        count: 20,
        threatRate: 1.0, // 100 seconds to full threat
        maxThreat: 100,
        milestones: [
            { threat: 10, debuffId: 'fear', stacks: 1 },
            { threat: 30, debuffId: 'natures_wrath', stacks: 1 },
            { threat: 60, debuffId: 'fear', stacks: 2 },
            { threat: 90, debuffId: 'plunder', stacks: 1 }
        ],
        rewards: [
            { itemId: 'leather', count: 15 },
            { itemId: 'wolf_fang', count: 5 }
        ],
        xpRewards: [
            { skill: 'melee', amount: 1000 },
            { skill: 'defence', amount: 500 }
        ]
    },

    skeleton_onslaught: {
        id: 'skeleton_onslaught',
        name: 'The Rattle of Bones',
        description: 'An ancient crypt has burst open, and a legion of skeletons is marching on your guild.',
        enemyId: 'guild_hall_t1_skeleton', // Could be randomized later
        count: 30,
        threatRate: 0.8,
        maxThreat: 100,
        milestones: [
            { threat: 20, debuffId: 'darkness', stacks: 1 },
            { threat: 40, debuffId: 'drain', stacks: 1 },
            { threat: 60, debuffId: 'cursed', stacks: 1 }, // Note: 'cursed' needs to be in threatRegistry if added
            { threat: 80, debuffId: 'despair', stacks: 1 }
        ],
        rewards: [
            { itemId: 'bone', count: 40 },
            { itemId: 'artifact_fragment', count: 1 }
        ],
        xpRewards: [
            { skill: 'magic', amount: 800 },
            { skill: 'occult', amount: 800 }
        ]
    },

    hostile_hens: {
        id: 'hostile_hens',
        name: 'Hostile Hens',
        description: 'A poultry uprising! The chickens are out for blood and they are incredibly annoying.',
        enemyId: 'farmland_t1_chicken',
        count: 10,
        threatRate: 1.0, // 100 seconds to full threat
        maxThreat: 100,
        milestones: [
            { threat: 0, debuffId: 'pecking_order', stacks: 1 },
            { threat: 20, debuffId: 'pecking_order', stacks: 2 },
            { threat: 40, debuffId: 'pecking_order', stacks: 3 },
            { threat: 60, debuffId: 'pecking_order', stacks: 4 },
            { threat: 80, debuffId: 'pecking_order', stacks: 5 }
        ],
        rewards: [
            { itemId: 'egg', count: 20 },
            { itemId: 'raw_chicken', count: 5 }
        ],
        xpRewards: [
            { skill: 'nature', amount: 200 }
        ]
    }
};

/**
 * Get an invasion by ID
 * @param {string} invasionId 
 * @returns {Object|null}
 */
export function getInvasion(invasionId) {
    return INVASIONS[invasionId] || null;
}

/**
 * Get all invasions
 * @returns {Object}
 */
export function getAllInvasions() {
    return { ...INVASIONS };
}
