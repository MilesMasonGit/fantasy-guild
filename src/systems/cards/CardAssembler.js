/**
 * Card Assembler (Facade)
 * Decomposed into specialized logic modules in assembler/
 */

import * as TraitRegistry from './assembler/TraitRegistry.js';
import * as ModularSyncer from './assembler/ModularSyncer.js';
import * as SlotMapper from './assembler/SlotMapper.js';

// --- Trait Generation Exports ---
export const generateTaskTraits = TraitRegistry.generateTaskTraits;
export const generateBlueprintTraits = TraitRegistry.generateBlueprintTraits;
export const generateCombatTraits = TraitRegistry.generateCombatTraits;
export const generateInvasionTraits = TraitRegistry.generateInvasionTraits;
export const generateDungeonTraits = TraitRegistry.generateDungeonTraits;
export const generateProjectTraits = TraitRegistry.generateProjectTraits;

// --- Synchronization & Modularity Exports ---
export const isModular = ModularSyncer.isModular;
export const ensureModular = ModularSyncer.ensureModular;

// --- Mapping & Data Projection Exports ---
export const buildSlotsFromTraits = SlotMapper.buildSlotsFromTraits;

/**
 * Note: MODULE_ORDER and other rigid layout constants have been 
 * removed as they are now handled by the UI layer (CardView.jsx).
 */
