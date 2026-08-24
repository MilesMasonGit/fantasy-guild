// Fantasy Guild - Hero Manager (Dispatcher)
// Refactored to delegate logic to specialized processors in logic/

import * as Lifecycle from './logic/HeroLifecycle.js';
import * as Lookup from './logic/HeroLookup.js';
import * as Roster from './logic/HeroRoster.js';
import * as State from './logic/HeroState.js';
import * as Rehydration from './logic/HeroRehydration.js';

// --- Lifecycle Exports ---
export const createHero = Lifecycle.createHero;
export const addHero = Lifecycle.addHero;
export const getRosterLimit = Lifecycle.getRosterLimit;
export const isRosterFull = Lifecycle.isRosterFull;

// --- Lookup Exports ---
export const getHero = Lookup.getHero;
export const getAllHeroes = Lookup.getAllHeroes;
export const getHeroCount = Lookup.getHeroCount;
export const getHeroesByStatus = Lookup.getHeroesByStatus;
export const getIdleHeroes = Lookup.getIdleHeroes;
export const getHeroLevel = Lookup.getHeroLevel;

// --- Roster Exports ---
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

export const HeroManager = {
    createHero,
    addHero,
    getRosterLimit,
    isRosterFull,
    getHero,
    getAllHeroes,
    getHeroCount,
    getHeroesByStatus,
    getIdleHeroes,
    getHeroLevel,
    reorderHero,
    setHeroStatus,
    setAssignment,
    updateHeroProfile,
    modifyHeroHp,
    modifyHeroEnergy,
    rehydrateHero,
    updateHeroSkillModifiers
};

export default HeroManager;
