
import { CARD_TYPES } from '../cardConstants.js';

export const COMBAT_CARDS = {
    // Forest Combat Cards
    combat_wolf: {
        id: 'combat_wolf',
        name: 'Hunt Wolf',
        cardType: CARD_TYPES.COMBAT,
        description: 'Hunt a wolf prowling the forest.',
        enemyId: 'forest_t1_wolf',
        biomeId: 'forest',
        skill: 'melee',
        skillRequirement: 0,
        isUnique: false,
        icon: '🐺'
    },

    combat_boar: {
        id: 'combat_boar',
        name: 'Hunt Wild Boar',
        cardType: CARD_TYPES.COMBAT,
        description: 'Take down a dangerous wild boar.',
        enemyId: 'forest_t1_boar',
        biomeId: 'forest',
        skill: 'melee',
        skillRequirement: 5,
        isUnique: false,
        icon: '🐗'
    },

    // Plains Combat Cards
    combat_rat: {
        id: 'combat_rat',
        name: 'Exterminate Rats',
        cardType: CARD_TYPES.COMBAT,
        description: 'Clear out the giant rat infestation.',
        enemyId: 'plains_t1_rat',
        biomeId: 'plains',
        skill: 'melee',
        skillRequirement: 0,
        isUnique: false,
        icon: '🐀'
    },

    combat_snake: {
        id: 'combat_snake',
        name: 'Snake Hunt',
        cardType: CARD_TYPES.COMBAT,
        description: 'Hunt grass snakes in the tall grass.',
        enemyId: 'plains_t1_snake',
        biomeId: 'plains',
        skill: 'ranged',
        skillRequirement: 0,
        isUnique: false,
        icon: '🐍'
    },

    // Mountain Combat Cards
    combat_goat: {
        id: 'combat_goat',
        name: 'Mountain Goat Hunt',
        cardType: CARD_TYPES.COMBAT,
        description: 'Hunt the sure-footed mountain goats.',
        enemyId: 'mountain_t1_goat',
        biomeId: 'mountain',
        skill: 'ranged',
        skillRequirement: 0,
        isUnique: false,
        icon: '🐐'
    },

    combat_eagle: {
        id: 'combat_eagle',
        name: 'Giant Eagle Hunt',
        cardType: CARD_TYPES.COMBAT,
        description: 'Bring down a giant eagle from the peaks.',
        enemyId: 'mountain_t1_eagle',
        biomeId: 'mountain',
        skill: 'ranged',
        skillRequirement: 5,
        isUnique: false,
        icon: '🦅'
    },

    // Cave Combat Cards
    combat_bat: {
        id: 'combat_bat',
        name: 'Clear Cave Bats',
        cardType: CARD_TYPES.COMBAT,
        description: 'Drive out the bats infesting the cave.',
        enemyId: 'cave_t1_bat',
        biomeId: 'cave',
        skill: 'melee',
        skillRequirement: 0,
        isUnique: false,
        icon: '🦇'
    },

    combat_spider: {
        id: 'combat_spider',
        name: 'Spider Slaying',
        cardType: CARD_TYPES.COMBAT,
        description: 'Destroy the giant spiders in the caverns.',
        enemyId: 'cave_t1_spider',
        biomeId: 'cave',
        skill: 'melee',
        skillRequirement: 5,
        isUnique: false,
        icon: '🕷️'
    },

    // Swamp Combat Cards
    combat_frog: {
        id: 'combat_frog',
        name: 'Frog Hunting',
        cardType: CARD_TYPES.COMBAT,
        description: 'Hunt the giant frogs lurking in the swamp.',
        enemyId: 'swamp_t1_frog',
        biomeId: 'swamp',
        skill: 'melee',
        skillRequirement: 0,
        isUnique: false,
        icon: '🐸'
    },

    combat_leech: {
        id: 'combat_leech',
        name: 'Leech Extermination',
        cardType: CARD_TYPES.COMBAT,
        description: 'Clear the leeches from the murky waters.',
        enemyId: 'swamp_t1_leech',
        biomeId: 'swamp',
        skill: 'melee',
        skillRequirement: 0,
        isUnique: false,
        icon: '🪱'
    }
};
