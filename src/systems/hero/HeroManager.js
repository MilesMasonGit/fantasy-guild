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
export const getHeroesByStatus = Lookup.getHeroesByStatus;

// --- Roster Exports ---
export const reorderHero = Roster.reorderHero;

// --- State Exports ---
export const setHeroStatus = State.setHeroStatus;
export const updateHeroProfile = State.updateHeroProfile;

export const modifyHeroHp = State.modifyHeroHp;

// --- Rehydration Exports ---
export const rehydrateHero = Rehydration.rehydrateHero;
export const updateHeroFromSkills = Rehydration.updateHeroFromSkills;

export const HeroManager = {
    createHero,
    addHero,
    getRosterLimit,
    isRosterFull,
    getHero,
    getAllHeroes,
    getHeroesByStatus,
    reorderHero,
    setHeroStatus,
    updateHeroProfile,
    modifyHeroHp,
    rehydrateHero,
    updateHeroFromSkills
};
