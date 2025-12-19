
import { CARD_TYPES } from '../cardConstants.js';

export const SPECIAL_CARDS = {
    // === Explore Card Template ===
    explore_wilderness: {
        id: 'explore_wilderness',
        name: 'Explore',
        cardType: CARD_TYPES.EXPLORE,
        description: 'Send a hero to discover new areas.',
        skill: 'nature',
        skillRequirement: 0,
        biomeId: null,
        isUnique: true,
        baseTickTime: 5000,
        explorePointsRequired: 5,
        areaOptions: 3,
        baseEnergyCost: 5,
        toolRequired: null,
        inputs: [
            { itemId: 'torch', quantity: 1 }
        ],
        outputs: [],
        xpAwarded: 10,
        icon: '🧭'
    },

    // === Recruit Card Template ===
    recruit: {
        id: 'recruit',
        name: 'Recruit Hero',
        cardType: CARD_TYPES.RECRUIT,
        description: 'Find a new hero to join your guild.',
        skill: null,
        skillRequirement: 0,
        biomeId: null,
        isUnique: false,
        baseTickTime: 0,
        baseEnergyCost: 0,
        toolRequired: null,
        inputs: [],
        outputs: [],
        xpAwarded: 0,
        candidateCount: 3,
        icon: '👤'
    },

    // === Dynamic Templates ===
    // Used by systems to create procedural cards

    explore_dynamic: {
        id: 'explore_dynamic',
        name: 'Explore Region',
        cardType: CARD_TYPES.EXPLORE,
        description: 'Explore a region to discover new areas.',
        skill: 'nature',
        skillRequirement: 0,
        biomeId: null,
        isUnique: true,
        baseTickTime: 5000,
        explorePointsRequired: 5,
        areaOptions: 3,
        baseEnergyCost: 5,
        toolRequired: null,
        inputs: [
            { itemId: 'torch', quantity: 1 }
        ],
        outputs: [],
        xpAwarded: 10,
        icon: '🗺️'
    },

    area_dynamic: {
        id: 'area_dynamic',
        name: 'Area',
        cardType: CARD_TYPES.AREA,
        description: 'An explored area with quests and projects.',
        skill: 'combat',
        skillRequirement: 0,
        biomeId: null,
        isUnique: true,
        baseTickTime: 0,
        baseEnergyCost: 0,
        toolRequired: null,
        inputs: [],
        outputs: [],
        xpAwarded: 0,
        icon: '📍'
    }
};
