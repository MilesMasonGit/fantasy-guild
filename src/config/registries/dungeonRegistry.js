// Fantasy Guild - Dungeon Registry
// Phase 34: Dungeon Cards - Sequential Combat

/**
 * DungeonRegistry - Defines templates for dungeon encounters.
 * 
 * Each dungeon has:
 * - id: unique identifier
 * - name: display name
 * - description: user-facing text
 * - enemies: an ordered list of enemy IDs to fight in sequence
 * - rewards: items given only on completion of the FINAL enemy
 * - xpRewards: skill XP given only on completion of the FINAL enemy
 */

export const DUNGEONS = Object.freeze({
    crypt_walk: {
        id: 'crypt_walk',
        name: 'The Forgotten Crypt',
        description: 'A damp, lightless tunnel filled with restless spirits. Three challenges await within.',
        enemies: [
            'guild_hall_t1_skeleton',
            'guild_hall_t1_skeleton',
            'guild_hall_t1_skeleton_guildmaster'
        ],
        rewards: [
            { itemId: 'bone', count: 10 },
            { itemId: 'raw_meat', count: 5 }
        ],
        xpRewards: [
            { skill: 'melee', amount: 500 },
            { skill: 'occult', amount: 500 }
        ]
    },

    wolf_den: {
        id: 'wolf_den',
        name: 'Alpha\'s Den',
        description: 'Sweep the den and face the pack leader.',
        enemies: [
            'forest_t1_wolf',
            'forest_t1_wolf',
            'forest_t1_wolf'
        ],
        rewards: [
            { itemId: 'leather', count: 10 },
            { itemId: 'wolf_fang', count: 5 }
        ],
        xpRewards: [
            { skill: 'melee', amount: 300 }
        ]
    }
});

/**
 * Get a dungeon by ID
 * @param {string} dungeonId 
 * @returns {Object|null}
 */
export function getDungeon(dungeonId) {
    return DUNGEONS[dungeonId] || null;
}

/**
 * Get all dungeons
 * @returns {Object}
 */
export function getAllDungeons() {
    return DUNGEONS;
}
