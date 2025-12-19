// Fantasy Guild - Recruit Cost Calculator
// Determines cost to recruit based on completed Projects

import { GameState } from '../state/GameState.js';

/**
 * Project tier bonuses to recruit cost
 * Each completed project adds to the base recruit cost
 */
const TIER_BONUS = {
    1: 1,   // T1 adds 1
    2: 5,   // T2 adds 5
    3: 10,  // T3 adds 10
    4: 15,  // T4 adds 15
    5: 20   // T5 adds 20
};

/** Base cost to recruit (before any projects) */
export const BASE_RECRUIT_COST = 10;

/**
 * Calculate current recruit cost based on completed Projects and total recruits
 * 
 * Formula: BASE_COST + sum(Project tier bonuses) + (2 * totalRecruits)
 * 
 * Example: 3 T1 projects (3) + 1 T2 project (5) + 2 recruits (4) + base (10) = 22
 * 
 * @returns {number} Current recruit cost
 */
export function calculateRecruitCost() {
    const completedProjects = GameState.progress?.completedProjects || [];
    const totalRecruits = GameState.currency?.totalRecruits || 0;

    let bonus = 0;
    for (const project of completedProjects) {
        const tier = project.tier || 1;
        bonus += TIER_BONUS[tier] || 0;
    }

    const recruitBonus = totalRecruits * 2;

    return BASE_RECRUIT_COST + bonus + recruitBonus;
}

/**
 * Get a breakdown of the recruit cost
 * @returns {Object} { baseCost, bonus, total, projectCount }
 */
export function getRecruitCostBreakdown() {
    const completedProjects = GameState.progress?.completedProjects || [];

    let bonus = 0;
    for (const project of completedProjects) {
        const tier = project.tier || 1;
        bonus += TIER_BONUS[tier] || 0;
    }

    return {
        baseCost: BASE_RECRUIT_COST,
        bonus,
        total: BASE_RECRUIT_COST + bonus,
        projectCount: completedProjects.length
    };
}
