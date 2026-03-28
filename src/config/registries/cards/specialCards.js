// Fantasy Guild - Special Cards Registry
// System cards that require special handling

import { CARD_TYPES } from '../cardConstants.js';

export const SPECIAL_CARDS = {
    // === Recruit Card ===
    // Used by RecruitSystem - special card type with no traits
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
    },
    recruit_villager: {
        id: 'recruit_villager',
        name: 'Wandering Villager',
        cardType: CARD_TYPES.RECRUIT,
        description: 'Find a new villager to work in your guild.',
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
        icon: '🌾'
    },
};
