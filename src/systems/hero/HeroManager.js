// Fantasy Guild - Hero Manager (Dispatcher)
// Refactored to delegate logic to specialized processors in logic/

import * as Lifecycle from './logic/HeroLifecycle.js';
import * as Lookup from './logic/HeroLookup.js';
import * as Roster from './logic/HeroRoster.js';
import * as State from './logic/HeroState.js';
import * as Rehydration from './logic/HeroRehydration.js';

import { AssignmentSystem } from '../global/AssignmentSystem.js';

// --- Lifecycle Exports ---
export const createHero = Lifecycle.createHero;
export const addHero = Lifecycle.addHero;
export const retireHero = Lifecycle.retireHero;

// --- Lookup Exports ---
export const getHero = Lookup.getHero;
export const getAllHeroes = Lookup.getAllHeroes;
export const getHeroCount = Lookup.getHeroCount;
export const getBenchCount = Lookup.getBenchCount;
export const getBench = Lookup.getBench;
export const getHeroesByStatus = Lookup.getHeroesByStatus;
export const getIdleHeroes = Lookup.getIdleHeroes;
export const getHeroLevel = Lookup.getHeroLevel;
export const getHeroClass = Lookup.getHeroClass;

// --- Roster Exports ---
export const moveHeroToBench = Roster.moveHeroToBench;
export const moveHeroToActive = Roster.moveHeroToActive;
export const reorderHero = Roster.reorderHero;

// --- State Exports ---
export const setHeroStatus = State.setHeroStatus;
export const setAssignment = State.setAssignment;
export const updateHeroProfile = State.updateHeroProfile;

export const modifyHeroHp = State.modifyHeroHp;
export const modifyHeroEnergy = State.modifyHeroEnergy;

// --- Rehydration Exports ---
export const rehydrateHero = Rehydration.rehydrateHero;
export const updateHeroSkillModifiers = Rehydration.updateHeroSkillModifiers;

// --- Assignment System Facades (for backward compatibility) ---

/**
 * Assign hero to a card (DEPRECATED: Use AssignmentSystem.assignHero)
 */
export function assignHeroToCard(heroId, cardId) {
    return AssignmentSystem.assignHero(heroId, cardId);
}

/**
 * Unassign hero from their current card
 */
export function unassignHero(heroId) {
    return AssignmentSystem.unassignHero(heroId);
}
